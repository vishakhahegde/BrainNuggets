// Cuts the figures Gemini picked out of the uploaded PDF, right in the browser.
// pdf.js is only loaded while a PDF is being processed.
const RENDER_SCALE = 2;
const MAX_WIDTH = 1000;
const MAX_BYTES = 300 * 1024; // stays well under Firestore's 1 MiB document limit
const MARGIN = 0.04;
const STEP = 0.01; // grow a cut side by 1% of the page at a time
const GAP = 0.012; // a side is clean once this much blank space sits at its edge
const MAX_GROW = 0.35; // never grow a side by more than 35% of the page

let pdfjsPromise;
function loadPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  return pdfjsPromise;
}

export async function loadPdf(file) {
  const pdfjs = await loadPdfjs();
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}

// Keeps the smaller encoding that fits: WebP where supported, JPEG otherwise.
function encode(canvas) {
  for (const type of ['image/webp', 'image/jpeg']) {
    for (let q = 0.85; q >= 0.4; q -= 0.15) {
      const url = canvas.toDataURL(type, q);
      if (!url.startsWith(`data:${type}`)) break; // browser can't encode this type
      if (url.length * 0.75 <= MAX_BYTES) return url;
    }
  }
  return null;
}

// Anything that isn't near-white: text, lines and coloured fills.
const isInk = (d, i) => d[i] < 200 || d[i + 1] < 200 || d[i + 2] < 200;

// Pushes each side of rect outward while ink runs across it (a label or leader
// line being cut), stopping at the first blank gap so body text nearby stays out.
// pixels is RGBA for the whole page; rect is { x0, y0, x1, y1 } in pixels.
export function expandToWhitespace(pixels, width, height, rect) {
  const r = { ...rect };
  const limit = {
    x0: Math.max(0, Math.round(r.x0 - MAX_GROW * width)), x1: Math.min(width, Math.round(r.x1 + MAX_GROW * width)),
    y0: Math.max(0, Math.round(r.y0 - MAX_GROW * height)), y1: Math.min(height, Math.round(r.y1 + MAX_GROW * height)),
  };
  const gapX = Math.max(2, Math.round(GAP * width)), gapY = Math.max(2, Math.round(GAP * height));
  const stepX = Math.max(1, Math.round(STEP * width)), stepY = Math.max(1, Math.round(STEP * height));

  // Ink anywhere in the strip [a, b) along one axis, across the rect's other axis.
  const columnsHaveInk = (a, b) => {
    for (let x = Math.max(0, a); x < Math.min(width, b); x++) {
      let n = 0;
      for (let y = r.y0; y < r.y1; y++) if (isInk(pixels, (y * width + x) * 4) && ++n >= 2) return true;
    }
    return false;
  };
  const rowsHaveInk = (a, b) => {
    for (let y = Math.max(0, a); y < Math.min(height, b); y++) {
      let n = 0;
      for (let x = r.x0; x < r.x1; x++) if (isInk(pixels, (y * width + x) * 4) && ++n >= 2) return true;
    }
    return false;
  };

  for (let moved = true; moved;) {
    moved = false;
    if (r.x0 > limit.x0 && columnsHaveInk(r.x0, r.x0 + gapX)) { r.x0 = Math.max(limit.x0, r.x0 - stepX); moved = true; }
    if (r.x1 < limit.x1 && columnsHaveInk(r.x1 - gapX, r.x1)) { r.x1 = Math.min(limit.x1, r.x1 + stepX); moved = true; }
    if (r.y0 > limit.y0 && rowsHaveInk(r.y0, r.y0 + gapY)) { r.y0 = Math.max(limit.y0, r.y0 - stepY); moved = true; }
    if (r.y1 < limit.y1 && rowsHaveInk(r.y1 - gapY, r.y1)) { r.y1 = Math.min(limit.y1, r.y1 + stepY); moved = true; }
  }
  return r;
}

// box is [ymin, xmin, ymax, xmax] in 0-1000 page units. Returns a data URL, or null.
export async function cropFigure(pdf, pageNumber, box) {
  if (pageNumber < 1 || pageNumber > pdf.numPages) return null;
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const full = document.createElement('canvas');
  full.width = Math.ceil(viewport.width);
  full.height = Math.ceil(viewport.height);
  const ctx = full.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, full.width, full.height);
  await page.render({ canvasContext: ctx, viewport, canvas: full }).promise;

  let [y0, x0, y1, x1] = box?.length === 4 ? box.map((n) => n / 1000) : [0, 0, 1, 1];
  if (y1 - y0 < 0.02 || x1 - x0 < 0.02) [y0, x0, y1, x1] = [0, 0, 1, 1];
  y0 = Math.max(0, y0 - MARGIN); x0 = Math.max(0, x0 - MARGIN);
  y1 = Math.min(1, y1 + MARGIN); x1 = Math.min(1, x1 + MARGIN);

  const W = full.width, H = full.height;
  const r = expandToWhitespace(ctx.getImageData(0, 0, W, H).data, W, H, {
    x0: Math.floor(x0 * W), y0: Math.floor(y0 * H), x1: Math.ceil(x1 * W), y1: Math.ceil(y1 * H),
  });
  const sx = r.x0, sy = r.y0, sw = r.x1 - r.x0, sh = r.y1 - r.y0;
  for (let scale = Math.min(1, MAX_WIDTH / sw); scale > 0.2; scale *= 0.75) {
    const out = document.createElement('canvas');
    out.width = Math.max(1, Math.round(sw * scale));
    out.height = Math.max(1, Math.round(sh * scale));
    out.getContext('2d').drawImage(full, sx, sy, sw, sh, 0, 0, out.width, out.height);
    const url = encode(out);
    if (url) return url;
  }
  return null;
}

// Cuts the figures Gemini picked out of the uploaded PDF, right in the browser.
// pdf.js is only loaded while a PDF is being processed.
const RENDER_SCALE = 2;
const MAX_WIDTH = 1000;
const MAX_BYTES = 300 * 1024; // stays well under Firestore's 1 MiB document limit
const MARGIN = 0.015; // breathing room around the box the model gave
const PAD = 0.012; // final white border around the cropped figure
const STEP = 0.01; // grow a cut side by 1% of the page at a time
const GAP = 0.012; // a side is clean once this much blank space sits at its edge
const MAX_GROW = 0.35; // never grow a side by more than 35% of the page

let pdfjsPromise;
let pdfjsLib;
function loadPdfjs() {
  pdfjsPromise ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    pdfjsLib = lib;
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

// Lines of running prose (paragraphs, captions) from the PDF's text layer, as pixel
// rects. Short text such as figure labels is left alone so it stays in the crop.
function proseRects(items, viewport, pageWidth) {
  const lines = [];
  const words = items
    .filter((it) => it.str?.trim())
    .map((it) => {
      const t = pdfjsLib.Util.transform(viewport.transform, it.transform);
      const h = Math.hypot(t[2], t[3]) || 1;
      return { x0: t[4], x1: t[4] + it.width * viewport.scale, base: t[5], h, chars: it.str.length, upright: Math.abs(t[1]) < Math.abs(t[0]) * 0.2 };
    })
    .filter((w) => w.upright)
    .sort((a, b) => a.base - b.base || a.x0 - b.x0);
  for (const w of words) {
    const line = lines.find((l) => Math.abs(l.base - w.base) < l.h * 0.5 && w.x0 - l.x1 < l.h * 1.5 && l.x0 - w.x1 < l.h * 1.5);
    if (line) {
      line.x0 = Math.min(line.x0, w.x0); line.x1 = Math.max(line.x1, w.x1);
      line.chars += w.chars + 1; line.h = Math.max(line.h, w.h);
    } else lines.push({ ...w });
  }
  // Long lines are prose; so are short lines that continue a paragraph (its first or
  // last line), i.e. sit right above or below a prose line and start at the same edge.
  lines.forEach((l) => { l.prose = l.chars >= 28 || l.x1 - l.x0 >= pageWidth * 0.3; });
  for (let changed = true; changed;) {
    changed = false;
    for (const l of lines) {
      if (l.prose) continue;
      if (lines.some((p) => p.prose && Math.abs(p.base - l.base) < p.h * 1.9 && Math.abs(p.x0 - l.x0) < p.h * 2.5)) {
        l.prose = true; changed = true;
      }
    }
  }
  return lines
    .filter((l) => l.prose)
    .map((l) => ({ x0: l.x0 - l.h * 0.2, x1: l.x1 + l.h * 0.2, y0: l.base - l.h * 1.05, y1: l.base + l.h * 0.35 }));
}

function maskFor(rects, width, height) {
  const mask = new Uint8Array(width * height);
  for (const r of rects) {
    const x0 = Math.max(0, Math.floor(r.x0)), x1 = Math.min(width, Math.ceil(r.x1));
    const y0 = Math.max(0, Math.floor(r.y0)), y1 = Math.min(height, Math.ceil(r.y1));
    for (let y = y0; y < y1; y++) mask.fill(1, y * width + x0, y * width + x1);
  }
  return mask;
}

// Tightest box around the ink inside rect that isn't prose; null if there is none.
function inkBounds(pixels, width, mask, rect) {
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let y = rect.y0; y < rect.y1; y++) {
    for (let x = rect.x0; x < rect.x1; x++) {
      const p = y * width + x;
      if (!mask[p] && isInk(pixels, p * 4)) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x0, y0, x1: x1 + 1, y1: y1 + 1 };
}

// Pushes each side of rect outward while ink runs across it (a label or leader
// line being cut), stopping at the first blank gap so body text nearby stays out.
// pixels is RGBA for the whole page; rect is { x0, y0, x1, y1 } in pixels; mask marks prose to ignore.
export function expandToWhitespace(pixels, width, height, rect, mask = new Uint8Array(width * height)) {
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
      for (let y = r.y0; y < r.y1; y++) if (!mask[y * width + x] && isInk(pixels, (y * width + x) * 4) && ++n >= 2) return true;
    }
    return false;
  };
  const rowsHaveInk = (a, b) => {
    for (let y = Math.max(0, a); y < Math.min(height, b); y++) {
      let n = 0;
      for (let x = r.x0; x < r.x1; x++) if (!mask[y * width + x] && isInk(pixels, (y * width + x) * 4) && ++n >= 2) return true;
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

async function renderPage(pdf, pageNumber) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  const text = await page.getTextContent().catch(() => ({ items: [] })); // scanned pages have none
  return { canvas, ctx, viewport, text };
}

// Works out the crop in page pixels: start from the model's box, trim away anything
// that isn't the figure (paragraphs, captions, white space), then grow to take in
// labels the box cut through. Prose never counts as part of a figure.
function figureRect(ctx, viewport, text, box, W, H) {
  let [y0, x0, y1, x1] = box?.length === 4 ? box.map((n) => n / 1000) : [0, 0, 1, 1];
  if (y1 - y0 < 0.02 || x1 - x0 < 0.02) [y0, x0, y1, x1] = [0, 0, 1, 1];
  const start = {
    x0: Math.max(0, Math.floor((x0 - MARGIN) * W)), y0: Math.max(0, Math.floor((y0 - MARGIN) * H)),
    x1: Math.min(W, Math.ceil((x1 + MARGIN) * W)), y1: Math.min(H, Math.ceil((y1 + MARGIN) * H)),
  };
  const pixels = ctx.getImageData(0, 0, W, H).data;
  const mask = maskFor(proseRects(text.items, viewport, W), W, H);
  const tight = inkBounds(pixels, W, mask, start) ?? start;
  const grown = expandToWhitespace(pixels, W, H, tight, mask);
  const r = inkBounds(pixels, W, mask, grown) ?? grown; // drop any overshoot from growing in steps
  return padAwayFromProse(r, mask, W, H, Math.round(PAD * W));
}

// A white border around the figure that stops short of any prose.
function padAwayFromProse(r, mask, W, H, pad) {
  const rowFree = (y, x0, x1) => { for (let x = x0; x < x1; x++) if (mask[y * W + x]) return false; return true; };
  const colFree = (x, y0, y1) => { for (let y = y0; y < y1; y++) if (mask[y * W + x]) return false; return true; };
  const out = { ...r };
  for (let k = 0; k < pad && out.y0 > 0 && rowFree(out.y0 - 1, out.x0, out.x1); k++) out.y0--;
  for (let k = 0; k < pad && out.y1 < H && rowFree(out.y1, out.x0, out.x1); k++) out.y1++;
  for (let k = 0; k < pad && out.x0 > 0 && colFree(out.x0 - 1, out.y0, out.y1); k++) out.x0--;
  for (let k = 0; k < pad && out.x1 < W && colFree(out.x1, out.y0, out.y1); k++) out.x1++;
  return out;
}

// The crop as fractions of the page, for checking. Same logic cropFigure uses.
export async function findFigureRect(pdf, pageNumber, box) {
  if (pageNumber < 1 || pageNumber > pdf.numPages) return null;
  const { canvas, ctx, viewport, text } = await renderPage(pdf, pageNumber);
  const W = canvas.width, H = canvas.height;
  const r = figureRect(ctx, viewport, text, box, W, H);
  return { x0: r.x0 / W, y0: r.y0 / H, x1: r.x1 / W, y1: r.y1 / H };
}

// box is [ymin, xmin, ymax, xmax] in 0-1000 page units. Returns a data URL, or null.
export async function cropFigure(pdf, pageNumber, box) {
  if (pageNumber < 1 || pageNumber > pdf.numPages) return null;
  const { canvas: full, ctx, viewport, text } = await renderPage(pdf, pageNumber);
  const W = full.width, H = full.height;
  const r = figureRect(ctx, viewport, text, box, W, H);
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

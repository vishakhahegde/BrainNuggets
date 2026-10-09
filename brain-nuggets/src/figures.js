// Cuts the figures Gemini picked out of the uploaded PDF, right in the browser.
// pdf.js is only loaded while a PDF is being processed.
const RENDER_SCALE = 2;
const MAX_WIDTH = 1000;
const MAX_BYTES = 300 * 1024; // stays well under Firestore's 1 MiB document limit
const MARGIN = 0.03;

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

  const sx = x0 * full.width, sy = y0 * full.height;
  const sw = (x1 - x0) * full.width, sh = (y1 - y0) * full.height;
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

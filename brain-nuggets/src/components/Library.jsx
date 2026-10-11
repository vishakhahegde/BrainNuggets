import { useEffect, useState } from 'react';
import { watchDocs, createDoc, patchDoc, saveChunk, removeDoc, USING_LOCAL_DB } from '../data';
import { processPdf } from '../api';
import { loadPdf, cropFigure } from '../figures';
import shelfArt from '../assets/library-shelf.webp';

const STALE_MS = 10 * 60 * 1000;

// Crops each figure the model picked; a figure that can't be cropped is dropped, never the chunk.
async function cropChunkFigures(pdf, index, figures = []) {
  const kept = [];
  const images = [];
  for (const f of figures) {
    const src = pdf && await cropFigure(pdf, f.page, f.box).catch((e) => { console.warn('[figure]', e); return null; });
    if (!src) continue;
    const key = `${index}_${kept.length}`;
    kept.push({ key, page: f.page, caption: f.caption, lookFor: f.lookFor, description: f.description });
    images.push({ key, src });
  }
  return { figures: kept, images };
}

async function runPipeline(uid, file) {
  const id = await createDoc(uid, file.name);
  const pdfReady = loadPdf(file).catch((e) => { console.warn('[figure] could not open PDF', e); return null; });
  let plan = [];
  let ready = 0;
  try {
    await processPdf(file, async (event) => {
      if (event.type === 'context') {
        plan = event.context.plan;
        await patchDoc(uid, id, {
          title: event.context.title,
          subject: event.context.subject,
          summary: event.context.summary,
          concepts: event.context.concepts,
          chunkCount: plan.length,
          totalMinutes: plan.reduce((s, p) => s + (p.minutes || 4), 0),
        });
      } else if (event.type === 'chunk') {
        ready += 1;
        const { pages, minutes } = plan[event.index];
        const { figures, images } = await cropChunkFigures(await pdfReady, event.index, event.chunk.figures);
        await saveChunk(uid, id, event.index, { ...event.chunk, figures, pages, minutes }, ready, images);
      } else if (event.type === 'done') {
        await patchDoc(uid, id, { status: 'ready' });
      } else if (event.type === 'error') {
        throw new Error(event.message);
      }
    });
  } catch (err) {
    await patchDoc(uid, id, { status: 'error', error: err.message });
  }
}

function statusLine(d) {
  const updated = d.updatedAt?.toMillis?.() ?? Date.now();
  if (d.status === 'error') return { text: d.error || 'Processing failed.', tone: 'error' };
  if (d.status === 'processing' && Date.now() - updated > STALE_MS) {
    return { text: 'Processing stopped before it finished. Remove it and upload again.', tone: 'error' };
  }
  if (d.status === 'processing') {
    return d.chunkCount
      ? { text: `Preparing chunks · ${d.readyCount} of ${d.chunkCount} ready` }
      : { text: 'Reading your PDF…' };
  }
  const done = d.done?.length ?? 0;
  if (done === d.chunkCount) return { text: `All ${d.chunkCount} chunks done` };
  return { text: `${done} of ${d.chunkCount} chunks done · about ${d.totalMinutes} min total` };
}

export default function Library({ uid, accountButton }) {
  const [docs, setDocs] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  const [slow, setSlow] = useState(false);

  useEffect(() => watchDocs(uid, setDocs, setLoadError), [uid]);

  // The Firestore SDK retries silently when the database is unreachable; say so.
  useEffect(() => {
    if (docs) return;
    const t = setTimeout(() => setSlow(true), 8000);
    return () => clearTimeout(t);
  }, [docs]);

  const connected = docs !== null;

  const handleFiles = (files) => {
    setUploadError(null);
    if (!connected) return setUploadError('Still connecting to your library. Try again in a moment.');
    const file = files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') return setUploadError('That file isn’t a PDF.');
    if (file.size > 18 * 1024 * 1024) return setUploadError('PDFs must be under 18MB.');
    runPipeline(uid, file);
  };

  const open = (d) => {
    if (d.readyCount > 0) window.location.hash = `#/doc/${d.id}`;
  };

  return (
    <div className="library">
      <header className="topbar">
        <span className="brand">Brain Nuggets{USING_LOCAL_DB && <span className="mode-tag">Local test mode</span>}</span>
        <div className="bar-actions">
          {accountButton}
        </div>
      </header>

      <main className="library-main">
        <h1>Your lectures</h1>

        <label
          className={`dropzone${dragging ? ' over' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        >
          <input
            type="file"
            accept="application/pdf"
            className="visually-hidden"
            onChange={(e) => { handleFiles(e.target.files); e.target.value = ''; }}
          />
          <span className="dropzone-title">Upload a lecture PDF</span>
          <span className="muted">Drop it here or click to choose. We’ll turn it into short, simple chunks.</span>
        </label>
        {uploadError && <p className="error-text" role="alert">{uploadError}</p>}

        {!connected && !loadError && slow && (
          <div className="notice" role="alert">
            <p>Can’t reach the Firestore database. Check that it exists in the Firebase console for this project.</p>
          </div>
        )}

        {loadError && (
          <div className="notice" role="alert">
            <p>Couldn’t load your lectures from Firestore ({loadError.code}).</p>
          </div>
        )}

        {docs?.length > 0 && (
          <ul className="doc-list">
            {docs.map((d) => {
              const s = statusLine(d);
              const pct = d.chunkCount ? Math.round(((d.done?.length ?? 0) / d.chunkCount) * 100) : 0;
              return (
                <li key={d.id} className="doc-row">
                  <div className="doc-info">
                    <span className="doc-title">{d.title}</span>
                    <span className={s.tone === 'error' ? 'error-text' : 'muted'}>{s.text}</span>
                    {d.status !== 'error' && d.chunkCount > 0 && (
                      <div className="progress" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
                    )}
                  </div>
                  <div className="doc-actions">
                    {d.readyCount > 0 && (
                      <button className="btn primary" onClick={() => open(d)}>
                        {(d.done?.length ?? 0) > 0 ? 'Continue' : 'Start'}
                      </button>
                    )}
                    <button
                      className="btn ghost"
                      onClick={() => { if (confirm(`Remove “${d.title}”?`)) removeDoc(uid, d.id); }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <img className="library-shelf" src={shelfArt} alt="" />
    </div>
  );
}

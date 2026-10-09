import { useEffect, useRef, useState } from 'react';
import { loadFigure } from '../data';
import Highlight from './Highlight';

// Loads a figure's image only when the chunk showing it is on screen.
function useFigureSrc(uid, docId, key) {
  const [src, setSrc] = useState(undefined);
  useEffect(() => {
    let live = true;
    setSrc(undefined);
    loadFigure(uid, docId, key).then((s) => live && setSrc(s), () => live && setSrc(null));
    return () => { live = false; };
  }, [uid, docId, key]);
  return src;
}

function Viewer({ src, figure, onClose }) {
  const closeRef = useRef();
  useEffect(() => {
    const opener = document.activeElement;
    closeRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab') { e.preventDefault(); closeRef.current?.focus(); } // only one control inside
    };
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, [onClose]);

  return (
    <div className="overlay figure-viewer" onClick={onClose}>
      <div className="figure-viewer-inner" role="dialog" aria-modal="true" aria-label={figure.caption} onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} className="btn secondary figure-close" onClick={onClose}>Close</button>
        <img className="figure-img" src={src} alt={figure.description} />
        <p>{figure.caption}</p>
      </div>
    </div>
  );
}

// One figure: the picture, a plain caption and a few "look for" pointers.
export function Figure({ uid, docId, figure, terms, showGuide = true }) {
  const src = useFigureSrc(uid, docId, figure.key);
  const [open, setOpen] = useState(false);
  if (src === null) return null; // image missing: show nothing rather than a broken box

  return (
    <figure className="figure-card">
      {src ? (
        <button className="figure-open" onClick={() => setOpen(true)} aria-label={`Enlarge picture: ${figure.caption}`}>
          <img className="figure-img" src={src} alt={figure.description} />
        </button>
      ) : (
        <div className="figure-placeholder" aria-hidden="true" />
      )}
      <figcaption>
        <p className="figure-caption"><Highlight text={figure.caption} terms={terms} /></p>
        {showGuide && figure.lookFor?.length > 0 && (
          <div className="figure-look">
            <span className="label">Look for</span>
            <ol>{figure.lookFor.map((l, i) => <li key={i}><Highlight text={l} terms={terms} /></li>)}</ol>
          </div>
        )}
        <p className="muted figure-source">From page {figure.page}{src && ' · tap the picture to enlarge'}</p>
      </figcaption>
      {open && <Viewer src={src} figure={figure} onClose={() => setOpen(false)} />}
    </figure>
  );
}

// The chunk's main figure, with any second one kept behind a button so the page stays calm.
export default function FigureCard({ uid, docId, figures, terms }) {
  const [showing, setShowing] = useState(0);
  if (!figures?.length) return null;
  const figure = figures[Math.min(showing, figures.length - 1)];
  return (
    <div className="figure-block">
      <Figure key={figure.key} uid={uid} docId={docId} figure={figure} terms={terms} />
      {figures.length > 1 && (
        <button className="link" onClick={() => setShowing((s) => (s + 1) % figures.length)}>
          {showing === 0 ? 'Show another picture' : 'Back to the first picture'}
        </button>
      )}
    </div>
  );
}

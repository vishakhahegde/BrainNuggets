import { Figure } from './FigureCard';

export default function OriginalView({ uid, docId, chunk, pageLabel }) {
  return (
    <div className="original">
      {pageLabel && <p className="muted">From the PDF, {pageLabel}</p>}
      {chunk.figures?.map((f) => (
        <Figure key={f.key} uid={uid} docId={docId} figure={f} showGuide={false} />
      ))}
      {chunk.original.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

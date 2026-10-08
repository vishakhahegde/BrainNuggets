export default function OriginalView({ chunk, pageLabel }) {
  return (
    <div className="original">
      {pageLabel && <p className="muted">From the PDF, {pageLabel}</p>}
      {chunk.original.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
    </div>
  );
}

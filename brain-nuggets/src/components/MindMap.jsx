export default function MindMap({ map }) {
  if (!map?.branches?.length) return <p className="muted">No mind map for this nugget.</p>;
  return (
    <div className="mindmap">
      <div className="mm-center">{map.center}</div>
      <ul className="mm-branches">
        {map.branches.map((b, i) => (
          <li key={i} className="mm-branch">
            <div className="mm-label">{b.label}</div>
            {b.children?.length > 0 && (
              <ul className="mm-children">
                {b.children.map((c, j) => <li key={j}>{c}</li>)}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

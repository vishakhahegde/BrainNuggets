// The chunk's key terms: just the names, each opening to its plain definition.
export default function KeyTerms({ terms }) {
  if (!terms?.length) return null;
  return (
    <section className="key-terms rail-card" aria-labelledby="key-terms-title">
      <h2 id="key-terms-title" className="label">Key terms <span className="count">· {terms.length}</span></h2>
      <div className="term-list">
        {terms.map((t) => (
          <details key={t.term} className="term-item">
            <summary>{t.term}</summary>
            <p>{t.definition}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

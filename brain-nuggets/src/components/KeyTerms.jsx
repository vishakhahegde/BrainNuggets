// The chunk's key terms with plain definitions, kept in view on every tab.
export default function KeyTerms({ terms }) {
  if (!terms?.length) return null;
  return (
    <section className="key-terms" aria-labelledby="key-terms-title">
      <h2 id="key-terms-title" className="label">Key terms</h2>
      <dl className="terms">
        {terms.map((t) => (
          <div key={t.term}><dt>{t.term}</dt><dd>{t.definition}</dd></div>
        ))}
      </dl>
    </section>
  );
}

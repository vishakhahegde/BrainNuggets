// Wraps key terms found in text with a highlighted term that reveals its definition.
export default function Highlight({ text, terms = [] }) {
  const usable = terms.filter((t) => t.term?.trim());
  if (!usable.length) return text;
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const sorted = [...usable].sort((a, b) => b.term.length - a.term.length);
  const re = new RegExp(`(${sorted.map((t) => escape(t.term)).join('|')})`, 'gi');
  const byTerm = new Map(usable.map((t) => [t.term.toLowerCase(), t.definition]));

  return text.split(re).map((part, i) => {
    const def = byTerm.get(part.toLowerCase());
    return def ? (
      <span key={i} className="term" tabIndex={0} data-def={def} aria-label={`${part}: ${def}`}>
        {part}
      </span>
    ) : part;
  });
}

import Highlight from './Highlight';
import FigureCard from './FigureCard';

export default function SimpleView({ uid, docId, chunk, variant, onShowFirst }) {
  const v = variant ?? chunk;
  const terms = chunk.keyTerms;
  return (
    <div className="simple">
      {variant && (
        <p className="variant-note">
          Explained with {variant.styleLabel}.{' '}
          <button className="link" onClick={onShowFirst}>Show first explanation</button>
        </p>
      )}
      <p className="big-idea"><Highlight text={v.bigIdea} terms={terms} /></p>
      <FigureCard key={chunk.title} uid={uid} docId={docId} figures={chunk.figures} terms={terms} />
      <ul className="bullets">
        {v.bullets.map((b, i) => <li key={i}><Highlight text={b} terms={terms} /></li>)}
      </ul>
      <div className="analogy">
        <span className="label">Think of it like this</span>
        <p><Highlight text={v.analogy} terms={terms} /></p>
      </div>
      {terms?.length > 0 && (
        <dl className="terms">
          {terms.map((t) => (
            <div key={t.term}><dt>{t.term}</dt><dd>{t.definition}</dd></div>
          ))}
        </dl>
      )}
    </div>
  );
}

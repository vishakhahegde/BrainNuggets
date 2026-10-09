import Highlight from './Highlight';
import FigureCard from './FigureCard';

export default function SimpleView({ uid, docId, chunk }) {
  const terms = chunk.keyTerms;
  return (
    <div className="simple">
      <p className="big-idea"><Highlight text={chunk.bigIdea} terms={terms} /></p>
      <FigureCard key={chunk.title} uid={uid} docId={docId} figures={chunk.figures} terms={terms} />
      <ul className="bullets">
        {chunk.bullets.map((b, i) => <li key={i}><Highlight text={b} terms={terms} /></li>)}
      </ul>
      <div className="analogy">
        <span className="label">Think of it like this</span>
        <p><Highlight text={chunk.analogy} terms={terms} /></p>
      </div>
    </div>
  );
}

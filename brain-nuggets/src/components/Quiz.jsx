import { useState } from 'react';
import { saveQuizResult } from '../data';

function Question({ q, qIndex, onResult }) {
  const [picked, setPicked] = useState(null);
  const [ruledOut, setRuledOut] = useState([]);
  const [attempts, setAttempts] = useState(0);
  const correct = picked === q.answerIndex;

  const choose = (i) => {
    if (picked !== null) return;
    const n = attempts + 1;
    setPicked(i);
    setAttempts(n);
    if (i === q.answerIndex) onResult({ correct: n === 1, attempts: n });
  };

  const retry = () => {
    setRuledOut((r) => [...r, picked]);
    setPicked(null);
  };

  return (
    <fieldset className="question">
      <legend><span className="muted">Question {qIndex + 1}</span>{q.question}</legend>
      <div className="options">
        {q.options.map((o, i) => (
          <button
            key={i}
            className={`option${picked === i ? (correct ? ' right' : ' picked') : ''}`}
            onClick={() => choose(i)}
            disabled={(picked !== null && picked !== i) || ruledOut.includes(i)}
            aria-pressed={picked === i}
          >
            {o}
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className={`feedback${correct ? ' right' : ''}`} role="status">
          {correct ? (
            <><strong>That’s it.</strong> {q.why}</>
          ) : (
            <>
              <strong>Not quite. Here’s another way to see it.</strong>
              <p>{q.reteach}</p>
              <button className="btn secondary" onClick={retry}>Try again</button>
            </>
          )}
        </div>
      )}
    </fieldset>
  );
}

export default function Quiz({ uid, docId, chunkIndex, quiz }) {
  if (!quiz?.length) return <p className="muted">No questions for this nugget.</p>;
  return (
    <div className="quiz">
      <p className="muted">Just a quick check. Nothing is graded.</p>
      {quiz.map((q, i) => (
        <Question
          key={i}
          q={q}
          qIndex={i}
          onResult={(r) => saveQuizResult(uid, docId, chunkIndex, i, r).catch(() => {})}
        />
      ))}
    </div>
  );
}

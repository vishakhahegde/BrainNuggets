import { useState } from 'react';
import { askTutor } from '../api';

export default function AskBox({ chunk, context }) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setLoading(true);
    setError(null);
    try {
      setAnswer(await askTutor(question, chunk, { title: context.title, concepts: context.concepts }));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="ask">
      <form onSubmit={submit}>
        <label htmlFor="ask-input" className="label">Stuck? Ask about this chunk</label>
        <div className="ask-row">
          <input
            id="ask-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. Why does this matter?"
            autoComplete="off"
          />
          <button className="btn secondary" disabled={loading || !question.trim()}>
            {loading ? 'Asking…' : 'Ask'}
          </button>
        </div>
      </form>
      {error && <p className="error-text" role="alert">{error}</p>}
      {answer && (
        <div className="answer" role="status">
          <p>{answer.answer}</p>
          {answer.found && <p className="muted">Based on your lecture notes.</p>}
        </div>
      )}
    </section>
  );
}

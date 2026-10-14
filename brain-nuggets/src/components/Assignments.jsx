import { useEffect, useState } from 'react';
import { watchAssignments, createAssignment, patchAssignment, removeAssignment } from '../data';
import { breakdownAssignment } from '../api';
import { BEHIND_TEXT, dayKey, dueLabel, planDays, startDayOf } from '../schedule';
import shelfArt from '../assets/library-shelf.webp';
import TopBar from './TopBar';

const STALE_MS = 10 * 60 * 1000;

const newId = () => Math.random().toString(36).slice(2, 10);

// Flattens the model's steps into one ordered task list; each task remembers its step.
const toTasks = (steps) =>
  steps.flatMap((s, step) => s.tasks.map((t) => ({ ...t, id: newId(), step, done: false })));

async function runBreakdown(uid, fields) {
  const id = await createAssignment(uid, {
    title: fields.title || 'New assignment',
    brief: fields.brief,
    dueDate: fields.dueDate,
    status: 'processing',
    steps: [],
    tasks: [],
  });
  try {
    const b = await breakdownAssignment({ ...fields, today: dayKey() });
    await patchAssignment(uid, id, {
      title: fields.title || b.title || 'New assignment',
      summary: b.summary,
      steps: b.steps.map((s) => s.name),
      tasks: toTasks(b.steps),
      status: 'ready',
    });
  } catch (err) {
    await patchAssignment(uid, id, { status: 'error', error: err.message });
  }
}

function statusLines(a) {
  const updated = a.updatedAt?.toMillis?.() ?? Date.now();
  if (a.status === 'error') return [{ text: a.error || 'Couldn’t break it down.', tone: 'error' }];
  if (a.status === 'processing') {
    return Date.now() - updated > STALE_MS
      ? [{ text: 'This stopped before it finished. Remove it and try again.', tone: 'error' }]
      : [{ text: 'Breaking it into small steps…' }];
  }
  const tasks = a.tasks ?? [];
  if (tasks.every((t) => t.done)) return [{ text: `All ${tasks.length} tasks done 🎉` }];
  const plan = planDays(tasks, a.dueDate, startDayOf(a));
  const lines = [
    { text: dueLabel(a.dueDate) },
    {
      text: plan.today.length
        ? `Today: ${plan.today.length} ${plan.today.length === 1 ? 'task' : 'tasks'} · ${plan.todayMinutes} min`
        : 'Today’s tasks are done ✓',
      tone: 'strong',
    },
  ];
  lines.push(plan.behind
    ? { text: BEHIND_TEXT, tone: 'behind' }
    : { text: 'On track', tone: 'ok' });
  return lines;
}

function NewAssignment({ uid, connected }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [brief, setBrief] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState(null);

  const reset = () => { setTitle(''); setBrief(''); setDueDate(''); setError(null); };

  const submit = (e) => {
    e.preventDefault();
    setError(null);
    if (!connected) return setError('Still connecting to your account. Try again in a moment.');
    if (!title.trim()) return setError('Give the assignment a title.');
    if (!brief.trim()) return setError('Paste or type what the teacher asked.');
    if (!dueDate) return setError('Pick a due date.');
    runBreakdown(uid, { title: title.trim(), brief: brief.trim(), dueDate });
    reset();
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="dropzone new-assignment" onClick={() => setOpen(true)}>
        <span className="dropzone-title">Add an assignment</span>
        <span className="muted">Tell us what you need to do. We’ll break it into 10-minute tasks.</span>
      </button>
    );
  }

  return (
    <form className="assignment-form" onSubmit={submit} noValidate>
      <h2 className="dropzone-title">Add an assignment</h2>
      <label className="form-field">
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. History paper on the causes of WW1" autoFocus />
      </label>
      <label className="form-field">
        <span>What did the teacher ask?</span>
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={4} placeholder="Paste or type the instructions." />
      </label>
      <label className="form-field due-field">
        <span>Due date</span>
        <input type="date" value={dueDate} min={dayKey()} onChange={(e) => setDueDate(e.target.value)} />
      </label>
      {error && <p className="error-text" role="alert">{error}</p>}
      <div className="form-actions">
        <button type="submit" className="btn primary">Break it down</button>
        <button type="button" className="btn ghost" onClick={() => { reset(); setOpen(false); }}>Cancel</button>
      </div>
    </form>
  );
}

export default function Assignments({ uid, accountButton }) {
  const [items, setItems] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => watchAssignments(uid, setItems, setLoadError), [uid]);

  return (
    <div className="library">
      <TopBar active="assignments" accountButton={accountButton} />

      <main className="library-main">
        <h1>Your assignments</h1>

        <NewAssignment uid={uid} connected={items !== null} />

        {loadError && (
          <div className="notice" role="alert">
            <p>Couldn’t load your assignments ({loadError.code}).</p>
          </div>
        )}

        {items?.length > 0 && (
          <ul className="doc-list">
            {items.map((a) => {
              const tasks = a.tasks ?? [];
              const doneCount = tasks.filter((t) => t.done).length;
              const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
              return (
                <li key={a.id} className="doc-row">
                  <div className="doc-info">
                    <span className="doc-title">{a.title}</span>
                    {statusLines(a).map((l) => (
                      <span key={l.text} className={l.tone === 'error' ? 'error-text' : `muted${l.tone ? ` line-${l.tone}` : ''}`}>{l.text}</span>
                    ))}
                    {a.status === 'ready' && (
                      <div className="progress" aria-hidden="true"><div style={{ width: `${pct}%` }} /></div>
                    )}
                  </div>
                  <div className="doc-actions">
                    {a.status === 'ready' && (
                      <a className="btn primary" href={`#/assignment/${a.id}`}>{doneCount > 0 ? 'Continue' : 'Start'}</a>
                    )}
                    <button
                      className="btn ghost"
                      onClick={() => { if (confirm(`Remove “${a.title}”?`)) removeAssignment(uid, a.id); }}
                    >
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <img className="library-shelf" src={shelfArt} alt="" />
    </div>
  );
}

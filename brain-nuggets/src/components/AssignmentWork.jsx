import { useEffect, useState } from 'react';
import { watchAssignment, patchAssignment } from '../data';
import { BEHIND_TEXT, dayKey, dueLabel, planDays, startDayOf } from '../schedule';
import SprintTimer from './SprintTimer';
import SidebarToggle from './SidebarToggle';
import { useSidebarCollapsed } from '../sidebar';

// One task at a time: the current task in the middle, the whole checklist on the side.
export default function AssignmentWork({ uid, assignmentId, comfortButton, accountButton }) {
  const [a, setA] = useState(undefined);
  const [currentId, setCurrentId] = useState(null);
  const [moreToday, setMoreToday] = useState(false);
  const [cheer, setCheer] = useState(null);
  const [sprintMinutes, setSprintMinutes] = useState(10);
  const [collapsed, toggleSidebar] = useSidebarCollapsed();

  useEffect(() => watchAssignment(uid, assignmentId, setA), [uid, assignmentId]);

  if (a === undefined) return <main className="centered"><p className="muted">Loading…</p></main>;
  if (!a || a.status !== 'ready') {
    return (
      <main className="centered">
        <div className="notice">
          <p>{a ? 'This assignment is still being broken down.' : 'This assignment was removed.'}</p>
          <a className="btn secondary" href="#/assignments">Back to your assignments</a>
        </div>
      </main>
    );
  }

  const today = dayKey();
  const tasks = a.tasks ?? [];
  const steps = a.steps ?? [];
  const plan = planDays(tasks, a.dueDate, startDayOf(a), today);
  const todayIds = new Set(plan.today.map((t) => t.id));
  const pending = tasks.filter((t) => !t.done);
  const doneCount = tasks.length - pending.length;
  const pct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;

  const chosen = tasks.find((t) => t.id === currentId && !t.done);
  const current = chosen ?? pending[0];
  const allDone = pending.length === 0;
  const todayDone = !allDone && !chosen && plan.today.length === 0 && !moreToday;

  const save = (next) => patchAssignment(uid, assignmentId, { tasks: next });

  const setDone = (task, done) =>
    save(tasks.map((t) => (t.id === task.id ? { ...t, done, doneOn: done ? today : null } : t)));

  const select = (id) => { setCurrentId(id); setCheer(null); };

  const finish = async (task) => {
    await setDone(task, true);
    select(null);
    setCheer(`Nice, ${doneCount + 1} down.`);
    setMoreToday(false); // ask again before starting another day's task
  };

  return (
    <div className={`study assignment-work${collapsed ? ' collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Assignment checklist">
        <div className="side-head">
          <a className="back-link" href="#/assignments">← All assignments</a>
          <SidebarToggle collapsed={collapsed} onToggle={toggleSidebar} />
        </div>
        <h2 className="side-title">{a.title}</h2>
        <div className="side-progress">
          <span className="muted">{doneCount} of {tasks.length} tasks done</span>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="task-groups">
          {steps.map((name, step) => {
            const inStep = tasks.filter((t) => t.step === step);
            if (!inStep.length) return null;
            return (
              <section key={step} className="task-group">
                <h3 className="label">{step + 1}. {name}</h3>
                <ul className="task-list">
                  {inStep.map((t) => (
                    <li key={t.id} className={`task-row${t.id === current?.id && !todayDone ? ' active' : ''}${t.done ? ' done' : ''}`}>
                      <button
                        className="task-check"
                        onClick={() => setDone(t, !t.done)}
                        aria-pressed={t.done}
                        aria-label={`${t.done ? 'Mark not done' : 'Mark done'}: ${t.title}`}
                      >
                        {t.done ? '✓' : ''}
                      </button>
                      <button className="task-link" onClick={() => select(t.id)} disabled={t.done}>
                        <span>{t.title}</span>
                        {todayIds.has(t.id) && <span className="today-tag">Today</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      </aside>

      <main className="study-main">
        <header className="study-bar">
          <div className="bar-left">
            <a className="back-link bar-back" href="#/assignments">← All assignments</a>
            <span className="muted">{dueLabel(a.dueDate, today)}</span>
          </div>
          <div className="bar-actions">
            {comfortButton}
            {accountButton}
          </div>
        </header>

        <div className="study-content">
          <div className="study-col">
            {allDone ? (
              <section className="chunk finished">
                <h1>You finished every task 🎉</h1>
                <p>All {tasks.length} tasks for “{a.title}” are done. Hand it in with pride.</p>
                <div className="chunk-actions">
                  <a className="btn primary" href="#/assignments">Back to your assignments</a>
                </div>
              </section>
            ) : todayDone ? (
              <section className="chunk finished">
                <h1>That’s today done 🎉</h1>
                <p>You did {plan.doneToday} minutes today. The rest is planned for the next few days.</p>
                <div className="chunk-actions">
                  <a className="btn ghost" href="#/assignments">Stop here</a>
                  <button className="btn primary" onClick={() => setMoreToday(true)}>Do one more</button>
                </div>
              </section>
            ) : (
              <>
                <article className="chunk task-card">
                  <p className="chunk-meta">
                    Step {current.step + 1} of {steps.length} · {steps[current.step]} · about {current.minutes} min
                  </p>
                  <h1 className="chunk-title">{current.title}</h1>
                  {current.doneWhen && (
                    <div className="done-when">
                      <span className="label">Done when</span>
                      <p>{current.doneWhen}</p>
                    </div>
                  )}
                  {cheer && <p className="cheer" role="status">{cheer}</p>}
                </article>

                <div className="chunk-actions">
                  <button className="btn primary big" onClick={() => finish(current)}>Done ✓</button>
                </div>
              </>
            )}
          </div>

          <aside className="study-rail" aria-label="Your plan">
            <div className="rail-card plan-card">
              <span className="label">Your plan</span>
              <p>
                {plan.today.length
                  ? <>Today: <strong>{plan.today.length} {plan.today.length === 1 ? 'task' : 'tasks'} · {plan.todayMinutes} min</strong></>
                  : allDone ? 'Everything is done.' : 'Today’s tasks are done.'}
              </p>
              {!allDone && (
                <p className={plan.behind ? 'line-behind' : 'line-ok'}>
                  {plan.behind ? BEHIND_TEXT : 'On track'}
                </p>
              )}
              <label className="form-field">
                <span>Due date</span>
                <input type="date" value={a.dueDate} min={today}
                  onChange={(e) => e.target.value && patchAssignment(uid, assignmentId, { dueDate: e.target.value })} />
              </label>
            </div>
            <div className="rail-card">
              <SprintTimer minutes={sprintMinutes} setMinutes={setSprintMinutes} />
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

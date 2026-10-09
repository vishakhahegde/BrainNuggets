import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const BREAK_MIN = 5;
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Focus sprints: a short timed block of study, then a nudge to take a break.
export default function SprintTimer({ minutes, setMinutes }) {
  const [mode, setMode] = useState('idle'); // idle | running | paused | done | break
  const [left, setLeft] = useState(minutes * 60);

  useEffect(() => { if (mode === 'idle') setLeft(minutes * 60); }, [minutes, mode]);

  useEffect(() => {
    if (mode !== 'running' && mode !== 'break') return;
    const t = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [mode]);

  useEffect(() => {
    if (left > 0) return;
    if (mode === 'running') setMode('done');
    if (mode === 'break') setMode('idle');
  }, [left, mode]);

  const backRef = useRef();
  useEffect(() => { if (mode === 'break') backRef.current?.focus(); }, [mode]);

  const startBreak = () => { setLeft(BREAK_MIN * 60); setMode('break'); };
  const reset = () => { setMode('idle'); setLeft(minutes * 60); };

  return (
    <div className="sprint">
      <span className="label">Focus sprint</span>
      {mode === 'idle' && (
        <>
          <div className="segmented" role="group" aria-label="Sprint length">
            {[10, 15, 25].map((m) => (
              <button key={m} className={m === minutes ? 'active' : ''} aria-pressed={m === minutes}
                onClick={() => setMinutes(m)}>{m} min</button>
            ))}
          </div>
          <button className="btn secondary full" onClick={() => setMode('running')}>Start sprint</button>
        </>
      )}
      {(mode === 'running' || mode === 'paused') && (
        <>
          <span className="sprint-time">{fmt(left)}</span>
          <div className="sprint-row">
            <button className="btn ghost" onClick={() => setMode(mode === 'running' ? 'paused' : 'running')}>
              {mode === 'running' ? 'Pause' : 'Resume'}
            </button>
            <button className="btn ghost" onClick={reset}>End</button>
          </div>
        </>
      )}
      {mode === 'done' && (
        <>
          <p className="sprint-msg" role="status">Sprint done. Nice work.</p>
          <button className="btn secondary full" onClick={startBreak}>Take a {BREAK_MIN}-min break</button>
          <button className="btn ghost full" onClick={reset}>Keep going</button>
        </>
      )}
      {mode !== 'break' && mode !== 'done' && (
        <button className="link" onClick={startBreak}>Take a break now</button>
      )}

      {/* Rendered on <body> so it covers the whole page, not just the sidebar. */}
      {mode === 'break' && createPortal(
        <div className="break-screen" role="dialog" aria-modal="true" aria-label="Break">
          <p className="label">Break</p>
          <p className="break-time">{fmt(left)}</p>
          <p className="muted">Step away from the screen. Your place is saved.</p>
          <button ref={backRef} className="btn primary big" onClick={reset}>Back to studying</button>
        </div>,
        document.body,
      )}
    </div>
  );
}

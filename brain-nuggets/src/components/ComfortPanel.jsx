import { useEffect, useRef } from 'react';
import { DEFAULT_PREFS } from '../prefs';

const BACKGROUNDS = [
  { id: 'cream', label: 'Cream' },
  { id: 'white', label: 'White' },
  { id: 'blue', label: 'Soft blue' },
  { id: 'green', label: 'Soft green' },
  { id: 'dark', label: 'Dark' },
];

export default function ComfortPanel({ prefs, setPrefs, onClose }) {
  const ref = useRef();
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="comfort-title"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="panel-head">
          <h2 id="comfort-title">Comfort</h2>
          <button className="btn ghost" onClick={onClose}>Done</button>
        </div>

        <label className="field">
          <span>Text size <span className="muted">{prefs.textSize}px</span></span>
          <input type="range" min={16} max={28} value={prefs.textSize}
            onChange={(e) => setPrefs({ textSize: Number(e.target.value) })} />
        </label>

        <label className="field">
          <span>Line spacing <span className="muted">{prefs.lineHeight.toFixed(1)}</span></span>
          <input type="range" min={1.4} max={2.4} step={0.1} value={prefs.lineHeight}
            onChange={(e) => setPrefs({ lineHeight: Number(e.target.value) })} />
        </label>

        <fieldset className="field">
          <legend>Background</legend>
          <div className="swatches">
            {BACKGROUNDS.map((b) => (
              <button
                key={b.id}
                className={`swatch swatch-${b.id}${prefs.background === b.id ? ' active' : ''}`}
                onClick={() => setPrefs({ background: b.id })}
                aria-pressed={prefs.background === b.id}
              >
                {b.label}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field">
          <span>Read-aloud speed <span className="muted">{prefs.speechRate.toFixed(2)}×</span></span>
          <input type="range" min={0.6} max={1.4} step={0.05} value={prefs.speechRate}
            onChange={(e) => setPrefs({ speechRate: Number(e.target.value) })} />
        </label>

        <label className="toggle">
          <input type="checkbox" checked={prefs.ruler} onChange={(e) => setPrefs({ ruler: e.target.checked })} />
          <span>Reading ruler</span>
        </label>

        <label className="toggle">
          <input type="checkbox" checked={prefs.reducedMotion}
            onChange={(e) => setPrefs({ reducedMotion: e.target.checked })} />
          <span>Reduce motion</span>
        </label>

        <button className="link reset" onClick={() => setPrefs(DEFAULT_PREFS)}>Reset to defaults</button>
      </div>
    </div>
  );
}

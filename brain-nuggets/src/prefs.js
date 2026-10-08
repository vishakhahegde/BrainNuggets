import { useEffect, useRef, useState } from 'react';
import { loadPrefs, savePrefs } from './data';

export const DEFAULT_PREFS = {
  textSize: 19,
  lineHeight: 1.8,
  background: 'cream',
  ruler: false,
  reducedMotion: false,
  sprintMinutes: 15,
  speechRate: 0.95,
};

const LOCAL_KEY = 'bn-prefs';

function readLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) ?? null; } catch { return null; }
}

function apply(p) {
  const root = document.documentElement;
  root.style.setProperty('--text-size', `${p.textSize}px`);
  root.style.setProperty('--line-height', p.lineHeight);
  root.dataset.bg = p.background;
  root.dataset.motion = p.reducedMotion ? 'reduced' : 'full';
}

// Comfort settings: applied instantly from this browser, synced to Firestore per user.
export function usePrefs(uid) {
  const [prefs, setPrefs] = useState(() => ({ ...DEFAULT_PREFS, ...readLocal() }));
  const saveTimer = useRef();

  useEffect(() => { apply(prefs); }, [prefs]);

  useEffect(() => {
    if (!uid) return;
    loadPrefs(uid).then((remote) => { if (remote) setPrefs((p) => ({ ...p, ...remote })); }).catch(() => {});
  }, [uid]);

  const update = (patch) => {
    setPrefs((p) => {
      const next = { ...p, ...patch };
      try { localStorage.setItem(LOCAL_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      clearTimeout(saveTimer.current);
      if (uid) saveTimer.current = setTimeout(() => savePrefs(uid, next).catch(() => {}), 600);
      return next;
    });
  };

  return [prefs, update];
}

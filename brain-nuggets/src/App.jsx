import { useEffect, useState } from 'react';
import { ensureUser } from './firebase';
import { usePrefs } from './prefs';
import Library from './components/Library';
import Study from './components/Study';
import ComfortPanel from './components/ComfortPanel';
import ReadingRuler from './components/ReadingRuler';

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const match = hash.match(/^#\/doc\/([^/]+)/);
  return match ? { docId: match[1] } : {};
}

export default function App() {
  const [uid, setUid] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [prefs, setPrefs] = usePrefs(uid);
  const [comfortOpen, setComfortOpen] = useState(false);
  const { docId } = useHashRoute();

  useEffect(() => {
    ensureUser().then((u) => setUid(u.uid)).catch((e) => setAuthError(e));
  }, []);

  if (authError) {
    return (
      <main className="centered">
        <div className="notice">
          <h1>Can't connect to Firebase</h1>
          <p>Anonymous sign-in failed ({authError.code}). Enable it in Firebase console → Authentication → Sign-in method → Anonymous.</p>
        </div>
      </main>
    );
  }
  if (!uid) return <main className="centered"><p className="muted">Loading…</p></main>;

  const comfortButton = (
    <button className="btn ghost" onClick={() => setComfortOpen(true)} aria-haspopup="dialog">
      Comfort
    </button>
  );

  return (
    <>
      {docId
        ? <Study uid={uid} docId={docId} prefs={prefs} setPrefs={setPrefs} comfortButton={comfortButton} />
        : <Library uid={uid} comfortButton={comfortButton} />}
      {comfortOpen && <ComfortPanel prefs={prefs} setPrefs={setPrefs} onClose={() => setComfortOpen(false)} />}
      {prefs.ruler && <ReadingRuler />}
    </>
  );
}

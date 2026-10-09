import { useEffect, useState } from 'react';
import { watchUser, signOutUser } from './firebase';
import { usePrefs } from './prefs';
import Library from './components/Library';
import Study from './components/Study';
import SignIn from './components/SignIn';
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
  // undefined = still checking, null = signed out.
  const [user, setUser] = useState(undefined);
  const signedIn = user && !user.isAnonymous;
  const uid = signedIn ? user.uid : null;
  const [prefs, setPrefs] = usePrefs(uid);
  const [comfortOpen, setComfortOpen] = useState(false);
  const { docId } = useHashRoute();

  useEffect(() => watchUser(setUser), []);

  if (user === undefined) return <main className="centered"><p className="muted">Loading…</p></main>;
  if (!signedIn) return <SignIn />;

  const comfortButton = (
    <button className="btn ghost" onClick={() => setComfortOpen(true)} aria-haspopup="dialog">
      Comfort
    </button>
  );

  const accountButton = (
    <div className="account">
      {user.photoURL && <img className="avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
      <span className="account-name">{user.displayName || user.email}</span>
      <button className="btn ghost" onClick={() => { window.location.hash = ''; signOutUser(); }}>
        Sign out
      </button>
    </div>
  );

  return (
    <>
      {docId
        ? <Study uid={uid} docId={docId} prefs={prefs} setPrefs={setPrefs} comfortButton={comfortButton} accountButton={accountButton} />
        : <Library uid={uid} comfortButton={comfortButton} accountButton={accountButton} />}
      {comfortOpen && <ComfortPanel prefs={prefs} setPrefs={setPrefs} onClose={() => setComfortOpen(false)} />}
      {prefs.ruler && <ReadingRuler />}
    </>
  );
}

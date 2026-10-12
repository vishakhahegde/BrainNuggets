import { useEffect, useState } from 'react';
import { watchUser, signOutUser } from './firebase';
import { usePrefs } from './prefs';
import Library from './components/Library';
import Study from './components/Study';
import Assignments from './components/Assignments';
import AssignmentWork from './components/AssignmentWork';
import SignIn from './components/SignIn';
import Home from './components/Home';
import ComfortPanel from './components/ComfortPanel';
import ReadingRuler from './components/ReadingRuler';

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const on = () => setHash(window.location.hash);
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const doc = hash.match(/^#\/doc\/([^/]+)/);
  if (doc) return { docId: doc[1] };
  const assignment = hash.match(/^#\/assignment\/([^/]+)/);
  if (assignment) return { assignmentId: assignment[1] };
  return { assignments: /^#\/assignments\/?$/.test(hash), home: /^#\/home\/?$/.test(hash) };
}

export default function App() {
  // undefined = still checking, null = signed out.
  const [user, setUser] = useState(undefined);
  const signedIn = user && !user.isAnonymous;
  const uid = signedIn ? user.uid : null;
  const [prefs, setPrefs] = usePrefs(uid);
  const [comfortOpen, setComfortOpen] = useState(false);
  const { docId, assignmentId, assignments, home } = useHashRoute();

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
      {user.photoURL && <img className="avatar" src={user.photoURL} alt="" title={user.displayName || user.email} referrerPolicy="no-referrer" />}
      <span className="account-name">{user.displayName || user.email}</span>
      <button className="btn ghost" onClick={() => { window.location.hash = ''; signOutUser(); }}>
        Sign out
      </button>
    </div>
  );

  return (
    <>
      {docId ? <Study uid={uid} docId={docId} prefs={prefs} setPrefs={setPrefs} comfortButton={comfortButton} accountButton={accountButton} />
        : assignmentId ? <AssignmentWork key={assignmentId} uid={uid} assignmentId={assignmentId} comfortButton={comfortButton} accountButton={accountButton} />
        : home ? <Home name={user.displayName} accountButton={accountButton} />
        : assignments ? <Assignments uid={uid} accountButton={accountButton} />
        : <Library uid={uid} accountButton={accountButton} />}
      {comfortOpen && <ComfortPanel prefs={prefs} setPrefs={setPrefs} onClose={() => setComfortOpen(false)} />}
      {prefs.ruler && <ReadingRuler />}
    </>
  );
}

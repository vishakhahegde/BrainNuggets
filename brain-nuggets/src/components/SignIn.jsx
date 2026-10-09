import { useState } from 'react';
import { signInWithGoogle } from '../firebase';

function friendlyError(err) {
  if (err.code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Allow popups for this site and try again.';
  if (err.code === 'auth/operation-not-allowed') return 'Google sign-in isn’t enabled for this app yet.';
  if (err.code === 'auth/network-request-failed') return 'Couldn’t reach Google. Check your connection and try again.';
  return 'Sign-in didn’t work. Please try again.';
}

export default function SignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      // Closing the popup is a choice, not an error.
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
        console.error('[sign-in]', err);
        setError(friendlyError(err));
      }
      setBusy(false);
    }
  };

  return (
    <main className="centered">
      <div className="notice sign-in">
        <h1>Brain Nuggets</h1>
        <p className="muted">Sign in to keep your lessons on any device.</p>
        <button className="btn primary big" onClick={signIn} disabled={busy}>
          {busy ? 'Signing in…' : 'Continue with Google'}
        </button>
        {error && <p className="error-text" role="alert">{error}</p>}
      </div>
    </main>
  );
}

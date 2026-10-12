import { useState } from 'react';
import { signInWithGoogle } from '../firebase';
import studyNook from '../assets/study-nook.webp';
import stepUpload from '../assets/step-upload.svg';
import stepLearn from '../assets/step-learn.svg';
import stepQuiz from '../assets/step-quiz.svg';

const STEPS = [
  { img: stepUpload, text: 'Upload a lecture PDF' },
  { img: stepLearn, text: 'Learn one chunk at a time' },
  { img: stepQuiz, text: 'Check yourself with a quiz' },
];

function friendlyError(err) {
  if (err.code === 'auth/popup-blocked') return 'Your browser blocked the sign-in window. Allow popups for this site and try again.';
  if (err.code === 'auth/operation-not-allowed') return 'Google sign-in isn’t enabled for this app yet.';
  if (err.code === 'auth/network-request-failed') return 'Couldn’t reach Google. Check your connection and try again.';
  return 'Sign-in didn’t work. Please try again.';
}

// The landing page. `cta` is what sits under the tagline: sign-in when signed out, shortcuts when signed in.
export function Landing({ cta, className = '' }) {
  return (
    <main className={`landing ${className}`.trim()}>
      <div className="landing-top">
      <section className="landing-hero">
        <h1 className="landing-title">Brain<br />Nuggets</h1>
        <p className="landing-tagline">Big lectures, broken into bite-sized nuggets.</p>
        <div className="landing-cta">{cta}</div>
      </section>
      <img className="landing-art" src={studyNook} alt="" />
      </div>

      <section className="how" aria-labelledby="how-title">
        <h2 id="how-title" className="how-title">How it works</h2>
        <p className="how-sub">Less overwhelm. One little nugget at a time.</p>
        <ol className="how-steps">
          {STEPS.map((s, i) => (
            <li key={s.text} className="how-step">
              <span className="how-num" aria-hidden="true">{i + 1}</span>
              <img src={s.img} alt="" />
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
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
    <Landing
      cta={
        <>
          <button className="btn primary landing-btn" onClick={signIn} disabled={busy}>
            <span className="google-g" aria-hidden="true">
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.6 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.3-4.8 3.3-8z" />
                <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.1v2.8A11 11 0 0 0 12 23z" />
                <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7.1H2.1a11 11 0 0 0 0 9.9z" />
                <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.2-3.2A11 11 0 0 0 2.1 7.1l3.7 2.8C6.7 7.3 9.1 5.4 12 5.4z" />
              </svg>
            </span>
            {busy ? 'Signing in…' : 'Continue with Google'}
          </button>
          <p className="muted landing-hint">Sign in to keep your lessons on any device.</p>
          {error && <p className="error-text" role="alert">{error}</p>}
        </>
      }
    />
  );
}

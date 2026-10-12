import { Landing } from './SignIn';
import TopBar from './TopBar';

// The landing page for a signed-in student, reached from the Brain Nuggets wordmark.
export default function Home({ name, accountButton }) {
  const first = name?.trim().split(/\s+/)[0];
  return (
    <div className="home">
      <TopBar accountButton={accountButton} />
      <Landing
        className="signed-in"
        cta={
          <>
            <div className="landing-actions">
              <a className="btn primary landing-btn plain" href="#/">Go to Your Lectures</a>
              <a className="btn secondary landing-btn plain" href="#/assignments">Your Assignments</a>
            </div>
            <p className="muted landing-hint">{first ? `Welcome back, ${first}.` : 'Welcome back.'}</p>
          </>
        }
      />
    </div>
  );
}

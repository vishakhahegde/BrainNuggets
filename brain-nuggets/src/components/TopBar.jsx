import { USING_LOCAL_DB } from '../data';

const TABS = [
  { id: 'lectures', label: 'Your Lectures', href: '#/' },
  { id: 'assignments', label: 'Your Assignments', href: '#/assignments' },
];

export default function TopBar({ active, accountButton }) {
  return (
    <header className="topbar">
      <span className="brand"><a className="brand-link" href="#/home">Brain Nuggets</a>{USING_LOCAL_DB && <span className="mode-tag">Local test mode</span>}</span>
      <nav className="nav-tabs" aria-label="Sections">
        {TABS.map((t) => (
          <a key={t.id} href={t.href} className={`nav-tab${t.id === active ? ' active' : ''}`} aria-current={t.id === active ? 'page' : undefined}>
            {t.label}
          </a>
        ))}
      </nav>
      <div className="bar-actions">
        {accountButton}
      </div>
    </header>
  );
}

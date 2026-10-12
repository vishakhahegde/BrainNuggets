import { useEffect, useRef, useState } from 'react';
import { watchDoc, watchChunks, markDone, setCurrent } from '../data';
import { useSpeech } from '../speech';
import SimpleView from './SimpleView';
import OriginalView from './OriginalView';
import MindMap from './MindMap';
import Quiz from './Quiz';
import AskBox from './AskBox';
import KeyTerms from './KeyTerms';
import SprintTimer from './SprintTimer';
import SidebarToggle from './SidebarToggle';
import { useSidebarCollapsed } from '../sidebar';

const TABS = [
  { id: 'simple', label: 'Simple' },
  { id: 'original', label: 'Original' },
  { id: 'map', label: 'Mind map' },
  { id: 'quiz', label: 'Quiz' },
];

const pageLabel = (pages = []) =>
  !pages.length ? '' : pages.length === 1 ? `page ${pages[0]}` : `pages ${pages[0]}–${pages[pages.length - 1]}`;

function speakableText(tab, chunk) {
  if (tab === 'original') return chunk.original;
  if (tab === 'simple') {
    const v = chunk;
    const fig = chunk.figures?.[0];
    const picture = fig ? [`Picture: ${fig.caption}`, fig.description] : [];
    return [chunk.title, v.bigIdea, ...picture, ...v.bullets, v.analogy].join('. ');
  }
  return null;
}

export default function Study({ uid, docId, prefs, setPrefs, comfortButton, accountButton }) {
  const [doc, setDoc] = useState(undefined);
  const [chunks, setChunks] = useState([]);
  const [index, setIndex] = useState(null);
  const [tab, setTab] = useState('simple');
  const [finished, setFinished] = useState(false);
  const speech = useSpeech(prefs.speechRate);
  const mainRef = useRef();
  const [collapsed, toggleSidebar] = useSidebarCollapsed();

  useEffect(() => watchDoc(uid, docId, setDoc), [uid, docId]);
  useEffect(() => watchChunks(uid, docId, setChunks), [uid, docId]);
  useEffect(() => {
    if (doc && index === null) setIndex(Math.min(doc.current ?? 0, Math.max(doc.chunkCount - 1, 0)));
  }, [doc, index]);

  useEffect(() => { speech.stop(); }, [index, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  if (doc === null) {
    return (
      <main className="centered">
        <div className="notice"><p>This lecture no longer exists.</p><a className="btn ghost" href="#/">All lectures</a></div>
      </main>
    );
  }
  if (!doc || index === null) return <main className="centered"><p className="muted">Loading…</p></main>;

  const chunk = chunks[index];
  const done = new Set(doc.done ?? []);
  const pct = doc.chunkCount ? Math.round((done.size / doc.chunkCount) * 100) : 0;

  const goTo = (i) => {
    setIndex(i);
    setTab('simple');
    setFinished(false);
    setCurrent(uid, docId, i).catch(() => {});
    mainRef.current?.scrollTo({ top: 0 });
  };

  const gotIt = async () => {
    const isLast = index === doc.chunkCount - 1;
    await markDone(uid, docId, index, isLast ? index : index + 1);
    if (isLast) setFinished(true);
    else goTo(index + 1);
  };

  const toRead = chunk && speakableText(tab, chunk);

  return (
    <div className={`study${collapsed ? ' collapsed' : ''}`}>
      <aside className="sidebar" aria-label="Lecture outline">
        <div className="side-head">
          <a className="back-link" href="#/">← All lectures</a>
          <SidebarToggle collapsed={collapsed} onToggle={toggleSidebar} />
        </div>
        <h2 className="side-title">{doc.title}</h2>
        <div className="side-progress">
          <span className="muted">{done.size} of {doc.chunkCount} done</span>
          <div className="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${pct}%` }} />
          </div>
        </div>
        <ol className="chunk-list">
          {Array.from({ length: doc.chunkCount }, (_, i) => {
            const c = chunks[i];
            return (
              <li key={i}>
                <button
                  className={`chunk-link${i === index ? ' active' : ''}${done.has(i) ? ' done' : ''}`}
                  onClick={() => goTo(i)}
                  disabled={!c}
                  aria-current={i === index ? 'step' : undefined}
                >
                  <span className="chunk-num" aria-hidden="true">{done.has(i) ? '✓' : i + 1}</span>
                  <span>{c?.title ?? 'Preparing…'}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </aside>

      <main className="study-main" ref={mainRef}>
        <header className="study-bar">
          <div className="tabs" role="tablist" aria-label="Views">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={tab === t.id}
                className={`tab${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
                disabled={finished}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="bar-actions">
            {speech.supported && toRead && !finished && (
              <button className="btn ghost" onClick={() => (speech.speaking ? speech.stop() : speech.speak(toRead))}>
                {speech.speaking ? 'Stop reading' : 'Read aloud'}
              </button>
            )}
            {comfortButton}
            {accountButton}
          </div>
        </header>

        <div className="study-content">
        <div className="study-col">
        {finished ? (
          <section className="chunk finished">
            <h1>You finished this lecture.</h1>
            <p>All {doc.chunkCount} chunks done.</p>
            <div className="chunk-actions">
              <a className="btn ghost" href="#/">All lectures</a>
              <button className="btn primary" onClick={() => goTo(0)}>Review from the start</button>
            </div>
          </section>
        ) : !chunk ? (
          <section className="chunk"><p className="muted">Still preparing this chunk…</p></section>
        ) : (
          <>
            <article className="chunk" role="tabpanel">
              <p className="chunk-meta">
                Chunk {index + 1} of {doc.chunkCount} · about {chunk.minutes ?? 4} min
                {chunk.pages?.length ? ` · ${pageLabel(chunk.pages)}` : ''}
              </p>
              <h1 className="chunk-title">{chunk.title}</h1>

              {tab === 'simple' && (
                <SimpleView
                  uid={uid}
                  docId={docId}
                  chunk={chunk}
                />
              )}
              {tab === 'original' && <OriginalView uid={uid} docId={docId} chunk={chunk} pageLabel={pageLabel(chunk.pages)} />}
              {tab === 'map' && <MindMap map={chunk.mindMap} />}
              {tab === 'quiz' && <Quiz key={index} uid={uid} docId={docId} chunkIndex={index} quiz={chunk.quiz} results={doc.quiz} />}
            </article>

            <div className="chunk-actions">
              <button className="btn primary big" onClick={gotIt}>
                {index === doc.chunkCount - 1 ? 'Got it, finish' : 'Got it, next chunk'}
              </button>
            </div>
          </>
        )}
        </div>

        <aside className="study-rail" aria-label="Help for this chunk">
          {chunk && !finished && (
            <>
              <KeyTerms terms={chunk.keyTerms} />
              <div className="rail-card">
                <AskBox key={index} chunk={chunk} context={doc} />
              </div>
            </>
          )}
          <div className="rail-card">
            <SprintTimer minutes={prefs.sprintMinutes} setMinutes={(m) => setPrefs({ sprintMinutes: m })} />
          </div>
        </aside>
        </div>
      </main>
    </div>
  );
}

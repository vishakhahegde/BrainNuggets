// Browser-only stand-in for Firestore (VITE_LOCAL_DB=true). Same functions and
// shapes as data-firestore.js, persisted to localStorage, with live listeners.
const KEY = 'bn-local-db';
const listeners = new Set();

function read() {
  try { return JSON.parse(localStorage.getItem(KEY)) ?? { users: {} }; } catch { return { users: {} }; }
}

let db = read();

function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* storage full or blocked */ }
  listeners.forEach((fn) => fn());
}

const user = (uid) => (db.users[uid] ??= { docs: {}, chunks: {}, figures: {}, prefs: null });
const ts = (n) => ({ toMillis: () => n });
const view = (id, d) => ({ ...d, id, createdAt: ts(d.createdAt), updatedAt: ts(d.updatedAt) });

function listen(fn) {
  const run = () => fn();
  listeners.add(run);
  queueMicrotask(run);
  return () => listeners.delete(run);
}

export function watchDocs(uid, cb) {
  return listen(() => {
    const docs = Object.entries(user(uid).docs).map(([id, d]) => view(id, d));
    cb(docs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
  });
}

export function watchDoc(uid, id, cb) {
  return listen(() => {
    const d = user(uid).docs[id];
    cb(d ? view(id, d) : null);
  });
}

export function watchChunks(uid, id, cb) {
  return listen(() => cb([...(user(uid).chunks[id] ?? [])]));
}

export async function createDoc(uid, fileName) {
  const id = Math.random().toString(36).slice(2, 12);
  const now = Date.now();
  user(uid).docs[id] = {
    fileName,
    title: fileName.replace(/\.pdf$/i, ''),
    status: 'processing',
    chunkCount: 0,
    readyCount: 0,
    current: 0,
    done: [],
    quiz: {},
    createdAt: now,
    updatedAt: now,
  };
  user(uid).chunks[id] = [];
  commit();
  return id;
}

function patch(uid, id, data) {
  const d = user(uid).docs[id];
  if (!d) return;
  Object.assign(d, data, { updatedAt: Date.now() });
  commit();
}

export const patchDoc = async (uid, id, data) => patch(uid, id, data);

export async function saveChunk(uid, id, index, chunk, readyCount, images = []) {
  const list = user(uid).chunks[id];
  if (!list) return;
  const figures = (user(uid).figures ??= {});
  images.forEach(({ key, src }) => { figures[`${id}/${key}`] = src; });
  list[index] = chunk;
  patch(uid, id, { readyCount });
}

export async function markDone(uid, id, index, next) {
  const d = user(uid).docs[id];
  if (!d) return;
  patch(uid, id, { done: d.done.includes(index) ? d.done : [...d.done, index], current: next });
}

export const setCurrent = async (uid, id, index) => patch(uid, id, { current: index });

export async function saveQuizResult(uid, id, chunkIndex, qIndex, result) {
  const d = user(uid).docs[id];
  if (!d) return;
  patch(uid, id, { quiz: { ...d.quiz, [`${chunkIndex}_${qIndex}`]: result } });
}

export const loadFigure = async (uid, id, key) => user(uid).figures?.[`${id}/${key}`] ?? null;

export async function removeDoc(uid, id) {
  const figures = user(uid).figures ?? {};
  Object.keys(figures).filter((k) => k.startsWith(`${id}/`)).forEach((k) => delete figures[k]);
  delete user(uid).docs[id];
  delete user(uid).chunks[id];
  commit();
}

export const loadPrefs = async (uid) => user(uid).prefs;

export async function savePrefs(uid, prefs) {
  user(uid).prefs = prefs;
  commit();
}

const assignments = (uid) => (user(uid).assignments ??= {});

export function watchAssignments(uid, cb) {
  return listen(() => {
    const list = Object.entries(assignments(uid)).map(([id, a]) => view(id, a));
    cb(list.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis()));
  });
}

export function watchAssignment(uid, id, cb) {
  return listen(() => {
    const a = assignments(uid)[id];
    cb(a ? view(id, a) : null);
  });
}

export async function createAssignment(uid, data) {
  const id = Math.random().toString(36).slice(2, 12);
  const now = Date.now();
  assignments(uid)[id] = { ...data, createdAt: now, updatedAt: now };
  commit();
  return id;
}

export async function patchAssignment(uid, id, data) {
  const a = assignments(uid)[id];
  if (!a) return;
  Object.assign(a, data, { updatedAt: Date.now() });
  commit();
}

export async function removeAssignment(uid, id) {
  delete assignments(uid)[id];
  commit();
}

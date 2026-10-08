import {
  collection, doc, addDoc, setDoc, updateDoc, getDoc, getDocs, onSnapshot,
  query, orderBy, serverTimestamp, writeBatch, arrayUnion,
} from 'firebase/firestore';
import { db } from './firebase';

// Layout: users/{uid} (prefs) · users/{uid}/docs/{docId} · users/{uid}/docs/{docId}/chunks/{index}
const docsCol = (uid) => collection(db, 'users', uid, 'docs');
const docRef = (uid, id) => doc(db, 'users', uid, 'docs', id);
const chunksCol = (uid, id) => collection(db, 'users', uid, 'docs', id, 'chunks');

export function watchDocs(uid, cb, onError) {
  return onSnapshot(query(docsCol(uid), orderBy('createdAt', 'desc')),
    (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))), onError);
}

export function watchDoc(uid, id, cb) {
  return onSnapshot(docRef(uid, id), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null));
}

export function watchChunks(uid, id, cb) {
  return onSnapshot(chunksCol(uid, id), (s) => {
    const list = [];
    s.docs.forEach((d) => { list[Number(d.id)] = d.data(); });
    cb(list);
  });
}

export async function createDoc(uid, fileName) {
  const ref = await addDoc(docsCol(uid), {
    fileName,
    title: fileName.replace(/\.pdf$/i, ''),
    status: 'processing',
    chunkCount: 0,
    readyCount: 0,
    current: 0,
    done: [],
    quiz: {},
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export const patchDoc = (uid, id, data) =>
  updateDoc(docRef(uid, id), { ...data, updatedAt: serverTimestamp() });

export async function saveChunk(uid, id, index, chunk, readyCount) {
  const batch = writeBatch(db);
  batch.set(doc(chunksCol(uid, id), String(index)), chunk);
  batch.update(docRef(uid, id), { readyCount, updatedAt: serverTimestamp() });
  await batch.commit();
}

export const markDone = (uid, id, index, next) =>
  updateDoc(docRef(uid, id), { done: arrayUnion(index), current: next, updatedAt: serverTimestamp() });

export const setCurrent = (uid, id, index) => updateDoc(docRef(uid, id), { current: index });

export const saveQuizResult = (uid, id, chunkIndex, qIndex, result) =>
  updateDoc(docRef(uid, id), { [`quiz.${chunkIndex}_${qIndex}`]: result });

export async function removeDoc(uid, id) {
  const chunks = await getDocs(chunksCol(uid, id));
  const batch = writeBatch(db);
  chunks.forEach((c) => batch.delete(c.ref));
  batch.delete(docRef(uid, id));
  await batch.commit();
}

export async function loadPrefs(uid) {
  const s = await getDoc(doc(db, 'users', uid));
  return s.exists() ? s.data().prefs ?? null : null;
}

export const savePrefs = (uid, prefs) => setDoc(doc(db, 'users', uid), { prefs }, { merge: true });


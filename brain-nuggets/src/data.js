import * as firestore from './data-firestore';
import * as local from './data-local';

// VITE_LOCAL_DB=true stores everything in this browser instead of Firestore (testing only).
export const USING_LOCAL_DB = import.meta.env.VITE_LOCAL_DB === 'true';
const impl = USING_LOCAL_DB ? local : firestore;

export const {
  watchDocs, watchDoc, watchChunks, createDoc, patchDoc, saveChunk,
  markDone, setCurrent, saveQuizResult, removeDoc, loadPrefs, savePrefs,
} = impl;

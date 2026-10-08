import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase web config is public by design; access is controlled by firestore.rules.
const firebaseConfig = {
  apiKey: 'AIzaSyB_t6jKq21v7r6R0uWM242ZDocKKK2pGM4',
  authDomain: 'brainnuggets-be6d9.firebaseapp.com',
  projectId: 'brainnuggets-be6d9',
  storageBucket: 'brainnuggets-be6d9.firebasestorage.app',
  messagingSenderId: '158464261359',
  appId: '1:158464261359:web:3dfe093236b5b04e572f1a',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Resolves with the current user, signing in anonymously on first visit.
export function ensureUser() {
  return new Promise((resolve, reject) => {
    const off = onAuthStateChanged(auth, (user) => {
      off();
      if (user) resolve(user);
      else signInAnonymously(auth).then((c) => resolve(c.user), reject);
    });
  });
}

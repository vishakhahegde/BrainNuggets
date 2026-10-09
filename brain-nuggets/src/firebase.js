import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, linkWithPopup,
  signInWithCredential, signOut,
} from 'firebase/auth';
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
export const FIRESTORE_DB = 'brainnuggets-69'
export const db = getFirestore(app, FIRESTORE_DB);

const provider = new GoogleAuthProvider();
provider.setCustomParameters({ prompt: 'select_account' });

export const watchUser = (cb) => onAuthStateChanged(auth, cb);

// Signs in with Google. A visitor still on an old anonymous account is upgraded in
// place (same uid, so their lessons stay); if that Google account already exists,
// we sign into it instead.
export async function signInWithGoogle() {
  const current = auth.currentUser;
  if (!current?.isAnonymous) return signInWithPopup(auth, provider);
  try {
    return await linkWithPopup(current, provider);
  } catch (err) {
    if (err.code !== 'auth/credential-already-in-use') throw err;
    return signInWithCredential(auth, GoogleAuthProvider.credentialFromError(err));
  }
}

export const signOutUser = () => signOut(auth);

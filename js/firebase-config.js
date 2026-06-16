/* ═══════════════════════════════════════
   Albexia — firebase-config.js
   Initialisation Firebase + exports Auth/DB
   ═══════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup,
         createUserWithEmailAndPassword, signInWithEmailAndPassword,
         signOut, onAuthStateChanged, updateProfile }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, setDoc, getDoc, updateDoc,
         collection, addDoc, getDocs, deleteDoc, query, orderBy }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── REMPLACE CES VALEURS PAR TES CLÉS FIREBASE ───────────────────────────
const firebaseConfig = {
  apiKey:            "VOTRE_API_KEY",
  authDomain:        "VOTRE_PROJECT.firebaseapp.com",
  projectId:         "VOTRE_PROJECT_ID",
  storageBucket:     "VOTRE_PROJECT.appspot.com",
  messagingSenderId: "VOTRE_SENDER_ID",
  appId:             "VOTRE_APP_ID"
};
// ───────────────────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

export {
  auth, db, googleProvider,
  GoogleAuthProvider, signInWithPopup,
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, updateProfile,
  doc, setDoc, getDoc, updateDoc,
  collection, addDoc, getDocs, deleteDoc, query, orderBy
};

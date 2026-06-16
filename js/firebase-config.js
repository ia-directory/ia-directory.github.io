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

const firebaseConfig = {
  apiKey:            "AIzaSyA6B14vp5wz-0em9eboEAXRVhHy7WF_Lvk",
  authDomain:        "albexia-dc650.firebaseapp.com",
  projectId:         "albexia-dc650",
  storageBucket:     "albexia-dc650.firebasestorage.app",
  messagingSenderId: "805830291200",
  appId:             "1:805830291200:web:c24122224c1abaf4360de5"
};

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

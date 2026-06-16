/* ═══════════════════════════════════════
   Albexia — auth.js
   Auth Google + Email/Mot de passe
   Création/lecture du profil Firestore
   ═══════════════════════════════════════ */

import {
  auth, db, googleProvider,
  signInWithPopup, createUserWithEmailAndPassword,
  signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile,
  doc, setDoc, getDoc
} from './firebase-config.js';

// ─── CRÉER OU RÉCUPÉRER LE PROFIL UTILISATEUR ───────────────────────────────
export async function upsertUserProfile(user) {
  const ref  = doc(db, 'users', user.uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    // Première connexion → on crée le profil
    await setDoc(ref, {
      uid:          user.uid,
      displayName:  user.displayName  || 'Utilisateur Albexia',
      email:        user.email        || '',
      photoURL:     user.photoURL     || '',
      langue:       localStorage.getItem('albexia_langue') || 'fr',
      newsletterOk: false,
      createdAt:    new Date().toISOString(),
    });
  }
  return (await getDoc(ref)).data();
}

// ─── CONNEXION GOOGLE ────────────────────────────────────────────────────────
export async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    await upsertUserProfile(result.user);
    return { ok: true, user: result.user };
  } catch (err) {
    return { ok: false, error: friendlyError(err.code) };
  }
}

// ─── INSCRIPTION EMAIL ────────────────────────────────────────────────────────
export async function registerWithEmail(displayName, email, password) {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(result.user, { displayName });
    await upsertUserProfile({ ...result.user, displayName });
    return { ok: true, user: result.user };
  } catch (err) {
    return { ok: false, error: friendlyError(err.code) };
  }
}

// ─── CONNEXION EMAIL ──────────────────────────────────────────────────────────
export async function loginWithEmail(email, password) {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, user: result.user };
  } catch (err) {
    return { ok: false, error: friendlyError(err.code) };
  }
}

// ─── DÉCONNEXION ──────────────────────────────────────────────────────────────
export async function logout() {
  await signOut(auth);
}

// ─── OBSERVER AUTH STATE ──────────────────────────────────────────────────────
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

// ─── MESSAGES D'ERREUR LISIBLES ───────────────────────────────────────────────
function friendlyError(code) {
  const map = {
    'auth/email-already-in-use':    'Cette adresse email est déjà utilisée.',
    'auth/invalid-email':           'Adresse email invalide.',
    'auth/weak-password':           'Mot de passe trop faible (6 caractères minimum).',
    'auth/wrong-password':          'Mot de passe incorrect.',
    'auth/user-not-found':          'Aucun compte trouvé avec cet email.',
    'auth/too-many-requests':       'Trop de tentatives. Réessayez dans quelques minutes.',
    'auth/popup-closed-by-user':    'Connexion annulée.',
    'auth/network-request-failed':  'Erreur réseau. Vérifiez votre connexion.',
  };
  return map[code] || 'Une erreur est survenue. Réessayez.';
}

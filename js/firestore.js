/* ═══════════════════════════════════════
   Albexia — firestore.js
   Collections, historique quiz, profil
   ═══════════════════════════════════════ */

import {
  db, doc, setDoc, getDoc, updateDoc,
  collection, addDoc, getDocs, deleteDoc, query, orderBy
} from './firebase-config.js';

// ══════════════════════════════════════
// COLLECTIONS D'OUTILS
// ══════════════════════════════════════

// Lire toutes les collections de l'utilisateur
export async function getCollections(uid) {
  const ref  = collection(db, 'users', uid, 'collections');
  const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Créer une nouvelle collection
export async function createCollection(uid, name) {
  const ref = collection(db, 'users', uid, 'collections');
  const doc = await addDoc(ref, {
    name,
    tools:     [],
    createdAt: new Date().toISOString(),
  });
  return doc.id;
}

// Renommer une collection
export async function renameCollection(uid, colId, newName) {
  const ref = doc(db, 'users', uid, 'collections', colId);
  await updateDoc(ref, { name: newName });
}

// Supprimer une collection
export async function deleteCollection(uid, colId) {
  const ref = doc(db, 'users', uid, 'collections', colId);
  await deleteDoc(ref);
}

// Ajouter un outil à une collection existante
export async function addToolToCollection(uid, colId, tool) {
  const ref  = doc(db, 'users', uid, 'collections', colId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const tools = snap.data().tools || [];
  const alreadyIn = tools.some(t => String(t.id) === String(tool.id));
  if (alreadyIn) return;

  tools.push({
    id:       tool.id,
    name:     tool.name,
    emoji:    tool.emoji    || '🤖',
    favicon:  tool.favicon  || '',
    category: tool.category || '',
    price:    tool.price    || 'free',
    url:      tool.url      || '',
    page:     tool.page     || '',
    addedAt:  new Date().toISOString(),
  });
  await updateDoc(ref, { tools });
}

// Retirer un outil d'une collection
export async function removeToolFromCollection(uid, colId, toolId) {
  const ref  = doc(db, 'users', uid, 'collections', colId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const tools = (snap.data().tools || []).filter(t => String(t.id) !== String(toolId));
  await updateDoc(ref, { tools });
}

// ══════════════════════════════════════
// HISTORIQUE QUIZ
// ══════════════════════════════════════

// Sauvegarder une session quiz
export async function saveQuizSession(uid, answers, results) {
  const ref = collection(db, 'users', uid, 'quizHistory');
  await addDoc(ref, {
    answers,              // { metier, objectif, budget, connexion, niveau }
    results: results.map(t => ({
      id:       t.id,
      name:     t.name,
      emoji:    t.emoji    || '🤖',
      favicon:  t.favicon  || '',
      category: t.category || '',
      price:    tool.price    || 'free',
      url:      t.url      || '',
      page:     t.page     || '',
    })),
    createdAt: new Date().toISOString(),
  });
}

// Lire tout l'historique quiz
export async function getQuizHistory(uid) {
  const ref  = collection(db, 'users', uid, 'quizHistory');
  const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Supprimer une session quiz
export async function deleteQuizSession(uid, sessionId) {
  const ref = doc(db, 'users', uid, 'quizHistory', sessionId);
  await deleteDoc(ref);
}

// ══════════════════════════════════════
// PROFIL UTILISATEUR
// ══════════════════════════════════════

// Lire le profil
export async function getUserProfile(uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Mettre à jour le displayName
export async function updateDisplayName(uid, displayName) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { displayName });
}

// Mettre à jour la langue préférée
export async function updateLangue(uid, langue) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { langue });
}

// Mettre à jour la préférence newsletter
export async function updateNewsletter(uid, newsletterOk) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { newsletterOk });
}

// Mettre à jour la photo de profil (base64 compressée)
export async function updatePhotoBase64(uid, photoBase64) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { photoBase64 });
}

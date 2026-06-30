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

export async function getCollections(uid) {
  const ref  = collection(db, 'users', uid, 'collections');
  const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function createCollection(uid, name) {
  const ref = collection(db, 'users', uid, 'collections');
  const doc = await addDoc(ref, {
    name,
    tools:     [],
    createdAt: new Date().toISOString(),
  });
  return doc.id;
}

export async function renameCollection(uid, colId, newName) {
  const ref = doc(db, 'users', uid, 'collections', colId);
  await updateDoc(ref, { name: newName });
}

export async function deleteCollection(uid, colId) {
  const ref = doc(db, 'users', uid, 'collections', colId);
  await deleteDoc(ref);
}

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

export async function saveQuizSession(uid, answers, results) {
  const ref = collection(db, 'users', uid, 'quizHistory');
  await addDoc(ref, {
    answers,
    results: results.map(t => ({
      id:       t.id,
      name:     t.name,
      emoji:    t.emoji    || '🤖',
      favicon:  t.favicon  || '',
      category: t.category || '',
      price:    t.price    || 'free',
      url:      t.url      || '',
      page:     t.page     || '',
    })),
    createdAt: new Date().toISOString(),
  });
}

export async function getQuizHistory(uid) {
  const ref  = collection(db, 'users', uid, 'quizHistory');
  const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function deleteQuizSession(uid, sessionId) {
  const ref = doc(db, 'users', uid, 'quizHistory', sessionId);
  await deleteDoc(ref);
}

// ══════════════════════════════════════
// PROFIL UTILISATEUR
// ══════════════════════════════════════

export async function getUserProfile(uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function updateDisplayName(uid, displayName) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { displayName });
}

export async function updateLangue(uid, langue) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { langue });
}

export async function updateNewsletter(uid, newsletterOk) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { newsletterOk });
}

export async function updatePhotoURL(uid, photoURL) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { photoURL });
}

export async function updateSkipExitModal(uid, value) {
  const ref = doc(db, 'users', uid);
  await updateDoc(ref, { skipExitModal: value });
}

// ── NOUVEAU : Champs profil public ────────────────
// Sauvegarde bio, role/titre, liens sociaux en une seule opération

export async function updatePublicProfile(uid, { bio, role, linkedin, twitter, website }) {
  const ref = doc(db, 'users', uid);
  const payload = {};
  if (bio      !== undefined) payload.bio      = bio;
  if (role     !== undefined) payload.role     = role;
  if (linkedin !== undefined) payload.linkedin = linkedin;
  if (twitter  !== undefined) payload.twitter  = twitter;
  if (website  !== undefined) payload.website  = website;
  await updateDoc(ref, payload);
}

// ══════════════════════════════════════
// PROFIL PUBLIC
// ══════════════════════════════════════

export async function setCollectionPublic(uid, colId, isPublic) {
  const ref = doc(db, 'users', uid, 'collections', colId);
  await updateDoc(ref, { isPublic });
}

export async function getPublicProfile(uid) {
  const ref  = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  // Champs exposés publiquement
  return {
    displayName: data.displayName || 'Utilisateur Albexia',
    photoURL:    data.photoURL    || null,
    bio:         data.bio         || null,
    role:        data.role        || null,
    linkedin:    data.linkedin    || null,
    twitter:     data.twitter     || null,
    website:     data.website     || null,
    isPionnier:  data.isPionnier  || false,
    isVerified:  data.isVerified  || false,
    reviewCount: data.reviewCount || 0,
  };
}

export async function getPublicCollections(uid) {
  const ref  = collection(db, 'users', uid, 'collections');
  const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')));
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(c => c.isPublic === true);
}

// ══════════════════════════════════════
// VIDÉOS SAUVEGARDÉES
// ══════════════════════════════════════

export async function saveVideo(uid, videoData) {
  const ref = doc(db, 'users', uid, 'savedVideos', videoData.videoId);
  await setDoc(ref, {
    videoId:   videoData.videoId,
    outilId:   videoData.outilId   || '',
    titre:     videoData.titre     || '',
    canal:     videoData.canal     || '',
    duree:     videoData.duree     || '',
    youtubeId: videoData.youtubeId || '',
    savedAt:   new Date().toISOString(),
  });
}

export async function unsaveVideo(uid, videoId) {
  const ref = doc(db, 'users', uid, 'savedVideos', videoId);
  await deleteDoc(ref);
}

export async function getSavedVideos(uid) {
  const ref  = collection(db, 'users', uid, 'savedVideos');
  const snap = await getDocs(query(ref, orderBy('savedAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

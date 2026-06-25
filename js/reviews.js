/* ═══════════════════════════════════════
   Albexia — reviews.js  v2
   Collections Firestore :
     • reviews/{toolSlug}_{uid}        → avis individuel
     • reviews/{id}/voters/{uid}       → votes utile
     • ratings_summary/{toolSlug}      → moyenne calculée
     • reports/{reviewId}_{reporterUid}→ signalements
   ═══════════════════════════════════════ */

import {
  db, doc, setDoc, getDoc, updateDoc,
  collection, getDocs, deleteDoc, query,
  where, increment, serverTimestamp, writeBatch,
} from './firebase-config.js';

// ──────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────

export function getToolSlugFromPath(pathname) {
  return pathname.split('/').pop().replace(/\.html?$/, '').toLowerCase().trim();
}

export function getToolSlug(tool) {
  if (tool.page) return getToolSlugFromPath(tool.page);
  return String(tool.id);
}

// ──────────────────────────────────────────
// SOUMETTRE / METTRE À JOUR UN AVIS
// ──────────────────────────────────────────

export async function submitReview(uid, toolSlug, toolMeta, rating, comment, userMeta) {
  const reviewId   = `${toolSlug}_${uid}`;
  const reviewRef  = doc(db, 'reviews', reviewId);
  const summaryRef = doc(db, 'ratings_summary', toolSlug);

  const existing  = await getDoc(reviewRef);
  const isUpdate  = existing.exists();
  const oldRating = isUpdate ? existing.data().rating : null;

  const batch = writeBatch(db);

  batch.set(reviewRef, {
    uid,
    displayName: userMeta.displayName || 'Anonyme',
    avatarUrl:   userMeta.avatarUrl   || '',
    toolSlug,
    toolName:    toolMeta.name    || '',
    toolFavicon: toolMeta.favicon || '',
    toolEmoji:   toolMeta.emoji   || '🤖',
    toolPage:    toolMeta.page    || '',
    rating,
    comment:     comment.trim().slice(0, 500),
    flagged:     false,
    helpful_yes: isUpdate ? (existing.data().helpful_yes || 0) : 0,
    helpful_no:  isUpdate ? (existing.data().helpful_no  || 0) : 0,
    createdAt:   isUpdate ? existing.data().createdAt : serverTimestamp(),
    updatedAt:   serverTimestamp(),
  });

  if (isUpdate) {
    batch.update(summaryRef, {
      ratingSum: increment(rating - oldRating),
      updatedAt: serverTimestamp(),
    });
  } else {
    const summarySnap = await getDoc(summaryRef);
    if (summarySnap.exists()) {
      batch.update(summaryRef, {
        ratingCount: increment(1),
        ratingSum:   increment(rating),
        updatedAt:   serverTimestamp(),
      });
    } else {
      batch.set(summaryRef, {
        toolSlug,
        toolName:    toolMeta.name || '',
        ratingCount: 1,
        ratingSum:   rating,
        updatedAt:   serverTimestamp(),
      });
    }
  }

  await batch.commit();
}

// ──────────────────────────────────────────
// LIRE LES AVIS
// ──────────────────────────────────────────

export async function getToolReviews(toolSlug) {
  const ref  = collection(db, 'reviews');
  const q    = query(ref, where('toolSlug', '==', toolSlug));
  const snap = await getDocs(q);
  const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.flagged !== true);
  reviews.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  return reviews;
}

export async function getUserReview(uid, toolSlug) {
  const ref  = doc(db, 'reviews', `${toolSlug}_${uid}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ──────────────────────────────────────────
// RÉSUMÉ DE NOTATION
// ──────────────────────────────────────────

export async function getRatingSummary(toolSlug) {
  const ref  = doc(db, 'ratings_summary', toolSlug);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ratingAverage: null, ratingCount: 0 };
  const { ratingSum, ratingCount } = snap.data();
  if (!ratingCount) return { ratingAverage: null, ratingCount: 0 };
  return {
    ratingAverage: Math.round((ratingSum / ratingCount) * 10) / 10,
    ratingCount,
  };
}

export async function getRatingSummaries(toolSlugs) {
  const results = new Map();
  await Promise.all(toolSlugs.map(async (slug) => {
    try {
      results.set(slug, await getRatingSummary(slug));
    } catch {
      results.set(slug, { ratingAverage: null, ratingCount: 0 });
    }
  }));
  return results;
}

// ──────────────────────────────────────────
// MES AVIS (profil)
// ──────────────────────────────────────────

export async function getUserReviews(uid) {
  const ref  = collection(db, 'reviews');
  const q    = query(ref, where('uid', '==', uid));
  const snap = await getDocs(q);
  const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.flagged !== true);
  reviews.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  return reviews;
}

export async function deleteUserReview(uid, toolSlug) {
  const reviewId   = `${toolSlug}_${uid}`;
  const reviewRef  = doc(db, 'reviews', reviewId);
  const summaryRef = doc(db, 'ratings_summary', toolSlug);

  const snap = await getDoc(reviewRef);
  if (!snap.exists()) return;

  const { rating } = snap.data();
  const batch = writeBatch(db);
  batch.delete(reviewRef);
  batch.update(summaryRef, {
    ratingCount: increment(-1),
    ratingSum:   increment(-rating),
    updatedAt:   serverTimestamp(),
  });
  await batch.commit();
}

// ──────────────────────────────────────────
// SIGNALEMENT
// ──────────────────────────────────────────

export async function reportReview(reviewId, reporterUid, reason) {
  const reportRef = doc(db, 'reports', `${reviewId}_${reporterUid}`);
  await setDoc(reportRef, {
    reviewId,
    reporterUid,
    reason:    reason || 'Contenu inapproprié',
    createdAt: serverTimestamp(),
  });
}

// ──────────────────────────────────────────
// VOTES "UTILE"
// Subcollection : reviews/{reviewId}/voters/{uid}
// Compteurs dénormalisés : helpful_yes / helpful_no
// Toggle : même valeur → annule. Valeur différente → change.
// ──────────────────────────────────────────

export async function getUserVote(reviewId, uid) {
  const ref  = doc(db, 'reviews', reviewId, 'voters', uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data().value : null;
}

export async function voteReview(reviewId, uid, value) {
  const reviewRef = doc(db, 'reviews', reviewId);
  const voterRef  = doc(db, 'reviews', reviewId, 'voters', uid);

  const [reviewSnap, voterSnap] = await Promise.all([
    getDoc(reviewRef),
    getDoc(voterRef),
  ]);

  if (!reviewSnap.exists()) throw new Error('Avis introuvable');

  const currentVote = voterSnap.exists() ? voterSnap.data().value : null;
  const reviewData  = reviewSnap.data();
  const batch = writeBatch(db);

  // Migration silencieuse : initialise helpful_yes/no à 0 si absents
  // (avis créés avant l'ajout des compteurs)
  const needsInit =
    reviewData.helpful_yes === undefined ||
    reviewData.helpful_no  === undefined;
  if (needsInit) {
    batch.set(reviewRef, {
      helpful_yes: reviewData.helpful_yes ?? 0,
      helpful_no:  reviewData.helpful_no  ?? 0,
    }, { merge: true });
  }

  if (currentVote === value) {
    // Toggle off → annuler le vote
    batch.delete(voterRef);
    batch.update(reviewRef, {
      [`helpful_${value}`]: increment(-1),
    });
  } else {
    // Nouveau vote ou changement de vote
    batch.set(voterRef, { value, uid, updatedAt: serverTimestamp() });
    const updates = { [`helpful_${value}`]: increment(1) };
    if (currentVote) {
      updates[`helpful_${currentVote}`] = increment(-1);
    }
    batch.update(reviewRef, updates);
  }

  await batch.commit();
  return currentVote === value ? null : value;
}

// ──────────────────────────────────────────
// EXPOSITION GLOBALE (app.js / annuaire)
// ──────────────────────────────────────────

window._getRatingSummaries = async function(toolSlugs) {
  try {
    return await getRatingSummaries(toolSlugs);
  } catch (error) {
    console.error('[Albexia-Avis] Échec passerelle notation:', error);
    return new Map();
  }
};

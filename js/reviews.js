/* ═══════════════════════════════════════
   Albexia — reviews.js
   Système d'avis utilisateurs
   Collections Firestore :
     • reviews/{toolSlug}_{uid}   → avis individuel
     • ratings_summary/{toolSlug} → moyenne calculée (lu par les cartes)
     • reports/{reviewId}         → signalements
   ═══════════════════════════════════════ */

import {
  db, doc, setDoc, getDoc, updateDoc,
  collection, getDocs, deleteDoc, query
} from './firebase-config.js';

import {
  where, increment, serverTimestamp, writeBatch
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ──────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────

/**
 * Génère un slug propre depuis un nom de fichier ou un chemin.
 * Ex: "tools/featured/canva.html" → "canva"
 *     "tools/chatgpt.html"        → "chatgpt"
 *     Usage depuis une fiche : getToolSlugFromPath(window.location.pathname)
 */
export function getToolSlugFromPath(pathname) {
  return pathname
    .split('/')
    .pop()
    .replace(/\.html?$/, '')
    .toLowerCase()
    .trim();
}

/**
 * Génère un slug depuis un objet outil (cartes annuaire).
 * Priorité : champ page → champ id
 */
export function getToolSlug(tool) {
  if (tool.page) return getToolSlugFromPath(tool.page);
  return String(tool.id);
}

// ──────────────────────────────────────────
// SOUMETTRE / METTRE À JOUR UN AVIS
// ──────────────────────────────────────────

/**
 * Crée ou met à jour l'avis d'un utilisateur sur un outil.
 * Met à jour atomiquement ratings_summary/{toolSlug}.
 *
 * @param {string} uid
 * @param {string} toolSlug
 * @param {object} toolMeta  { name, favicon, emoji }
 * @param {number} rating    1-5
 * @param {string} comment   max 500 chars
 * @param {object} userMeta  { displayName, avatarUrl }
 */
export async function submitReview(uid, toolSlug, toolMeta, rating, comment, userMeta) {
  const reviewId  = `${toolSlug}_${uid}`;
  const reviewRef = doc(db, 'reviews', reviewId);
  const summaryRef = doc(db, 'ratings_summary', toolSlug);

  // Lire l'avis existant pour savoir si c'est une création ou une mise à jour
  const existing = await getDoc(reviewRef);
  const isUpdate = existing.exists();
  const oldRating = isUpdate ? existing.data().rating : null;

  const batch = writeBatch(db);

  // 1. Écrire l'avis
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
    createdAt:   isUpdate ? existing.data().createdAt : serverTimestamp(),
    updatedAt:   serverTimestamp(),
  });

  // 2. Mettre à jour ratings_summary atomiquement
  if (isUpdate) {
    // Mise à jour → ajuster la somme, le count reste inchangé
    batch.update(summaryRef, {
      ratingSum: increment(rating - oldRating),
      updatedAt: serverTimestamp(),
    });
  } else {
    // Nouvel avis → incrémenter count et sum
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
// LIRE LES AVIS D'UN OUTIL
// ──────────────────────────────────────────

/**
 * Retourne tous les avis non-signalés pour un outil, triés du plus récent.
 */
export async function getToolReviews(toolSlug) {
  const ref  = collection(db, 'reviews');
  const q    = query(ref, where('toolSlug', '==', toolSlug), where('flagged', '==', false));
  const snap = await getDocs(q);
  const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Tri client-side (pas d'index composite nécessaire)
  reviews.sort((a, b) => {
    const ta = a.updatedAt?.seconds || 0;
    const tb = b.updatedAt?.seconds || 0;
    return tb - ta;
  });
  return reviews;
}

/**
 * Retourne l'avis d'un utilisateur sur un outil (ou null).
 */
export async function getUserReview(uid, toolSlug) {
  const ref  = doc(db, 'reviews', `${toolSlug}_${uid}`);
  const snap = await getDoc(ref);
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

// ──────────────────────────────────────────
// RÉSUMÉ DE NOTATION (pour les cartes)
// ──────────────────────────────────────────

/**
 * Retourne { ratingAverage, ratingCount } pour un outil.
 * ratingAverage est calculé à la volée depuis sum/count.
 */
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

/**
 * Charge les résumés de notation pour plusieurs outils en parallèle.
 * Retourne un Map { toolSlug → { ratingAverage, ratingCount } }
 */
export async function getRatingSummaries(toolSlugs) {
  const results = new Map();
  await Promise.all(
    toolSlugs.map(async (slug) => {
      try {
        const summary = await getRatingSummary(slug);
        results.set(slug, summary);
      } catch {
        results.set(slug, { ratingAverage: null, ratingCount: 0 });
      }
    })
  );
  return results;
}

// ──────────────────────────────────────────
// MES AVIS (section profil)
// ──────────────────────────────────────────

/**
 * Retourne tous les avis laissés par un utilisateur, triés du plus récent.
 */
export async function getUserReviews(uid) {
  const ref  = collection(db, 'reviews');
  const q    = query(ref, where('uid', '==', uid));
  const snap = await getDocs(q);
  const reviews = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  reviews.sort((a, b) => {
    const ta = a.updatedAt?.seconds || 0;
    const tb = b.updatedAt?.seconds || 0;
    return tb - ta;
  });
  return reviews;
}

/**
 * Supprime l'avis d'un utilisateur et met à jour ratings_summary.
 */
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

/**
 * Signale un avis. Crée un document dans reports/.
 * Un utilisateur ne peut signaler qu'une fois le même avis.
 */
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
// EXPOSITION GLOBALE POUR L'ANNUAIRE (INDEX)
// ──────────────────────────────────────────

/**
 * Rend accessible la fonction de récupération groupée à app.js
 * en s'accrochant à la fenêtre globale de l'application (window).
 */
// ──────────────────────────────────────────
// VOTES "UTILE" SUR LES AVIS
// ──────────────────────────────────────────

/**
 * Subcollection : reviews/{reviewId}/voters/{uid}
 * Valeur : "yes" | "no"
 *
 * Compteurs dénormalisés sur le doc avis :
 *   helpful_yes: number
 *   helpful_no:  number
 *
 * Règle : un seul vote par utilisateur par avis.
 * Re-voter avec la même valeur → annule le vote (toggle).
 * Re-voter avec une valeur différente → change le vote.
 */

import {
  doc as _doc2,
  getDoc as _getDoc2,
  setDoc as _setDoc2,
  deleteDoc as _deleteDoc2,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

/**
 * Retourne le vote actuel d'un utilisateur sur un avis.
 * @returns {string|null} "yes" | "no" | null
 */
export async function getUserVote(reviewId, uid) {
  const ref  = _doc2(db, 'reviews', reviewId, 'voters', uid);
  const snap = await _getDoc2(ref);
  return snap.exists() ? snap.data().value : null;
}

/**
 * Vote ou annule le vote sur un avis.
 * @param {string} reviewId
 * @param {string} uid
 * @param {"yes"|"no"} value
 */
export async function voteReview(reviewId, uid, value) {
  const reviewRef = doc(db, 'reviews', reviewId);
  const voterRef  = _doc2(db, 'reviews', reviewId, 'voters', uid);

  const [reviewSnap, voterSnap] = await Promise.all([
    getDoc(reviewRef),
    _getDoc2(voterRef),
  ]);

  if (!reviewSnap.exists()) throw new Error('Avis introuvable');

  const currentVote = voterSnap.exists() ? voterSnap.data().value : null;
  const batch = writeBatch(db);

  if (currentVote === value) {
    // Même valeur → annuler le vote (toggle off)
    batch.delete(voterRef);
    batch.update(reviewRef, {
      [`helpful_${value}`]: increment(-1),
    });
  } else {
    // Nouveau vote ou changement
    batch.set(voterRef, { value, uid, updatedAt: serverTimestamp() });
    batch.update(reviewRef, {
      [`helpful_${value}`]: increment(1),
      // Si changement de vote, décrémenter l'ancien
      ...(currentVote ? { [`helpful_${currentVote}`]: increment(-1) } : {}),
    });
  }

  await batch.commit();

  // Retourner le nouvel état
  return currentVote === value ? null : value;
}

/**
 * Initialise les compteurs de vote sur un avis existant
 * (si les champs n'existent pas encore).
 */
export async function ensureVoteFields(reviewId) {
  const ref  = doc(db, 'reviews', reviewId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();
  const updates = {};
  if (data.helpful_yes === undefined) updates.helpful_yes = 0;
  if (data.helpful_no  === undefined) updates.helpful_no  = 0;
  if (Object.keys(updates).length) await updateDoc(ref, updates);
}

// ──────────────────────────────────────────
// EXPOSITION GLOBALE POUR L'ANNUAIRE (INDEX)
// ──────────────────────────────────────────

window._getRatingSummaries = async function(toolSlugs) {
  try {
    // Utilise la fonction parallélisée déjà existante ci-dessus (plus rapide !)
    return await getRatingSummaries(toolSlugs);
  } catch (error) {
    console.error("[Albexia-Avis] Échec de la passerelle de notation globale:", error);
    return new Map();
  }
};
 

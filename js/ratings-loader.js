/* ═══════════════════════════════════════
   Albexia — ratings-loader.js
   Module ES dédié à l'injection des notes
   Firestore sur les cartes de l'annuaire.

   Chargement dans index.html :
   <script type="module" src="js/ratings-loader.js"></script>
   ═══════════════════════════════════════ */

import { getRatingSummaries } from './reviews.js';

/**
 * Injecte les notes Firestore sur toutes les cartes
 * ayant un attribut [data-tool-slug].
 * Appelé automatiquement après chaque renderTools().
 */
async function injectRatings() {
  const cards = document.querySelectorAll('[data-tool-slug]');
  if (!cards.length) return;

  const slugs = [...new Set([...cards].map(c => c.dataset.toolSlug))];

  try {
    const summaries = await getRatingSummaries(slugs);
    cards.forEach(card => {
      const badge = card.querySelector('.tool-rating-badge');
      if (!badge) return;
      const summary = summaries.get(card.dataset.toolSlug);
      if (!summary || !summary.ratingCount) {
        badge.innerHTML = '';
        return;
      }
      const avg = summary.ratingAverage.toFixed(1);
      badge.innerHTML =
        `<span class="stars-live">⭐ ${avg}</span>` +
        `<span class="review-count"> · ${summary.ratingCount} avis</span>`;
    });
  } catch (err) {
    console.warn('[ratings-loader] Erreur Firestore:', err);
  }
}

// Exposer sur window pour que app.js (script classique) puisse l'appeler
window._injectRatings = injectRatings;

// Écouter l'événement custom émis par app.js après chaque renderTools()
window.addEventListener('albexia:toolsRendered', injectRatings);

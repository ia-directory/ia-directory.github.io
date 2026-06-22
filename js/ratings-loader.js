/* ═══════════════════════════════════════
   Albexia — ratings-loader.js
   Charge les avis Firestore et enrichit
   les cartes outils avec les étoiles.
   ═══════════════════════════════════════ */

import { getRatingSummaries } from './reviews.js';

// Exposer la fonction globalement pour app.js
window._getRatingSummaries = getRatingSummaries;

// Appelée après renderTools() pour enrichir les cartes visibles
export async function enrichCardsWithRatings() {
  if (typeof window._getRatingSummaries !== 'function') return;
  
  try {
    const cards = document.querySelectorAll('[data-tool-slug]');
    if (!cards.length) return;

    // Collecter les slugs uniques visibles
    const visibleSlugs = [...new Set([...cards].map(c => c.dataset.toolSlug))];
    
    // Charger les résumés en parallèle
    const summaries = await window._getRatingSummaries(visibleSlugs);

    // Enrichir chaque carte
    cards.forEach(card => {
      const slug    = card.dataset.toolSlug;
      const summary = summaries.get(slug);
      const badge   = card.querySelector('.tool-rating-badge');

      if (!badge || !summary || !summary.ratingCount) return;

      const avg = summary.ratingAverage.toFixed(1);
      const count = summary.ratingCount;
      
      // Remplacer le contenu de la badge
      badge.innerHTML = `
        <span class="stars-live">⭐ ${avg}</span>
        <span class="review-count">· ${count} avis</span>`;
    });
  } catch (err) {
    console.warn('⚠ Ratings Firestore non chargés:', err);
  }
}

// Exposer globalement
window._enrichCardsWithRatings = enrichCardsWithRatings;

/* ═══════════════════════════════════════
   Albexia — ratings-loader.js
   Expose getRatingSummaries sur window
   pour que app.js (script classique)
   puisse enrichir les cartes outils.
   ═══════════════════════════════════════ */

import { getRatingSummaries } from './reviews.js';

window._getRatingSummaries = getRatingSummaries;

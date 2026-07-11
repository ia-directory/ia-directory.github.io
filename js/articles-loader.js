/**
 * articles-loader.js — Albexia
 * Charge les articles depuis articles.json et les injecte dans la sidebar des fiches outils.
 *
 * Usage dans chaque fiche HTML :
 * <script src="../../js/articles-loader.js" data-outil="stable-diffusion" data-plan="featured"></script>
 *
 * Plans :
 * featured  → sidebar uniquement (2 articles max)
 * starter   → sidebar uniquement (1 premier article)
 * gratuit   → rien affiché
 */

(function () {
  const script  = document.currentScript;
  const outil   = script.getAttribute('data-outil');
  const plan    = script.getAttribute('data-plan');

  // Si pas d'outil ou plan gratuit, on arrête tout
  if (!outil || plan === 'gratuit') return;

  // Chemin absolu vers articles.json
  const jsonPath = '/data/articles.json';

  fetch(jsonPath)
    .then(r => r.json())
    .then(data => {
      const toolData = data[outil];
      if (!toolData) return;
      const articles = toolData.articles;

      // Affichage ultra-léger selon le plan
      if (plan === 'featured') {
        injectSidebar(articles, 2, 'articles-sidebar-all');
      }

      if (plan === 'starter') {
        injectSidebar(articles, 1, 'articles-sidebar-starter');
      }
    })
    .catch(err => console.warn('articles-loader : impossible de charger articles.json', err));

  /* ─────────────────────────────────────────
     INJECTION SIDEBAR (Contenu épuré)
  ───────────────────────────────────────── */
  function injectSidebar(articles, maxCount, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Récupère uniquement le nombre d'articles demandé (1 ou 2)
    container.innerHTML = articles.slice(0, maxCount).map(a => `
      <a href="${a.lien}" class="article-link-card">
        <div class="article-link-thumb">
          <img src="${a.image}" alt="${a.titre}" loading="lazy">
        </div>
        <div>
          <div class="article-link-title">${a.titre}</div>
          <div class="article-link-sub">${a.soustitre}</div>
        </div>
      </a>
    `).join('');
  }

})();

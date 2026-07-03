/**
 * articles-loader.js — Albexia
 * Charge les articles depuis articles.json et les injecte dans les fiches outils.
 *
 * Usage dans chaque fiche HTML :
 *   <script src="../../js/articles-loader.js" data-outil="stable-diffusion" data-plan="featured"></script>
 *
 * Plans :
 *   featured  → zone principale (3 featured) + sidebar (7 tous)
 *   starter   → sidebar uniquement (3 premiers articles)
 *   gratuit   → rien affiché
 */

(function () {
  const script  = document.currentScript;
  const outil   = script.getAttribute('data-outil');
  const plan    = script.getAttribute('data-plan');

  if (!outil || plan === 'gratuit') return;

  // Chemin absolu vers articles.json (site servi à la racine du domaine)
  const jsonPath = '/data/articles.json';

  fetch(jsonPath)
    .then(r => r.json())
    .then(data => {
      const toolData = data[outil];
      if (!toolData) return;
      const articles = toolData.articles;

      if (plan === 'featured') {
        injectFeaturedZone(articles);
        injectSidebarAll(articles);
      }

      if (plan === 'starter') {
        injectSidebarStarter(articles);
      }
    })
    .catch(err => console.warn('articles-loader : impossible de charger articles.json', err));

  /* ─────────────────────────────────────────
     ZONE PRINCIPALE — 3 articles featured
     (section après les tutoriels vidéo)
  ───────────────────────────────────────── */
  function injectFeaturedZone(articles) {
    const grid = document.getElementById('articles-featured-grid');
    if (!grid) return;

    const featured = articles.filter(a => a.featured === true).slice(0, 3);

    grid.innerHTML = featured.map(a => `
      <a href="${a.lien}" class="related-card">
        <div class="related-cover">
          <img src="${a.image}" alt="${a.titre}" loading="lazy">
        </div>
        <div class="related-body">
          <div class="related-title">${a.titre}</div>
          <div class="related-sub">${a.soustitre}</div>
          <span class="related-arrow">Lire l'article →</span>
        </div>
      </a>
    `).join('');
  }

  /* ─────────────────────────────────────────
     SIDEBAR FEATURED — 7 articles (tous)
  ───────────────────────────────────────── */
  function injectSidebarAll(articles) {
    const container = document.getElementById('articles-sidebar-all');
    if (!container) return;

    container.innerHTML = articles.slice(0, 7).map(a => `
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

  /* ─────────────────────────────────────────
     SIDEBAR STARTER — 3 premiers articles
  ───────────────────────────────────────── */
  function injectSidebarStarter(articles) {
    const container = document.getElementById('articles-sidebar-starter');
    if (!container) return;

    container.innerHTML = articles.slice(0, 3).map(a => `
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

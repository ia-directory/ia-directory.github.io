#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   gen-fiches.js — Générateur de fiches outils Albexia
   Source : Firestore collection "outils"
   Sortie : tools/{plan}/{langue}/{slug}/index.html
   Usage  : node gen-fiches.js
   ═══════════════════════════════════════════════════════ */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const fs   = require('fs');
const path = require('path');

// ── Init Firebase Admin ──────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Helpers ──────────────────────────────────────────────
function slugify(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function badgePrice(price, langue) {
  const labels = {
    fr: { gratuit:'Gratuit', freemium:'Freemium', payant:'Payant' },
    en: { gratuit:'Free',    freemium:'Freemium', payant:'Paid'   },
    es: { gratuit:'Gratis',  freemium:'Freemium', payant:'De pago'},
  };
  const l = labels[langue] || labels.fr;
  const map = {
    gratuit:  `<span class="tool-badge badge-hot">${l.gratuit}</span>`,
    freemium: `<span class="tool-badge badge-freemium">${l.freemium}</span>`,
    payant:   `<span class="tool-badge badge-cat">${l.payant}</span>`,
  };
  return map[price] || '';
}

function stars(note) {
  const n = Math.round(note || 0);
  return Array.from({length:5}, (_,i) =>
    `<span class="star ${i < n ? 'on' : ''}">★</span>`
  ).join('') + `<span class="star-label">${note ? note+'/5' : 'Nouveau'}</span>`;
}

// R = chemin absolu vers la racine du site (site servi à la racine du domaine)
const R = '/';
const SITE_ORIGIN = 'https://albexia.com';

function navHTML(langue) {
  const homeLabel = { fr:'Accueil', en:'Home',  es:'Inicio' }[langue] || 'Accueil';
  const toolLabel = { fr:'Outils',  en:'Tools', es:'Herramientas' }[langue] || 'Outils';
  const blogLabel = { fr:'Blog',    en:'Blog',  es:'Blog' }[langue] || 'Blog';
  return `<nav>
  <div class="logo">
    <svg viewBox="0 0 130 36" xmlns="http://www.w3.org/2000/svg" height="32" aria-label="Albexia">
      <style>.poly-part{animation:buildIn 1.2s ease-out forwards;opacity:0}.logo-text{animation:fadeIn 1s ease-out 0.8s forwards;opacity:0}@keyframes buildIn{0%{opacity:0;transform:translateY(10px) scale(.8)}100%{opacity:1;transform:translateY(0) scale(1)}}@keyframes fadeIn{0%{opacity:0;transform:translateX(-5px)}100%{opacity:1;transform:translateX(0)}}.part-1{animation-delay:.1s}.part-2{animation-delay:.3s}.part-3{animation-delay:.5s}</style>
      <polygon class="poly-part part-1" points="2,10 14,32 10,32" fill="#ff6b9d"/>
      <polygon class="poly-part part-2" points="14,2 18,12 10,12" fill="#ff6b9d" opacity="0.6"/>
      <polygon class="poly-part part-3" points="26,10 14,32 18,32" fill="#ff6b9d"/>
      <text class="logo-text" x="36" y="26" font-family="Georgia,serif" font-size="20" font-weight="700" fill="#f0f0f5" letter-spacing="-0.5">Albe<tspan fill="#ff6b9d">x</tspan>ia</text>
    </svg>
  </div>
  <div class="nav-links">
    <button class="nav-link" onclick="window.location.href='${R}index.html'">${homeLabel}</button>
    <button class="nav-link" onclick="window.location.href='${R}index.html#tools'">${toolLabel}</button>
    <button class="nav-link" onclick="window.location.href='${R}index.html#blog'">${blogLabel}</button>
  </div>
  <div class="kebab-wrap" id="kebab-wrap">
    <button class="kebab-btn" id="kebab-btn" aria-label="Menu" aria-expanded="false"><span></span><span></span><span></span></button>
    <div class="kebab-menu" id="kebab-menu" role="menu">
      <a href="${R}glossaire.html" class="kebab-item" role="menuitem"><span class="kebab-ico">📖</span><div><div class="kebab-item-name">Glossaire IA</div></div></a>
      <a href="${R}tools/comparateur.html" class="kebab-item" role="menuitem"><span class="kebab-ico">⚖️</span><div><div class="kebab-item-name">Comparateur</div></div></a>
      <a href="${R}deals/" class="kebab-item" role="menuitem"><span class="kebab-ico">🔥</span><div><div class="kebab-item-name">Deals &amp; Promos</div></div></a>
      <div class="kebab-divider"></div>
      <a href="${R}hub.html" class="kebab-item" role="menuitem"><span class="kebab-ico">📂</span><div><div class="kebab-item-name">Toutes les sections →</div></div></a>
    </div>
  </div>
</nav>`;
}

function footerHTML() {
  return `<footer>
  <div style="text-align:center;padding:24px;font-size:13px;color:#4a4a6a;border-top:1px solid rgba(255,255,255,0.07)">
    &copy; 2025-2026 <a href="${R}index.html" style="color:#a8a3ff;text-decoration:none">Albexia</a> —
    <a href="${R}mentions-legales.html" style="color:#7a7a9a;text-decoration:none">Mentions légales</a> ·
    <a href="${R}politique-confidentialite.html" style="color:#7a7a9a;text-decoration:none">Confidentialité</a> ·
    <a href="${R}contact.html" style="color:#7a7a9a;text-decoration:none">Contact</a>
  </div>
</footer>`;
}

function sharedJS() {
  return `<script>
  const kb = document.getElementById('kebab-btn'), km = document.getElementById('kebab-menu');
  if (kb && km) {
    kb.addEventListener('click', e => { e.stopPropagation(); const o = km.classList.toggle('open'); kb.setAttribute('aria-expanded', o); });
    document.addEventListener('click', () => { km.classList.remove('open'); kb.setAttribute('aria-expanded','false'); });
    km.addEventListener('click', e => e.stopPropagation());
  }
</script>`;
}

function faqJS() {
  return `<script>
  document.querySelectorAll('.faq-q').forEach(q => {
    q.addEventListener('click', () => q.parentElement.classList.toggle('open'));
  });
</script>`;
}

function tutorialJS() {
  return `<script>
  function toggleTutorial(id) {
    const item = document.getElementById(id);
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.tutorial-item.open').forEach(el => {
      if (el.id !== id) { el.classList.remove('open'); const f = el.querySelector('iframe'); if (f) f.src=''; }
    });
    if (isOpen) { item.classList.remove('open'); const f = item.querySelector('iframe'); if (f) f.src=''; }
    else { item.classList.add('open'); const f = item.querySelector('iframe[data-src]'); if (f && !f.src) f.src=f.dataset.src; }
  }
</script>`;
}

// ── Alternatives ──────────────────────────────────────────
function altsHTML(alternatives, name, langue) {
  const moreLabel = { fr:'Voir tous les outils →', en:'See all tools →', es:'Ver todas las herramientas →' }[langue] || 'Voir tous les outils →';
  if (!alternatives || !alternatives.length) return '';
  const items = alternatives.map(a => {
    // Format : "nom|domaine|description" ou juste "nom"
    const [nom, domaine, desc] = (typeof a === 'string' ? a : `${a.nom}|${a.domaine||''}|${a.desc||''}`).split('|');
    const domain = domaine || slugify(nom) + '.com';
    const favicon = `https://www.google.com/s2/favicons?sz=32&domain=${domain}`;
    const siteUrl = domaine ? (domaine.startsWith('http') ? domaine : `https://${domaine}`) : `https://${domain}`;
    return `<a href="${siteUrl}" target="_blank" rel="noopener" class="alt-item">
      <img src="${favicon}" alt="${nom}" onerror="this.style.display='none'">
      <div><div class="alt-name">${nom}</div><div class="alt-desc">${desc || `Alternative à ${name}`}</div></div>
    </a>`;
  }).join('');
  return `<div class="sidebar-card">
    <div class="sc-title">${{fr:'Alternatives', en:'Alternatives', es:'Alternativas'}[langue]||'Alternatives'}</div>
    ${items}
    <a href="${R}index.html#tools" class="alt-more">${moreLabel}</a>
  </div>`;
}

// ── Infos rapides sidebar ─────────────────────────────────
function infosSidebar(tool, langue) {
  const labels = {
    fr: { cat:'Catégorie', prix:'Prix', ideal:'Idéal pour', dev:'Développeur', plateformes:'Plateformes', api:'API', ifr:'Interface FR', essai:'Essai gratuit', oui:'✓ Oui' },
    en: { cat:'Category',  prix:'Price', ideal:'Ideal for', dev:'Developer',   plateformes:'Platforms',   api:'API', ifr:'FR Interface',  essai:'Free trial',   oui:'✓ Yes' },
    es: { cat:'Categoría', prix:'Precio', ideal:'Ideal para', dev:'Desarrollador', plateformes:'Plataformas', api:'API', ifr:'Interfaz FR', essai:'Prueba gratis', oui:'✓ Sí' },
  }[langue] || {};
  const price = tool.price || 'freemium';
  const priceLabel = { fr:{gratuit:'Gratuit',freemium:'Freemium',payant:'Payant'}, en:{gratuit:'Free',freemium:'Freemium',payant:'Paid'}, es:{gratuit:'Gratis',freemium:'Freemium',payant:'De pago'} }[langue]?.[price] || price;
  return `<div class="sidebar-card sidebar-card-featured-highlight">
    <div class="sc-title">${{fr:'Infos rapides',en:'Quick info',es:'Info rápida'}[langue]||'Infos rapides'}</div>
    ${tool.maker ? `<div class="sc-row"><span class="sc-label">${labels.dev}</span><span class="sc-val">${tool.maker}</span></div>` : ''}
    <div class="sc-row"><span class="sc-label">${labels.cat}</span><span class="sc-val">${tool.category||''}</span></div>
    <div class="sc-row"><span class="sc-label">${labels.prix}</span><span class="sc-val-green sc-val">${priceLabel}</span></div>
    ${tool.ideal_pour ? `<div class="sc-row"><span class="sc-label">${labels.ideal}</span><span class="sc-val">${tool.ideal_pour}</span></div>` : ''}
    ${tool.plateformes ? `<div class="sc-row"><span class="sc-label">${labels.plateformes}</span><span class="sc-val">${tool.plateformes}</span></div>` : ''}
    ${tool.api ? `<div class="sc-row"><span class="sc-label">${labels.api}</span><span class="sc-val">${labels.oui}</span></div>` : ''}
    ${tool.interface_fr ? `<div class="sc-row"><span class="sc-label">${labels.ifr}</span><span class="sc-val-green sc-val">${labels.oui}</span></div>` : ''}
    ${tool.essai_gratuit ? `<div class="sc-row"><span class="sc-label">${labels.essai}</span><span class="sc-val-green sc-val">${labels.oui} · ${tool.duree_essai||''}</span></div>` : ''}
  </div>`;
}

// ════════════════════════════════════════════════════════════
// BALISES SEO MULTILINGUES (canonical, hreflang, og:locale)
// Fonction commune réutilisée par les fiches outils ET les articles,
// pour ne jamais dupliquer ni faire diverger cette logique sensible au SEO.
// ════════════════════════════════════════════════════════════
function seoHeadTags(langue, langueUrls) {
  const canonicalUrl = langueUrls[langue];

  // Le x-default pointe vers le FR si disponible, sinon la langue courante —
  // jamais vers une langue absente (éviterait un hreflang -> 404).
  const xDefaultUrl = langueUrls.fr || canonicalUrl;

  const hreflangTags = Object.entries(langueUrls)
    .map(([langCode, u]) => `  <link rel="alternate" hreflang="${langCode}" href="${u}" />`)
    .join('\n') + `\n  <link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />`;

  const ogLocales = { fr: 'fr_FR', en: 'en_US', es: 'es_ES' };
  const ogLocale = ogLocales[langue] || 'fr_FR';
  const ogLocaleAlternates = Object.keys(langueUrls)
    .filter(l => l !== langue)
    .map(l => `  <meta property="og:locale:alternate" content="${ogLocales[l] || l}" />`)
    .join('\n');

  return { canonicalUrl, hreflangTags, ogLocale, ogLocaleAlternates };
}

// Construit la map {langue: url} pour un outil, en résolvant ses traductions
// (qui référencent des IDs) vers les URLs réelles des fiches correspondantes.
function toolLangueUrls(tool, allTools) {
  const slug = slugify(tool.name);
  const folder = tool.plan === 'featured' ? 'featured' : tool.plan === 'starter' ? 'starter' : 'standard';
  const langue = tool.langue || 'fr';
  const canonicalUrl = `${SITE_ORIGIN}/tools/${folder}/${langue}/${slug}/`;
  const langueUrls = { [langue]: canonicalUrl };

  for (const [langCode, relId] of Object.entries(tool.traductions || {})) {
    const rel = allTools.find(t => String(t.id) === String(relId));
    if (rel) {
      const relSlug = slugify(rel.name);
      const relFolder = rel.plan === 'featured' ? 'featured' : rel.plan === 'starter' ? 'starter' : 'standard';
      const relLangue = rel.langue || langCode;
      if (relSlug) langueUrls[relLangue] = `${SITE_ORIGIN}/tools/${relFolder}/${relLangue}/${relSlug}/`;
    }
  }
  return langueUrls;
}

// ════════════════════════════════════════════════════════════
// GÉNÉRATEUR STANDARD
// ════════════════════════════════════════════════════════════
function generateStandard(tool, allTools=[]) {
  const { name, description='', price='freemium', category='', url='#', favicon, emoji='🤖', langue='fr' } = tool;
  const fav = favicon || `https://www.google.com/s2/favicons?sz=128&domain=${new URL(url).hostname}`;
  const slug = tool.slug_articles || slugify(name);

  const pointsForts = (tool.points_forts || []).map(p =>
    `<div class="feature-item"><div class="fi-icon">✓</div><div class="fi-title">${p}</div></div>`
  ).join('');

  const limiteHTML = tool.limite ? `
    <div class="feature-item" style="border-color:rgba(245,166,35,0.2)">
      <div class="fi-icon">⚠️</div>
      <div class="fi-title">${{fr:'Limite principale',en:'Main limitation',es:'Limitación principal'}[langue]||'Limite'}</div>
      <div class="fi-desc">${tool.limite}</div>
    </div>` : '';

  const titres = {
    fr: `${name} — Avis, Prix & Alternatives 2026 | Albexia`,
    en: `${name} — Review, Pricing & Alternatives 2026 | Albexia`,
    es: `${name} — Reseña, Precios & Alternativas 2026 | Albexia`,
  };
  const metaDesc = tool.meta_description || description.slice(0, 155);
  const { canonicalUrl, hreflangTags, ogLocale, ogLocaleAlternates } = seoHeadTags(langue, toolLangueUrls(tool, allTools));

  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titres[langue] || titres.fr}</title>
  <meta name="description" content="${metaDesc}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
${hreflangTags}
  <meta property="og:title" content="${titres[langue] || titres.fr}">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:locale" content="${ogLocale}">
${ogLocaleAlternates}
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpolygon points='16,2 28,30 4,30' fill='none' stroke='%23ff6b9d' stroke-width='2.5' stroke-linejoin='round'/%3E%3Ccircle cx='16' cy='22' r='3' fill='%23ff6b9d'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${R}css/style.css">
  <link rel="stylesheet" href="${R}css/tool-detail.css">
</head>
<body>
${navHTML(langue)}
<main><div class="container">
  <div class="tool-hero">
    <div class="hero-glow"></div>
    <div class="tool-hero-left">
      <div class="tool-logo-wrap">
        <img src="${fav}" alt="${name} logo" class="tool-logo-img">
      </div>
      <div class="tool-hero-info">
        <div class="tool-hero-badges">
          <span class="tool-badge badge-cat">${category}</span>
          ${badgePrice(price, langue)}
        </div>
        <h1 class="tool-hero-title">${name}</h1>
        <div class="tool-hero-stars">${stars(tool.note || tool.rating || 0)}</div>
        <p class="tool-hero-desc">${description}</p>
        <div class="tool-hero-actions">
          <a href="${url}" target="_blank" rel="noopener" class="btn-try">${{fr:'Essayer',en:'Try it',es:'Probar'}[langue]||'Essayer'} ${emoji} →</a>
        </div>
      </div>
    </div>
  </div>
  <div class="tool-content">
    <div class="tool-main">
      ${pointsForts || limiteHTML ? `
      <section class="tool-section">
        <h2>${{fr:"Ce qu'on retient",en:'Key takeaways',es:'Lo destacado'}[langue]||"Ce qu'on retient"}</h2>
        <div class="feature-grid">${pointsForts}${limiteHTML}</div>
      </section>` : ''}
      <div id="reviews-section"></div>
    </div>
    <aside class="tool-sidebar">
      ${infosSidebar(tool, langue)}
      ${altsHTML(tool.alternatives, name, langue)}
      <div class="sidebar-card sidebar-card-cta">
        <div class="sc-title">${{fr:`Essayer ${name}`,en:`Try ${name}`,es:`Probar ${name}`}[langue]||`Essayer ${name}`}</div>
        <p>${tool.ideal_pour || ''}</p>
        <a href="${url}" target="_blank" rel="noopener" class="btn-try-full">${{fr:`Aller sur ${name}`,en:`Go to ${name}`,es:`Ir a ${name}`}[langue]||`Aller sur ${name}`} →</a>
      </div>
    </aside>
  </div>
</div></main>
${footerHTML()}
${sharedJS()}
<script type="module" src="${R}js/reviews-widget.js"></script>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════
// GÉNÉRATEUR STARTER
// ════════════════════════════════════════════════════════════
function generateStarter(tool, allTools=[]) {
  const { name, description='', price='freemium', category='', url='#', favicon, emoji='🤖', langue='fr' } = tool;
  const fav  = favicon || `https://www.google.com/s2/favicons?sz=128&domain=${new URL(url).hostname}`;
  const slug = tool.slug_articles || slugify(name);

  const statsHTML = (tool.stats||[]).slice(0,4).map(s =>
    `<div class="tool-stat"><div class="ts-n">${s.valeur}</div><div class="ts-l">${s.label}</div></div>`
  ).join('');

  // Starter : 3 fonctionnalités max, 2 FAQ max — cf. hiérarchie éditoriale par plan.
  const featuresHTML = (tool.fonctionnalites||[]).slice(0,3).map(f =>
    `<div class="feature-item">
      <div class="fi-icon">${f.icon||'✦'}</div>
      <div class="fi-title">${f.titre}</div>
      <div class="fi-desc">${f.desc||''}</div>
    </div>`
  ).join('');

  const faqHTML = (tool.faq||[]).slice(0,2).map(f =>
    `<div class="faq-item">
      <button class="faq-q">${f.q}</button>
      <div class="faq-a">${f.a}</div>
    </div>`
  ).join('');

  const titres = {
    fr: `${name} — Guide, Tarifs & Avis 2026 | Albexia`,
    en: `${name} — Guide, Pricing & Reviews 2026 | Albexia`,
    es: `${name} — Guía, Precios & Reseñas 2026 | Albexia`,
  };

  // Articles sidebar selon langue
  const articlesSidebar = langue === 'fr'
    ? `<div class="sidebar-card">
        <div class="sc-title">Articles liés</div>
        <div id="articles-sidebar-starter"></div>
      </div>`
    : '';
  const articlesScript = langue === 'fr'
    ? `<script src="${R}js/articles-loader.js" data-outil="${slug}" data-plan="starter"></script>`
    : '';

  const metaDescStarter = (tool.meta_description||description).slice(0,155);
  const { canonicalUrl, hreflangTags, ogLocale, ogLocaleAlternates } = seoHeadTags(langue, toolLangueUrls(tool, allTools));

  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titres[langue]||titres.fr}</title>
  <meta name="description" content="${metaDescStarter}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
${hreflangTags}
  <meta property="og:title" content="${titres[langue]||titres.fr}">
  <meta property="og:description" content="${metaDescStarter}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:locale" content="${ogLocale}">
${ogLocaleAlternates}
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpolygon points='16,2 28,30 4,30' fill='none' stroke='%23ff6b9d' stroke-width='2.5' stroke-linejoin='round'/%3E%3Ccircle cx='16' cy='22' r='3' fill='%23ff6b9d'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${R}css/style.css">
  <link rel="stylesheet" href="${R}css/tool-detail.css">
</head>
<body>
${navHTML(langue)}
<main><div class="container">
  <div class="tool-hero">
    <div class="hero-glow"></div>
    <div class="tool-hero-left">
      <div class="tool-logo-wrap">
        <img src="${fav}" alt="${name} logo" class="tool-logo-img">
      </div>
      <div class="tool-hero-info">
        <div class="tool-hero-badges">
          <span class="tool-badge badge-cat">${category}</span>
          ${badgePrice(price, langue)}
          ${tool.interface_fr ? `<span class="tool-badge badge-hot">🌍 ${langue==='fr'?'Interface en français':langue==='en'?'French interface':'Interfaz en francés'}</span>` : ''}
        </div>
        <h1 class="tool-hero-title">${name}</h1>
        ${tool.maker ? `<p class="tool-hero-maker">par <strong>${tool.maker}</strong></p>` : ''}
        <div class="tool-hero-stars">${stars(tool.note||tool.rating||0)}</div>
        <p class="tool-hero-desc">${description}</p>
        <div class="tool-hero-actions">
          <a href="${url}" target="_blank" rel="noopener" class="btn-try">${{fr:'Essayer',en:'Try it',es:'Probar'}[langue]||'Essayer'} →</a>
          ${tool.url_tarifs ? `<a href="${tool.url_tarifs}" target="_blank" rel="noopener" class="btn-pricing">${{fr:'Voir les tarifs',en:'See pricing',es:'Ver precios'}[langue]||'Voir les tarifs'}</a>` : ''}
        </div>
      </div>
    </div>
  </div>
  ${statsHTML ? `<div class="tool-stats">${statsHTML}</div>` : ''}
  <div class="tool-content">
    <div class="tool-main">
      ${featuresHTML ? `
      <section class="tool-section">
        <h2>${{fr:'Fonctionnalités clés',en:'Key features',es:'Funcionalidades clave'}[langue]||'Fonctionnalités'}</h2>
        <div class="feature-grid">${featuresHTML}</div>
      </section>` : ''}
      ${faqHTML ? `
      <section class="tool-section">
        <h2>${{fr:'Questions fréquentes',en:'FAQ',es:'Preguntas frecuentes'}[langue]||'FAQ'}</h2>
        <div class="faq-list">${faqHTML}</div>
      </section>` : ''}
      <div id="reviews-section"></div>
    </div>
    <aside class="tool-sidebar">
      ${infosSidebar(tool, langue)}
      ${articlesSidebar}
      ${altsHTML(tool.alternatives, name, langue)}
      <div class="sidebar-card sidebar-card-cta">
        <div class="sc-title">${{fr:`Essayer ${name}`,en:`Try ${name}`,es:`Probar ${name}`}[langue]||`Essayer ${name}`}</div>
        <p>${tool.ideal_pour||''}</p>
        <a href="${url}" target="_blank" rel="noopener" class="btn-try-full">${{fr:`Aller sur ${name}`,en:`Go to ${name}`,es:`Ir a ${name}`}[langue]||`Aller sur ${name}`} →</a>
      </div>
    </aside>
  </div>
</div></main>
${footerHTML()}
${faqHTML ? faqJS() : ''}
${sharedJS()}
${articlesScript}
<script type="module" src="${R}js/reviews-widget.js"></script>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════
// GÉNÉRATEUR FEATURED
// ════════════════════════════════════════════════════════════
function generateFeatured(tool, allTools=[]) {
  const { name, description='', price='freemium', category='', url='#', favicon, emoji='🤖', langue='fr' } = tool;
  const fav  = favicon || `https://www.google.com/s2/favicons?sz=128&domain=${new URL(url).hostname}`;
  const slug = tool.slug_articles || slugify(name);

  const statsHTML = (tool.stats||[]).slice(0,4).map(s =>
    `<div class="tool-stat"><div class="ts-n">${s.valeur}</div><div class="ts-l">${s.label}</div></div>`
  ).join('');

  // Featured : 4 fonctionnalités max, 1 seul tutoriel, 4 FAQ max — cf. hiérarchie
  // éditoriale par plan (Featured reste plus complet que Starter/Standard,
  // mais sans dupliquer le contenu sous plusieurs formes).
  const featuresHTML = (tool.fonctionnalites||[]).slice(0,4).map(f =>
    `<div class="feature-item">
      <div class="fi-icon">${f.icon||'✦'}</div>
      <div class="fi-title">${f.titre}</div>
      <div class="fi-desc">${f.desc||''}</div>
    </div>`
  ).join('');

  const tutorielsHTML = (tool.tutoriels||[]).slice(0,1).map((t,i) => {
    const id = `tuto-${i}`;
    return `<div class="tutorial-item" id="${id}">
      <div class="tutorial-header" onclick="toggleTutorial('${id}')">
        <div class="tutorial-thumb">
          <img src="https://img.youtube.com/vi/${t.youtube_id}/mqdefault.jpg" alt="${t.titre}" loading="lazy">
          <div class="tutorial-thumb-play"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></div>
        </div>
        <div class="tutorial-meta">
          <div class="tutorial-title">${t.titre}</div>
          ${t.duree ? `<div class="tutorial-duration">${t.duree}</div>` : ''}
        </div>
        <button class="tutorial-toggle">▾</button>
      </div>
      <div class="tutorial-video">
        <div class="tutorial-video-inner">
          <iframe data-src="https://www.youtube.com/embed/${t.youtube_id}" frameborder="0" allowfullscreen style="width:100%;aspect-ratio:16/9;border-radius:8px;display:block;"></iframe>
        </div>
      </div>
    </div>`;
  }).join('');

  const faqHTML = (tool.faq||[]).slice(0,4).map(f =>
    `<div class="faq-item">
      <button class="faq-q">${f.q}</button>
      <div class="faq-a">${f.a}</div>
    </div>`
  ).join('');

  const screenshotHTML = tool.screenshot_url ? `
    <section class="tool-section">
      <h2>${{fr:"Interface de l'outil",en:'Tool interface',es:'Interfaz del tool'}[langue]||"Interface"}</h2>
      <div class="screenshot-wrap">
        <img src="${tool.screenshot_url}" alt="Interface ${name}" loading="lazy">
        <div class="screenshot-label">Interface ${name} — 2026</div>
      </div>
    </section>` : '';

  const presentationHTML = tool.presentation ? `
    <section class="tool-section">
      <h2>${{fr:`Qu'est-ce que ${name} ?`,en:`What is ${name}?`,es:`¿Qué es ${name}?`}[langue]||`Qu'est-ce que ${name} ?`}</h2>
      ${tool.presentation.split('\n').filter(Boolean).map(p=>`<p>${p}</p>`).join('')}
    </section>` : '';

  // Verdict et grille "Articles liés" du main retirés du template Featured :
  // le verdict reformulait sans info nouvelle le hero + les features, et la
  // grille d'articles faisait doublon avec la version sidebar juste en dessous
  // (une seule suffit — cf. décision éditoriale sur la densité des fiches).

  // Articles : uniquement si langue FR (articles.json est en français) —
  // affichés uniquement en sidebar sur Featured, plus de grille dans le main.
  const articlesSidebar = langue === 'fr' ? `
    <div class="sidebar-card">
      <div class="sc-title">Articles liés</div>
      <div id="articles-sidebar-all"></div>
    </div>` : '';

  const articlesScript = langue === 'fr'
    ? `<script src="${R}js/articles-loader.js" data-outil="${slug}" data-plan="featured"></script>`
    : '';

  const titres = {
    fr: `${name} — Guide complet, Tarifs & Tutoriels 2026 | Albexia`,
    en: `${name} — Complete Guide, Pricing & Tutorials 2026 | Albexia`,
    es: `${name} — Guía completa, Precios & Tutoriales 2026 | Albexia`,
  };

  const metaDescFeatured = (tool.meta_description||description).slice(0,155);
  const { canonicalUrl, hreflangTags, ogLocale, ogLocaleAlternates } = seoHeadTags(langue, toolLangueUrls(tool, allTools));

  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${titres[langue]||titres.fr}</title>
  <meta name="description" content="${metaDescFeatured}">
  <meta name="robots" content="index, follow">
  <link rel="canonical" href="${canonicalUrl}">
${hreflangTags}
  <meta property="og:title" content="${titres[langue]||titres.fr}">
  <meta property="og:description" content="${metaDescFeatured}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:locale" content="${ogLocale}">
${ogLocaleAlternates}
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Cpolygon points='16,2 28,30 4,30' fill='none' stroke='%23ff6b9d' stroke-width='2.5' stroke-linejoin='round'/%3E%3Ccircle cx='16' cy='22' r='3' fill='%23ff6b9d'/%3E%3C/svg%3E">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="${R}css/style.css">
  <link rel="stylesheet" href="${R}css/tool-detail.css">
</head>
<body>
${navHTML(langue)}
<main><div class="container">
  <div class="tool-hero">
    <div class="hero-glow"></div>
    <div class="tool-hero-left">
      <div class="tool-logo-wrap">
        <img src="${fav}" alt="${name} logo" class="tool-logo-img">
      </div>
      <div class="tool-hero-info">
        <div class="tool-hero-badges">
          <span class="tool-badge badge-cat">${category}</span>
          ${badgePrice(price, langue)}
          ${tool.interface_fr ? `<span class="tool-badge badge-hot">🌍 ${langue==='fr'?'Interface en français':langue==='en'?'French interface':'Interfaz en francés'}</span>` : ''}
        </div>
        <h1 class="tool-hero-title">${name}</h1>
        ${tool.maker ? `<p class="tool-hero-maker">par <strong>${tool.maker}</strong></p>` : ''}
        <div class="tool-hero-stars">${stars(tool.note||tool.rating||0)}</div>
        <p class="tool-hero-desc">${description}</p>
        <div class="tool-hero-actions">
          <a href="${url}" target="_blank" rel="noopener" class="btn-try">${{fr:'Essayer',en:'Try it',es:'Probar'}[langue]||'Essayer'} →</a>
          ${tool.url_tarifs ? `<a href="${tool.url_tarifs}" target="_blank" rel="noopener" class="btn-pricing">${{fr:'Voir les tarifs',en:'See pricing',es:'Ver precios'}[langue]||'Voir les tarifs'}</a>` : ''}
        </div>
      </div>
    </div>
  </div>
  ${statsHTML ? `<div class="tool-stats">${statsHTML}</div>` : ''}
  <div class="tool-content">
    <div class="tool-main">
      ${presentationHTML}
      ${screenshotHTML}
      ${featuresHTML ? `
      <section class="tool-section">
        <h2>${{fr:'Fonctionnalités clés',en:'Key features',es:'Funcionalidades clave'}[langue]||'Fonctionnalités'}</h2>
        <div class="feature-grid">${featuresHTML}</div>
      </section>` : ''}
      ${tutorielsHTML ? `
      <section class="tool-section">
        <h2>${{fr:'Tutoriels vidéo',en:'Video tutorials',es:'Tutoriales en vídeo'}[langue]||'Tutoriels'}</h2>
        <div class="tutorials-list">${tutorielsHTML}</div>
      </section>` : ''}
      ${faqHTML ? `
      <section class="tool-section">
        <h2>${{fr:'Questions fréquentes',en:'FAQ',es:'Preguntas frecuentes'}[langue]||'FAQ'}</h2>
        <div class="faq-list">${faqHTML}</div>
      </section>` : ''}
      <div id="reviews-section"></div>
    </div>
    <aside class="tool-sidebar">
      ${infosSidebar(tool, langue)}
      ${articlesSidebar}
      ${altsHTML(tool.alternatives, name, langue)}
      <div class="sidebar-card sidebar-card-cta">
        <div class="sc-title">${{fr:`Essayer ${name}`,en:`Try ${name}`,es:`Probar ${name}`}[langue]||`Essayer ${name}`}</div>
        <p>${tool.ideal_pour||''}</p>
        <a href="${url}" target="_blank" rel="noopener" class="btn-try-full">${{fr:`Aller sur ${name}`,en:`Go to ${name}`,es:`Ir a ${name}`}[langue]||`Aller sur ${name}`} →</a>
      </div>
    </aside>
  </div>
</div></main>
${footerHTML()}
${faqHTML ? faqJS() : ''}
${tutorielsHTML ? tutorialJS() : ''}
${sharedJS()}
${articlesScript}
<script type="module" src="${R}js/reviews-widget.js"></script>
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════
// GÉNÉRATEUR ARTICLES (blog)
// Source : Firestore collection "articles"
// Sortie : articles/{langue}/{slug}/index.html
// ════════════════════════════════════════════════════════════
function articleNavHTML(langue) {
  // Nav identique à navHTML() mais depuis un fichier à 3 niveaux de profondeur
  // (articles/{langue}/{slug}/index.html) — on réutilise navHTML() telle quelle
  // car R est un chemin absolu ('/'), donc la profondeur du fichier n'a aucune
  // incidence sur les liens : c'est tout l'intérêt des chemins absolus.
  return navHTML(langue);
}

function generateArticle(article, allArticles) {
  const {
    title, category='', emoji='📝', date='', readTime='', excerpt='',
    author='Équipe Albexia', tags=[], slug, langue='fr',
    traductions={}, corps_html='', meta_description='', og_image='', cta=null
  } = article;

  if (!slug) return null; // sécurité : jamais générer sans slug (URL invalide)

  const canonicalUrl = `${SITE_ORIGIN}/articles/${langue}/${slug}/index.html`;

  // Construit dynamiquement le bloc hreflang : uniquement pour les langues qui
  // existent RÉELLEMENT (article FR lui-même + traductions renseignées dans
  // Firestore). On ne référence jamais une langue absente pour éviter un
  // hreflang pointant vers une page 404 — c'est ce qui pénalise le plus en SEO.
  const langueUrls = { [langue]: canonicalUrl };
  for (const [langCode, relId] of Object.entries(traductions || {})) {
    const rel = allArticles.find(a => String(a.id) === String(relId));
    if (rel && rel.slug) {
      langueUrls[langCode] = `${SITE_ORIGIN}/articles/${langCode}/${rel.slug}/index.html`;
    }
  }
  // Le x-default pointe toujours vers la version FR si elle existe, sinon
  // vers la langue courante (cas d'un article publié directement en EN/ES
  // sans version FR — rare mais possible).
  const xDefaultUrl = langueUrls.fr || canonicalUrl;

  const hreflangTags = Object.entries(langueUrls)
    .map(([langCode, u]) => `  <link rel="alternate" hreflang="${langCode}" href="${u}" />`)
    .join('\n') + `\n  <link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />`;

  const ogLocales = { fr: 'fr_FR', en: 'en_US', es: 'es_ES' };
  const ogLocale = ogLocales[langue] || 'fr_FR';
  const ogLocaleAlternates = Object.keys(langueUrls)
    .filter(l => l !== langue)
    .map(l => `  <meta property="og:locale:alternate" content="${ogLocales[l] || l}" />`)
    .join('\n');

  const metaDesc = meta_description || excerpt.slice(0, 155);
  const ogImageTag = og_image ? `  <meta property="og:image" content="${og_image}" />\n  <meta name="twitter:image" content="${og_image}" />\n` : '';
  const ogImageJsonLd = og_image ? `,\n    "image": "${og_image}"` : '';

  const workTranslations = Object.entries(langueUrls)
    .filter(([l]) => l !== langue)
    .map(([l, u]) => `      { "@type": "Article", "inLanguage": "${l}", "url": "${u}" }`)
    .join(',\n');

  const titleTag = `${title} | Albexia`;

  // Navigation article précédent/suivant : dans la même langue uniquement,
  // en se basant sur l'ordre des articles de cette langue triés par date brute
  // Firestore (le champ "date" est une chaîne d'affichage, donc on trie sur
  // l'ID à défaut d'un champ date ISO dédié — voir note dans le README du repo).
  const sameLang = allArticles.filter(a => (a.langue || 'fr') === langue && a.slug).sort((a,b) => Number(String(a.id).split('-')[0]) - Number(String(b.id).split('-')[0]));
  const idx = sameLang.findIndex(a => String(a.id) === String(article.id));
  const prevArticle = idx > 0 ? sameLang[idx - 1] : null;
  const nextArticle = (idx >= 0 && idx < sameLang.length - 1) ? sameLang[idx + 1] : null;

  const navBottomHTML = (prevArticle || nextArticle) ? `
  <nav class="article-nav-bottom" aria-label="Navigation articles">
    ${prevArticle ? `<a href="${R}articles/${langue}/${prevArticle.slug}/index.html" class="article-nav-btn">← ${prevArticle.title}</a>` : ''}
    ${nextArticle ? `<a href="${R}articles/${langue}/${nextArticle.slug}/index.html" class="article-nav-btn">${nextArticle.title} →</a>` : ''}
  </nav>` : '';

  const tagsHTML = (tags || []).map(t => `<a href="#" class="article-tag">#${t}</a>`).join('\n      ');

  // Bloc CTA de fin d'article : entièrement optionnel, personnalisable par
  // article depuis l'admin. Absent si "cta" n'est pas renseigné en Firestore
  // (pas de bloc générique par défaut, pour éviter un CTA hors-sujet).
  const ctaHTML = (cta && cta.texte && cta.lien_principal_url && cta.lien_principal_label) ? `
    <div class="analyse-cta">
      <p>${cta.texte}</p>
      <div class="analyse-cta-links">
        <a href="${cta.lien_principal_url}" class="btn-cta-primary">${cta.lien_principal_label}</a>
        ${cta.lien_secondaire_url && cta.lien_secondaire_label ? `<a href="${cta.lien_secondaire_url}" class="btn-cta-secondary">${cta.lien_secondaire_label}</a>` : ''}
      </div>
    </div>` : '';

  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleTag}</title>
  <meta name="description" content="${metaDesc}" />
  <meta name="robots" content="index, follow" />

  <link rel="canonical" href="${canonicalUrl}" />

${hreflangTags}

  <meta property="og:title"       content="${title} | Albexia" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:type"        content="article" />
  <meta property="og:url"         content="${canonicalUrl}" />
${ogImageTag}  <meta property="og:locale"           content="${ogLocale}" />
${ogLocaleAlternates}
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${title} | Albexia" />
  <meta name="twitter:description" content="${metaDesc}" />
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": "${title}",
    "description": "${metaDesc}",
    "inLanguage": "${langue}",
    "datePublished": "${date}",
    "dateModified": "${date}",
    "author": { "@type": "Organization", "name": "Albexia" },
    "publisher": { "@type": "Organization", "name": "Albexia", "url": "${SITE_ORIGIN}" }${ogImageJsonLd},
    "mainEntityOfPage": { "@type": "WebPage", "@id": "${canonicalUrl}" }${workTranslations ? `,
    "workTranslation": [
${workTranslations}
    ]` : ''}
  }
  </script>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${R}css/style.css" />
  <link rel="stylesheet" href="${R}css/article.css" />
</head>
<body>

${articleNavHTML(langue)}

<main class="article-main">
<div class="article-container">

  <header class="article-header">
    <div class="article-meta-top">
      <span class="article-cat fond">${category}</span>
      <span class="dot"></span>
      <span class="article-date">${date}</span>
      <span class="dot"></span>
      <span class="article-read-time">⏱ ${readTime}</span>
    </div>
    <h1 class="article-title">${title}</h1>
    <p class="article-intro">${excerpt}</p>
  </header>

  <div class="article-body">
${corps_html}
    <div class="article-tags">
      ${tagsHTML}
    </div>
${ctaHTML}
  </div>
${navBottomHTML}

</div>
</main>

${footerHTML()}
${sharedJS()}
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════
// GÉNÉRATEUR COMPARATEUR (X vs Y)
// Source : Firestore collection "comparaisons"
// Sortie : comparateur/{slug}/index.html
//
// Chaque doc comparaison référence deux outils par slug
// (outil_a_slug / outil_b_slug). Au build, on va chercher
// note/prix/favicon/lien dans la vraie collection "outils"
// (déjà en mémoire — voir main()) pour rester synchronisé.
// Si l'outil référencé n'existe pas (pas encore indexé, ou
// volontairement hors-catalogue), on retombe sur les champs
// de fallback saisis à la main dans le doc comparaison
// (nom_fallback, emoji_fallback, lien_fallback, etc.) — la
// comparaison ne casse jamais silencieusement.
// ════════════════════════════════════════════════════════════

// Résout un "côté" (a ou b) de la comparaison : cherche l'outil
// référencé dans la collection outils (même langue si possible,
// sinon n'importe laquelle), sinon utilise le fallback manuel.
function resoudreOutilComparaison(side, comp, tools, langue) {
  const slugRef   = comp[`outil_${side}_slug`] || '';
  const nomFallback = comp[`outil_${side}_nom_fallback`] || comp[`outil_${side}_nom`] || '';
  const winnerSlug = comp.gagnant_slug || '';

  let found = null;
  if (slugRef) {
    found = tools.find(t => slugify(t.name) === slugRef && (t.langue || 'fr') === langue)
         || tools.find(t => slugify(t.name) === slugRef);
  }

  if (found) {
    const priceLabel = { gratuit:'Freemium', freemium:'Freemium', payant:'Payant', free:'Gratuit', paid:'Payant' }[found.price] || 'Freemium';
    return {
      nom: found.name,
      slug: slugify(found.name),
      emoji: found.emoji || '🤖',
      favicon: `https://www.google.com/s2/favicons?sz=64&domain=${(found.url||'').replace(/^https?:\/\//,'').split('/')[0]}`,
      categorie: found.category || '',
      note: typeof found.note === 'number' ? found.note : (found.note ? Number(found.note) : 4.5),
      lien: found.url || comp[`outil_${side}_lien_fallback`] || '#',
      priceLabel,
      winner: slugRef === winnerSlug,
      _resolved: true,
    };
  }

  // Fallback manuel (outil pas encore indexé dans "outils")
  return {
    nom: nomFallback || (side === 'a' ? 'Outil A' : 'Outil B'),
    slug: slugRef || slugify(nomFallback),
    emoji: comp[`outil_${side}_emoji_fallback`] || '🤖',
    favicon: comp[`outil_${side}_favicon_fallback`] || '',
    categorie: comp[`outil_${side}_categorie_fallback`] || '',
    note: comp[`outil_${side}_note_fallback`] ? Number(comp[`outil_${side}_note_fallback`]) : 4.5,
    lien: comp[`outil_${side}_lien_fallback`] || '#',
    priceLabel: comp[`outil_${side}_prix_fallback`] || '',
    winner: slugRef && slugRef === winnerSlug,
    _resolved: false,
  };
}

function noteClasseComp(note) {
  if (note >= 4.7) return 'note-top';
  if (note >= 4.4) return 'note-bon';
  return 'note-ok';
}

function logoHTMLComp(outil, classeImg, classeFallback) {
  if (outil.favicon) {
    return `<img src="${outil.favicon}" alt="${outil.nom}" class="${classeImg}"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
            <span class="${classeFallback}" style="display:none">${outil.emoji}</span>`;
  }
  return `<span class="${classeFallback}">${outil.emoji}</span>`;
}

function logoInlineComp(outil) {
  return outil.favicon
    ? `<img src="${outil.favicon}" alt="${outil.nom}" onerror="this.style.display='none'">`
    : outil.emoji;
}

function generateComparaison(comp, tools, allComparaisons) {
  const langue = comp.langue || 'fr';
  const slug   = comp.slug;
  if (!slug) return null;

  const a = resoudreOutilComparaison('a', comp, tools, langue);
  const b = resoudreOutilComparaison('b', comp, tools, langue);

  const canonicalUrl = `${SITE_ORIGIN}/comparateur/${slug}/index.html`;
  const titleTag = comp.meta_title || `${a.nom} vs ${b.nom} — Comparaison complète | Albexia`;
  const metaDesc = comp.meta_description || comp.resume?.slice(0, 155) || `${a.nom} ou ${b.nom} ? Comparaison détaillée. Notre verdict Albexia.`;

  // Hreflang : uniquement les langues où une traduction existe réellement
  const langueUrls = { [langue]: canonicalUrl };
  for (const [langCode, relSlug] of Object.entries(comp.traductions || {})) {
    const rel = allComparaisons.find(c => c.slug === relSlug || String(c.id) === String(relSlug));
    if (rel && rel.slug) {
      langueUrls[langCode] = `${SITE_ORIGIN}/comparateur/${rel.slug}/index.html`;
    }
  }
  const xDefaultUrl = langueUrls.fr || canonicalUrl;
  const hreflangTags = Object.entries(langueUrls)
    .map(([langCode, u]) => `  <link rel="alternate" hreflang="${langCode}" href="${u}" />`)
    .join('\n') + `\n  <link rel="alternate" hreflang="x-default" href="${xDefaultUrl}" />`;

  const ogLocales = { fr: 'fr_FR', en: 'en_US', es: 'es_ES' };
  const ogLocale = ogLocales[langue] || 'fr_FR';
  const ogLocaleAlternates = Object.keys(langueUrls)
    .filter(l => l !== langue)
    .map(l => `  <meta property="og:locale:alternate" content="${ogLocales[l] || l}" />`)
    .join('\n');

  // ── Hero ──
  const heroHTML = `<section class="cp-hero">
  <div class="cp-vs-badge">${{fr:'Comparaison',en:'Comparison',es:'Comparación'}[langue]||'Comparaison'}</div>
  <h1>${a.nom} <span class="vs-sep">vs</span> ${b.nom}</h1>
  <p class="cp-resume">${comp.resume || ''}</p>
</section>`;

  // ── Header outils ──
  const toolsHeaderHTML = `<div class="cp-tools-header">
  <div class="cp-tool-card${a.winner ? ' winner' : ''}">
    ${logoHTMLComp(a, 'cp-tool-logo', 'cp-tool-logo-fallback')}
    <div class="cp-tool-name">${a.nom}</div>
    <div class="cp-tool-cat">${a.categorie}</div>
    <span class="cp-tool-note ${noteClasseComp(a.note)}">${a.note} / 5</span>
  </div>
  <div class="cp-vs-divider">VS</div>
  <div class="cp-tool-card${b.winner ? ' winner' : ''}">
    ${logoHTMLComp(b, 'cp-tool-logo', 'cp-tool-logo-fallback')}
    <div class="cp-tool-name">${b.nom}</div>
    <div class="cp-tool-cat">${b.categorie}</div>
    <span class="cp-tool-note ${noteClasseComp(b.note)}">${b.note} / 5</span>
  </div>
</div>`;

  // ── Tableau critères ──
  const criteres = comp.criteres || [];
  let lignes = '';
  criteres.forEach(c => {
    const cellA = c.bool
      ? (c.a === true  ? '<span class="check-yes">✓</span>'
       : c.a === false ? '<span class="check-no">✗</span>'
       : '<span class="check-na">—</span>')
      : `<span style="color:var(--text);font-size:13px">${c.a}</span>`;
    const cellB = c.bool
      ? (c.b === true  ? '<span class="check-yes">✓</span>'
       : c.b === false ? '<span class="check-no">✗</span>'
       : '<span class="check-na">—</span>')
      : `<span style="color:var(--text);font-size:13px">${c.b}</span>`;
    lignes += `<tr>
      <td class="td-label">${c.label}</td>
      <td>${cellA}</td>
      <td>${cellB}</td>
    </tr>`;
  });
  const tableauHTML = `<table class="cp-table">
  <thead>
    <tr>
      <th>${{fr:'Critère',en:'Criteria',es:'Criterio'}[langue]||'Critère'}</th>
      <th class="th-tool">${logoInlineComp(a)} ${a.nom}</th>
      <th class="th-tool">${logoInlineComp(b)} ${b.nom}</th>
    </tr>
  </thead>
  <tbody>${lignes}</tbody>
</table>`;

  // ── Avantages / inconvénients ──
  const avA  = comp.avantages?.a || [];
  const avB  = comp.avantages?.b || [];
  const incA = comp.inconvenients?.a || [];
  const incB = comp.inconvenients?.b || [];
  const listeHTML = (items, estPros) =>
    `<ul class="cp-pros-list${estPros ? '' : ' cp-cons-list'}">${(items||[]).map(i => `<li>${i}</li>`).join('')}</ul>`;

  const avantagesHTML = `<div class="cp-pros-cons">
  <div class="cp-pros-card">
    <div class="cp-pros-card-title">${logoInlineComp(a)} ${a.nom} — Points forts</div>
    ${listeHTML(avA, true)}
  </div>
  <div class="cp-pros-card">
    <div class="cp-pros-card-title">${logoInlineComp(b)} ${b.nom} — Points forts</div>
    ${listeHTML(avB, true)}
  </div>
  <div class="cp-pros-card">
    <div class="cp-pros-card-title" style="color:var(--text-muted)">${a.nom} — Limites</div>
    ${listeHTML(incA, false)}
  </div>
  <div class="cp-pros-card">
    <div class="cp-pros-card-title" style="color:var(--text-muted)">${b.nom} — Limites</div>
    ${listeHTML(incB, false)}
  </div>
</div>`;

  // ── Cas d'usage ──
  const casUsageHTML = comp.cas_usage ? `<div class="cp-cas-grid">
  <div class="cp-cas-card card-a">
    <div class="cp-cas-label">Choisissez</div>
    <div class="cp-cas-title">${logoInlineComp(a)} ${a.nom}</div>
    <p class="cp-cas-text">${comp.cas_usage.choisir_a || ''}</p>
  </div>
  <div class="cp-cas-card card-b">
    <div class="cp-cas-label">Choisissez</div>
    <div class="cp-cas-title">${logoInlineComp(b)} ${b.nom}</div>
    <p class="cp-cas-text">${comp.cas_usage.choisir_b || ''}</p>
  </div>
</div>` : '';

  // ── Verdict ──
  const gagnantNom = comp.verdict?.gagnant || a.nom;
  const gagnantObj = gagnantNom === b.nom ? b : a;
  const verdictHTML = comp.verdict ? `<div class="cp-verdict-card">
  <div class="cp-verdict-label">Notre verdict Albexia</div>
  <div class="cp-verdict-title">${logoInlineComp(gagnantObj)} 🏆 ${gagnantNom} recommandé</div>
  <p class="cp-verdict-text">${comp.verdict.texte || ''}</p>
</div>` : '';

  // ── FAQ ──
  const faqItems = comp.faq || [];
  const faqHTML = faqItems.length ? `<div class="cp-faq">
  ${faqItems.map((f, i) => `<div class="cp-faq-item" id="faq-${i}">
    <button class="cp-faq-question" onclick="toggleFAQ(${i})">
      <span>${f.question}</span>
      <span class="cp-faq-arrow">▼</span>
    </button>
    <div class="cp-faq-answer">${f.reponse}</div>
  </div>`).join('')}
</div>` : '';

  const faqJsonLd = faqItems.length ? `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": [
${faqItems.map(f => `      {
        "@type": "Question",
        "name": ${JSON.stringify(f.question)},
        "acceptedAnswer": { "@type": "Answer", "text": ${JSON.stringify(f.reponse.replace(/<[^>]+>/g,''))} }
      }`).join(',\n')}
    ]
  }
  </script>` : '';

  // ── CTA ──
  const ctaHTML = `<div class="cp-cta-wrap">
  <a href="${a.lien}" target="_blank" rel="noopener" class="cp-cta-btn cp-cta-a">
    ${a.favicon ? `<img src="${a.favicon}" alt="${a.nom}" onerror="this.style.display='none'">` : ''}<span>Essayer ${a.nom}</span><span>→</span>
  </a>
  <a href="${b.lien}" target="_blank" rel="noopener" class="cp-cta-btn cp-cta-b">
    ${b.favicon ? `<img src="${b.favicon}" alt="${b.nom}" onerror="this.style.display='none'">` : ''}<span>Essayer ${b.nom}</span><span>→</span>
  </a>
</div>`;

  const comparisonJsonLd = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": ${JSON.stringify(`${a.nom} vs ${b.nom}`)},
    "description": ${JSON.stringify(metaDesc)},
    "inLanguage": "${langue}",
    "author": { "@type": "Organization", "name": "Albexia" },
    "publisher": { "@type": "Organization", "name": "Albexia", "url": "${SITE_ORIGIN}" },
    "mainEntityOfPage": { "@type": "WebPage", "@id": "${canonicalUrl}" }
  }
  </script>`;

  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleTag}</title>
  <meta name="description" content="${metaDesc}" />
  <meta name="robots" content="index, follow" />

  <link rel="canonical" href="${canonicalUrl}" />

${hreflangTags}

  <meta property="og:title"       content="${titleTag}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:type"        content="website" />
  <meta property="og:url"         content="${canonicalUrl}" />
  <meta property="og:locale"      content="${ogLocale}" />
${ogLocaleAlternates}
  <meta name="twitter:card"        content="summary_large_image" />
  <meta name="twitter:title"       content="${titleTag}" />
  <meta name="twitter:description" content="${metaDesc}" />
${comparisonJsonLd}
${faqJsonLd}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${R}css/style.css" />
  <link rel="stylesheet" href="${R}css/comparer.css" />
</head>
<body>

${navHTML(langue)}

${heroHTML}

${toolsHeaderHTML}

<div class="cp-section">
  <div class="cp-section-title">${{fr:'Comparaison détaillée',en:'Detailed comparison',es:'Comparación detallada'}[langue]||'Comparaison détaillée'}</div>
  ${tableauHTML}
</div>

<div class="cp-section">
  <div class="cp-section-title">${{fr:'Points forts & limites',en:'Strengths & limitations',es:'Puntos fuertes y límites'}[langue]||'Points forts & limites'}</div>
  ${avantagesHTML}
</div>

${casUsageHTML ? `<div class="cp-section">
  <div class="cp-section-title">${{fr:'Qui devrait choisir quoi ?',en:'Who should choose what?',es:'¿Quién debería elegir qué?'}[langue]||'Qui devrait choisir quoi ?'}</div>
  ${casUsageHTML}
</div>` : ''}

${verdictHTML ? `<div class="cp-section">
  <div class="cp-section-title">${{fr:'Verdict Albexia',en:'Albexia verdict',es:'Veredicto Albexia'}[langue]||'Verdict Albexia'}</div>
  ${verdictHTML}
</div>` : ''}

${faqHTML ? `<div class="cp-section">
  <div class="cp-section-title">${{fr:'Questions fréquentes',en:'FAQ',es:'Preguntas frecuentes'}[langue]||'Questions fréquentes'}</div>
  ${faqHTML}
</div>` : ''}

<div class="cp-section">
  ${ctaHTML}
</div>

<a href="${R}tools/comparateur.html" class="cp-back">← ${{fr:'Retour au comparateur',en:'Back to comparator',es:'Volver al comparador'}[langue]||'Retour au comparateur'}</a>

${footerHTML()}
${faqHTML ? '<script>function toggleFAQ(i){document.getElementById("faq-"+i).classList.toggle("open");}</script>' : ''}
${sharedJS()}
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════
async function main() {
  console.log('📥 Lecture de Firestore (outils)...');
  const snap  = await db.collection('outils').get();
  const tools = snap.docs.map(d => d.data());
  console.log(`✓ ${tools.length} documents trouvés`);

  let generated = 0, skipped = 0, noFiche = 0;

  for (const tool of tools) {
    // Toggle générer_fiche
    if (tool.generer_fiche === false) { noFiche++; continue; }

    const plan   = tool.plan || '';
    const langue = tool.langue || 'fr';
    const slug   = slugify(tool.name);
    if (!slug) { skipped++; continue; }

    let folder, html;

    if (plan === 'featured') {
      folder = path.join('tools', 'featured', langue, slug);
      html   = generateFeatured(tool, tools);
    } else if (plan === 'starter') {
      folder = path.join('tools', 'starter', langue, slug);
      html   = generateStarter(tool, tools);
    } else {
      folder = path.join('tools', 'standard', langue, slug);
      html   = generateStandard(tool, tools);
    }

    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'index.html'), html, 'utf8');
    generated++;

    if (generated % 50 === 0) console.log(`  → ${generated} fiches générées...`);
  }

  console.log(`\n✅ Outils — ${generated} fiches générées, ${noFiche} ignorées (generer_fiche=false), ${skipped} slug vides.`);
  console.log(`\nStructure :`);
  console.log(`  tools/featured/fr/{slug}/index.html`);
  console.log(`  tools/featured/en/{slug}/index.html`);
  console.log(`  tools/featured/es/{slug}/index.html`);
  console.log(`  tools/starter/{langue}/{slug}/index.html`);
  console.log(`  tools/standard/{langue}/{slug}/index.html`);

  // ─── NETTOYAGE DES FICHES OUTILS ORPHELINES ───
  console.log(`\n🧹 Nettoyage des fiches outils orphelines...`);

  const validToolPaths = new Set();
  for (const tool of tools) {
    if (tool.generer_fiche === false) continue;
    const plan   = tool.plan === 'featured' ? 'featured' : tool.plan === 'starter' ? 'starter' : 'standard';
    const langue = tool.langue || 'fr';
    const slug   = slugify(tool.name);
    if (!slug) continue;
    validToolPaths.add(path.join('tools', plan, langue, slug));
  }

  let removedTools = 0;
  for (const plan of ['featured', 'starter', 'standard']) {
    const planDir = path.join('tools', plan);
    if (!fs.existsSync(planDir)) continue;
    for (const langue of fs.readdirSync(planDir)) {
      const langueDir = path.join(planDir, langue);
      if (!fs.statSync(langueDir).isDirectory()) continue;
      for (const slugDir of fs.readdirSync(langueDir)) {
        const fullPath = path.join(langueDir, slugDir);
        if (!fs.statSync(fullPath).isDirectory()) continue;
        if (!validToolPaths.has(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`  🗑️  Supprimé : ${fullPath}`);
          removedTools++;
        }
      }
    }
  }
  console.log(`✓ ${removedTools} dossier(s) outil orphelin(s) supprimé(s).`);

  // ════════════════════════════════════════════════════════════
  // ARTICLES (blog)
  // ════════════════════════════════════════════════════════════
  console.log(`\n📥 Lecture de Firestore (articles)...`);
  const articlesSnap = await db.collection('articles').get();
  const articles = articlesSnap.docs.map(d => d.data());
  console.log(`✓ ${articles.length} documents trouvés`);

  let articlesGenerated = 0, articlesSkippedNoSlug = 0, articlesSkippedNoCorps = 0;

  for (const article of articles) {
    const langue = article.langue || 'fr';
    const slug   = article.slug || slugify(article.title);

    if (!slug) { articlesSkippedNoSlug++; continue; }
    // Un article sans corps_html ne doit jamais être publié : ça produirait
    // une page quasi vide, mauvaise pour le SEO et l'expérience utilisateur.
    // (C'est le cas typique juste après la migration depuis blog.json.)
    if (!article.corps_html || !article.corps_html.trim()) { articlesSkippedNoCorps++; continue; }

    const html = generateArticle(article, articles);
    if (!html) { articlesSkippedNoSlug++; continue; }

    const folder = path.join('articles', langue, slug);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'index.html'), html, 'utf8');
    articlesGenerated++;
  }

  console.log(`\n✅ Articles — ${articlesGenerated} fiches générées, ${articlesSkippedNoCorps} ignorées (corps_html vide), ${articlesSkippedNoSlug} slug vide.`);
  console.log(`\nStructure :`);
  console.log(`  articles/fr/{slug}/index.html`);
  console.log(`  articles/en/{slug}/index.html`);
  console.log(`  articles/es/{slug}/index.html`);

  // ─── NETTOYAGE DES ARTICLES ORPHELINS ───
  console.log(`\n🧹 Nettoyage des articles orphelins...`);

  const validArticlePaths = new Set();
  for (const article of articles) {
    const langue = article.langue || 'fr';
    const slug   = article.slug || slugify(article.title);
    if (!slug || !article.corps_html || !article.corps_html.trim()) continue;
    validArticlePaths.add(path.join('articles', langue, slug));
  }

  let removedArticles = 0;
  if (fs.existsSync('articles')) {
    for (const langue of fs.readdirSync('articles')) {
      const langueDir = path.join('articles', langue);
      if (!fs.statSync(langueDir).isDirectory()) continue;
      for (const slugDir of fs.readdirSync(langueDir)) {
        const fullPath = path.join(langueDir, slugDir);
        if (!fs.statSync(fullPath).isDirectory()) continue;
        if (!validArticlePaths.has(fullPath)) {
          fs.rmSync(fullPath, { recursive: true, force: true });
          console.log(`  🗑️  Supprimé : ${fullPath}`);
          removedArticles++;
        }
      }
    }
  }
  console.log(`✓ ${removedArticles} dossier(s) article orphelin(s) supprimé(s).`);

  // ════════════════════════════════════════════════════════════
  // COMPARATEUR (X vs Y)
  // ════════════════════════════════════════════════════════════
  console.log(`\n📥 Lecture de Firestore (comparaisons)...`);
  const comparaisonsSnap = await db.collection('comparaisons').get();
  const comparaisons = comparaisonsSnap.docs.map(d => d.data());
  console.log(`✓ ${comparaisons.length} documents trouvés`);

  let compGenerated = 0, compSkippedNoSlug = 0;

  for (const comp of comparaisons) {
    const slug = comp.slug;
    if (!slug) { compSkippedNoSlug++; continue; }

    const html = generateComparaison(comp, tools, comparaisons);
    if (!html) { compSkippedNoSlug++; continue; }

    const folder = path.join('comparateur', slug);
    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(path.join(folder, 'index.html'), html, 'utf8');
    compGenerated++;
  }

  console.log(`\n✅ Comparateur — ${compGenerated} pages générées, ${compSkippedNoSlug} ignorée(s) (slug vide).`);
  console.log(`\nStructure :`);
  console.log(`  comparateur/{slug}/index.html`);

  // ─── NETTOYAGE DES COMPARAISONS ORPHELINES ───
  console.log(`\n🧹 Nettoyage des pages comparateur orphelines...`);

  const validComparaisonPaths = new Set();
  for (const comp of comparaisons) {
    if (!comp.slug) continue;
    validComparaisonPaths.add(path.join('comparateur', comp.slug));
  }

  let removedComparaisons = 0;
  if (fs.existsSync('comparateur')) {
    for (const slugDir of fs.readdirSync('comparateur')) {
      const fullPath = path.join('comparateur', slugDir);
      if (!fs.statSync(fullPath).isDirectory()) continue;
      if (!validComparaisonPaths.has(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  🗑️  Supprimé : ${fullPath}`);
        removedComparaisons++;
      }
    }
  }
  console.log(`✓ ${removedComparaisons} dossier(s) comparateur orphelin(s) supprimé(s).`);
}

main().catch(err => { console.error('❌ Erreur:', err); process.exit(1); });

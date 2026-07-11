#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   gen-fiches.js — Générateur de fiches outils Albexia
   Source : Firestore collections "outils", "articles", "comparaisons"
   Sortie : tools/{plan}/{langue}/{slug}/index.html
            articles/{langue}/{slug}/index.html
            comparateur/{slug}/index.html
   Usage  : node gen-fiches.js

   ── Génération incrémentale ──
   Chaque doc lu est hashé (SHA-256 de son contenu). L'état
   (hash + updatedAt par doc) est persisté dans .gen-state.json,
   committé dans le repo avec le reste. Un doc dont le hash n'a
   pas changé depuis le dernier run n'est PAS réécrit sur disque
   — ça évite du bruit Git et du travail inutile.

   Important : ceci NE réduit PAS le nombre de lectures Firestore
   (chaque doc doit être lu pour calculer son hash et détecter les
   suppressions), seulement le nombre d'écritures fichier/Git.
   Réduire les lectures elles-mêmes demanderait des requêtes
   partielles (where updatedAt > lastRun) qui manqueraient les
   suppressions et les docs jamais resauvegardés — jugé trop
   fragile pour l'instant.

   Cascade : si un outil référencé par une comparaison a changé
   (note, prix, etc.), la comparaison est régénérée même si son
   propre contenu n'a pas bougé, pour rester synchronisée.
   ═══════════════════════════════════════════════════════ */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const fs     = require('fs');
const path   = require('path');
const crypto = require('crypto');

// ── Init Firebase Admin ──────────────────────────────────
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── État de génération incrémentale ──────────────────────
const STATE_PATH = '.gen-state.json';

function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
  } catch {
    // Premier run, ou fichier absent/corrompu : état vide, tout sera généré.
    return { outils: {}, articles: {}, comparaisons: {}, niches: {} };
  }
}

function saveState(state) {
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

// Hash stable du contenu d'un doc (indépendant de l'ordre des clés).
// On exclut updatedAt du hash : c'est un timestamp serveur qui change
// à chaque save même si le contenu réel est identique (ex: ré-ouverture
// puis fermeture d'un formulaire sans modif) — l'inclure ferait
// régénérer inutilement à chaque simple resauvegarde.
function hashDoc(data) {
  const { updatedAt, ...rest } = data;
  const sorted = JSON.stringify(rest, Object.keys(rest).sort());
  return crypto.createHash('sha256').update(sorted).digest('hex');
}

function updatedAtMs(data) {
  const u = data.updatedAt;
  if (!u) return 0;
  // Firestore Timestamp (admin SDK) expose toMillis()
  if (typeof u.toMillis === 'function') return u.toMillis();
  if (u instanceof Date) return u.getTime();
  return 0;
}

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
      <a href="${R}comparateur/" class="kebab-item" role="menuitem"><span class="kebab-ico">⚖️</span><div><div class="kebab-item-name">Comparateur</div></div></a>
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
  // Le favicon n'est jamais saisi à la main dans l'admin (pas de champ pour
  // ça) — on le dérive automatiquement du lien de secours, comme pour les
  // outils résolus, plutôt que de dépendre d'un champ qui n'existe pas.
  const lienFallback = comp[`outil_${side}_lien_fallback`] || '';
  const faviconFallback = lienFallback
    ? `https://www.google.com/s2/favicons?sz=64&domain=${lienFallback.replace(/^https?:\/\//,'').split('/')[0]}`
    : '';
  return {
    nom: nomFallback || (side === 'a' ? 'Outil A' : 'Outil B'),
    slug: slugRef || slugify(nomFallback),
    emoji: comp[`outil_${side}_emoji_fallback`] || '🤖',
    favicon: faviconFallback,
    categorie: comp[`outil_${side}_categorie_fallback`] || '',
    note: comp[`outil_${side}_note_fallback`] ? Number(comp[`outil_${side}_note_fallback`]) : 4.5,
    lien: lienFallback || '#',
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

// ── Page listing paginée : comparateur/index.html, comparateur/page/2/index.html, ... ──
const COMPARATEUR_PAR_PAGE = 12;

// Réutilise les classes .paire-link/.paire-logos/.paire-vs déjà stylées dans
// css/style.css (existantes sur le site depuis l'ancien comparateur.html) —
// pas de CSS à dupliquer pour cette partie. Repli emoji si aucun favicon
// n'est disponible (ex: comparaison créée via secours sans lien renseigné).
function comparateurItemHTML(comp, tools) {
  const langue = comp.langue || 'fr';
  const a = resoudreOutilComparaison('a', comp, tools, langue);
  const b = resoudreOutilComparaison('b', comp, tools, langue);
  const logo = (outil) => outil.favicon
    ? `<img src="${outil.favicon}" alt="${outil.nom}" onerror="this.style.display='none';this.nextElementSibling.style.display='inline'"><span style="display:none">${outil.emoji}</span>`
    : `<span>${outil.emoji}</span>`;
  return `<a href="${R}comparateur/${comp.slug}/index.html" class="paire-link">
    <div class="paire-logos">
      ${logo(a)}
      <span class="paire-vs">VS</span>
      ${logo(b)}
    </div>
    <span style="flex:1;font-size:12px">${a.nom} vs ${b.nom}</span>
    <span style="color:var(--text-dim);font-size:11px">→</span>
  </a>`;
}

// Construit le tableau TOOLS_DATA injecté au build pour le picker interactif,
// depuis la collection "outils" déjà en mémoire (zéro lecture Firestore côté
// visiteur). Seuls les outils FR sont inclus — c'est un annuaire francophone,
// et TOOLS_DATA original ne mélangeait pas les variantes de langue.
//
// triEtat : distingue "vrai" / "faux" / "jamais renseigné" plutôt que de tout
// forcer en booléen strict. Un champ jamais coché dans l'admin (undefined)
// affichait sinon une croix rouge trompeuse, identique à un vrai "non" —
// alors que "—" (inconnu) est le signal honnête tant que la donnée n'a pas
// été saisie. afficherComparaison() sait déjà gérer ce 3e état (val===true /
// val===false / sinon "—") ; seul le cast en amont ici les confondait.
function triEtat(val) {
  if (val === true) return true;
  if (val === false) return false;
  return null; // jamais renseigné
}

function buildToolsDataJSON(tools) {
  const fr = tools.filter(t => t.name && (!t.langue || t.langue === 'fr'));
  const data = fr.map(t => ({
    id: t.id,
    name: t.name,
    emoji: t.emoji || '🤖',
    favicon: `https://www.google.com/s2/favicons?sz=64&domain=${(t.url||'').replace(/^https?:\/\//,'').split('/')[0]}`,
    category: t.category || '',
    price: t.price || '',
    essai_gratuit: triEtat(t.essai_gratuit),
    duree_essai: t.duree_essai || null,
    langue_fr: triEtat(t.interface_fr),
    api: triEtat(t.api),
    mobile: triEtat(t.mobile),
    ideal_pour: t.ideal_pour || '',
    note: typeof t.note === 'number' ? t.note : (typeof t.rating === 'number' ? t.rating : null),
    lien_affilie: t.url || '#',
  }));
  return JSON.stringify(data);
}

function paginationHTML(currentPage, totalPages) {
  if (totalPages <= 1) return '';
  const pageUrl = (n) => n === 1 ? `${R}comparateur/index.html` : `${R}comparateur/page/${n}/index.html`;
  let links = '';

  links += currentPage > 1
    ? `<a href="${pageUrl(currentPage-1)}" class="cpl-page-link">← Précédent</a>`
    : `<span class="cpl-page-link disabled">← Précédent</span>`;

  for (let n = 1; n <= totalPages; n++) {
    links += `<a href="${pageUrl(n)}" class="cpl-page-link${n===currentPage?' active':''}">${n}</a>`;
  }

  links += currentPage < totalPages
    ? `<a href="${pageUrl(currentPage+1)}" class="cpl-page-link">Suivant →</a>`
    : `<span class="cpl-page-link disabled">Suivant →</span>`;

  return `<div class="cpl-pagination">${links}</div>`;
}

// comparaisonsTriees : déjà triées (plus récentes en premier) par l'appelant
function generateComparateurIndexPage(comparaisonsTriees, tools, pageNum, totalPages) {
  const langue = 'fr';
  const start = (pageNum - 1) * COMPARATEUR_PAR_PAGE;
  const pageItems = comparaisonsTriees.slice(start, start + COMPARATEUR_PAR_PAGE);

  const canonicalUrl = pageNum === 1
    ? `${SITE_ORIGIN}/comparateur/index.html`
    : `${SITE_ORIGIN}/comparateur/page/${pageNum}/index.html`;

  const titleTag = pageNum === 1
    ? `Comparateur d'outils IA — Comparaisons détaillées | Albexia`
    : `Comparateur d'outils IA — Page ${pageNum} | Albexia`;
  const metaDesc = `Comparez les meilleurs outils IA côte à côte : fonctionnalités, prix, avis. ${comparaisonsTriees.length} comparaisons détaillées sur Albexia.`;

  const listHTML = pageItems.length
    ? pageItems.map(c => comparateurItemHTML(c, tools)).join('\n')
    : `<div class="cpl-empty">Aucune comparaison publiée pour le moment.</div>`;

  // La pagination 2+ est en noindex : évite le contenu quasi-dupliqué en SERP
  // tout en gardant ces pages crawlables (follow) pour que Google découvre
  // les comparaisons individuelles au fil des pages suivantes.
  const robotsTag = pageNum === 1 ? 'index, follow' : 'noindex, follow';
  const prevUrl = pageNum === 2 ? `${SITE_ORIGIN}/comparateur/index.html` : `${SITE_ORIGIN}/comparateur/page/${pageNum-1}/index.html`;
  const nextUrl = `${SITE_ORIGIN}/comparateur/page/${pageNum+1}/index.html`;

  return `<!DOCTYPE html>
<html lang="${langue}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${titleTag}</title>
  <meta name="description" content="${metaDesc}" />
  <meta name="robots" content="${robotsTag}" />

  <link rel="canonical" href="${canonicalUrl}" />
  ${pageNum > 1 ? `<link rel="prev" href="${prevUrl}" />` : ''}
  ${pageNum < totalPages ? `<link rel="next" href="${nextUrl}" />` : ''}

  <meta property="og:title"       content="${titleTag}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:type"        content="website" />
  <meta property="og:url"         content="${canonicalUrl}" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${R}css/style.css" />
  <link rel="stylesheet" href="${R}css/comparer.css" />
</head>
<body>

${navHTML(langue)}

<section class="comp-hero">
  <div class="comp-badge">⚖️ Comparez les outils IA</div>
  <h1>Trouvez <span class="grad">le meilleur outil</span><br>pour vous</h1>
  <p>Sélectionnez 2 ou 3 outils et comparez-les côte à côte en quelques secondes.</p>
</section>

<div class="comp-selection">
  <div class="comp-search">
    <span class="comp-search-icon">🔍</span>
    <input type="text" id="comp-search-input" placeholder="Rechercher un outil… (ex: Jasper, Canva, Runway)">
  </div>
  <div class="comp-cat-filters" id="comp-cats"></div>
  <div class="tools-picker" id="tools-picker"></div>
</div>

<div class="selected-bar">
  <div class="selected-bar-inner">
    <div class="selected-chips" id="selected-chips">
      <span class="selected-hint" id="selected-hint">Sélectionnez 2 ou 3 outils ci-dessus</span>
    </div>
    <button class="comp-btn" id="comp-btn" disabled onclick="afficherComparaison()">Comparer →</button>
  </div>
</div>

<div class="comp-result" id="comp-result">
  <div class="comp-result-title" id="comp-result-title"></div>
  <div class="comp-table-wrap">
    <table class="comp-table" id="comp-table"></table>
  </div>
  <div class="comp-cta-row" id="comp-cta-row"></div>
  <span class="comp-reset" onclick="resetComparaison()">← Nouvelle comparaison</span>
</div>

<div class="paires-section">
  <div class="paires-title">${pageNum === 1 ? 'Comparaisons populaires' : `Comparaisons populaires — Page ${pageNum}`} (${comparaisonsTriees.length})</div>
  <div class="paires-grid" id="paires-grid">
${listHTML}
  </div>
  ${paginationHTML(pageNum, totalPages)}
</div>

${footerHTML()}
<script>
const TOOLS_DATA = ${buildToolsDataJSON(tools)};

let selected = [], filteredTools = [...TOOLS_DATA], activeCategory = 'Tous';

function normaliser(s){ return (s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim(); }

function initCats(){
  const cats = ['Tous', ...new Set(TOOLS_DATA.map(t=>t.category).filter(Boolean))];
  const el = document.getElementById('comp-cats');
  el.innerHTML = cats.map(c=>\`<button class="comp-cat-btn\${c==='Tous'?' active':''}" data-cat="\${c}">\${c}</button>\`).join('');
  el.querySelectorAll('.comp-cat-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      activeCategory=btn.dataset.cat;
      el.querySelectorAll('.comp-cat-btn').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      applyFilters();
    });
  });
}

function applyFilters(){
  const q=normaliser(document.getElementById('comp-search-input').value);
  filteredTools=TOOLS_DATA.filter(t=>{
    const matchCat=activeCategory==='Tous'||t.category===activeCategory;
    const matchQ=!q||normaliser(t.name).includes(q)||normaliser(t.category).includes(q);
    return matchCat&&matchQ;
  });
  renderPicker();
}

function renderPicker(){
  document.getElementById('tools-picker').innerHTML=filteredTools.map(t=>{
    const isSel=selected.includes(t.id), isDisabled=!isSel&&selected.length>=3;
    const logo = t.favicon
      ? \`<img src="\${t.favicon}" alt="\${t.name}" class="picker-logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="picker-logo-fallback" style="display:none">\${t.emoji}</span>\`
      : \`<span class="picker-logo-fallback">\${t.emoji}</span>\`;
    return \`<div class="picker-card\${isSel?' selected':''}\${isDisabled?' disabled':''}" onclick="toggleTool(\${t.id})">
      \${logo}<span class="picker-name">\${t.name}</span><span class="picker-check">✓</span>
    </div>\`;
  }).join('');
}

function toggleTool(id){
  const idx=selected.indexOf(id);
  if(idx>-1){ selected.splice(idx,1); } else if(selected.length<3){ selected.push(id); }
  renderPicker(); renderChips();
}

function renderChips(){
  const hint=document.getElementById('selected-hint');
  const chips=document.getElementById('selected-chips');
  const btn=document.getElementById('comp-btn');
  chips.querySelectorAll('.selected-chip').forEach(e=>e.remove());
  if(selected.length===0){ hint.style.display='inline'; }
  else {
    hint.style.display='none';
    selected.forEach(id=>{
      const t=TOOLS_DATA.find(x=>x.id===id); if(!t) return;
      const chip=document.createElement('div'); chip.className='selected-chip';
      const logoEl = t.favicon ? \`<img src="\${t.favicon}" alt="" style="width:14px;height:14px;border-radius:3px;object-fit:contain" onerror="this.style.display='none'">\` : t.emoji;
      chip.innerHTML=\`\${logoEl} \${t.name} <span class="chip-remove" onclick="toggleTool(\${id})">×</span>\`;
      chips.appendChild(chip);
    });
  }
  btn.disabled=selected.length<2;
}

function afficherComparaison(){
  const outils=selected.map(id=>TOOLS_DATA.find(t=>t.id===id)).filter(Boolean);
  if(outils.length<2) return;
  const result=document.getElementById('comp-result');
  document.getElementById('comp-result-title').textContent=outils.map(t=>t.name).join(' vs ');
  const criteres=[
    ['Prix de base',       t=>t.price||'—',                    false],
    ['Essai gratuit',      t=>t.essai_gratuit,                 true],
    ["Durée d'essai",      t=>t.duree_essai||'—',              false],
    ['Support français',   t=>t.langue_fr,                     true],
    ['API disponible',     t=>t.api,                           true],
    ['App mobile',         t=>t.mobile,                        true],
    ['Idéal pour',         t=>t.ideal_pour||'—',               false],
    ['Note Albexia',       t=>t.note?t.note+'/5':'—',          false],
  ];
  let thead='<thead><tr><th>Critère</th>';
  outils.forEach(t=>{
    const logoEl = t.favicon
      ? \`<img src="\${t.favicon}" alt="\${t.name}" class="th-logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="th-logo-fallback" style="display:none">\${t.emoji}</span>\`
      : \`<span class="th-logo-fallback">\${t.emoji}</span>\`;
    thead+=\`<th class="tool-col">\${logoEl}\${t.name}</th>\`;
  });
  thead+='</tr></thead>';
  let tbody='<tbody>';
  criteres.forEach(([label,fn,isBool])=>{
    tbody+=\`<tr><td class="crit-col">\${label}</td>\`;
    outils.forEach(t=>{
      const val=fn(t);
      if(isBool){ tbody+=val===true?'<td><span class="yes">✓</span></td>':val===false?'<td><span class="no">✗</span></td>':'<td><span style="color:var(--text-dim)">—</span></td>'; }
      else { tbody+=\`<td>\${val}</td>\`; }
    });
    tbody+='</tr>';
  });
  tbody+='</tbody>';
  document.getElementById('comp-table').innerHTML=thead+tbody;
  document.getElementById('comp-cta-row').innerHTML=outils.map(t=>{
    const logoEl = t.favicon ? \`<img src="\${t.favicon}" alt="">\` : '';
    return \`<a href="\${t.lien_affilie}" target="_blank" rel="noopener" class="comp-cta-btn">\${logoEl} Essayer \${t.name} →</a>\`;
  }).join('');
  result.classList.add('show');
  result.scrollIntoView({behavior:'smooth',block:'start'});
}

function resetComparaison(){
  selected=[]; renderPicker(); renderChips();
  document.getElementById('comp-result').classList.remove('show');
  window.scrollTo({top:0,behavior:'smooth'});
}

document.getElementById('comp-search-input').addEventListener('input',applyFilters);
initCats(); applyFilters();
</script>
${sharedJS()}
</body>
</html>`;
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

<a href="${R}comparateur/" class="cp-back">← ${{fr:'Retour au comparateur',en:'Back to comparator',es:'Volver al comparador'}[langue]||'Retour au comparateur'}</a>

${footerHTML()}
${faqHTML ? '<script>function toggleFAQ(i){document.getElementById("faq-"+i).classList.toggle("open");}</script>' : ''}
${sharedJS()}
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════
// GÉNÉRATEUR NICHES (micro-niches SEO par métier)
// Source : Firestore collection "niches"
// Sortie : niches/{slug}/index.html
//
// Seules les niches status==='publie' sont générées — un brouillon
// reste en Firestore mais n'a jamais de page HTML publique tant que
// Damon ne l'a pas validé dans l'admin, quel que soit son contenu.
// ════════════════════════════════════════════════════════════

function nicheToolCardHTML(tool) {
  const fav = `https://www.google.com/s2/favicons?sz=64&domain=${(tool.url||'').replace(/^https?:\/\//,'').split('/')[0]}`;
  const note = typeof tool.note === 'number' ? tool.note : (typeof tool.rating === 'number' ? tool.rating : null);
  const slug = slugify(tool.name);
  const plan = tool.plan === 'featured' ? 'featured' : tool.plan === 'starter' ? 'starter' : 'standard';
  const langue = tool.langue || 'fr';
  const ficheUrl = `${R}tools/${plan}/${langue}/${slug}/`;
  return `<a href="${ficheUrl}" class="niche-tool-card">
  <div class="ntc-top">
    <img src="${fav}" alt="${tool.name}" class="ntc-logo" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
    <span class="ntc-logo-fallback" style="display:none">${tool.emoji||'🤖'}</span>
    <span class="ntc-name">${tool.name}</span>
    ${note ? `<span class="ntc-note">★ ${note}</span>` : ''}
  </div>
  <span class="ntc-cat">${tool.category||''}</span>
  <span class="ntc-cta">Voir la fiche →</span>
</a>`;
}

function generateNichePage(niche, tools, allNiches) {
  const langue = 'fr';
  const slug = niche.slug;
  if (!slug) return null;

  const outilsMatches = (niche.outils_slugs || [])
    .map(s => tools.find(t => slugify(t.name) === s && (!t.langue || t.langue === 'fr')))
    .filter(Boolean);

  const canonicalUrl = `${SITE_ORIGIN}/niches/${slug}/index.html`;
  const titleTag = niche.meta_title || `Meilleurs outils IA pour ${niche.metier} en 2026 | Albexia`;
  const metaDesc = niche.meta_description || niche.intro_ia?.slice(0, 155) || `Découvrez les meilleurs outils IA sélectionnés pour ${niche.metier}. Comparatif et conseils Albexia.`;

  const toolsGridHTML = outilsMatches.length
    ? outilsMatches.map(nicheToolCardHTML).join('\n')
    : `<p style="color:var(--text-dim);font-size:14px;">Aucun outil sélectionné pour l'instant.</p>`;

  const conseilsHTML = niche.conseils_ia ? `<div class="niche-section">
  <div class="niche-section-title">Comment choisir ?</div>
  <div class="niche-conseils">${niche.conseils_ia}</div>
</div>` : '';

  const faqItems = niche.faq || [];
  const faqHTML = faqItems.length ? `<div class="niche-section">
  <div class="niche-section-title">Questions fréquentes</div>
  <div class="niche-faq">
    ${faqItems.map((f, i) => `<div class="niche-faq-item" id="nfaq-${i}">
      <button class="niche-faq-question" onclick="toggleNicheFAQ(${i})">
        <span>${f.question}</span>
        <span class="niche-faq-arrow">▼</span>
      </button>
      <div class="niche-faq-answer">${f.reponse}</div>
    </div>`).join('')}
  </div>
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

  // Maillage interne : autres niches publiées de la même super-catégorie
  const nichesLiees = allNiches.filter(n => n.status === 'publie' && n.super_categorie === niche.super_categorie && n.slug !== slug).slice(0, 8);
  const relatedHTML = nichesLiees.length ? `<div class="niche-section">
  <div class="niche-section-title">Autres métiers en ${niche.super_categorie}</div>
  <div class="niche-related">
    ${nichesLiees.map(n => `<a href="${R}niches/${n.slug}/index.html" class="niche-related-link">${n.metier}</a>`).join('')}
  </div>
</div>` : '';

  const articleJsonLd = `
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": ${JSON.stringify(`Meilleurs outils IA pour ${niche.metier}`)},
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

  <meta property="og:title"       content="${titleTag}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:type"        content="website" />
  <meta property="og:url"         content="${canonicalUrl}" />
${articleJsonLd}
${faqJsonLd}
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="${R}css/style.css" />
  <link rel="stylesheet" href="${R}css/niche.css" />
</head>
<body>

${navHTML(langue)}

<section class="niche-hero">
  <div class="niche-hero-glow"></div>
  <div class="niche-badge">${niche.super_categorie}</div>
  <h1>Meilleurs outils IA pour ${niche.metier}</h1>
  <p>${niche.intro_ia || ''}</p>
</section>

<div class="niche-section">
  <div class="niche-section-title">Notre sélection (${outilsMatches.length})</div>
  <div class="niche-tools-grid">
${toolsGridHTML}
  </div>
</div>

${conseilsHTML}

${faqHTML}

${relatedHTML}

<div class="niche-cta-wrap">
  <a href="${R}index.html#tools" class="niche-cta-btn">Explorer tout le catalogue →</a>
</div>

<a href="${R}index.html#tools" class="niche-back">← Retour au catalogue</a>

${footerHTML()}
${faqHTML ? '<script>function toggleNicheFAQ(i){document.getElementById("nfaq-"+i).classList.toggle("open");}</script>' : ''}
${sharedJS()}
</body>
</html>`;
}

// ════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════
async function main() {
  const state = loadState();
  const newState = { outils: {}, articles: {}, comparaisons: {}, niches: {} };

  console.log('📥 Lecture de Firestore (outils)...');
  const snap  = await db.collection('outils').get();
  const tools = snap.docs.map(d => d.data());
  console.log(`✓ ${tools.length} documents trouvés`);

  let generated = 0, skipped = 0, noFiche = 0, unchanged = 0;
  const changedToolIds = new Set(); // pour la cascade vers comparaisons

  for (const tool of tools) {
    const toolHash = hashDoc(tool);
    const toolId   = String(tool.id || slugify(tool.name));
    newState.outils[toolId] = { hash: toolHash, updatedAtMs: updatedAtMs(tool) };

    const previousHash = state.outils?.[toolId]?.hash;
    const hasChanged = previousHash !== toolHash;
    if (hasChanged) changedToolIds.add(toolId);

    // Toggle générer_fiche
    if (tool.generer_fiche === false) { noFiche++; continue; }

    const plan   = tool.plan || '';
    const langue = tool.langue || 'fr';
    const slug   = slugify(tool.name);
    if (!slug) { skipped++; continue; }

    let folder;
    if (plan === 'featured') folder = path.join('tools', 'featured', langue, slug);
    else if (plan === 'starter') folder = path.join('tools', 'starter', langue, slug);
    else folder = path.join('tools', 'standard', langue, slug);

    const filePath = path.join(folder, 'index.html');

    // Skip l'écriture si rien n'a changé ET le fichier existe déjà sur disque
    // (le fichier peut manquer après un nettoyage manuel ou un premier run partiel).
    if (!hasChanged && fs.existsSync(filePath)) { unchanged++; continue; }

    let html;
    if (plan === 'featured')      html = generateFeatured(tool, tools);
    else if (plan === 'starter')  html = generateStarter(tool, tools);
    else                          html = generateStandard(tool, tools);

    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
    generated++;

    if (generated % 50 === 0) console.log(`  → ${generated} fiches générées...`);
  }

  console.log(`\n✅ Outils — ${generated} régénérée(s), ${unchanged} inchangée(s) (skip), ${noFiche} ignorée(s) (generer_fiche=false), ${skipped} slug vide(s).`);
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

  let articlesGenerated = 0, articlesSkippedNoSlug = 0, articlesSkippedNoCorps = 0, articlesUnchanged = 0;

  for (const article of articles) {
    const articleHash = hashDoc(article);
    const articleId    = String(article.id || article.slug);
    newState.articles[articleId] = { hash: articleHash, updatedAtMs: updatedAtMs(article) };
    const hasChanged = state.articles?.[articleId]?.hash !== articleHash;

    const langue = article.langue || 'fr';
    const slug   = article.slug || slugify(article.title);

    if (!slug) { articlesSkippedNoSlug++; continue; }
    // Un article sans corps_html ne doit jamais être publié : ça produirait
    // une page quasi vide, mauvaise pour le SEO et l'expérience utilisateur.
    // (C'est le cas typique juste après la migration depuis blog.json.)
    if (!article.corps_html || !article.corps_html.trim()) { articlesSkippedNoCorps++; continue; }

    const folder   = path.join('articles', langue, slug);
    const filePath = path.join(folder, 'index.html');

    if (!hasChanged && fs.existsSync(filePath)) { articlesUnchanged++; continue; }

    const html = generateArticle(article, articles);
    if (!html) { articlesSkippedNoSlug++; continue; }

    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
    articlesGenerated++;
  }

  console.log(`\n✅ Articles — ${articlesGenerated} régénéré(s), ${articlesUnchanged} inchangé(s) (skip), ${articlesSkippedNoCorps} ignoré(s) (corps_html vide), ${articlesSkippedNoSlug} slug vide.`);
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

  let compGenerated = 0, compSkippedNoSlug = 0, compUnchanged = 0, compCascade = 0;

  for (const comp of comparaisons) {
    const compHash = hashDoc(comp);
    const compId   = String(comp.id || comp.slug);
    newState.comparaisons[compId] = { hash: compHash, updatedAtMs: updatedAtMs(comp) };

    const ownHasChanged = state.comparaisons?.[compId]?.hash !== compHash;

    // Cascade : régénérer aussi si l'un des deux outils référencés a changé,
    // pour que note/prix/logo affichés restent synchronisés avec "outils".
    const refA = comp.outil_a_slug;
    const refB = comp.outil_b_slug;
    const referencedToolChanged =
      (refA && changedToolIds.has(refA)) ||
      (refB && changedToolIds.has(refB)) ||
      // Fallback : si les IDs Firestore des outils diffèrent des slugs
      // (selon comment "id" est stocké), on vérifie aussi par nom résolu.
      tools.some(t => (slugify(t.name) === refA || slugify(t.name) === refB)
                    && changedToolIds.has(String(t.id || slugify(t.name))));

    const hasChanged = ownHasChanged || referencedToolChanged;
    if (!ownHasChanged && referencedToolChanged) compCascade++;

    const slug = comp.slug;
    if (!slug) { compSkippedNoSlug++; continue; }

    const folder   = path.join('comparateur', slug);
    const filePath = path.join(folder, 'index.html');

    if (!hasChanged && fs.existsSync(filePath)) { compUnchanged++; continue; }

    const html = generateComparaison(comp, tools, comparaisons);
    if (!html) { compSkippedNoSlug++; continue; }

    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
    compGenerated++;
  }

  console.log(`\n✅ Comparateur — ${compGenerated} régénérée(s) (dont ${compCascade} via cascade outil modifié), ${compUnchanged} inchangée(s) (skip), ${compSkippedNoSlug} ignorée(s) (slug vide).`);
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
      if (slugDir === 'page') continue; // dossier de pagination, pas une comparaison
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

  // ════════════════════════════════════════════════════════════
  // COMPARATEUR — PAGE LISTING PAGINÉE (comparateur/index.html)
  // ════════════════════════════════════════════════════════════
  // Régénérée si : une comparaison a été ajoutée/modifiée/supprimée
  // (le nombre total ou le hash de l'ensemble a changé), ou si le
  // nombre de pages change suite à ça. On la reconstruit entièrement
  // à chaque fois qu'un changement est détecté côté comparaisons —
  // c'est une liste globale, pas un doc individuel qu'on peut hasher
  // isolément de la même façon.
  const comparaisonsValides = comparaisons.filter(c => c.slug);
  // Tri : plus récentes en premier (fallback ordre Firestore si pas de updatedAt)
  const comparaisonsTriees = [...comparaisonsValides].sort((a, b) => updatedAtMs(b) - updatedAtMs(a));
  const totalPages = Math.max(1, Math.ceil(comparaisonsTriees.length / COMPARATEUR_PAR_PAGE));

  // Détection de changement au niveau de la liste : le run a-t-il généré,
  // supprimé, ou fait cascader au moins une comparaison ? Ou bien un outil
  // a-t-il changé (TOOLS_DATA, embarqué dans cette page pour le picker
  // interactif, dépend de TOUS les outils FR, pas seulement ceux référencés
  // par une comparaison) ? Si l'une de ces conditions est vraie, la page
  // doit être reconstruite.
  const listeAChange = compGenerated > 0 || removedComparaisons > 0 || changedToolIds.size > 0;
  const indexExists = fs.existsSync(path.join('comparateur', 'index.html'));

  let listPagesGenerated = 0;
  if (listeAChange || !indexExists) {
    for (let p = 1; p <= totalPages; p++) {
      const html = generateComparateurIndexPage(comparaisonsTriees, tools, p, totalPages);
      const folder = p === 1 ? 'comparateur' : path.join('comparateur', 'page', String(p));
      fs.mkdirSync(folder, { recursive: true });
      fs.writeFileSync(path.join(folder, 'index.html'), html, 'utf8');
      listPagesGenerated++;
    }
    console.log(`\n✅ Page listing comparateur — ${listPagesGenerated} page(s) générée(s) (${comparaisonsTriees.length} comparaisons, ${totalPages} page(s) au total).`);
  } else {
    console.log(`\n✅ Page listing comparateur — inchangée, régénération non nécessaire.`);
  }

  // ─── NETTOYAGE DES PAGES DE PAGINATION EXCÉDENTAIRES ───
  // Si le nombre de comparaisons diminue, il faut supprimer les anciennes
  // pages de pagination devenues excédentaires (ex: on avait 3 pages, il
  // n'en faut plus que 2 → comparateur/page/3/ doit disparaître).
  const pageDir = path.join('comparateur', 'page');
  let removedPages = 0;
  if (fs.existsSync(pageDir)) {
    for (const pDir of fs.readdirSync(pageDir)) {
      const pNum = Number(pDir);
      const fullPath = path.join(pageDir, pDir);
      if (!fs.statSync(fullPath).isDirectory()) continue;
      if (isNaN(pNum) || pNum > totalPages || pNum < 2) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  🗑️  Page de pagination excédentaire supprimée : ${fullPath}`);
        removedPages++;
      }
    }
  }
  if (removedPages > 0) console.log(`✓ ${removedPages} page(s) de pagination excédentaire(s) supprimée(s).`);

  // ─── REDIRECTION DEPUIS L'ANCIEN CHEMIN tools/comparateur.html ───
  // L'ancienne page (fetch JS runtime) est remplacée par la génération
  // statique ci-dessus. On garde un fichier de redirection à l'ancien
  // chemin pour ne pas casser les liens externes/backlinks existants.
  const redirectFolder = 'tools';
  fs.mkdirSync(redirectFolder, { recursive: true });
  fs.writeFileSync(path.join(redirectFolder, 'comparateur.html'), `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <title>Redirection — Comparateur | Albexia</title>
  <meta name="robots" content="noindex, follow" />
  <link rel="canonical" href="${SITE_ORIGIN}/comparateur/index.html" />
  <meta http-equiv="refresh" content="0; url=${R}comparateur/index.html" />
  <script>window.location.replace('${R}comparateur/index.html');</script>
</head>
<body>
  <p>Cette page a été déplacée. Si vous n'êtes pas redirigé automatiquement,
  <a href="${R}comparateur/index.html">cliquez ici</a>.</p>
</body>
</html>`, 'utf8');
  console.log(`\n↪️  Redirection tools/comparateur.html → comparateur/index.html écrite.`);

  // ════════════════════════════════════════════════════════════
  // NICHES (micro-niches SEO par métier)
  // ════════════════════════════════════════════════════════════
  // Seules les niches status==='publie' génèrent une page HTML publique —
  // un brouillon reste en Firestore, visible dans l'admin, mais jamais
  // exposé publiquement tant qu'il n'est pas validé.
  console.log(`\n📥 Lecture de Firestore (niches)...`);
  const nichesSnap = await db.collection('niches').get();
  const niches = nichesSnap.docs.map(d => d.data());
  console.log(`✓ ${niches.length} documents trouvés`);

  let nichesGenerated = 0, nichesSkippedNoSlug = 0, nichesSkippedBrouillon = 0, nichesUnchanged = 0, nichesCascade = 0;

  for (const niche of niches) {
    const nicheHash = hashDoc(niche);
    const nicheId   = String(niche.id || niche.slug);
    newState.niches[nicheId] = { hash: nicheHash, updatedAtMs: updatedAtMs(niche) };

    const ownHasChanged = state.niches?.[nicheId]?.hash !== nicheHash;

    // Cascade : régénérer aussi si l'un des outils référencés a changé
    // (note, favicon, etc.), même si la niche elle-même n'a pas bougé —
    // même logique que pour le comparateur.
    const outilsRefs = niche.outils_slugs || [];
    const referencedToolChanged = outilsRefs.some(slugRef =>
      changedToolIds.has(slugRef) ||
      tools.some(t => slugify(t.name) === slugRef && changedToolIds.has(String(t.id || slugify(t.name))))
    );

    const hasChanged = ownHasChanged || referencedToolChanged;

    const slug = niche.slug;
    if (!slug) { nichesSkippedNoSlug++; continue; }

    const folder   = path.join('niches', slug);
    const filePath = path.join(folder, 'index.html');

    if (niche.status !== 'publie') {
      nichesSkippedBrouillon++;
      // Un brouillon qui a été DÉPUBLIÉ (existait publié avant, repassé en
      // brouillon) doit voir sa page retirée — pas seulement les nouveaux
      // brouillons jamais publiés. On laisse le nettoyage orphelin plus bas
      // s'en charger, puisqu'un brouillon n'est jamais dans validNichePaths.
      continue;
    }

    // Comptée seulement ici (après le filtre brouillon) pour que le nombre
    // reflète des pages RÉELLEMENT régénérées par cascade, pas des niches
    // brouillon qui référencent aussi un outil modifié sans jamais publier.
    if (!ownHasChanged && referencedToolChanged) nichesCascade++;

    if (!hasChanged && fs.existsSync(filePath)) { nichesUnchanged++; continue; }

    const html = generateNichePage(niche, tools, niches);
    if (!html) { nichesSkippedNoSlug++; continue; }

    fs.mkdirSync(folder, { recursive: true });
    fs.writeFileSync(filePath, html, 'utf8');
    nichesGenerated++;
  }

  console.log(`\n✅ Niches — ${nichesGenerated} régénérée(s) (dont ${nichesCascade} via cascade outil modifié), ${nichesUnchanged} inchangée(s) (skip), ${nichesSkippedBrouillon} en brouillon (non générées), ${nichesSkippedNoSlug} ignorée(s) (slug vide).`);
  console.log(`\nStructure :`);
  console.log(`  niches/{slug}/index.html`);

  // ─── NETTOYAGE DES NICHES ORPHELINES OU DÉPUBLIÉES ───
  console.log(`\n🧹 Nettoyage des pages niches orphelines ou dépubliées...`);

  const validNichePaths = new Set();
  for (const niche of niches) {
    if (!niche.slug || niche.status !== 'publie') continue;
    validNichePaths.add(path.join('niches', niche.slug));
  }

  let removedNiches = 0;
  if (fs.existsSync('niches')) {
    for (const slugDir of fs.readdirSync('niches')) {
      const fullPath = path.join('niches', slugDir);
      if (!fs.statSync(fullPath).isDirectory()) continue;
      if (!validNichePaths.has(fullPath)) {
        fs.rmSync(fullPath, { recursive: true, force: true });
        console.log(`  🗑️  Supprimé : ${fullPath}`);
        removedNiches++;
      }
    }
  }
  console.log(`✓ ${removedNiches} dossier(s) niche orphelin(s) ou dépublié(s) supprimé(s).`);

  // ─── SAUVEGARDE DE L'ÉTAT DE GÉNÉRATION ───
  // newState ne contient que les docs actuellement en base : un doc supprimé
  // de Firestore disparaît automatiquement de l'état au prochain run.
  saveState(newState);
  console.log(`\n💾 État de génération sauvegardé dans ${STATE_PATH} (à committer avec le reste).`);
}

main().catch(err => { console.error('❌ Erreur:', err); process.exit(1); });

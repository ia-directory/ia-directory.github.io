/* ═══════════════════════════════════════
   Albexia — app.js
   Fonctionnalités : navigation, JSON,
   collections Firebase, soumission d'outil
   ═══════════════════════════════════════ */

'use strict';

// LS_KEY favoris supprimé → remplacé par Firebase collections
const LS_LANG_KEY = 'albexia_langue';

// ─── SLUG / URL FICHE ────────────────────
// Identique à la logique de gen-fiches.js — garantit que les URLs
// reconstruites ici correspondent toujours aux fichiers réellement générés,
// sans dépendre du champ "page" stocké en Firestore (qui peut être obsolète).
function slugify(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildToolPageUrl(t) {
  if (t.generer_fiche === false) return null; // pas de fiche générée pour cet outil
  const slug = slugify(t.name);
  if (!slug) return null;
  const folder = t.plan === 'featured' ? 'featured' : t.plan === 'starter' ? 'starter' : 'standard';
  const langue = t.langue || 'fr';
  return `/tools/${folder}/${langue}/${slug}/`;
}

// ─── LANGUE ──────────────────────────────
const LANGUES_SUPPORTEES = ['fr', 'en', 'es'];

function detecterLangue() {
  const saved = localStorage.getItem(LS_LANG_KEY);
  if (saved && LANGUES_SUPPORTEES.includes(saved)) return saved;
  const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  if (LANGUES_SUPPORTEES.includes(nav)) return nav;
  return 'fr';
}

function changerLangue(code) {
  if (!LANGUES_SUPPORTEES.includes(code)) return;
  localStorage.setItem(LS_LANG_KEY, code);
  state.langue = code;
  state.activeToolCat    = 'Tous';
  state.activeBlogCat    = 'Tous';
  state.activeGalleryCat = 'Tous';
  state.toolsPage  = 1;
  state.blogPage   = 1;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === code);
  });
  renderTools();
  renderBlog();
  renderGallery();
}

// ─── STATE ───────────────────────────────
const state = {
  tools:   [],
  blog:    [],
  gallery: [],
  langue:  detecterLangue(),
  activeToolCat:    'Tous',
  activeBlogCat:    'Tous',
  activeGalleryCat: 'Tous',
  searchQuery: '',
  toolsPage:   1,
  blogPage:    1,
  galleryPage: 1,
  itemsPerPage: 20,
};

// ─── COLOR PALETTES ──────────────────────
const catColors = {
  Texte:        { bg: 'rgba(108,99,255,0.18)'  },
  Image:        { bg: 'rgba(255,107,157,0.18)' },
  Musique:      { bg: 'rgba(0,212,170,0.18)'   },
  Code:         { bg: 'rgba(108,99,255,0.18)'  },
  Vidéo:        { bg: 'rgba(255,107,157,0.18)' },
  Recherche:    { bg: 'rgba(0,212,170,0.18)'   },
  Audio:        { bg: 'rgba(108,99,255,0.18)'  },
  Productivité: { bg: 'rgba(245,166,35,0.18)'  },
  Autre:        { bg: 'rgba(255,255,255,0.08)' },
};

const blogColors = {
  Guide:      { bg: 'rgba(108,99,255,0.2)',  tagBg: 'rgba(108,99,255,0.15)',  tagColor: '#a8a3ff' },
  Sélection:  { bg: 'rgba(255,107,157,0.2)', tagBg: 'rgba(255,107,157,0.15)', tagColor: '#ff6b9d' },
  Débutant:   { bg: 'rgba(0,212,170,0.2)',   tagBg: 'rgba(0,212,170,0.15)',   tagColor: '#00d4aa' },
  Comparatif: { bg: 'rgba(245,166,35,0.2)',  tagBg: 'rgba(245,166,35,0.15)',  tagColor: '#f5a623' },
  Tutoriel:   { bg: 'rgba(108,99,255,0.2)',  tagBg: 'rgba(108,99,255,0.15)',  tagColor: '#a8a3ff' },
  Analyse:    { bg: 'rgba(0,212,170,0.2)',   tagBg: 'rgba(0,212,170,0.15)',   tagColor: '#00d4aa' },
};
window.blogColorsMap = blogColors;

const galleryColors = {
  image:   'rgba(108,99,255,0.2)',
  vidéo:   'rgba(255,107,157,0.18)',
  musique: 'rgba(0,212,170,0.2)',
};

// ═══════════════════════════════════════
// TOAST
// ═══════════════════════════════════════

let toastTimer = null;

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════
// MODAL — SOUMISSION D'OUTIL
// ═══════════════════════════════════════

function openModal() {
  resetForm();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('f-name').focus(), 100);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function resetForm() {
  ['f-name','f-url','f-cat','f-price','f-desc','f-emoji','f-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const err = document.getElementById('form-error');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  const countEl = document.getElementById('f-desc-count');
  if (countEl) countEl.textContent = '0 / 200';
}

function validateForm() {
  const name  = document.getElementById('f-name').value.trim();
  const url   = document.getElementById('f-url').value.trim();
  const cat   = document.getElementById('f-cat').value;
  const price = document.getElementById('f-price').value;
  const desc  = document.getElementById('f-desc').value.trim();
  if (!name)  return "Le nom de l'outil est requis.";
  if (!url)   return "L'URL officielle est requise.";
  if (!url.startsWith('http')) return "L'URL doit commencer par http:// ou https://";
  if (!cat)   return 'Veuillez choisir une catégorie.';
  if (!price) return 'Veuillez indiquer la tarification.';
  if (!desc)  return 'La description est requise.';
  if (desc.length < 20) return 'La description doit faire au moins 20 caractères.';
  return null;
}

function handleSubmit() {
  const errMsg = validateForm();
  const errEl  = document.getElementById('form-error');

  if (errMsg) {
    errEl.textContent = errMsg;
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const nomOutil = document.getElementById('f-name').value.trim();

  const formData = new FormData();
  formData.append('nom_outil',    nomOutil);
  formData.append('url',          document.getElementById('f-url').value.trim());
  formData.append('categorie',    document.getElementById('f-cat').value);
  formData.append('tarification', document.getElementById('f-price').value);
  formData.append('description',  document.getElementById('f-desc').value.trim());
  formData.append('emoji',        document.getElementById('f-emoji').value.trim() || '🤖');
  formData.append('email',        document.getElementById('f-email').value.trim());

  const submitBtn = document.querySelector('.modal-footer .btn-main');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Envoi…'; }

  fetch('https://formspree.io/f/xaqkgqlr', {
    method:  'POST',
    body:    formData,
    headers: { 'Accept': 'application/json' }
  }).then(() => {
    document.querySelector('.modal-body').innerHTML = `
      <div class="form-success">
        <div class="success-icon">✅</div>
        <h4>Soumission envoyée !</h4>
        <p>Merci pour votre contribution. L'outil <strong>${nomOutil}</strong>
        sera examiné par notre équipe et ajouté sous 48h si approuvé.</p>
      </div>`;
    document.querySelector('.modal-footer').innerHTML =
      `<button class="btn-main" onclick="closeModal()">Fermer</button>`;
  }).catch(() => {
    errEl.textContent = 'Erreur réseau. Réessayez dans quelques instants.';
    errEl.style.display = 'block';
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Soumettre'; }
  });
}

// ═══════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Erreur chargement ${path}`);
  return res.json();
}

async function loadAllData() {
  try {
    // Outils et galerie viennent de Firestore (mise à jour sans redéploiement),
    // le blog reste un index JSON statique (les articles eux-mêmes sont en HTML statique pour le SEO).
    const { db, collection, getDocs } = await import('./firebase-config.js');

    const [toolsSnap, blog, gallerySnap] = await Promise.all([
      getDocs(collection(db, 'outils')).catch(() => ({ docs: [] })),
      loadJSON('data/blog.json').catch(() => []),
      getDocs(collection(db, 'galerie')).catch(() => ({ docs: [] })),
    ]);

    state.tools   = toolsSnap.docs.map(d => d.data());
    state.blog    = blog;
    state.gallery = gallerySnap.docs.map(d => d.data());
    renderTools();
    renderBlog();
    renderGallery();
    checkToolsParam();
  } catch (err) {
    console.error('Erreur chargement données:', err);
    showError('tools-grid',   'Impossible de charger les outils.');
    showError('blog-list',    'Impossible de charger les articles.');
    showError('gallery-grid', 'Impossible de charger la galerie.');
  }
}

function filtrerParLangue(items) {
  return items.filter(item => !item.langue || item.langue === state.langue);
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  const btn = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (btn) btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (pageId === 'profile') window.location.href = 'profil.html';
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function getColor(map, key, fallback = {}) {
  return map[key] || fallback;
}

function showError(containerId, msg) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>${msg}</div>`;
}

function showEmpty(containerId, msg = 'Aucun résultat trouvé.') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div>${msg}</div>`;
}

// ═══════════════════════════════════════
// CARTE OUTIL — source unique de vérité
// ═══════════════════════════════════════

function buildToolCard(t) {
  const priceLabel = { free: 'Gratuit', freemium: 'Freemium', paid: 'Payant' };
  const col  = catColors[t.category] || { bg: 'rgba(255,255,255,0.08)' };
  const pageUrl = buildToolPageUrl(t);
  const plan = t.plan || (pageUrl ? 'gratuit' : null);

  const iconHtml = t.favicon
    ? `<img src="${t.favicon}" alt="${t.name}" class="tool-favicon"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           onload="this.nextElementSibling.style.display='none'">
       <span class="tool-ico-fallback" style="display:none">${t.emoji}</span>`
    : `<span class="tool-ico-fallback">${t.emoji}</span>`;

  const cardAction = pageUrl
    ? `onclick="window.location.href='${pageUrl}'"`
    : `onclick="window.open('${t.url}','_blank')"`;

  let planBadge = '';
  let cardClass = 'tool-card';

  if (plan === 'featured') {
    cardClass = 'tool-card tool-card-featured tool-card-plan-featured';
  } else if (plan === 'starter') {
    cardClass = 'tool-card tool-card-featured tool-card-plan-starter';
  } else if (plan === 'gratuit') {
    cardClass = 'tool-card tool-card-plan-gratuit';
  }

  if (pageUrl) {
    planBadge = `<span class="tool-plan-badge tool-plan-badge-gratuit">Guide complet →</span>`;
  }

  const toolJson = JSON.stringify(t).replace(/'/g, "\'").replace(/"/g, '&quot;');

  // Slug pour Firestore ratings — même logique que gen-fiches.js
  const slug = slugify(t.name) || String(t.id);

  return `
    <article class="${cardClass}" ${cardAction} data-tool-slug="${slug}">
      <div class="tool-head">
        <div class="tool-ico" style="background:${col.bg}">${iconHtml}</div>
        <div style="flex:1">
          <div class="tool-name">${t.name}</div>
          <div class="tool-cat">${t.category}</div>
        </div>
        <button class="fav-btn"
          onclick="openCollectionPicker(event, ${toolJson})"
          title="Ajouter à une collection">♡</button>
      </div>
      <p class="tool-desc">${t.description}</p>
      <div class="tool-foot">
        <span class="price-tag price-${t.price}">${priceLabel[t.price]}</span>
        <span class="tool-rating-badge" data-slug="${slug}"></span>
      </div>
      ${planBadge}
    </article>`;
}

// ════════════════════════════════════════
// RATINGS FIRESTORE — enrichir les cartes
// Appelé après chaque renderTools()
// ════════════════════════════════════════
async function renderRatingsOnCards() {
  if (typeof window._getRatingSummaries !== 'function') return;
  try {
    const cards = document.querySelectorAll('.tool-card');
    if (!cards.length) return;

    const slugs = [];
    cards.forEach(card => {
      const slug = card.getAttribute('data-tool-slug');
      if (slug) slugs.push(slug);
    });

    if (!slugs.length) return;

    const summaries = await window._getRatingSummaries([...new Set(slugs)]);
    if (!summaries) return;

    cards.forEach(card => {
      const slug = card.getAttribute('data-tool-slug');
      if (!slug) return;

      const badge = card.querySelector('.tool-rating-badge');
      if (!badge) return;

      const summary = summaries.get(slug);

      // Aucun avis → badge vide (pas de fausses étoiles)
      if (!summary || !summary.ratingCount) {
        badge.innerHTML = '';
        return;
      }

      const avg   = summary.ratingAverage.toFixed(1);
      const count = summary.ratingCount;
      badge.innerHTML = `★ ${avg} <span style="font-size:0.85em;opacity:0.75;font-weight:normal">(${count} avis)</span>`;
    });
  } catch (err) {
    console.warn('Ratings Firestore non chargés:', err);
  }
}

// ═══════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════

function renderTools() {
  const toolsLangue = filtrerParLangue(state.tools);
  const cats = ['Tous', ...new Set(toolsLangue.map(t => t.category))];

  document.getElementById('tool-filters').innerHTML = cats.map(c =>
    `<button class="filter${c === state.activeToolCat ? ' active' : ''}"
      onclick="setToolCat('${c}')">${c}</button>`
  ).join('');

  const filtered = toolsLangue.filter(t =>
    (state.activeToolCat === 'Tous' || t.category === state.activeToolCat) &&
    (matchRecherche(state.searchQuery, t.name) ||
     matchRecherche(state.searchQuery, t.description) ||
     t.tags.some(tag => matchRecherche(state.searchQuery, tag)))
  );

  if (!filtered.length) { showEmpty('tools-grid'); setPaginationEl('tools-grid', ''); return; }

  const total      = filtered.length;
  const totalPages = Math.ceil(total / state.itemsPerPage);
  if (state.toolsPage > totalPages) state.toolsPage = 1;
  const start    = (state.toolsPage - 1) * state.itemsPerPage;
  const paged    = filtered.slice(start, start + state.itemsPerPage);
  const shownEnd = start + paged.length;

  document.getElementById('tools-grid').innerHTML = paged.map(t => buildToolCard(t)).join('');
  setPaginationEl('tools-grid', buildPaginationHTML(state.toolsPage, totalPages, total, start + 1, shownEnd, 'tools', 'outils'));

  // Ratings Firestore après chaque rendu
  renderRatingsOnCards();
}

function buildPaginationHTML(current, totalPages, totalItems, shownStart, shownEnd, section, label) {
  if (totalPages <= 1) return '';
  let pages = '';
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - 1 && i <= current + 1)) {
      pages += `<button class="pg-btn${i === current ? ' active' : ''}" onclick="goToPage('${section}',${i})">${i}</button>`;
    } else if (i === current - 2 || i === current + 2) {
      pages += `<span class="pg-dots">…</span>`;
    }
  }
  return `
    <div class="pagination">
      <span class="pg-info">${shownStart}–${shownEnd} sur ${totalItems} ${label}</span>
      <div class="pg-controls">
        <button class="pg-btn pg-arrow" onclick="goToPage('${section}',${current - 1})" ${current === 1 ? 'disabled' : ''}>‹</button>
        ${pages}
        <button class="pg-btn pg-arrow" onclick="goToPage('${section}',${current + 1})" ${current === totalPages ? 'disabled' : ''}>›</button>
      </div>
    </div>`;
}

function setPaginationEl(containerId, html) {
  let el = document.getElementById(containerId + '-pagination');
  if (!el) {
    el = document.createElement('div');
    el.id = containerId + '-pagination';
    document.getElementById(containerId).insertAdjacentElement('afterend', el);
  }
  el.innerHTML = html;
}

function goToPage(section, page) {
  if (section === 'tools') {
    state.toolsPage = page;
    renderTools(); // renderRatingsOnCards() appelé à l'intérieur
    document.getElementById('tools').scrollIntoView({behavior:'smooth',block:'start'});
  }
  if (section === 'blog')    { state.blogPage    = page; renderBlog();    document.getElementById('blog').scrollIntoView({behavior:'smooth',block:'start'}); }
  if (section === 'gallery') { state.galleryPage = page; renderGallery(); document.getElementById('gallery').scrollIntoView({behavior:'smooth',block:'start'}); }
}

function setToolCat(cat) {
  state.activeToolCat = cat;
  state.toolsPage = 1;
  renderTools(); // renderRatingsOnCards() appelé à l'intérieur
}

// ═══════════════════════════════════════
// BLOG
// ═══════════════════════════════════════

function renderBlog() {
  const blogLangue = filtrerParLangue(state.blog);
  const cats = ['Tous', ...new Set(blogLangue.map(p => p.category))];
  document.getElementById('blog-filters').innerHTML = cats.map(c =>
    `<button class="filter${c === state.activeBlogCat ? ' active' : ''}"
      onclick="setBlogCat('${c}')">${c}</button>`
  ).join('');

  const filtered = blogLangue.filter(p =>
    state.activeBlogCat === 'Tous' || p.category === state.activeBlogCat
  );

  if (!filtered.length) { showEmpty('blog-list'); setPaginationEl('blog-list', ''); return; }

  const total      = filtered.length;
  const totalPages = Math.ceil(total / state.itemsPerPage);
  if (state.blogPage > totalPages) state.blogPage = 1;
  const start    = (state.blogPage - 1) * state.itemsPerPage;
  const paged    = filtered.slice(start, start + state.itemsPerPage);
  const shownEnd = start + paged.length;

  document.getElementById('blog-list').innerHTML = paged.map(p => {
    const col = getColor(blogColors, p.category, { bg: 'rgba(255,255,255,0.08)', tagBg: 'rgba(255,255,255,0.08)', tagColor: '#aaa' });
    const href = p.url ? p.url : '#';
    const thumbContent = p.image
      ? `<img src="${p.image}" alt="${p.title}" loading="lazy"
             onerror="this.style.display='none';this.parentElement.innerHTML='<span style=font-size:48px>${p.emoji || '📝'}</span>'">`
      : `<span>${p.emoji || '📝'}</span>`;
    return `
      <a href="${href}" class="blog-card-link" style="text-decoration:none;display:block;">
        <article class="blog-card">
          <div class="blog-thumb">${thumbContent}</div>
          <div class="blog-body">
            <div class="blog-title">${p.title}</div>
            <div class="blog-meta">${p.date} · ${p.author}</div>
            <p class="blog-excerpt">${p.excerpt}</p>
            <span class="blog-tag" style="background:${col.tagBg};color:${col.tagColor}">${p.category}</span>
          </div>
          <div class="blog-mins">⏱ ${p.readTime} de lecture</div>
        </article>
      </a>`;
  }).join('');

  setPaginationEl('blog-list', buildPaginationHTML(state.blogPage, totalPages, total, start + 1, shownEnd, 'blog', 'articles'));
}

function setBlogCat(cat) {
  state.activeBlogCat = cat;
  state.blogPage = 1;
  renderBlog();
}

// ═══════════════════════════════════════
// GALLERY
// ═══════════════════════════════════════

function renderGallery() {
  const types = ['Tous', 'image', 'vidéo', 'musique'];
  const typeLabels = { Tous: 'Tous', image: 'Image', vidéo: 'Vidéo', musique: 'Musique' };
  const typeIcons  = { image: '🖼', vidéo: '▶', musique: '♪' };

  document.getElementById('gallery-filters').innerHTML = types.map(t =>
    `<button class="filter${t === state.activeGalleryCat ? ' active' : ''}"
      onclick="setGalleryCat('${t}')">${typeLabels[t]}</button>`
  ).join('');

  const filtered = state.gallery.filter(g =>
    state.activeGalleryCat === 'Tous' || g.type === state.activeGalleryCat
  );

  if (!filtered.length) { showEmpty('gallery-grid'); setPaginationEl('gallery-grid', ''); return; }

  const total      = filtered.length;
  const totalPages = Math.ceil(total / state.itemsPerPage);
  if (state.galleryPage > totalPages) state.galleryPage = 1;
  const start    = (state.galleryPage - 1) * state.itemsPerPage;
  const paged    = filtered.slice(start, start + state.itemsPerPage);
  const shownEnd = start + paged.length;

  document.getElementById('gallery-grid').innerHTML = paged.map((g, i) => {
    const realIndex = start + i;
    const isMusic = g.type === 'musique';
    const thumbStyle = isMusic ? `background:linear-gradient(135deg,#6c63ff,#ff6b9d);` : `background:#111;`;
    const thumbContent = isMusic
      ? `<span style="font-size:48px">🎵</span>`
      : `<img src="${g.thumb}" alt="${g.title}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy">`;
    return `
      <article class="gallery-card" onclick="openGalleryItem(${realIndex})" style="cursor:pointer;">
        <div class="gallery-thumb" style="${thumbStyle}position:relative;overflow:hidden;">
          ${thumbContent}
          <span class="gallery-type type-${g.type}">${typeLabels[g.type]}</span>
          <div class="gallery-play-icon">${typeIcons[g.type]}</div>
        </div>
        <div class="gallery-info">
          <div class="gallery-title">${g.title}</div>
          <div class="gallery-tool">${g.tool}</div>
          <div class="gallery-likes"><span>♥</span> ${g.likes} likes</div>
        </div>
      </article>`;
  }).join('');

  state.filteredGallery = filtered;
  setPaginationEl('gallery-grid', buildPaginationHTML(state.galleryPage, totalPages, total, start + 1, shownEnd, 'gallery', 'œuvres'));
}

function openGalleryItem(index) {
  if (window.GalleryLightbox) {
    window.GalleryLightbox.openLightbox(state.filteredGallery, index);
  }
}

function setGalleryCat(cat) {
  state.activeGalleryCat = cat;
  state.galleryPage = 1;
  renderGallery();
}

// ═══════════════════════════════════════
// NEWSLETTER (Formspree)
// ═══════════════════════════════════════

function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('footer-email').value.trim();
    const feedback = document.getElementById('nl-feedback');
    const btn      = form.querySelector('button[type=submit]');
    if (!email) return;
    btn.textContent = '...';
    btn.disabled = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        feedback.textContent = '✓ Inscription confirmée ! Merci ' + email.split('@')[0] + ' !';
        feedback.style.color = '#00d4aa';
        form.reset();
      } else {
        feedback.textContent = '⚠ Erreur. Réessayez dans un instant.';
        feedback.style.color = '#f5a623';
      }
    } catch {
      feedback.textContent = '⚠ Erreur réseau. Réessayez.';
      feedback.style.color = '#f5a623';
    }
    btn.textContent = 'S\'abonner';
    btn.disabled = false;
  });
}

// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════

function normaliser(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function matchRecherche(query, target) {
  const q = normaliser(query);
  const t = normaliser(target);
  if (!q) return true;
  if (t.includes(q)) return true;
  const mots = q.split(' ').filter(Boolean);
  const motsTarget = t.split(' ').filter(Boolean);
  return mots.every(mot => {
    if (motsTarget.some(mt => mt.includes(mot) || mot.includes(mt))) return true;
    const seuil = mot.length <= 3 ? 0 : mot.length <= 5 ? 1 : 2;
    return motsTarget.some(mt => levenshtein(mot, mt) <= seuil);
  });
}

function handleSearch(e) {
  state.searchQuery = e.target.value;
  state.toolsPage = 1;
  const url = new URL(window.location);
  if (e.target.value) {
    url.searchParams.set('search', e.target.value);
  } else {
    url.searchParams.delete('search');
  }
  window.history.replaceState({}, '', url);
  renderTools();
}

function readSearchFromURL() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('search');
  if (q) {
    state.searchQuery = q;
    const searchEl = document.getElementById('tool-search');
    if (searchEl) searchEl.value = q;
    showPage('tools');
  }
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  const searchEl = document.getElementById('tool-search');
  if (searchEl) searchEl.addEventListener('input', handleSearch);

  const descEl = document.getElementById('f-desc');
  if (descEl) {
    descEl.addEventListener('input', () => {
      document.getElementById('f-desc-count').textContent = `${descEl.value.length} / 200`;
    });
  }

  document.getElementById('open-submit-btn')?.addEventListener('click', openModal);
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modal-submit')?.addEventListener('click', handleSubmit);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  initNewsletter();
  readSearchFromURL();
  loadAllData();

  if (window.BlogReader) window.BlogReader.createBlogReader();
  if (window.GalleryLightbox) window.GalleryLightbox.initLightbox();
});

// ═══════════════════════════════════════
// QUIZ — TROUVER MON OUTIL IA
// ═══════════════════════════════════════

const QUIZ_QUESTIONS = [
  {
    id: 'metier',
    question: 'Tu es plutôt…',
    options: [
      { label: '✍️ Rédacteur / Copywriter',   value: 'redacteur'    },
      { label: '🎨 Designer / Créatif',        value: 'designer'     },
      { label: '💻 Développeur',               value: 'developpeur'  },
      { label: '🚀 Entrepreneur / Freelance',  value: 'entrepreneur' },
      { label: '🎓 Étudiant',                  value: 'etudiant'     },
      { label: '👤 Autre',                     value: 'autre'        },
    ]
  },
  {
    id: 'objectif',
    question: "Ton objectif principal avec l'IA…",
    options: [
      { label: '⚡ Gagner du temps',           value: 'temps'     },
      { label: '✏️ Créer du contenu',          value: 'contenu'   },
      { label: '📚 Apprendre',                 value: 'apprendre' },
      { label: '💰 Générer des revenus',       value: 'revenus'   },
      { label: "📋 M'organiser",               value: 'organiser' },
    ]
  },
  {
    id: 'budget',
    question: 'Ton budget mensuel pour un outil IA…',
    options: [
      { label: '🆓 Gratuit uniquement',        value: 'free'     },
      { label: '💳 Moins de 20$/mois',         value: 'freemium' },
      { label: '💎 Plus de 20$/mois',          value: 'paid'     },
    ]
  },
  {
    id: 'connexion',
    question: 'Ta connexion internet est…',
    options: [
      { label: '🚀 Rapide et stable',          value: 'rapide'  },
      { label: '📶 Correcte',                  value: 'moyenne' },
      { label: '🐢 Lente ou instable',         value: 'lente'   },
    ]
  },
  {
    id: 'niveau',
    question: 'Ton niveau avec les outils IA…',
    options: [
      { label: '🌱 Débutant complet',          value: 'debutant'      },
      { label: '🌿 Quelques expériences',      value: 'intermediaire' },
      { label: '🌳 Utilisateur régulier',      value: 'avance'        },
    ]
  }
];

const METIER_CATS = {
  redacteur:    ['Texte', 'Productivité'],
  designer:     ['Image', 'Design', 'Vidéo'],
  developpeur:  ['Code', 'Productivité'],
  entrepreneur: ['Texte', 'Productivité', 'Recherche'],
  etudiant:     ['Texte', 'Recherche', 'Productivité'],
  autre:        ['Texte', 'Productivité', 'Image'],
};

const CATS_LOURDES = ['Vidéo', 'Image', 'Musique'];

const quizState = { step: 0, answers: {} };

function openQuiz() {
  if (!window._firebaseUser) {
    window.location.href = 'profil.html?redirect=quiz';
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const quizParam = params.get('quiz');
  if (quizParam) {
    const parts = quizParam.split('-');
    const ids = ['metier','objectif','budget','connexion','niveau'];
    ids.forEach((id, i) => { if (parts[i]) quizState.answers[id] = parts[i]; });
    quizState.step = 5;
    document.getElementById('quiz-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    showQuizResults();
    return;
  }
  quizState.step    = 0;
  quizState.answers = {};
  document.getElementById('quiz-results').style.display = 'none';
  document.getElementById('quiz-body').style.display    = 'block';
  document.getElementById('quiz-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderQuizStep();
}

function closeQuiz() {
  document.getElementById('quiz-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderQuizStep() {
  const q     = QUIZ_QUESTIONS[quizState.step];
  const total = QUIZ_QUESTIONS.length;
  const pct   = (quizState.step / total) * 100;
  document.getElementById('quiz-progress-bar').style.width = pct + '%';
  document.getElementById('quiz-step-label').textContent   = `Question ${quizState.step + 1} sur ${total}`;
  document.getElementById('quiz-question').textContent     = q.question;
  document.getElementById('quiz-options').innerHTML = q.options.map(o =>
    `<button class="quiz-option" onclick="selectQuizOption('${q.id}','${o.value}')">${o.label}</button>`
  ).join('');
}

function selectQuizOption(questionId, value) {
  quizState.answers[questionId] = value;
  document.querySelectorAll('.quiz-option').forEach(btn => {
    if (btn.textContent.trim() ===
        QUIZ_QUESTIONS[quizState.step].options.find(o => o.value === value)?.label.trim()) {
      btn.classList.add('selected');
    }
  });
  setTimeout(() => {
    quizState.step++;
    if (quizState.step < QUIZ_QUESTIONS.length) renderQuizStep();
    else showQuizResults();
  }, 280);
}

function scoreOutil(tool, answers) {
  let score = 0;
  const cats = METIER_CATS[answers.metier] || ['Texte'];
  if (cats[0] === tool.category)         score += 3;
  else if (cats.includes(tool.category)) score += 1;
  if (answers.budget === 'free'     && tool.price === 'free') score += 3;
  if (answers.budget === 'freemium' && tool.price !== 'paid') score += 2;
  if (answers.budget === 'paid')                               score += 1;
  if (answers.connexion === 'lente' && CATS_LOURDES.includes(tool.category)) score -= 3;
  const hasPage = !!buildToolPageUrl(tool);
  if (answers.niveau === 'debutant' && !hasPage) score += 1;
  if (answers.niveau === 'avance'   && hasPage)  score += 1;
  score += (tool.rating || 3) * 0.3;
  return score;
}

function showQuizResults() {
  const answers = quizState.answers;
  const outils  = filtrerParLangue(state.tools);
  const scored  = outils.map(t => ({ tool: t, score: scoreOutil(t, answers) }));
  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  const usedCats = new Set();
  for (const item of scored) {
    if (selected.length >= 3) break;
    if (!usedCats.has(item.tool.category)) {
      selected.push(item.tool);
      usedCats.add(item.tool.category);
    }
  }
  for (const item of scored) {
    if (selected.length >= 3) break;
    if (!selected.find(t => t.id === item.tool.id)) selected.push(item.tool);
  }

  const metierLabel = QUIZ_QUESTIONS[0].options.find(o => o.value === answers.metier)?.label || '';
  document.getElementById('quiz-results-sub').textContent =
    `Profil : ${metierLabel} · Budget ${answers.budget} · Connexion ${answers.connexion}`;

  const priceLabel = { free: 'Gratuit', freemium: 'Freemium', paid: 'Payant' };
  document.getElementById('quiz-results-grid').innerHTML = selected.map(t => {
    const quizPageUrl = buildToolPageUrl(t);
    const action = quizPageUrl
      ? `onclick="closeQuiz();window.location.href='${quizPageUrl}'"`
      : `onclick="closeQuiz();window.open('${t.url}','_blank')"`;
    const iconHtml = t.favicon
      ? `<img src="${t.favicon}" alt="${t.name}" style="width:32px;height:32px;border-radius:6px;" onerror="this.style.display='none'">`
      : `<span style="font-size:28px">${t.emoji}</span>`;
    return `
      <div class="quiz-result-card" ${action}>
        <div class="quiz-result-head">
          <div class="quiz-result-ico">${iconHtml}</div>
          <div style="flex:1">
            <div class="quiz-result-name">${t.name}</div>
            <div class="quiz-result-cat">${t.category}</div>
          </div>
          <span class="price-tag price-${t.price}">${priceLabel[t.price]}</span>
        </div>
        <p class="quiz-result-desc">${t.description}</p>
        <div class="quiz-result-cta">Voir la fiche →</div>
      </div>`;
  }).join('');

  document.getElementById('quiz-body').style.display    = 'none';
  document.getElementById('quiz-results').style.display = 'block';
  document.getElementById('quiz-progress-bar').style.width = '100%';

  if (window._firebaseUser && window._saveQuizToFirebase) {
    window._saveQuizToFirebase(window._firebaseUser.uid, answers, selected);
  }
}

function restartQuiz() {
  quizState.step    = 0;
  quizState.answers = {};
  document.getElementById('quiz-results').style.display = 'none';
  document.getElementById('quiz-body').style.display    = 'block';
  document.getElementById('quiz-copy-confirm').style.display = 'none';
  renderQuizStep();
}

function copyQuizLink() {
  const a     = quizState.answers;
  const param = [a.metier, a.objectif, a.budget, a.connexion, a.niveau].join('-');
  const url   = `${window.location.origin}${window.location.pathname}?quiz=${param}`;
  navigator.clipboard.writeText(url).then(() => {
    const el = document.getElementById('quiz-copy-confirm');
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 2500);
  });
}

function shareWhatsApp() {
  const grid = document.getElementById('quiz-results-grid');
  const noms = [...grid.querySelectorAll('.quiz-result-name')].map(el => '• ' + el.textContent).join('\n');
  const a    = quizState.answers;
  const param = [a.metier, a.objectif, a.budget, a.connexion, a.niveau].join('-');
  const url  = `${window.location.origin}${window.location.pathname}?quiz=${param}`;
  const msg  = encodeURIComponent(`J'ai testé le quiz Albexia et voici mes 3 outils IA recommandés :\n${noms}\n\nTeste-le toi aussi → ${url}`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

window.openQuiz      = openQuiz;
window.closeQuiz     = closeQuiz;
window.restartQuiz   = restartQuiz;
window.copyQuizLink  = copyQuizLink;
window.shareWhatsApp = shareWhatsApp;

// ═══════════════════════════════════════
// SPOTLIGHT
// ═══════════════════════════════════════

function checkToolsParam() {
  const params = new URLSearchParams(window.location.search);
  const raw    = params.get('tools');
  if (!raw) return;
  const ids   = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return;
  const found = ids
    .map(id => state.tools.find(t => String(t.id) === id))
    .filter(Boolean);
  if (!found.length) return;
  renderSpotlight(found);
}

function renderSpotlight(outils) {
  const old = document.getElementById('notif-spotlight');
  if (old) old.remove();
  const cardsHTML = outils.map(t => buildToolCard(t)).join('');
  const panel = document.createElement('div');
  panel.id = 'notif-spotlight';
  panel.innerHTML = `
    <div class="spotlight-header">
      <div class="spotlight-label">
        <span class="spotlight-dot"></span>
        Outils sélectionnés cette semaine
      </div>
      <button class="spotlight-close" onclick="closeSpotlight()" aria-label="Fermer">✕</button>
    </div>
    <div class="spotlight-grid">${cardsHTML}</div>
  `;
  const toolsGrid = document.getElementById('tools-grid');
  if (toolsGrid) toolsGrid.insertAdjacentElement('beforebegin', panel);
  showPage('tools');
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function closeSpotlight() {
  const panel = document.getElementById('notif-spotlight');
  if (!panel) return;
  panel.classList.add('spotlight-hiding');
  setTimeout(() => panel.remove(), 350);
  const url = new URL(window.location.href);
  url.searchParams.delete('tools');
  window.history.replaceState({}, '', url.toString());
}

window.closeSpotlight = closeSpotlight;

// ── NAVIGATION DEPUIS LES PAGES SECONDAIRES ──
(function() {
  const hash = window.location.hash.replace('#', '');
  const pages = ['tools', 'blog', 'gallery', 'favorites'];
  if (pages.includes(hash)) {
    window.addEventListener('DOMContentLoaded', () => {
      if (typeof showPage === 'function') showPage(hash);
    });
  }
})();

// ═══════════════════════════════════════
// COLLECTION PICKER — fallback
// ═══════════════════════════════════════
if (typeof window.openCollectionPicker === 'undefined') {
  window.openCollectionPicker = function(event, tool) {
    event.stopPropagation();
    window.location.href = 'profil.html';
  };
}

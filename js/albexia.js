/* ═══════════════════════════════════════════════════════
   Albexia — albexia.js  (fichier unique)
   Fusionne app.js + albexia.js (Firebase Auth + Firestore)
   Usage :
     index.html   → <script src="js/albexia.js"></script>
     profile.html → <script src="js/albexia.js"></script>
     auth.html    → <script src="js/albexia.js"></script>
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ════════════════════════════════════════════════════════
   SECTION 1 — LANGUE
   ════════════════════════════════════════════════════════ */

const LS_LANG_KEY = 'albexia_langue';
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

/* ════════════════════════════════════════════════════════
   SECTION 2 — STATE
   ════════════════════════════════════════════════════════ */

const state = {
  tools:   [],
  blog:    [],
  gallery: [],
  langue:  detecterLangue(),
  activeToolCat:    'Tous',
  activeBlogCat:    'Tous',
  activeGalleryCat: 'Tous',
  searchQuery: '',
  favorites: new Set(),
  toolsPage:   1,
  blogPage:    1,
  galleryPage: 1,
  itemsPerPage: 20,
};

window.state = state;

/* ════════════════════════════════════════════════════════
   SECTION 3 — COULEURS
   ════════════════════════════════════════════════════════ */

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

/* ════════════════════════════════════════════════════════
   SECTION 4 — HELPERS UI
   ════════════════════════════════════════════════════════ */

function setEl(id, text)  { const e = document.getElementById(id); if (e) e.textContent = text; }
function setVal(id, val)  { const e = document.getElementById(id); if (e) e.value = val; }
function setCount(id, n)  { const e = document.getElementById(id); if (e) e.textContent = n; }

function getColor(map, key, fallback = {}) {
  return map[key] || fallback;
}

function renderStars(rating) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    html += `<span class="${i <= rating ? 'on' : ''}">★</span>`;
  }
  return html;
}

function showError(containerId, msg) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>${msg}</div>`;
}

function showEmpty(containerId, msg = 'Aucun résultat trouvé.') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div>${msg}</div>`;
}

let toastTimer = null;

function showToast(msg) {
  /* Toast index.html (élément #toast) */
  const el = document.getElementById('toast');
  if (el) {
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
    return;
  }
  /* Toast profile.html (élément créé dynamiquement) */
  const t = document.createElement('div');
  t.className = 'profile-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('visible'), 10);
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 3000);
}

window.showToast = showToast;

/* ════════════════════════════════════════════════════════
   SECTION 5 — FIREBASE (chargement + init)
   ════════════════════════════════════════════════════════ */

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

/* ════════════════════════════════════════════════════════
   SECTION 6 — RECHERCHE (fuzzy)
   ════════════════════════════════════════════════════════ */

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

/* ════════════════════════════════════════════════════════
   SECTION 7 — MODAL SOUMISSION D'OUTIL
   ════════════════════════════════════════════════════════ */

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

/* ════════════════════════════════════════════════════════
   SECTION 8 — NAVIGATION
   ════════════════════════════════════════════════════════ */

function showPage(pageId) {
  if (!pageId) return;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  const btn = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (btn) btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (pageId === 'favorites') { window.location.href = 'profile.html#favorites'; return; }
}

/* ════════════════════════════════════════════════════════
   SECTION 9 — CHARGEMENT DONNÉES
   ════════════════════════════════════════════════════════ */

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Erreur chargement ${path}`);
  return res.json();
}

function filtrerParLangue(items) {
  return items.filter(item => !item.langue || item.langue === state.langue);
}

async function loadAllData() {
  try {
    const [tools, blog, gallery] = await Promise.all([
      loadJSON('data/tools.json').catch(() => []),
      loadJSON('data/blog.json').catch(() => []),
      loadJSON('data/gallery.json').catch(() => []),
    ]);
    state.tools   = tools;
    state.blog    = blog;
    state.gallery = gallery;
    renderTools();
    renderBlog();
    renderGallery();
    updateFavCount();
    checkToolsParam();
    /* Charger les favoris Firebase si user déjà connu */
    if (window._fbUser) await loadFavoritesFirebase();
  } catch (err) {
    console.error('Erreur chargement données:', err);
    showError('tools-grid',   'Impossible de charger les outils.');
    showError('blog-list',    'Impossible de charger les articles.');
    showError('gallery-grid', 'Impossible de charger la galerie.');
  }
}

/* ════════════════════════════════════════════════════════
   SECTION 10 — FAVORIS (Firebase)
   ════════════════════════════════════════════════════════ */

async function loadFavoritesFirebase() {
  if (!window._fbUser || !window._firebase?.db) return;
  try {
    const snap = await window._firebase.db.collection('favorites')
      .where('user_id', '==', window._fbUser.uid).get();
    state.favorites = new Set(snap.docs.map(d => String(d.data().tool_id)));
    updateFavCount();
    renderTools();
  } catch (e) { console.warn('loadFavorites:', e); }
}

async function toggleFavorite(toolId, event) {
  event.stopPropagation();
  const id   = String(toolId);
  const user = window._fbUser;

  if (!user) {
    showToast('Connectez-vous pour sauvegarder des favoris');
    setTimeout(() => window.location.href = 'auth.html', 1500);
    return;
  }

  const db = window._firebase.db;
  const snap = await db.collection('favorites')
    .where('user_id', '==', user.uid)
    .where('tool_id', '==', id).get();

  if (!snap.empty) {
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    state.favorites.delete(id);
    showToast('Retiré des favoris');
  } else {
    await db.collection('favorites').add({
      user_id: user.uid,
      tool_id: id,
      added_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    state.favorites.add(id);
    showToast('♥ Ajouté aux favoris !');
  }

  updateFavCount();
  renderTools();
}

function updateFavCount() {
  const count = state.favorites.size;
  const badge = document.getElementById('nav-fav-count');
  if (badge) badge.textContent = count > 0 ? count : '';
}

window.updateFavCount = updateFavCount;

/* ════════════════════════════════════════════════════════
   SECTION 11 — HISTORIQUE (Firebase)
   ════════════════════════════════════════════════════════ */

async function trackToolVisit(toolId) {
  const user = window._fbUser;
  if (!user) return;
  await window._firebase.db.collection('history').add({
    user_id:    user.uid,
    tool_id:    String(toolId),
    visited_at: firebase.firestore.FieldValue.serverTimestamp()
  });
}

window.trackToolVisit = trackToolVisit;

/* ════════════════════════════════════════════════════════
   SECTION 12 — CLIC CARTE
   ════════════════════════════════════════════════════════ */

async function handleCardClick(toolId, page, url, event) {
  if (event.target.closest('.fav-btn') || event.target.closest('.col-btn')) return;
  trackToolVisit(toolId);
  if (page) window.location.href = page;
  else if (url) window.open(url, '_blank');
}

window.handleCardClick = handleCardClick;

/* ════════════════════════════════════════════════════════
   SECTION 13 — COLLECTIONS (menu depuis les cartes)
   ════════════════════════════════════════════════════════ */

async function openCollectionMenu(toolId, toolName, event) {
  event.stopPropagation();
  if (!window._fbUser) {
    showToast('Connectez-vous pour créer des collections');
    setTimeout(() => window.location.href = 'auth.html', 1500);
    return;
  }
  const old = document.getElementById('col-menu-popup');
  if (old) { old.remove(); return; }

  let collections = [];
  try {
    if (window._firebase?.db) {
      const snap = await window._firebase.db.collection('collections')
        .where('user_id', '==', window._fbUser.uid)
        .orderBy('created_at', 'desc').get();
      collections = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch {}

  const menu = document.createElement('div');
  menu.id = 'col-menu-popup';
  menu.className = 'col-menu-popup';

  const listHTML = collections.length
    ? collections.map(c => `
        <button class="col-menu-item" data-col-id="${c.id}" data-tool-id="${toolId}">
          📁 ${c.name}
        </button>`).join('')
    : `<div class="col-menu-empty">Aucune collection</div>`;

  menu.innerHTML = `
    <div class="col-menu-header">Ajouter "${toolName}"</div>
    <div class="col-menu-list">${listHTML}</div>
    <div class="col-menu-divider"></div>
    <div class="col-menu-new">
      <input type="text" id="col-menu-input" placeholder="Nouvelle collection…" maxlength="40" />
      <button id="col-menu-create">+</button>
    </div>`;

  const btn  = event.currentTarget;
  const rect = btn.getBoundingClientRect();
  menu.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
  menu.style.left = Math.min(rect.left, window.innerWidth - 220) + 'px';
  document.body.appendChild(menu);

  menu.querySelectorAll('.col-menu-item').forEach(item => {
    item.addEventListener('click', async () => {
      try {
        const colRef = window._firebase.db.collection('collections').doc(item.dataset.colId);
        await colRef.update({ tool_ids: firebase.firestore.FieldValue.arrayUnion(item.dataset.toolId) });
        showToast('✓ Ajouté à la collection');
      } catch { showToast('Déjà dans cette collection'); }
      menu.remove();
    });
  });

  document.getElementById('col-menu-create').addEventListener('click', async () => {
    const name = document.getElementById('col-menu-input').value.trim();
    if (!name) return;
    try {
      await window._firebase.db.collection('collections').add({
        user_id: window._fbUser.uid,
        name,
        tool_ids: [String(toolId)],
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast(`✓ Collection "${name}" créée`);
    } catch { showToast('Erreur création collection'); }
    menu.remove();
  });

  document.getElementById('col-menu-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('col-menu-create').click();
  });

  setTimeout(() => {
    document.addEventListener('click', () => menu.remove(), { once: true });
  }, 50);
}

window.openCollectionMenu = openCollectionMenu;

/* ════════════════════════════════════════════════════════
   SECTION 14 — CARTE OUTIL
   ════════════════════════════════════════════════════════ */

function buildToolCard(t) {
  const priceLabel = { free: 'Gratuit', freemium: 'Freemium', paid: 'Payant' };
  const col   = catColors[t.category] || { bg: 'rgba(255,255,255,0.08)' };
  const isFav = state.favorites.has(String(t.id));
  const plan  = t.plan || (t.page ? 'gratuit' : null);

  const iconHtml = t.favicon
    ? `<img src="${t.favicon}" alt="${t.name}" class="tool-favicon"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           onload="this.nextElementSibling.style.display='none'">
       <span class="tool-ico-fallback" style="display:none">${t.emoji}</span>`
    : `<span class="tool-ico-fallback">${t.emoji}</span>`;

  const cardAction = t.page
    ? `onclick="handleCardClick('${t.id}','${t.page}',null,event)"`
    : `onclick="handleCardClick('${t.id}',null,'${t.url}',event)"`;

  let planBadge = '';
  let cardClass = 'tool-card';

  if (plan === 'featured') {
    cardClass = 'tool-card tool-card-featured tool-card-plan-featured';
  } else if (plan === 'starter') {
    cardClass = 'tool-card tool-card-featured tool-card-plan-starter';
  } else if (plan === 'gratuit') {
    cardClass = 'tool-card tool-card-plan-gratuit';
  }

  if (t.page) {
    planBadge = `<span class="tool-plan-badge tool-plan-badge-gratuit">Guide complet →</span>`;
  }

  return `
    <article class="${cardClass}" ${cardAction}>
      <div class="tool-head">
        <div class="tool-ico" style="background:${col.bg}">${iconHtml}</div>
        <div style="flex:1">
          <div class="tool-name">${t.name}</div>
          <div class="tool-cat">${t.category}</div>
        </div>
        <button class="fav-btn ${isFav ? 'active' : ''}"
          onclick="toggleFavorite('${t.id}', event)"
          title="${isFav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">♥</button>
      </div>
      <p class="tool-desc">${t.description}</p>
      <div class="tool-foot">
        <span class="price-tag price-${t.price}">${priceLabel[t.price]}</span>
        <span class="stars">${renderStars(t.rating)}</span>
        <button class="col-btn" onclick="openCollectionMenu('${t.id}','${t.name}',event)" title="Ajouter à une collection">📁</button>
      </div>
      ${planBadge}
    </article>`;
}

/* ════════════════════════════════════════════════════════
   SECTION 15 — RENDU OUTILS
   ════════════════════════════════════════════════════════ */

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
}

window.renderTools = renderTools;

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
  if (section === 'tools')   { state.toolsPage   = page; renderTools();   document.getElementById('tools').scrollIntoView({behavior:'smooth',block:'start'}); }
  if (section === 'blog')    { state.blogPage     = page; renderBlog();    document.getElementById('blog').scrollIntoView({behavior:'smooth',block:'start'}); }
  if (section === 'gallery') { state.galleryPage  = page; renderGallery(); document.getElementById('gallery').scrollIntoView({behavior:'smooth',block:'start'}); }
}

function setToolCat(cat) {
  state.activeToolCat = cat;
  state.toolsPage = 1;
  renderTools();
}

/* ════════════════════════════════════════════════════════
   SECTION 16 — RENDU BLOG
   ════════════════════════════════════════════════════════ */

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
    const col  = getColor(blogColors, p.category, { bg: 'rgba(255,255,255,0.08)', tagBg: 'rgba(255,255,255,0.08)', tagColor: '#aaa' });
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

/* ════════════════════════════════════════════════════════
   SECTION 17 — RENDU GALERIE
   ════════════════════════════════════════════════════════ */

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
    const thumbStyle   = isMusic ? `background:linear-gradient(135deg,#6c63ff,#ff6b9d);` : `background:#111;`;
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

/* ════════════════════════════════════════════════════════
   SECTION 18 — NEWSLETTER
   ════════════════════════════════════════════════════════ */

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

/* ════════════════════════════════════════════════════════
   SECTION 19 — RECHERCHE (handlers)
   ════════════════════════════════════════════════════════ */

function handleSearch(e) {
  state.searchQuery = e.target.value;
  state.toolsPage = 1;
  const url = new URL(window.location);
  if (e.target.value) url.searchParams.set('search', e.target.value);
  else url.searchParams.delete('search');
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

/* ════════════════════════════════════════════════════════
   SECTION 20 — QUIZ
   ════════════════════════════════════════════════════════ */

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
  if (answers.niveau === 'debutant' && !tool.page) score += 1;
  if (answers.niveau === 'avance'   && tool.page)  score += 1;
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
    const action = t.page
      ? `onclick="closeQuiz();window.location.href='${t.page}'"`
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

/* ════════════════════════════════════════════════════════
   SECTION 21 — SPOTLIGHT
   ════════════════════════════════════════════════════════ */

function checkToolsParam() {
  const params = new URLSearchParams(window.location.search);
  const raw    = params.get('tools');
  if (!raw) return;
  const ids   = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return;
  const found = ids.map(id => state.tools.find(t => String(t.id) === id)).filter(Boolean);
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
    <div class="spotlight-grid">${cardsHTML}</div>`;
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

/* ════════════════════════════════════════════════════════
   SECTION 22 — FIREBASE AUTH + PROFIL (IIFE async)
   ════════════════════════════════════════════════════════ */

(async function () {

  /* -- Charger Firebase CDN -- */
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');

  /* -- Init Firebase -- */
  const firebaseConfig = {
    apiKey:            "AIzaSyA6B14vp5wz-0em9eboEAXRVhHy7WF_Lvk",
    authDomain:        "albexia-dc650.firebaseapp.com",
    projectId:         "albexia-dc650",
    storageBucket:     "albexia-dc650.firebasestorage.app",
    messagingSenderId: "805830291200",
    appId:             "1:805830291200:web:c24122224c1abaf4360de5"
  };

  if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);

  const auth = firebase.auth();
  const db   = firebase.firestore();

  window._firebase = { auth, db };

  /* -- Attendre le DOM -- */
  await new Promise(resolve => {
    if (document.readyState !== 'loading') { resolve(); return; }
    document.addEventListener('DOMContentLoaded', resolve, { once: true });
  });

  const IS_PROFILE = document.getElementById('profile-main') !== null;
  const IS_AUTH    = document.getElementById('btn-login')    !== null;
  const IS_INDEX   = !IS_PROFILE && !IS_AUTH;

  /* -- Auth helpers -- */
  async function signOut() {
    await auth.signOut();
    window.location.href = 'index.html';
  }

  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
      window.location.href = 'profile.html';
    } catch (e) { console.error('Google OAuth:', e.message); throw e; }
  }

  async function signIn(email, password) {
    const { user } = await auth.signInWithEmailAndPassword(email, password);
    return user;
  }

  async function signUp(email, password, username) {
    const { user } = await auth.createUserWithEmailAndPassword(email, password);
    if (user) {
      await db.collection('profiles').doc(user.uid).set({
        username: username || email.split('@')[0],
        email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
    return user;
  }

  async function resetPassword(email) {
    await auth.sendPasswordResetEmail(email);
  }

  window._auth = { signIn, signUp, signInWithGoogle, resetPassword };

  /* -- Profil Firestore -- */
  async function ensureProfile(user) {
    const ref  = db.collection('profiles').doc(user.uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data();
    const username = user.displayName || user.email?.split('@')[0] || 'utilisateur';
    const profile  = { username, email: user.email, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    await ref.set(profile, { merge: true });
    return profile;
  }

  /* -- Tools map (pour profile.html) -- */
  let toolsMap = {};

  async function loadToolsMap() {
    if (Object.keys(toolsMap).length > 0) return;
    try {
      const res  = await fetch('data/tools.json');
      const data = await res.json();
      data.forEach(t => {
        toolsMap[String(t.id)] = t;
        if (t.slug) toolsMap[t.slug] = t;
      });
    } catch (e) { console.warn('tools.json:', e); }
  }

  const toolName     = id => toolsMap[String(id)]?.name     || id;
  const toolCategory = id => toolsMap[String(id)]?.category || '';
  const toolUrl      = id => toolsMap[String(id)]?.page || toolsMap[String(id)]?.url || '#';

  /* -- Nav avatar -- */
  async function initNav(user, profile) {
    const slot = document.querySelector('.nav-profile-slot');
    if (!slot) return;
    if (!user) {
      slot.innerHTML = `<a href="auth.html" class="btn-nav-auth">Connexion</a>`;
      return;
    }
    const initial = (profile?.username || user.email || '?')[0].toUpperCase();
    slot.innerHTML = `
      <div class="nav-avatar-wrap" id="nav-avatar-wrap">
        <button class="nav-avatar" id="nav-avatar-btn" aria-label="Mon compte">${initial}</button>
        <div class="nav-avatar-menu" id="nav-avatar-menu">
          <div class="nav-avatar-name">${profile?.username || user.email}</div>
          <a href="profile.html"               class="nav-avatar-item">👤 Mon profil</a>
          <a href="profile.html#favorites"     class="nav-avatar-item">❤️ Favoris</a>
          <a href="profile.html#collections"   class="nav-avatar-item">📁 Collections</a>
          <a href="profile.html#history"       class="nav-avatar-item">🕒 Historique</a>
          <a href="profile.html#notifications" class="nav-avatar-item">🔔 Notifications</a>
          <div class="nav-avatar-divider"></div>
          <button class="nav-avatar-item" id="nav-logout-btn">🚪 Déconnexion</button>
        </div>
      </div>`;
    const btn  = document.getElementById('nav-avatar-btn');
    const menu = document.getElementById('nav-avatar-menu');
    btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
    document.addEventListener('click', () => menu.classList.remove('open'));
    menu.addEventListener('click', e => e.stopPropagation());
    document.getElementById('nav-logout-btn').addEventListener('click', signOut);
  }

  /* -- Page Profil -- */
  async function initProfile(user, profile) {
    await loadToolsMap();

    const username = profile?.username || user.email?.split('@')[0] || '—';
    const initial  = username[0].toUpperCase();
    setEl('profile-avatar-display',   initial);
    setEl('profile-username-display', username);
    setEl('profile-email-display',    profile?.email || user.email || '—');
    setEl('dash-username',            username);
    setVal('settings-username',       username);
    setVal('settings-email',          profile?.email || user.email || '');

    async function loadFavorites() {
      const snap = await db.collection('favorites').where('user_id', '==', user.uid).get();
      return snap.docs.map(d => d.data());
    }

    function renderFavorites(data) {
      const grid = document.getElementById('fav-grid');
      if (!grid) return;
      setCount('fav-count', data.length);
      if (!data.length) {
        grid.innerHTML = '<p class="empty-state">Aucun favori pour l\'instant.<br><a href="index.html">Découvrir des outils →</a></p>';
        return;
      }
      grid.innerHTML = data.map(f => {
        const t   = toolsMap[String(f.tool_id)] || {};
        const url = toolUrl(f.tool_id);
        return `<div class="fav-card" onclick="window.location.href='${url}'">
          <div class="fav-card-head">
            <span class="fav-emoji">${t.emoji || '🤖'}</span>
            <div>
              <div class="fav-name">${toolName(f.tool_id)}</div>
              <div class="fav-cat">${toolCategory(f.tool_id)}</div>
            </div>
          </div>
          <button class="fav-remove" onclick="event.stopPropagation();removeFavorite('${f.tool_id}')">✕</button>
        </div>`;
      }).join('');
    }

    window.removeFavorite = async function(toolId) {
      const snap = await db.collection('favorites')
        .where('user_id', '==', user.uid).where('tool_id', '==', String(toolId)).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast('Retiré des favoris');
      loadFavorites().then(renderFavorites);
    };

    async function loadCollections() {
      const snap = await db.collection('collections')
        .where('user_id', '==', user.uid).orderBy('created_at', 'desc').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    function renderCollections(data) {
      const list = document.getElementById('collections-list');
      if (!list) return;
      setCount('collections-count', data.length);
      if (!data.length) {
        list.innerHTML = '<p class="empty-state">Aucune collection. Créez-en une !</p>';
        return;
      }
      list.innerHTML = data.map(c => `
        <div class="collection-item">
          <div class="collection-name">${c.name}</div>
          <div class="collection-meta">${(c.tool_ids || []).length} outil(s)</div>
          <button class="btn-ghost-sm" onclick="deleteCollection('${c.id}')">Supprimer</button>
        </div>`).join('');
    }

    window.deleteCollection = async function(id) {
      await db.collection('collections').doc(id).delete();
      showToast('Collection supprimée');
      loadCollections().then(renderCollections);
    };

    window.createCollection = async function() {
      const input = document.getElementById('new-collection-name');
      const name  = input?.value.trim();
      if (!name) return;
      await db.collection('collections').add({
        user_id: user.uid, name, tool_ids: [],
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (input) input.value = '';
      showToast('Collection créée !');
      loadCollections().then(renderCollections);
    };

    async function loadHistory() {
      const snap = await db.collection('history')
        .where('user_id', '==', user.uid).orderBy('visited_at', 'desc').limit(50).get();
      return snap.docs.map(d => d.data());
    }

    function renderHistory(data) {
      const list = document.getElementById('history-list');
      if (!list) return;
      setCount('history-count', data.length);
      if (!data.length) {
        list.innerHTML = '<p class="empty-state">Aucun historique.</p>';
        return;
      }
      list.innerHTML = data.map(h => {
        const url = toolUrl(h.tool_id);
        return `<div class="history-item" onclick="window.location.href='${url}'">
          <span class="history-name">${toolName(h.tool_id)}</span>
          <span class="history-date">${h.visited_at?.toDate ? h.visited_at.toDate().toLocaleDateString('fr-FR') : ''}</span>
        </div>`;
      }).join('');
    }

    window.clearHistory = async function() {
      const snap = await db.collection('history').where('user_id', '==', user.uid).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast('Historique effacé');
      loadHistory().then(renderHistory);
    };

    async function loadNotifications() {
      const snap = await db.collection('notifications')
        .where('user_id', '==', user.uid).orderBy('created_at', 'desc').limit(20).get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    function renderNotifications(data) {
      const list = document.getElementById('notif-list');
      if (!list) return;
      const unread = data.filter(n => !n.read).length;
      setCount('notif-count', unread || '');
      if (!data.length) {
        list.innerHTML = '<p class="empty-state">Aucune notification.</p>';
        return;
      }
      list.innerHTML = data.map(n => `
        <div class="notif-item ${n.read ? '' : 'notif-unread'}" onclick="markNotifRead('${n.id}')">
          <div class="notif-msg">${n.message || ''}</div>
          <div class="notif-date">${n.created_at?.toDate ? n.created_at.toDate().toLocaleDateString('fr-FR') : ''}</div>
        </div>`).join('');
    }

    window.markNotifRead = async function(id) {
      await db.collection('notifications').doc(id).update({ read: true });
      loadNotifications().then(renderNotifications);
    };

    window.saveSettings = async function() {
      const newUsername = document.getElementById('settings-username')?.value.trim();
      if (!newUsername) return;
      await db.collection('profiles').doc(user.uid).update({ username: newUsername });
      showToast('Profil mis à jour !');
      setEl('profile-username-display', newUsername);
      setEl('dash-username', newUsername);
    };

    window.deleteAccount = async function() {
      if (!confirm('Supprimer définitivement votre compte ? Cette action est irréversible.')) return;
      const batch = db.batch();
      for (const col of ['favorites', 'collections', 'history', 'notifications']) {
        const snap = await db.collection(col).where('user_id', '==', user.uid).get();
        snap.docs.forEach(d => batch.delete(d.ref));
      }
      await batch.commit();
      await db.collection('profiles').doc(user.uid).delete();
      await user.delete();
      window.location.href = 'index.html';
    };

    window.switchTab = function(tab) {
      document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.profile-section').forEach(s => s.classList.remove('active'));
      const tabEl  = document.querySelector(`.profile-tab[data-tab="${tab}"]`);
      const sectEl = document.getElementById(`section-${tab}`);
      if (tabEl)  tabEl.classList.add('active');
      if (sectEl) sectEl.classList.add('active');
      if (tab === 'favorites')     loadFavorites().then(renderFavorites);
      if (tab === 'collections')   loadCollections().then(renderCollections);
      if (tab === 'history')       loadHistory().then(renderHistory);
      if (tab === 'notifications') loadNotifications().then(renderNotifications);
    };

    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => window.switchTab(tab.dataset.tab));
    });

    /* Chargement initial du dashboard */
    try {
      const [favData, colData, histData, notifData] = await Promise.all([
        loadFavorites(), loadCollections(), loadHistory(), loadNotifications()
      ]);
      setCount('dash-fav-count',  favData.length);
      setCount('dash-col-count',  colData.length);
      setCount('dash-hist-count', histData.length);
      setCount('fav-count',         favData.length);
      setCount('collections-count', colData.length);
      setCount('history-count',     histData.length);
      const unread = notifData.filter(n => !n.read).length;
      setCount('notif-count', unread || '');
    } catch (err) {
      console.error('Erreur chargement dashboard:', err);
      ['dash-fav-count','dash-col-count','dash-hist-count'].forEach(id => setCount(id, 0));
    }

    const hash = window.location.hash.replace('#', '');
    if (hash) window.switchTab(hash);
  }

  /* -- Page Auth -- */
  function initAuth(user) {
    if (user) { window.location.href = 'profile.html'; return; }

    function showMessage(msg, type = 'error') {
      const el = document.getElementById('auth-message');
      if (!el) return;
      el.textContent = msg;
      el.className   = 'auth-message auth-message--' + type;
      el.style.display = 'block';
    }
    function hideMessage() {
      const el = document.getElementById('auth-message');
      if (el) el.style.display = 'none';
    }
    function setLoading(btn, loading) {
      btn.disabled = loading;
      btn.dataset.orig = btn.dataset.orig || btn.textContent;
      btn.textContent  = loading ? '...' : btn.dataset.orig;
    }
    function translateError(code) {
      const map = {
        'auth/invalid-credential':     'Email ou mot de passe incorrect.',
        'auth/user-not-found':         'Aucun compte avec cet email.',
        'auth/wrong-password':         'Mot de passe incorrect.',
        'auth/email-already-in-use':   'Un compte existe déjà avec cet email.',
        'auth/weak-password':          'Mot de passe trop court (min. 6 caractères).',
        'auth/invalid-email':          'Email invalide.',
        'auth/too-many-requests':      'Trop de tentatives. Attendez quelques minutes.',
        'auth/network-request-failed': 'Erreur réseau. Vérifiez votre connexion.',
        'auth/popup-closed-by-user':   'Connexion Google annulée.',
      };
      return map[code] || 'Une erreur est survenue. Réessayez.';
    }

    const tabs = document.querySelectorAll('.auth-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form-wrap').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById('form-' + tab.dataset.tab).classList.add('active');
        hideMessage();
      });
    });

    document.getElementById('forgot-link')?.addEventListener('click', e => {
      e.preventDefault();
      document.querySelectorAll('.auth-form-wrap').forEach(f => f.classList.remove('active'));
      document.getElementById('form-reset').classList.add('active');
      tabs.forEach(t => t.classList.remove('active'));
    });
    document.getElementById('btn-back-login')?.addEventListener('click', () => {
      document.querySelectorAll('.auth-form-wrap').forEach(f => f.classList.remove('active'));
      document.getElementById('form-login').classList.add('active');
      document.getElementById('tab-login')?.classList.add('active');
    });

    document.querySelectorAll('.toggle-pw').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.type  = input.type === 'password' ? 'text' : 'password';
        btn.textContent = input.type === 'password' ? '👁' : '🙈';
      });
    });

    document.getElementById('signup-password')?.addEventListener('input', function () {
      const val = this.value;
      const el  = document.getElementById('pw-strength');
      if (!el) return;
      let s = 0;
      if (val.length >= 8) s++; if (/[A-Z]/.test(val)) s++;
      if (/[0-9]/.test(val)) s++; if (/[^A-Za-z0-9]/.test(val)) s++;
      const labels = ['', 'Faible', 'Moyen', 'Bon', 'Fort'];
      const colors = ['', '#e05c5c', '#f0a030', '#6cc', '#4caf50'];
      el.innerHTML = val ? `<div class="pw-bar"><div class="pw-fill" style="width:${s*25}%;background:${colors[s]}"></div></div><span style="color:${colors[s]}">${labels[s]}</span>` : '';
    });

    document.getElementById('btn-login')?.addEventListener('click', async () => {
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn      = document.getElementById('btn-login');
      if (!email || !password) { showMessage('Veuillez remplir tous les champs.'); return; }
      setLoading(btn, true); hideMessage();
      try { await signIn(email, password); window.location.href = 'profile.html'; }
      catch (err) { showMessage(translateError(err.code)); }
      finally { setLoading(btn, false); }
    });

    document.getElementById('btn-signup')?.addEventListener('click', async () => {
      const username = document.getElementById('signup-username').value.trim();
      const email    = document.getElementById('signup-email').value.trim();
      const password = document.getElementById('signup-password').value;
      const btn      = document.getElementById('btn-signup');
      if (!username || !email || !password) { showMessage('Veuillez remplir tous les champs.'); return; }
      if (password.length < 8) { showMessage('Le mot de passe doit contenir au moins 8 caractères.'); return; }
      setLoading(btn, true); hideMessage();
      try {
        await signUp(email, password, username);
        showMessage('Compte créé ! Vous allez être redirigé…', 'success');
        setTimeout(() => window.location.href = 'profile.html', 1500);
      } catch (err) { showMessage(translateError(err.code)); }
      finally { setLoading(btn, false); }
    });

    document.getElementById('btn-google-login')?.addEventListener('click', async () => {
      try { await signInWithGoogle(); } catch (err) { showMessage(translateError(err.code)); }
    });
    document.getElementById('btn-google-signup')?.addEventListener('click', async () => {
      try { await signInWithGoogle(); } catch (err) { showMessage(translateError(err.code)); }
    });

    document.getElementById('btn-reset')?.addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value.trim();
      const btn   = document.getElementById('btn-reset');
      if (!email) { showMessage('Entrez votre email.'); return; }
      setLoading(btn, true); hideMessage();
      try { await resetPassword(email); showMessage('Email envoyé ! Vérifiez votre boîte.', 'success'); }
      catch (err) { showMessage(translateError(err.code)); }
      finally { setLoading(btn, false); }
    });

    document.getElementById('login-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
    document.getElementById('signup-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-signup').click();
    });
  }

  /* -- Résolution de l'utilisateur Firebase -- */
  const user = await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
  });

  let profile = null;
  if (user) profile = await ensureProfile(user);

  /* Exposer avant tout rendu */
  window._fbUser = user || null;
  window._sbUser = window._fbUser;

  await initNav(user, profile);

  if (IS_PROFILE) {
    const loadingEl = document.getElementById('profile-loading');
    if (loadingEl) loadingEl.style.display = 'none';
    if (!user) {
      const unauth = document.getElementById('profile-unauth');
      if (unauth) unauth.style.display = 'flex';
    } else {
      const main = document.getElementById('profile-main');
      if (main) main.style.display = 'flex';
      await initProfile(user, profile);
    }
  }

  if (IS_AUTH) initAuth(user);

  if (IS_INDEX) {
    /* Charger les favoris Firebase dans state avant le premier rendu */
    if (user) await loadFavoritesFirebase();
  }

})();

/* ════════════════════════════════════════════════════════
   SECTION 23 — DOMContentLoaded (index.html uniquement)
   ════════════════════════════════════════════════════════ */

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
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  initNewsletter();
  readSearchFromURL();
  loadAllData();

  if (window.BlogReader)    window.BlogReader.createBlogReader();
  if (window.GalleryLightbox) window.GalleryLightbox.initLightbox();

  /* Navigation depuis les pages secondaires via hash */
  const hash = window.location.hash.replace('#', '');
  if (['tools', 'blog', 'gallery'].includes(hash)) showPage(hash);
});

/* ════════════════════════════════════════════════════════
   SECTION 24 — GESTION ERREURS GLOBALES
   ════════════════════════════════════════════════════════ */

window.onerror = function(msg, src, line) {
  console.error('ERREUR:', msg, '| Ligne:', line);
};

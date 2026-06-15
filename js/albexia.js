/* ═══════════════════════════════════════════════════════
   Albexia — Script Unique Global (Firebase + UI Engine Master)
   Version Finale Unifiée : Gère Auth, Firestore, Navigation,
   Outils, Blog, Galerie (avec Lightbox Multimédia complet) et Profil.
   Usage : <script src="js/albexia.js"></script> sur toutes les pages.
   ═══════════════════════════════════════════════════════ */

(async function () {
  'use strict';

  /* ════════════════════════════════════════
     1. CHARGEMENT ASYNCHRONE DE FIREBASE (CDN COMPAT)
  ════════════════════════════════════════ */
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

  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');

  /* ════════════════════════════════════════
     2. CONFIGURATION & INITIALISATION FIREBASE
  ════════════════════════════════════════ */
  const firebaseConfig = {
    apiKey:            "AIzaSyA6B14vp5wz-0em9eboEAXRVhHy7WF_Lvk",
    authDomain:        "albexia-dc650.firebaseapp.com",
    projectId:         "albexia-dc650",
    storageBucket:     "albexia-dc650.firebasestorage.app",
    messagingSenderId: "805830291200",
    appId:             "1:805830291200:web:c24122224c1abaf4360de5"
  };

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  const auth = firebase.auth();
  const db   = firebase.firestore();

  /* ════════════════════════════════════════
     3. ÉTAT GLOBAL DE L'APPLICATION (State)
  ════════════════════════════════════════ */
  const LS_LANG_KEY = 'albexia_langue';
  const LANGUES_SUPPORTEES = ['fr', 'en', 'es'];

  function detecterLangue() {
    const saved = localStorage.getItem(LS_LANG_KEY);
    if (saved && LANGUES_SUPPORTEES.includes(saved)) return saved;
    const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
    return LANGUES_SUPPORTEES.includes(nav) ? nav : 'fr';
  }

  const state = {
    user: null,
    favorites: new Set(),
    tools: [],
    blog: [],
    gallery: [],
    toolsMap: {},
    langue: detecterLangue(),
    activeToolCat: 'Tous',
    activeBlogCat: 'Tous',
    activeGalleryCat: 'Tous',
    toolsPage: 1,
    blogPage: 1,
    toolsPerPage: 12,
    blogPerPage: 6,
    searchQuery: '',
    searchBlogQuery: '',
    searchGalleryQuery: '',
    // État Lightbox pour la galerie
    lightboxFilteredItems: [],
    lightboxIndex: 0,
    zoomLevel: 100
  };

  // Identification des conteneurs cibles de page
  const IS_PROFILE = document.getElementById('profile-main') !== null;
  const IS_AUTH    = document.getElementById('btn-login')    !== null;
  const IS_INDEX   = document.getElementById('page-tools')   !== null || document.getElementById('tools-grid') !== null;

  /* ════════════════════════════════════════
     4. DICTIONNAIRE DE TRADUCTION UI
  ════════════════════════════════════════ */
  const DICT = {
    fr: {
      searchPlaceholder: "Rechercher une IA...", searchBlog: "Rechercher un article...", searchGallery: "Rechercher une invite...",
      catTous: "Tous", submitBtn: "Soumettre", loading: "Chargement...", noResult: "Aucun résultat trouvé.",
      addFavToast: "❤️ Ajouté aux favoris !", removeFavToast: "Retiré des favoris", loginRequired: "Connectez-vous pour sauvegarder des favoris",
      collectionRequired: "Connectez-vous pour gérer vos collections",
      emptyFav: "Aucun favori pour l'instant.<br><a href='index.html'>Découvrir des outils →</a>"
    },
    en: {
      searchPlaceholder: "Search an AI...", searchBlog: "Search an article...", searchGallery: "Search a prompt...",
      catTous: "All", submitBtn: "Submit", loading: "Loading...", noResult: "No results found.",
      addFavToast: "❤️ Added to favorites!", removeFavToast: "Removed from favorites", loginRequired: "Log in to save favorites",
      collectionRequired: "Log in to manage your collections",
      emptyFav: "No favorites yet.<br><a href='index.html'>Discover tools →</a>"
    },
    es: {
      searchPlaceholder: "Buscar una IA...", searchBlog: "Buscar un artículo...", searchGallery: "Buscar un prompt...",
      catTous: "Todos", submitBtn: "Enviar", loading: "Cargando...", noResult: "No se encontraron resultados.",
      addFavToast: "❤️ ¡Añadido a favoritos!", removeFavToast: "Eliminado de favoritos", loginRequired: "Inicie sesión para guardar favoritos",
      collectionRequired: "Inicie sesión para gestionar colecciones",
      emptyFav: "Ningún favorito por el momento.<br><a href='index.html'>Descubrir herramientas →</a>"
    }
  };

  const toolName     = id => state.toolsMap[String(id)]?.name     || id;
  const toolCategory = id => state.toolsMap[String(id)]?.category || '';
  const toolUrl      = id => state.toolsMap[String(id)]?.page || state.toolsMap[String(id)]?.url || '#';

  function setEl(id, text)  { const e = document.getElementById(id); if (e) e.textContent = text; }
  function setVal(id, val)  { const e = document.getElementById(id); if (e) e.value = val; }
  function setCount(id, n)  { const e = document.getElementById(id); if (e) e.textContent = n; }

  function showToast(msg) {
    const t = document.createElement('div');
    t.className = 'profile-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('visible'), 10);
    setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 3000);
  }

  /* ════════════════════════════════════════
     5. INTERACTION FIRESTORE (Favoris, Historique, Collections)
  ════════════════════════════════════════ */
  window.toggleFavoriteFirebase = async function(toolId, event) {
    if (event) event.stopPropagation();
    const id = String(toolId);
    if (!state.user) {
      showToast(DICT[state.langue].loginRequired);
      setTimeout(() => window.location.href = 'auth.html', 1500);
      return;
    }

    const snap = await db.collection('favorites')
      .where('user_id', '==', state.user.uid)
      .where('tool_id', '==', id).get();

    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      state.favorites.delete(id);
      showToast(DICT[state.langue].removeFavToast);
    } else {
      await db.collection('favorites').add({
        user_id: state.user.uid,
        tool_id: id,
        added_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      state.favorites.add(id);
      showToast(DICT[state.langue].addFavToast);
    }

    updateFavNavCount();
    // Met à jour l'icône de la carte en temps réel si on est sur la liste des outils
    if (IS_INDEX && typeof window.renderTools === 'function') window.renderTools();
  };

  window.trackToolVisit = async function(toolId) {
    if (!state.user) return;
    await db.collection('history').add({
      user_id:    state.user.uid,
      tool_id:    String(toolId),
      visited_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  window.toggleToolInCollection = async function(collectionId, toolId, event) {
    if (event) event.stopPropagation();
    const id = String(toolId);
    if (!state.user) { showToast(DICT[state.langue].collectionRequired); return; }

    const docRef = db.collection('collections').doc(collectionId);
    try {
      const docSnap = await docRef.get();
      if (!docSnap.exists) return;

      const currentTools = docSnap.data().tool_ids || [];
      if (currentTools.includes(id)) {
        await docRef.update({ tool_ids: firebase.firestore.FieldValue.arrayRemove(id) });
        showToast('Retiré de la collection');
      } else {
        await docRef.update({ tool_ids: firebase.firestore.FieldValue.arrayUnion(id) });
        showToast('Ajouté à la collection !');
      }
      if (IS_PROFILE && document.getElementById('section-collections').classList.contains('active')) {
        window.switchTab('collections');
      }
    } catch (e) { console.error("Erreur collection:", e); }
  };

  function updateFavNavCount() {
    const badge = document.getElementById('fav-nav-count');
    if (badge) badge.textContent = state.favorites.size || '0';
  }

  /* ════════════════════════════════════════
     6. DESIGN COMPOSANT : NAVBAR MENU AVATAR
  ════════════════════════════════════════ */
  function initNav(user, profile) {
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
    if (btn && menu) {
      btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
      document.addEventListener('click', () => menu.classList.remove('open'));
    }
    const logoutBtn = document.getElementById('nav-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async () => {
        await auth.signOut();
        window.location.href = 'index.html';
      });
    }
  }

  async function ensureProfile(user) {
    const ref = db.collection('profiles').doc(user.uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data();
    const username = user.displayName || user.email?.split('@')[0] || 'utilisateur';
    const profile  = { username, email: user.email, createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    await ref.set(profile, { merge: true });
    return profile;
  }

  /* ════════════════════════════════════════
     7. MODULE DE LANGUE & TRADUCTION UI
  ════════════════════════════════════════ */
  window.changerLangue = function(code) {
    if (!LANGUES_SUPPORTEES.includes(code)) return;
    localStorage.setItem(LS_LANG_KEY, code);
    state.langue = code;
    state.activeToolCat = 'Tous';
    state.activeBlogCat = 'Tous';
    state.activeGalleryCat = 'Tous';
    state.toolsPage = 1;
    state.blogPage = 1;

    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === code);
    });

    const inputTool = document.getElementById('search-input');
    if (inputTool) inputTool.placeholder = DICT[code].searchPlaceholder;
    const inputBlog = document.getElementById('blog-search-input');
    if (inputBlog) inputBlog.placeholder = DICT[code].searchBlog;
    const inputGal = document.getElementById('gallery-search-input');
    if (inputGal) inputGal.placeholder = DICT[code].searchGallery;

    if (IS_INDEX) {
      applyTranslationsUI();
      loadDataAndRender();
    }
  };

  function applyTranslationsUI() {
    const code = state.langue;
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      if (DICT[code] && DICT[code][key]) el.textContent = DICT[code][key];
    });
  }

  function initLangButtons() {
    document.querySelectorAll('.lang-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.lang === state.langue);
      btn.addEventListener('click', () => window.changerLangue(btn.dataset.lang));
    });
  }

  /* ════════════════════════════════════════
     8. CHARGEMENT CENTRAL DES SOURCES JSON (Tools, Blog, Galerie)
  ════════════════════════════════════════ */
  async function loadDataAndRender() {
    try {
      const [resTools, resBlog, resGallery] = await Promise.all([
        fetch('data/tools.json').then(r => r.json()).catch(() => []),
        fetch('data/blog.json').then(r => r.json()).catch(() => []),
        fetch('data/gallery.json').then(r => r.json()).catch(() => [])
      ]);

      state.tools = resTools;
      state.blog = resBlog;
      state.gallery = resGallery;

      state.toolsMap = {};
      state.tools.forEach(t => {
        state.toolsMap[String(t.id)] = t;
        if (t.slug) state.toolsMap[t.slug] = t;
      });

      if (IS_INDEX) {
        buildCategoriesHTML();
        window.renderTools();
        renderBlog();
        renderGallery();
        checkUrlParams();
      }
    } catch (e) { console.error("Erreur chargement des fichiers JSON:", e); }
  }

  /* ════════════════════════════════════════
     9. MOTEUR D'AFFICHAGE DE L'INDEX (Outils, Blog, Galerie)
  ════════════════════════════════════════ */
  function buildCategoriesHTML() {
    const build = (items, containerId, activeCat, clickFnName) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const cats = new Set(items.map(i => i.category).filter(Boolean));
      const textTous = state.langue === 'en' ? 'All' : (state.langue === 'es' ? 'Todos' : 'Tous');
      let html = `<button class="cat-btn ${activeCat === 'Tous' ? 'active' : ''}" onclick="${clickFnName}('Tous')">${textTous}</button>`;
      cats.forEach(c => {
        html += `<button class="cat-btn ${activeCat === c ? 'active' : ''}" onclick="${clickFnName}('${c}')">${c}</button>`;
      });
      container.innerHTML = html;
    };
    build(state.tools, 'tools-categories', state.activeToolCat, 'filterToolsCategory');
    build(state.blog, 'blog-categories', state.activeBlogCat, 'filterBlogCategory');
    build(state.gallery, 'gallery-categories', state.activeGalleryCat, 'filterGalleryCategory');
  }

  window.filterToolsCategory = function(cat) { state.activeToolCat = cat; state.toolsPage = 1; buildCategoriesHTML(); window.renderTools(); };
  window.filterBlogCategory  = function(cat) { state.activeBlogCat = cat; state.blogPage = 1; buildCategoriesHTML(); renderBlog(); };
  window.filterGalleryCategory = function(cat) { state.activeGalleryCat = cat; buildCategoriesHTML(); renderGallery(); };

  window.renderTools = function() {
    const grid = document.getElementById('tools-grid');
    if (!grid) return;

    let filtered = state.tools.filter(t => {
      const matchCat = state.activeToolCat === 'Tous' || t.category === state.activeToolCat;
      const matchSrc = !state.searchQuery || t.name.toLowerCase().includes(state.searchQuery) || (t.short_desc && t.short_desc.toLowerCase().includes(state.searchQuery));
      return matchCat && matchSrc;
    });

    const totalPages = Math.ceil(filtered.length / state.toolsPerPage) || 1;
    const start = (state.toolsPage - 1) * state.toolsPerPage;
    const paginated = filtered.slice(start, start + state.toolsPerPage);

    if (!paginated.length) {
      grid.innerHTML = `<p class="no-results">${DICT[state.langue].noResult}</p>`;
      renderPagination('tools-pagination', totalPages, state.toolsPage, 'changeToolsPage');
      return;
    }

    grid.innerHTML = paginated.map(t => {
      const isFav = state.favorites.has(String(t.id));
      return `
        <div class="tool-card" onclick="window.trackToolVisit('${t.id}'); window.location.href='${t.page || t.url || '#'}';">
          <div class="tool-card-header">
            <span class="tool-emoji">${t.emoji || '🤖'}</span>
            <button class="btn-fav ${isFav ? 'is-favorite' : ''}" onclick="window.toggleFavoriteFirebase('${t.id}', event)" aria-label="Favori">
              ${isFav ? '❤️' : '🤍'}
            </button>
          </div>
          <h3 class="tool-name">${t.name}</h3>
          <p class="tool-desc">${t.short_desc || ''}</p>
          <div class="tool-footer">
            <span class="tool-cat">${t.category || ''}</span>
            <span class="tool-pricing ${t.pricing ? t.pricing.toLowerCase() : ''}">${t.pricing || ''}</span>
          </div>
        </div>`;
    }).join('');

    renderPagination('tools-pagination', totalPages, state.toolsPage, 'changeToolsPage');
  };

  function renderBlog() {
    const grid = document.getElementById('blog-grid');
    if (!grid) return;

    let filtered = state.blog.filter(b => {
      const matchCat = state.activeBlogCat === 'Tous' || b.category === state.activeBlogCat;
      const matchSrc = !state.searchBlogQuery || b.title.toLowerCase().includes(state.searchBlogQuery);
      return matchCat && matchSrc;
    });

    const totalPages = Math.ceil(filtered.length / state.blogPerPage) || 1;
    const start = (state.blogPage - 1) * state.blogPerPage;
    const paginated = filtered.slice(start, start + state.blogPerPage);

    if (!paginated.length) {
      grid.innerHTML = `<p class="no-results">${DICT[state.langue].noResult}</p>`;
      renderPagination('blog-pagination', totalPages, state.blogPage, 'changeBlogPage');
      return;
    }

    grid.innerHTML = paginated.map(b => `
      <article class="blog-card" onclick="window.location.href='${b.page || '#'}';">
        <img src="${b.image || 'img/blog-placeholder.jpg'}" alt="${b.title}" class="blog-img" loading="lazy">
        <div class="blog-content">
          <span class="blog-cat">${b.category}</span>
          <h3 class="blog-title">${b.title}</h3>
          <p class="blog-desc">${b.short_desc || ''}</p>
          <div class="blog-meta">${b.date || ''}</div>
        </div>
      </article>`).join('');

    renderPagination('blog-pagination', totalPages, state.blogPage, 'changeBlogPage');
  }

  function renderGallery() {
    const grid = document.getElementById('gallery-grid');
    if (!grid) return;

    state.lightboxFilteredItems = state.gallery.filter(g => {
      const matchCat = state.activeGalleryCat === 'Tous' || g.category === state.activeGalleryCat;
      const matchSrc = !state.searchGalleryQuery || g.prompt.toLowerCase().includes(state.searchGalleryQuery) || g.tool.toLowerCase().includes(state.searchGalleryQuery);
      return matchCat && matchSrc;
    });

    if (!state.lightboxFilteredItems.length) {
      grid.innerHTML = `<p class="no-results">${DICT[state.langue].noResult}</p>`;
      return;
    }

    grid.innerHTML = state.lightboxFilteredItems.map((g, index) => {
      let mediaIcon = '🖼️';
      if (g.type === 'video') mediaIcon = '🎥';
      if (g.type === 'audio') mediaIcon = '🎵';

      return `
        <div class="gallery-card" onclick="window.openLightbox(${index})">
          <img src="${g.type === 'audio' ? (g.art || 'img/audio-placeholder.jpg') : g.image}" alt="Prompt Art" class="gallery-img" loading="lazy">
          <div class="gallery-overlay">
            <span class="gallery-media-badge">${mediaIcon}</span>
            <p class="gallery-prompt">"${g.prompt}"</p>
            <div class="gallery-meta">
              <span class="gallery-tool">🛠️ ${g.tool}</span>
              <button class="btn-copy-prompt" onclick="event.stopPropagation(); navigator.clipboard.writeText(\`${g.prompt.replace(/"/g, '\\"')}\`); showToast('Prompt copié !');">📋</button>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function renderPagination(containerId, total, current, changeFnName) {
    const container = document.getElementById(containerId);
    if (!container) return;
    if (total <= 1) { container.innerHTML = ''; return; }

    let html = `<button class="pag-btn" ${current === 1 ? 'disabled' : ''} onclick="${changeFnName}(${current - 1})">◀</button>`;
    for (let i = 1; i <= total; i++) {
      html += `<button class="pag-btn ${i === current ? 'active' : ''}" onclick="${changeFnName}(${i})">${i}</button>`;
    }
    html += `<button class="pag-btn" ${current === total ? 'disabled' : ''} onclick="${changeFnName}(${current + 1})">▶</button>`;
    container.innerHTML = html;
  }

  window.changeToolsPage = function(p) { state.toolsPage = p; window.renderTools(); document.getElementById('tools-main-section')?.scrollIntoView({ behavior: 'smooth' }); };
  window.changeBlogPage  = function(p) { state.blogPage = p; renderBlog(); document.getElementById('blog-main-section')?.scrollIntoView({ behavior: 'smooth' }); };

  function initSearchInputs() {
    document.getElementById('search-input')?.addEventListener('input', function() { state.searchQuery = this.value.toLowerCase().trim(); state.toolsPage = 1; window.renderTools(); });
    document.getElementById('blog-search-input')?.addEventListener('input', function() { state.searchBlogQuery = this.value.toLowerCase().trim(); state.blogPage = 1; renderBlog(); });
    document.getElementById('gallery-search-input')?.addEventListener('input', function() { state.searchGalleryQuery = this.value.toLowerCase().trim(); renderGallery(); });
  }

  /* ════════════════════════════════════════
     10. GESTION DES ONGLETS DE NAVIGATION PRINCIPAUX
  ════════════════════════════════════════ */
  window.showPage = function(pageId) {
    document.querySelectorAll('.main-page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

    const sect = document.getElementById('page-' + pageId);
    const link = document.querySelector(`.nav-link[data-page="${pageId}"]`);
    if (sect) sect.classList.add('active');
    if (link) link.classList.add('active');

    window.location.hash = pageId;
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  function initNavLinks() {
    document.querySelectorAll('.nav-link[data-page]').forEach(l => {
      l.addEventListener('click', (e) => { e.preventDefault(); window.showPage(l.dataset.page); });
    });
    const hash = window.location.hash.replace('#', '');
    if (['tools', 'blog', 'gallery'].includes(hash)) {
      window.showPage(hash);
    } else {
      window.showPage('tools'); // Page par défaut
    }
  }

  /* ════════════════════════════════════════
     11. VISIONNEUSE (LIGHTBOX) MULTIMÉDIA DE LA GALERIE
  ════════════════════════════════════════ */
  window.openLightbox = function(index) {
    const item = state.lightboxFilteredItems[index];
    if (!item) return;

    state.lightboxIndex = index;
    state.zoomLevel = 100;

    const lb = document.getElementById('lightbox');
    const lbImg = document.getElementById('lb-img');
    const lbVideo = document.getElementById('lb-video');
    const lbAudioWrap = document.getElementById('lb-audio-wrap');
    const lbAudio = document.getElementById('lb-audio');
    const lbAudioArt = document.getElementById('lb-audio-art');
    const lbAudioTitle = document.getElementById('lb-audio-title');

    if (!lb) return;

    // Réinitialisation des médias
    lbImg.style.display = 'none';
    lbVideo.style.display = 'none';
    lbAudioWrap.style.display = 'none';
    lbVideo.pause(); lbVideo.src = '';
    lbAudio.pause(); lbAudio.src = '';

    // Configuration selon le type de média
    if (item.type === 'video') {
      lbVideo.src = item.video;
      lbVideo.style.display = 'block';
    } else if (item.type === 'audio') {
      lbAudio.src = item.audio;
      if (lbAudioArt) lbAudioArt.style.backgroundImage = `url('${item.art || 'img/audio-placeholder.jpg'}')`;
      if (lbAudioTitle) lbAudioTitle.textContent = item.prompt;
      lbAudioWrap.style.display = 'flex';
    } else {
      lbImg.src = item.image;
      lbImg.style.display = 'block';
      lbImg.style.transform = `scale(1) translate(0px, 0px)`;
    }

    setEl('lb-title', `"${item.prompt}"`);
    setEl('lb-tool', `🛠️ Généré avec ${item.tool} (${item.category || ''})`);
    updateZoomDisplay();

    lb.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeLightbox = function() {
    const lb = document.getElementById('lightbox');
    if (!lb) return;
    lb.classList.remove('active');
    document.getElementById('lb-video')?.pause();
    document.getElementById('lb-audio')?.pause();
    document.body.style.overflow = '';
  };

  window.lightboxPrev = function() {
    if (state.lightboxFilteredItems.length <= 1) return;
    let idx = state.lightboxIndex - 1;
    if (idx < 0) idx = state.lightboxFilteredItems.length - 1;
    window.openLightbox(idx);
  };

  window.lightboxNext = function() {
    if (state.lightboxFilteredItems.length <= 1) return;
    let idx = state.lightboxIndex + 1;
    if (idx >= state.lightboxFilteredItems.length) idx = 0;
    window.openLightbox(idx);
  };

  function updateZoomDisplay() {
    const el = document.getElementById('lb-zoom-level');
    if (el) el.textContent = `${state.zoomLevel}%`;
  }

  window.lightboxZoomIn = function() {
    if (state.zoomLevel >= 300) return;
    state.zoomLevel += 25;
    document.getElementById('lb-img').style.transform = `scale(${state.zoomLevel / 100})`;
    updateZoomDisplay();
  };

  window.lightboxZoomOut = function() {
    if (state.zoomLevel <= 50) return;
    state.zoomLevel -= 25;
    document.getElementById('lb-img').style.transform = `scale(${state.zoomLevel / 100})`;
    updateZoomDisplay();
  };

  window.lightboxZoomReset = function() {
    state.zoomLevel = 100;
    document.getElementById('lb-img').style.transform = `scale(1)`;
    updateZoomDisplay();
  };

  function initLightboxEvents() {
    document.getElementById('lightbox-close')?.addEventListener('click', window.closeLightbox);
    document.getElementById('lb-prev')?.addEventListener('click', window.lightboxPrev);
    document.getElementById('lb-next')?.addEventListener('click', window.lightboxNext);
    document.getElementById('lb-zoom-in')?.addEventListener('click', window.lightboxZoomIn);
    document.getElementById('lb-zoom-out')?.addEventListener('click', window.lightboxZoomOut);
    document.getElementById('lb-zoom-reset')?.addEventListener('click', window.lightboxZoomReset);

    // Fermeture en cliquant en dehors du conteneur média
    document.getElementById('lightbox')?.addEventListener('click', function(e) {
      if (e.target === this || e.target.id === 'lb-media-wrap') {
        window.closeLightbox();
      }
    });

    // Contrôles au clavier
    document.addEventListener('keydown', (e) => {
      const lb = document.getElementById('lightbox');
      if (!lb || !lb.classList.contains('active')) return;
      if (e.key === 'Escape') window.closeLightbox();
      if (e.key === 'ArrowLeft') window.lightboxPrev();
      if (e.key === 'ArrowRight') window.lightboxNext();
    });
  }

  /* ════════════════════════════════════════
     12. POPUP SPOTLIGHT & FORMULAIRE DE SOUMISSION D'OUTIL
  ════════════════════════════════════════ */
  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('tools')) {
      const ids = params.get('tools').split(',');
      openSpotlight(ids);
    }
  }

  function openSpotlight(ids) {
    const cardsHTML = ids.map(id => {
      const t = state.toolsMap[String(id)];
      if (!t) return '';
      const isFav = state.favorites.has(String(id));
      return `
        <div class="tool-card spotlight-card" onclick="window.trackToolVisit('${t.id}'); window.location.href='${t.page || t.url || '#'}';">
          <span class="tool-emoji">${t.emoji || '🤖'}</span>
          <h3>${t.name}</h3>
          <p>${t.short_desc || ''}</p>
          <button class="btn-fav ${isFav ? 'is-favorite' : ''}" onclick="window.toggleFavoriteFirebase('${t.id}', event)">${isFav ? '❤️' : '🤍'}</button>
        </div>`;
    }).join('');

    const panel = document.createElement('div');
    panel.id = 'notif-spotlight';
    panel.className = 'notif-spotlight';
    panel.innerHTML = `
      <div class="spotlight-header">
        <div class="spotlight-title">✨ À ne pas manquer !</div>
        <div class="spotlight-subtitle">Découvrez les outils IA vedettes sélectionnés cette semaine</div>
        <button class="spotlight-close" onclick="window.closeSpotlight()">✕</button>
      </div>
      <div class="spotlight-grid">${cardsHTML}</div>`;

    const toolsGrid = document.getElementById('tools-grid');
    if (toolsGrid) toolsGrid.insertAdjacentElement('beforebegin', panel);
    window.showPage('tools');
    setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  }

  window.closeSpotlight = function() {
    const panel = document.getElementById('notif-spotlight');
    if (!panel) return;
    panel.classList.add('spotlight-hiding');
    setTimeout(() => panel.remove(), 350);
    const url = new URL(window.location.href);
    url.searchParams.delete('tools');
    window.history.replaceState({}, '', url.toString());
  };

  window.submitToolForm = async function(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('submit-name')?.value.trim();
    const url = document.getElementById('submit-url')?.value.trim();
    const desc = document.getElementById('submit-desc')?.value.trim();
    const cat = document.getElementById('submit-cat')?.value;

    if (!name || !url) { showToast('Veuillez remplir les champs obligatoires.'); return; }

    try {
      await db.collection('submitted_tools').add({
        name, url, desc, category: cat,
        user_id: state.user ? state.user.uid : 'anonymous',
        submitted_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      showToast('Merci ! Outil soumis avec succès.');
      document.getElementById('suggest-tool-form')?.reset();
    } catch (err) { showToast('Erreur lors de la soumission.'); }
  };

  document.getElementById('suggest-tool-form')?.addEventListener('submit', window.submitToolForm);

  /* ════════════════════════════════════════
     13. LOGIQUE ET CONTRÔLEUR DE LA PAGE PROFIL
  ════════════════════════════════════════ */
  async function initProfile(user, profile) {
    const username = profile?.username || user.email?.split('@')[0] || '—';
    const initial  = username[0].toUpperCase();
    setEl('profile-avatar-display',   initial);
    setEl('profile-username-display', username);
    setEl('profile-email-display',    profile?.email || user.email || '—');
    setEl('dash-username',            username);
    setVal('settings-username',       username);
    setVal('settings-email',          profile?.email || user.email || '');

    const loadAndRenderFavs = async () => {
      const snap = await db.collection('favorites').where('user_id', '==', user.uid).get();
      const listData = snap.docs.map(d => d.data());
      setCount('fav-count', listData.length);
      setCount('dash-fav-count', listData.length);

      const grid = document.getElementById('fav-grid');
      if (!grid) return;
      if (!listData.length) { grid.innerHTML = `<p class="empty-state">${DICT[state.langue].emptyFav}</p>`; return; }

      grid.innerHTML = listData.map(f => {
        const t = state.toolsMap[String(f.tool_id)] || {};
        return `
          <div class="fav-card" onclick="window.location.href='${toolUrl(f.tool_id)}'">
            <div class="fav-card-head">
              <span class="fav-emoji">${t.emoji || '🤖'}</span>
              <div>
                <div class="fav-name">${toolName(f.tool_id)}</div>
                <div class="fav-cat">${toolCategory(f.tool_id)}</div>
              </div>
            </div>
            <button class="fav-remove" onclick="event.stopPropagation(); window.profileRemoveFav('${f.tool_id}')">✕</button>
          </div>`;
      }).join('');
    };

    window.profileRemoveFav = async function(toolId) {
      const snap = await db.collection('favorites').where('user_id', '==', user.uid).where('tool_id', '==', String(toolId)).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      state.favorites.delete(String(toolId));
      showToast(DICT[state.langue].removeFavToast);
      updateFavNavCount();
      loadAndRenderFavs();
    };

    const loadAndRenderCollections = async () => {
      const snap = await db.collection('collections').where('user_id', '==', user.uid).orderBy('created_at', 'desc').get();
      const listData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setCount('collections-count', listData.length);
      setCount('dash-col-count', listData.length);

      const list = document.getElementById('collections-list');
      if (!list) return;
      if (!listData.length) { list.innerHTML = '<p class="empty-state">Aucune collection. Créez-en une !</p>'; return; }

      list.innerHTML = listData.map(c => `
        <div class="collection-item">
          <div class="collection-name">${c.name}</div>
          <div class="collection-meta">${(c.tool_ids || []).length} outil(s)</div>
          <button class="btn-ghost-sm" onclick="window.profileDeleteCollection('${c.id}')">Supprimer</button>
        </div>`).join('');
    };

    window.profileDeleteCollection = async function(id) {
      await db.collection('collections').doc(id).delete();
      showToast('Collection supprimée');
      loadAndRenderCollections();
    };

    window.createCollection = async function() {
      const input = document.getElementById('new-collection-name');
      const name  = input?.value.trim();
      if (!name) return;
      await db.collection('collections').add({
        user_id: user.uid, name, tool_ids: [], created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (input) input.value = '';
      showToast('Collection créée !');
      loadAndRenderCollections();
    };

    const loadAndRenderHistory = async () => {
      const snap = await db.collection('history').where('user_id', '==', user.uid).orderBy('visited_at', 'desc').limit(50).get();
      const listData = snap.docs.map(d => d.data());
      setCount('history-count', listData.length);
      setCount('dash-hist-count', listData.length);

      const list = document.getElementById('history-list');
      if (!list) return;
      if (!listData.length) { list.innerHTML = '<p class="empty-state">Aucun historique.</p>'; return; }

      list.innerHTML = listData.map(h => `
        <div class="history-item" onclick="window.location.href='${toolUrl(h.tool_id)}'">
          <span class="history-name">${toolName(h.tool_id)}</span>
          <span class="history-date">${h.visited_at?.toDate ? h.visited_at.toDate().toLocaleDateString('fr-FR') : ''}</span>
        </div>`).join('');
    };

    window.clearHistory = async function() {
      const snap = await db.collection('history').where('user_id', '==', user.uid).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast('Historique effacé');
      loadAndRenderHistory();
    };

    const loadAndRenderNotifications = async () => {
      const snap = await db.collection('notifications').where('user_id', '==', user.uid).orderBy('created_at', 'desc').limit(20).get();
      const listData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const unread = listData.filter(n => !n.read).length;
      setCount('notif-count', unread || '');

      const list = document.getElementById('notif-list');
      if (!list) return;
      if (!listData.length) { list.innerHTML = '<p class="empty-state">Aucune notification.</p>'; return; }

      list.innerHTML = listData.map(n => `
        <div class="notif-item ${n.read ? '' : 'notif-unread'}" onclick="window.profileMarkNotifRead('${n.id}')">
          <div class="notif-msg">${n.message || ''}</div>
          <div class="notif-date">${n.created_at?.toDate ? n.created_at.toDate().toLocaleDateString('fr-FR') : ''}</div>
        </div>`).join('');
    };

    window.profileMarkNotifRead = async function(id) {
      await db.collection('notifications').doc(id).update({ read: true });
      loadAndRenderNotifications();
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
      const cols  = ['favorites', 'collections', 'history', 'notifications'];
      for (const col of cols) {
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

      if (tab === 'favorites')     loadAndRenderFavs();
      if (tab === 'collections')   loadAndRenderCollections();
      if (tab === 'history')       loadAndRenderHistory();
      if (tab === 'notifications') loadAndRenderNotifications();
    };

    document.querySelectorAll('.profile-tab').forEach(tab => {
      tab.addEventListener('click', () => window.switchTab(tab.dataset.tab));
    });

    await Promise.all([loadAndRenderFavs(), loadAndRenderCollections(), loadAndRenderHistory(), loadAndRenderNotifications()]);

    const hash = window.location.hash.replace('#', '');
    if (hash) window.switchTab(hash);
  }

  /* ════════════════════════════════════════
     14. LOGIQUE ET CONTRÔLEUR DE LA PAGE AUTH
  ════════════════════════════════════════ */
  function initAuth(user) {
    if (user) { window.location.href = 'profile.html'; return; }

    function showMessage(msg, type = 'error') {
      const el = document.getElementById('auth-message');
      if (!el) return;
      el.textContent = msg;
      el.className   = 'auth-message auth-message--' + type;
      el.style.display = 'block';
    }
    function hideMessage() { const el = document.getElementById('auth-message'); if (el) el.style.display = 'none'; }
    function setLoading(btn, loading) {
      btn.disabled = loading;
      btn.dataset.orig = btn.dataset.orig || btn.textContent;
      btn.textContent  = loading ? '...' : btn.dataset.orig;
    }
    function translateError(code) {
      const map = {
        'auth/invalid-credential':      'Email ou mot de passe incorrect.',
        'auth/user-not-found':          'Aucun compte avec cet email.',
        'auth/wrong-password':          'Mot de passe incorrect.',
        'auth/email-already-in-use':    'Un compte existe déjà avec cet email.',
        'auth/weak-password':           'Mot de passe trop court (min. 6 caractères).',
        'auth/invalid-email':           'Email invalide.',
        'auth/too-many-requests':       'Trop de tentatives. Attendez quelques minutes.',
        'auth/network-request-failed':  'Erreur réseau. Vérifiez votre connexion.',
        'auth/popup-closed-by-user':    'Connexion Google annulée.',
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
      try {
        await auth.signInWithEmailAndPassword(email, password);
        window.location.href = 'profile.html';
      } catch (err) { showMessage(translateError(err.code)); }
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
        const { user } = await auth.createUserWithEmailAndPassword(email, password);
        if (user) {
          await db.collection('profiles').doc(user.uid).set({
            username: username, email, createdAt: firebase.firestore.FieldValue.serverTimestamp()
          }, { merge: true });
        }
        showMessage('Compte créé ! Redirection…', 'success');
        setTimeout(() => window.location.href = 'profile.html', 1500);
      } catch (err) { showMessage(translateError(err.code)); }
      finally { setLoading(btn, false); }
    });

    const handleGoogleAuth = async () => {
      const provider = new firebase.auth.GoogleAuthProvider();
      try {
        await auth.signInWithPopup(provider);
        window.location.href = 'profile.html';
      } catch (err) { showMessage(translateError(err.code)); }
    };
    document.getElementById('btn-google-login')?.addEventListener('click', handleGoogleAuth);
    document.getElementById('btn-google-signup')?.addEventListener('click', handleGoogleAuth);

    document.getElementById('btn-reset')?.addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value.trim();
      const btn   = document.getElementById('btn-reset');
      if (!email) { showMessage('Entrez votre email.'); return; }
      setLoading(btn, true); hideMessage();
      try {
        await auth.sendPasswordResetEmail(email);
        showMessage('Email de réinitialisation envoyé !', 'success');
      } catch (err) { showMessage(translateError(err.code)); }
      finally { setLoading(btn, false); }
    });
  }

  /* ════════════════════════════════════════
     15. INITIALIZATION GENERALE DU CYCLE DE VIE (Lifecycle)
  ════════════════════════════════════════ */
  initLangButtons();
  if (IS_INDEX) {
    initSearchInputs();
    initNavLinks();
    initLightboxEvents();
  }

  // Écouteur d'authentification réactif centralisé
  auth.onAuthStateChanged(async (user) => {
    state.user = user;
    let profileData = null;

    if (user) {
      profileData = await ensureProfile(user);
      try {
        const favSnap = await db.collection('favorites').where('user_id', '==', user.uid).get();
        state.favorites = new Set(favSnap.docs.map(d => String(d.data().tool_id)));
      } catch(e) { console.warn("Erreur chargement favoris Firebase:", e); }
    } else {
      state.favorites.clear();
    }

    // Chargement de l'avatar Header commun
    initNav(user, profileData);
    updateFavNavCount();

    // Téléchargement des JSON et Rendu UI (Outils, Blog, Galerie)
    await loadDataAndRender();

    // Routage vers l'initialisation spécifique de la page Profil ou Auth
    if (IS_PROFILE) {
      const loadingEl = document.getElementById('profile-loading');
      if (loadingEl) loadingEl.style.display = 'none';
      
      if (!user) {
        const unauthEl = document.getElementById('profile-unauth');
        if (unauthEl) unauthEl.style.display = 'flex';
      } else {
        const mainEl = document.getElementById('profile-main');
        if (mainEl) mainEl.style.display = 'flex';
        await initProfile(user, profileData);
      }
    }

    if (IS_AUTH) initAuth(user);
  });

})();

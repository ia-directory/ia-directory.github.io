/* ═══════════════════════════════════════════════════════
   albexia.js — fichier unique
   Gère : index.html / profile.html / auth.html
   Firebase Auth + Firestore
   ═══════════════════════════════════════════════════════ */

'use strict';

/* ══════════════════════════════════════════
   UTILITAIRES
══════════════════════════════════════════ */

function $(id) { return document.getElementById(id); }
function setText(id, val) { const e = $(id); if (e) e.textContent = val; }
function setVal(id, val)  { const e = $(id); if (e) e.value = val; }

function showToast(msg) {
  /* index.html a un #toast fixe ; profile/auth utilisent un toast dynamique */
  const fixed = $('toast');
  if (fixed) {
    fixed.textContent = msg;
    fixed.classList.add('show');
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => fixed.classList.remove('show'), 2500);
    return;
  }
  const t = document.createElement('div');
  t.className = 'profile-toast';
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('visible'));
  setTimeout(() => { t.classList.remove('visible'); setTimeout(() => t.remove(), 300); }, 3000);
}
window.showToast = showToast;

/* ══════════════════════════════════════════
   FIREBASE — chargement + init
══════════════════════════════════════════ */

function loadScript(src) {
  return new Promise((ok, fail) => {
    if (document.querySelector(`script[src="${src}"]`)) { ok(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = fail;
    document.head.appendChild(s);
  });
}

const FB_CONFIG = {
  apiKey:            "AIzaSyA6B14vp5wz-0em9eboEAXRVhHy7WF_Lvk",
  authDomain:        "albexia-dc650.firebaseapp.com",
  projectId:         "albexia-dc650",
  storageBucket:     "albexia-dc650.firebasestorage.app",
  messagingSenderId: "805830291200",
  appId:             "1:805830291200:web:c24122224c1abaf4360de5"
};

/* ══════════════════════════════════════════
   DÉTECTION DE PAGE
══════════════════════════════════════════ */

function getPage() {
  if ($('profile-main') !== null)  return 'profile';
  if ($('btn-login')    !== null)  return 'auth';
  return 'index';
}

/* ══════════════════════════════════════════
   LANCEMENT PRINCIPAL (async)
══════════════════════════════════════════ */

(async () => {

  /* 1. Charger Firebase */
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js');
  await loadScript('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js');

  if (!firebase.apps.length) firebase.initializeApp(FB_CONFIG);
  const auth = firebase.auth();
  const db   = firebase.firestore();
  window._firebase = { auth, db };

  /* 2. Attendre le DOM */
  if (document.readyState === 'loading') {
    await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
  }

  const PAGE = getPage();

  /* 3. Résoudre l'utilisateur courant */
  const user = await new Promise(r => {
    const unsub = auth.onAuthStateChanged(u => { unsub(); r(u); });
  });

  window._user = user || null;

  /* 4. Nav avatar (toutes les pages) */
  renderNav(user, auth, db);

  /* 5. Router */
  if (PAGE === 'profile') await initProfile(user, auth, db);
  if (PAGE === 'auth')    initAuth(user, auth, db);
  if (PAGE === 'index')   await initIndex(user, db);

})();

/* ══════════════════════════════════════════
   NAV AVATAR
══════════════════════════════════════════ */

function renderNav(user, auth, db) {
  const slot = document.querySelector('.nav-profile-slot');
  if (!slot) return;

  if (!user) {
    slot.innerHTML = `<a href="auth.html" class="btn-nav-auth">Connexion</a>`;
    return;
  }

  const initial = (user.displayName || user.email || '?')[0].toUpperCase();
  slot.innerHTML = `
    <div class="nav-avatar-wrap">
      <button class="nav-avatar" id="nav-avatar-btn">${initial}</button>
      <div class="nav-avatar-menu" id="nav-avatar-menu">
        <div class="nav-avatar-name">${user.displayName || user.email}</div>
        <a href="profile.html"               class="nav-avatar-item">👤 Mon profil</a>
        <a href="profile.html#favorites"     class="nav-avatar-item">❤️ Favoris</a>
        <a href="profile.html#collections"   class="nav-avatar-item">📁 Collections</a>
        <a href="profile.html#history"       class="nav-avatar-item">🕒 Historique</a>
        <a href="profile.html#notifications" class="nav-avatar-item">🔔 Notifications</a>
        <div class="nav-avatar-divider"></div>
        <button class="nav-avatar-item" id="nav-logout-btn">🚪 Déconnexion</button>
      </div>
    </div>`;

  const btn  = $('nav-avatar-btn');
  const menu = $('nav-avatar-menu');
  btn.addEventListener('click', e => { e.stopPropagation(); menu.classList.toggle('open'); });
  document.addEventListener('click', () => menu.classList.remove('open'));
  menu.addEventListener('click', e => e.stopPropagation());
  $('nav-logout-btn').addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'index.html';
  });
}

/* ══════════════════════════════════════════
   PAGE PROFIL
══════════════════════════════════════════ */

async function initProfile(user, auth, db) {
  const loading = $('profile-loading');
  const unauth  = $('profile-unauth');
  const main    = $('profile-main');

  if (loading) loading.style.display = 'none';

  /* Non connecté */
  if (!user) {
    if (unauth) unauth.style.display = 'flex';
    return;
  }

  if (main) main.style.display = 'flex';

  /* Remplir les infos de base */
  const name    = user.displayName || user.email?.split('@')[0] || 'Utilisateur';
  const initial = name[0].toUpperCase();

  setText('profile-avatar-display',   initial);
  setText('profile-username-display', name);
  setText('profile-email-display',    user.email || '');
  setText('dash-username',            name);
  setVal('settings-username',         name);
  setVal('settings-email',            user.email || '');

  /* Déconnexion depuis sidebar */
  $('profile-logout-btn')?.addEventListener('click', async () => {
    await auth.signOut();
    window.location.href = 'index.html';
  });

  /* Charger tools.json pour afficher les noms dans favoris/historique */
  let toolsMap = {};
  try {
    const res  = await fetch('data/tools.json');
    const list = await res.json();
    list.forEach(t => { toolsMap[String(t.id)] = t; });
  } catch(e) { console.warn('tools.json non chargé', e); }

  const toolName = id => toolsMap[String(id)]?.name || String(id);
  const toolLink = id => toolsMap[String(id)]?.page || toolsMap[String(id)]?.url || '#';
  const toolEmoji= id => toolsMap[String(id)]?.emoji || '🤖';

  /* ── Loaders Firestore ── */

  async function getFavorites() {
    const snap = await db.collection('favorites')
      .where('user_id', '==', user.uid).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function getCollections() {
    const snap = await db.collection('collections')
      .where('user_id', '==', user.uid)
      .orderBy('created_at', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function getHistory() {
    const snap = await db.collection('history')
      .where('user_id', '==', user.uid)
      .orderBy('visited_at', 'desc').limit(50).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  async function getNotifications() {
    const snap = await db.collection('notifications')
      .where('user_id', '==', user.uid)
      .orderBy('created_at', 'desc').limit(30).get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  }

  /* ── Renderers ── */

  function renderFavorites(data) {
    const el = $('favorites-list');
    if (!el) return;
    setText('stat-favorites',       data.length);
    setText('dash-fav-count',       data.length);
    setText('nav-count-favorites',  data.length);
    if (!data.length) {
      el.innerHTML = '<p class="empty-state">Aucun favori pour l\'instant.<br>Cliquez sur ❤️ sur une fiche outil.</p>';
      return;
    }
    el.innerHTML = data.map(f => `
      <div class="tool-card" onclick="window.location.href='${toolLink(f.tool_id)}'">
        <div class="tool-head">
          <span style="font-size:24px">${toolEmoji(f.tool_id)}</span>
          <div style="flex:1; margin-left:10px">
            <div class="tool-name">${toolName(f.tool_id)}</div>
          </div>
          <button onclick="event.stopPropagation(); removeFavorite('${f.id}')" 
            style="background:none;border:none;cursor:pointer;color:#ff6b9d;font-size:18px">✕</button>
        </div>
      </div>`).join('');
  }

  function renderCollections(data) {
    const el = $('collections-list');
    if (!el) return;
    setText('stat-collections',      data.length);
    setText('dash-col-count',        data.length);
    setText('nav-count-collections', data.length);
    if (!data.length) {
      el.innerHTML = '<p class="empty-state">Aucune collection. Créez votre première !</p>';
      return;
    }
    el.innerHTML = data.map(c => `
      <div class="collection-item">
        <div class="collection-name">${c.name}</div>
        <div class="collection-meta">${(c.tool_ids || []).length} outil(s)</div>
        <button class="btn-ghost btn-sm" onclick="deleteCollection('${c.id}')">Supprimer</button>
      </div>`).join('');
  }

  function renderHistory(data) {
    const el = $('history-list');
    if (!el) return;
    setText('stat-history',    data.length);
    setText('dash-hist-count', data.length);
    if (!data.length) {
      el.innerHTML = '<p class="empty-state">Aucun historique pour l\'instant.</p>';
      return;
    }
    el.innerHTML = data.map(h => {
      const date = h.visited_at?.toDate ? h.visited_at.toDate().toLocaleDateString('fr-FR') : '';
      return `
        <div class="tool-card" onclick="window.location.href='${toolLink(h.tool_id)}'">
          <div class="tool-head">
            <span style="font-size:24px">${toolEmoji(h.tool_id)}</span>
            <div style="flex:1; margin-left:10px">
              <div class="tool-name">${toolName(h.tool_id)}</div>
              <div class="tool-cat">${date}</div>
            </div>
          </div>
        </div>`;
    }).join('');
  }

  function renderRecentHistory(data) {
    const el = $('dash-recent-list');
    if (!el) return;
    const recent = data.slice(0, 5);
    if (!recent.length) {
      el.innerHTML = '<p class="empty-state">Aucun outil consulté pour l\'instant.</p>';
      return;
    }
    el.innerHTML = recent.map(h => `
      <div class="dash-recent-item" onclick="window.location.href='${toolLink(h.tool_id)}'" style="cursor:pointer">
        <span>${toolEmoji(h.tool_id)}</span>
        <span>${toolName(h.tool_id)}</span>
      </div>`).join('');
  }

  function renderNotifications(data) {
    const el = $('notifications-list');
    if (!el) return;
    const unread = data.filter(n => !n.read).length;
    setText('dash-notif-count',   unread || 0);
    setText('nav-count-notifs',   unread || 0);
    if (!data.length) {
      el.innerHTML = '<p class="empty-state">Aucune notification pour l\'instant.</p>';
      return;
    }
    el.innerHTML = data.map(n => `
      <div class="notif-item ${n.read ? '' : 'notif-unread'}" onclick="markRead('${n.id}')">
        <div class="notif-msg">${n.message || ''}</div>
        <div class="notif-date">${n.created_at?.toDate ? n.created_at.toDate().toLocaleDateString('fr-FR') : ''}</div>
      </div>`).join('');
  }

  /* ── Actions ── */

  window.removeFavorite = async function(docId) {
    await db.collection('favorites').doc(docId).delete();
    showToast('Retiré des favoris');
    getFavorites().then(renderFavorites);
  };

  window.deleteCollection = async function(docId) {
    await db.collection('collections').doc(docId).delete();
    showToast('Collection supprimée');
    getCollections().then(renderCollections);
  };

  window.markRead = async function(docId) {
    await db.collection('notifications').doc(docId).update({ read: true });
    getNotifications().then(renderNotifications);
  };

  /* Création de collection */
  $('btn-new-collection')?.addEventListener('click', () => {
    const form = $('collection-form');
    if (form) form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  });
  $('btn-cancel-collection')?.addEventListener('click', () => {
    const form = $('collection-form');
    if (form) form.style.display = 'none';
  });
  $('btn-create-collection')?.addEventListener('click', async () => {
    const input = $('collection-name-input');
    const name  = input?.value.trim();
    if (!name) return;
    await db.collection('collections').add({
      user_id: user.uid, name, tool_ids: [],
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
    $('collection-form').style.display = 'none';
    showToast('Collection créée !');
    getCollections().then(renderCollections);
  });

  /* Vider l'historique */
  $('btn-clear-history')?.addEventListener('click', async () => {
    if (!confirm('Vider tout l\'historique ?')) return;
    const snap = await db.collection('history').where('user_id', '==', user.uid).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    showToast('Historique vidé');
    renderHistory([]);
  });

  /* Sauvegarder profil */
  $('btn-save-profile')?.addEventListener('click', async () => {
    const newName = $('settings-username')?.value.trim();
    if (!newName) return;
    await db.collection('profiles').doc(user.uid).set({ username: newName }, { merge: true });
    setText('profile-username-display', newName);
    setText('dash-username', newName);
    showToast('Profil mis à jour !');
  });

  /* Supprimer le compte */
  $('btn-delete-account')?.addEventListener('click', async () => {
    if (!confirm('Supprimer définitivement votre compte ? Irréversible.')) return;
    const batch = db.batch();
    for (const col of ['favorites', 'collections', 'history', 'notifications']) {
      const snap = await db.collection(col).where('user_id', '==', user.uid).get();
      snap.docs.forEach(d => batch.delete(d.ref));
    }
    await batch.commit();
    await db.collection('profiles').doc(user.uid).delete();
    await user.delete();
    window.location.href = 'index.html';
  });

  /* ── Navigation par onglets ── */

  window.switchTab = function(tabId) {
    document.querySelectorAll('.profile-nav-item').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
    const btn = document.querySelector(`.profile-nav-item[data-tab="${tabId}"]`);
    const tab = $(`tab-${tabId}`);
    if (btn) btn.classList.add('active');
    if (tab) tab.classList.add('active');

    if (tabId === 'favorites')     getFavorites().then(renderFavorites);
    if (tabId === 'collections')   getCollections().then(renderCollections);
    if (tabId === 'history')       getHistory().then(renderHistory);
    if (tabId === 'notifications') getNotifications().then(renderNotifications);
  };

  document.querySelectorAll('.profile-nav-item[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => window.switchTab(btn.dataset.tab));
  });

  /* Clics sur les dash-cards */
  document.querySelectorAll('.dash-card[onclick]').forEach(card => {
    const match = card.getAttribute('onclick')?.match(/switchTab\('(\w+)'\)/);
    if (match) {
      card.removeAttribute('onclick');
      card.addEventListener('click', () => window.switchTab(match[1]));
    }
  });

  /* ── Chargement initial du dashboard ── */
  try {
    const [favs, cols, hist, notifs] = await Promise.all([
      getFavorites(), getCollections(), getHistory(), getNotifications()
    ]);
    renderFavorites(favs);
    renderCollections(cols);
    renderHistory(hist);
    renderRecentHistory(hist);
    renderNotifications(notifs);
  } catch(err) {
    console.error('Erreur chargement profil:', err);
    showToast('Erreur lors du chargement des données');
  }

  /* Hash URL → aller directement au bon onglet */
  const hash = window.location.hash.replace('#', '');
  if (hash && ['favorites','collections','history','notifications','settings'].includes(hash)) {
    window.switchTab(hash);
  }
}

/* ══════════════════════════════════════════
   PAGE AUTH
══════════════════════════════════════════ */

function initAuth(user, auth, db) {
  if (user) { window.location.href = 'profile.html'; return; }

  function msg(text, type = 'error') {
    const el = $('auth-message');
    if (!el) return;
    el.textContent = text;
    el.className = `auth-message auth-message--${type}`;
    el.style.display = 'block';
  }
  function clearMsg() { const el = $('auth-message'); if (el) el.style.display = 'none'; }
  function setLoading(btn, on) {
    btn.disabled = on;
    btn.dataset.orig = btn.dataset.orig || btn.textContent;
    btn.textContent = on ? '...' : btn.dataset.orig;
  }
  function errMsg(code) {
    return ({
      'auth/invalid-credential':     'Email ou mot de passe incorrect.',
      'auth/user-not-found':         'Aucun compte avec cet email.',
      'auth/wrong-password':         'Mot de passe incorrect.',
      'auth/email-already-in-use':   'Un compte existe déjà avec cet email.',
      'auth/weak-password':          'Mot de passe trop court (min. 6 car.).',
      'auth/invalid-email':          'Email invalide.',
      'auth/too-many-requests':      'Trop de tentatives. Réessayez plus tard.',
      'auth/network-request-failed': 'Erreur réseau.',
      'auth/popup-closed-by-user':   'Connexion Google annulée.',
    })[code] || 'Une erreur est survenue.';
  }

  /* Onglets login / signup */
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.auth-form-wrap').forEach(f => f.classList.remove('active'));
      tab.classList.add('active');
      $('form-' + tab.dataset.tab)?.classList.add('active');
      clearMsg();
    });
  });

  /* Mot de passe oublié */
  $('forgot-link')?.addEventListener('click', e => {
    e.preventDefault();
    document.querySelectorAll('.auth-form-wrap').forEach(f => f.classList.remove('active'));
    $('form-reset')?.classList.add('active');
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  });
  $('btn-back-login')?.addEventListener('click', () => {
    document.querySelectorAll('.auth-form-wrap').forEach(f => f.classList.remove('active'));
    $('form-login')?.classList.add('active');
    $('tab-login')?.classList.add('active');
  });

  /* Toggle visibilité mot de passe */
  document.querySelectorAll('.toggle-pw').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = $(btn.dataset.target);
      inp.type = inp.type === 'password' ? 'text' : 'password';
      btn.textContent = inp.type === 'password' ? '👁' : '🙈';
    });
  });

  /* Force du mot de passe */
  $('signup-password')?.addEventListener('input', function() {
    const v = this.value;
    const el = $('pw-strength');
    if (!el) return;
    let s = 0;
    if (v.length >= 8) s++; if (/[A-Z]/.test(v)) s++;
    if (/[0-9]/.test(v)) s++; if (/[^A-Za-z0-9]/.test(v)) s++;
    const labels = ['','Faible','Moyen','Bon','Fort'];
    const colors = ['','#e05c5c','#f0a030','#6cc','#4caf50'];
    el.innerHTML = v
      ? `<div class="pw-bar"><div class="pw-fill" style="width:${s*25}%;background:${colors[s]}"></div></div><span style="color:${colors[s]}">${labels[s]}</span>`
      : '';
  });

  /* Connexion email */
  $('btn-login')?.addEventListener('click', async () => {
    const email = $('login-email')?.value.trim();
    const pw    = $('login-password')?.value;
    const btn   = $('btn-login');
    if (!email || !pw) { msg('Remplissez tous les champs.'); return; }
    setLoading(btn, true); clearMsg();
    try {
      await auth.signInWithEmailAndPassword(email, pw);
      window.location.href = 'profile.html';
    } catch(e) { msg(errMsg(e.code)); }
    finally { setLoading(btn, false); }
  });
  $('login-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-login')?.click(); });

  /* Inscription email */
  $('btn-signup')?.addEventListener('click', async () => {
    const username = $('signup-username')?.value.trim();
    const email    = $('signup-email')?.value.trim();
    const pw       = $('signup-password')?.value;
    const btn      = $('btn-signup');
    if (!username || !email || !pw) { msg('Remplissez tous les champs.'); return; }
    if (pw.length < 6) { msg('Mot de passe trop court (min. 6 car.).'); return; }
    setLoading(btn, true); clearMsg();
    try {
      const { user: u } = await auth.createUserWithEmailAndPassword(email, pw);
      await db.collection('profiles').doc(u.uid).set({
        username, email, createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      msg('Compte créé ! Redirection…', 'success');
      setTimeout(() => window.location.href = 'profile.html', 1500);
    } catch(e) { msg(errMsg(e.code)); }
    finally { setLoading(btn, false); }
  });
  $('signup-password')?.addEventListener('keydown', e => { if (e.key === 'Enter') $('btn-signup')?.click(); });

  /* Google */
  async function googleLogin() {
    try {
      await auth.signInWithPopup(new firebase.auth.GoogleAuthProvider());
      window.location.href = 'profile.html';
    } catch(e) { msg(errMsg(e.code)); }
  }
  $('btn-google-login')?.addEventListener('click',  googleLogin);
  $('btn-google-signup')?.addEventListener('click', googleLogin);

  /* Reset mot de passe */
  $('btn-reset')?.addEventListener('click', async () => {
    const email = $('reset-email')?.value.trim();
    const btn   = $('btn-reset');
    if (!email) { msg('Entrez votre email.'); return; }
    setLoading(btn, true); clearMsg();
    try {
      await auth.sendPasswordResetEmail(email);
      msg('Email envoyé ! Vérifiez votre boîte.', 'success');
    } catch(e) { msg(errMsg(e.code)); }
    finally { setLoading(btn, false); }
  });
}

/* ══════════════════════════════════════════
   PAGE INDEX
══════════════════════════════════════════ */

async function initIndex(user, db) {

  /* ── State ── */
  const state = {
    tools: [], blog: [], gallery: [],
    langue: detectLang(),
    activeToolCat: 'Tous', activeBlogCat: 'Tous', activeGalleryCat: 'Tous',
    searchQuery: '',
    favorites: new Set(),
    toolsPage: 1, blogPage: 1, galleryPage: 1,
    perPage: 20,
    filteredGallery: [],
  };
  window.state = state;

  function detectLang() {
    const saved = localStorage.getItem('albexia_langue');
    if (['fr','en','es'].includes(saved)) return saved;
    const nav = (navigator.language || 'fr').slice(0,2).toLowerCase();
    return ['fr','en','es'].includes(nav) ? nav : 'fr';
  }

  /* ── Charger les données ── */
  async function loadJSON(path) {
    const r = await fetch(path);
    if (!r.ok) throw new Error(path);
    return r.json();
  }

  try {
    const [tools, blog, gallery] = await Promise.all([
      loadJSON('data/tools.json').catch(() => []),
      loadJSON('data/blog.json').catch(() => []),
      loadJSON('data/gallery.json').catch(() => []),
    ]);
    state.tools   = tools;
    state.blog    = blog;
    state.gallery = gallery;
  } catch(e) { console.error(e); }

  /* ── Favoris Firebase ── */
  if (user) {
    try {
      const snap = await db.collection('favorites').where('user_id', '==', user.uid).get();
      state.favorites = new Set(snap.docs.map(d => String(d.data().tool_id)));
    } catch(e) { console.warn('Favoris:', e); }
  }

  /* ── Couleurs ── */
  const catColors = {
    Texte:        'rgba(108,99,255,0.18)',
    Image:        'rgba(255,107,157,0.18)',
    Musique:      'rgba(0,212,170,0.18)',
    Code:         'rgba(108,99,255,0.18)',
    Vidéo:        'rgba(255,107,157,0.18)',
    Recherche:    'rgba(0,212,170,0.18)',
    Audio:        'rgba(108,99,255,0.18)',
    Productivité: 'rgba(245,166,35,0.18)',
    Autre:        'rgba(255,255,255,0.08)',
  };
  const blogColors = {
    Guide:      { tagBg: 'rgba(108,99,255,0.15)',  tagColor: '#a8a3ff' },
    Sélection:  { tagBg: 'rgba(255,107,157,0.15)', tagColor: '#ff6b9d' },
    Débutant:   { tagBg: 'rgba(0,212,170,0.15)',   tagColor: '#00d4aa' },
    Comparatif: { tagBg: 'rgba(245,166,35,0.15)',  tagColor: '#f5a623' },
    Tutoriel:   { tagBg: 'rgba(108,99,255,0.15)',  tagColor: '#a8a3ff' },
    Analyse:    { tagBg: 'rgba(0,212,170,0.15)',   tagColor: '#00d4aa' },
  };
  window.blogColorsMap = blogColors;

  /* ── Helpers rendu ── */
  function byLang(items) { return items.filter(i => !i.langue || i.langue === state.langue); }

  function stars(r) {
    let h = '';
    for (let i = 1; i <= 5; i++) h += `<span class="${i <= r ? 'on' : ''}">★</span>`;
    return h;
  }

  function normalise(s) {
    return (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim();
  }
  function lev(a, b) {
    if (!a) return b.length; if (!b) return a.length;
    const m=a.length, n=b.length, dp=Array.from({length:m+1},(_,i)=>[i]);
    for (let j=1;j<=n;j++) dp[0][j]=j;
    for (let i=1;i<=m;i++) for (let j=1;j<=n;j++)
      dp[i][j]=a[i-1]===b[j-1]?dp[i-1][j-1]:1+Math.min(dp[i-1][j],dp[i][j-1],dp[i-1][j-1]);
    return dp[m][n];
  }
  function match(query, target) {
    const q=normalise(query), t=normalise(target);
    if (!q) return true; if (t.includes(q)) return true;
    const mots=q.split(' ').filter(Boolean), mt=t.split(' ').filter(Boolean);
    return mots.every(w => mt.some(x=>x.includes(w)||w.includes(x)) ||
      mt.some(x=>lev(w,x)<=(w.length<=3?0:w.length<=5?1:2)));
  }

  function pagination(cur, total, items, s, e, sec, label) {
    if (total <= 1) return '';
    let pg = '';
    for (let i=1;i<=total;i++) {
      if (i===1||i===total||(i>=cur-1&&i<=cur+1))
        pg += `<button class="pg-btn${i===cur?' active':''}" onclick="goPage('${sec}',${i})">${i}</button>`;
      else if (i===cur-2||i===cur+2) pg += `<span class="pg-dots">…</span>`;
    }
    return `<div class="pagination">
      <span class="pg-info">${s}–${e} sur ${items} ${label}</span>
      <div class="pg-controls">
        <button class="pg-btn pg-arrow" onclick="goPage('${sec}',${cur-1})" ${cur===1?'disabled':''}>‹</button>
        ${pg}
        <button class="pg-btn pg-arrow" onclick="goPage('${sec}',${cur+1})" ${cur===total?'disabled':''}>›</button>
      </div></div>`;
  }

  function setPag(id, html) {
    let el = $(`${id}-pagination`);
    if (!el) { el=document.createElement('div'); el.id=`${id}-pagination`; $(id)?.insertAdjacentElement('afterend',el); }
    el.innerHTML = html;
  }

  window.goPage = function(sec, pg) {
    if (sec==='tools')   { state.toolsPage=pg;   renderTools();   $('tools')?.scrollIntoView({behavior:'smooth',block:'start'}); }
    if (sec==='blog')    { state.blogPage=pg;     renderBlog();    $('blog')?.scrollIntoView({behavior:'smooth',block:'start'}); }
    if (sec==='gallery') { state.galleryPage=pg;  renderGallery(); $('gallery')?.scrollIntoView({behavior:'smooth',block:'start'}); }
  };

  /* ── Carte outil ── */
  function buildCard(t) {
    const isFav = state.favorites.has(String(t.id));
    const bg    = catColors[t.category] || 'rgba(255,255,255,0.08)';
    const icon  = t.favicon
      ? `<img src="${t.favicon}" alt="${t.name}" class="tool-favicon"
             onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
             onload="this.nextElementSibling.style.display='none'">
         <span class="tool-ico-fallback" style="display:none">${t.emoji}</span>`
      : `<span class="tool-ico-fallback">${t.emoji}</span>`;
    const action = t.page
      ? `onclick="cardClick('${t.id}','${t.page}',null,event)"`
      : `onclick="cardClick('${t.id}',null,'${t.url}',event)"`;
    let cls = 'tool-card';
    if (t.plan==='featured') cls += ' tool-card-featured tool-card-plan-featured';
    else if (t.plan==='starter') cls += ' tool-card-featured tool-card-plan-starter';
    else if (t.page) cls += ' tool-card-plan-gratuit';
    return `
      <article class="${cls}" ${action}>
        <div class="tool-head">
          <div class="tool-ico" style="background:${bg}">${icon}</div>
          <div style="flex:1">
            <div class="tool-name">${t.name}</div>
            <div class="tool-cat">${t.category}</div>
          </div>
          <button class="fav-btn ${isFav?'active':''}"
            onclick="toggleFav('${t.id}',event)"
            title="${isFav?'Retirer':'Ajouter aux favoris'}">♥</button>
        </div>
        <p class="tool-desc">${t.description}</p>
        <div class="tool-foot">
          <span class="price-tag price-${t.price}">${{free:'Gratuit',freemium:'Freemium',paid:'Payant'}[t.price]||''}</span>
          <span class="stars">${stars(t.rating)}</span>
          <button class="col-btn" onclick="openColMenu('${t.id}','${t.name}',event)" title="Collections">📁</button>
        </div>
        ${t.page ? '<span class="tool-plan-badge tool-plan-badge-gratuit">Guide complet →</span>' : ''}
      </article>`;
  }

  /* ── Rendu outils ── */
  function renderTools() {
    const items = byLang(state.tools);
    const cats  = ['Tous', ...new Set(items.map(t => t.category))];
    const filEl = $('tool-filters');
    if (filEl) filEl.innerHTML = cats.map(c =>
      `<button class="filter${c===state.activeToolCat?' active':''}" onclick="setToolCat('${c}')">${c}</button>`).join('');

    const filtered = items.filter(t =>
      (state.activeToolCat==='Tous' || t.category===state.activeToolCat) &&
      (match(state.searchQuery,t.name) || match(state.searchQuery,t.description) ||
       (t.tags||[]).some(tag=>match(state.searchQuery,tag))));

    const grid = $('tools-grid');
    if (!filtered.length) { if(grid) grid.innerHTML='<div class="empty"><div class="empty-icon">🔍</div>Aucun résultat.</div>'; setPag('tools-grid',''); return; }
    const total=Math.ceil(filtered.length/state.perPage);
    if(state.toolsPage>total) state.toolsPage=1;
    const s=(state.toolsPage-1)*state.perPage, paged=filtered.slice(s,s+state.perPage);
    if(grid) grid.innerHTML=paged.map(buildCard).join('');
    setPag('tools-grid', pagination(state.toolsPage,total,filtered.length,s+1,s+paged.length,'tools','outils'));
    updateFavUI();
  }
  window.renderTools = renderTools;

  window.setToolCat = function(c) { state.activeToolCat=c; state.toolsPage=1; renderTools(); };

  /* ── Rendu blog ── */
  function renderBlog() {
    const items = byLang(state.blog);
    const cats  = ['Tous', ...new Set(items.map(p=>p.category))];
    const filEl = $('blog-filters');
    if (filEl) filEl.innerHTML = cats.map(c =>
      `<button class="filter${c===state.activeBlogCat?' active':''}" onclick="setBlogCat('${c}')">${c}</button>`).join('');

    const filtered = items.filter(p => state.activeBlogCat==='Tous' || p.category===state.activeBlogCat);
    const list = $('blog-list');
    if (!filtered.length) { if(list) list.innerHTML='<div class="empty">Aucun article.</div>'; setPag('blog-list',''); return; }
    const total=Math.ceil(filtered.length/state.perPage);
    if(state.blogPage>total) state.blogPage=1;
    const s=(state.blogPage-1)*state.perPage, paged=filtered.slice(s,s+state.perPage);
    if (list) list.innerHTML = paged.map(p => {
      const c = blogColors[p.category] || { tagBg:'rgba(255,255,255,0.08)', tagColor:'#aaa' };
      const thumb = p.image
        ? `<img src="${p.image}" alt="${p.title}" loading="lazy" onerror="this.style.display='none'">`
        : `<span>${p.emoji||'📝'}</span>`;
      return `
        <a href="${p.url||'#'}" class="blog-card-link" style="text-decoration:none;display:block">
          <article class="blog-card">
            <div class="blog-thumb">${thumb}</div>
            <div class="blog-body">
              <div class="blog-title">${p.title}</div>
              <div class="blog-meta">${p.date} · ${p.author}</div>
              <p class="blog-excerpt">${p.excerpt}</p>
              <span class="blog-tag" style="background:${c.tagBg};color:${c.tagColor}">${p.category}</span>
            </div>
            <div class="blog-mins">⏱ ${p.readTime} de lecture</div>
          </article>
        </a>`;
    }).join('');
    setPag('blog-list', pagination(state.blogPage,total,filtered.length,s+1,s+paged.length,'blog','articles'));
  }
  window.setBlogCat = function(c) { state.activeBlogCat=c; state.blogPage=1; renderBlog(); };

  /* ── Rendu galerie ── */
  function renderGallery() {
    const types  = ['Tous','image','vidéo','musique'];
    const labels = { Tous:'Tous', image:'Image', vidéo:'Vidéo', musique:'Musique' };
    const icons  = { image:'🖼', vidéo:'▶', musique:'♪' };
    const filEl  = $('gallery-filters');
    if (filEl) filEl.innerHTML = types.map(t =>
      `<button class="filter${t===state.activeGalleryCat?' active':''}" onclick="setGalleryCat('${t}')">${labels[t]}</button>`).join('');

    const filtered = state.gallery.filter(g => state.activeGalleryCat==='Tous' || g.type===state.activeGalleryCat);
    state.filteredGallery = filtered;
    const grid = $('gallery-grid');
    if (!filtered.length) { if(grid) grid.innerHTML='<div class="empty">Aucune œuvre.</div>'; setPag('gallery-grid',''); return; }
    const total=Math.ceil(filtered.length/state.perPage);
    if(state.galleryPage>total) state.galleryPage=1;
    const s=(state.galleryPage-1)*state.perPage, paged=filtered.slice(s,s+state.perPage);
    if (grid) grid.innerHTML = paged.map((g,i) => {
      const isMusic = g.type==='musique';
      return `
        <article class="gallery-card" onclick="openGalleryItem(${s+i})" style="cursor:pointer">
          <div class="gallery-thumb" style="${isMusic?'background:linear-gradient(135deg,#6c63ff,#ff6b9d)':'background:#111'};position:relative;overflow:hidden">
            ${isMusic ? '<span style="font-size:48px">🎵</span>' : `<img src="${g.thumb}" alt="${g.title}" style="width:100%;height:100%;object-fit:cover" loading="lazy">`}
            <span class="gallery-type type-${g.type}">${labels[g.type]}</span>
            <div class="gallery-play-icon">${icons[g.type]}</div>
          </div>
          <div class="gallery-info">
            <div class="gallery-title">${g.title}</div>
            <div class="gallery-tool">${g.tool}</div>
            <div class="gallery-likes"><span>♥</span> ${g.likes} likes</div>
          </div>
        </article>`;
    }).join('');
    setPag('gallery-grid', pagination(state.galleryPage,total,filtered.length,s+1,s+paged.length,'gallery','œuvres'));
  }
  window.setGalleryCat = function(c) { state.activeGalleryCat=c; state.galleryPage=1; renderGallery(); };
  window.openGalleryItem = function(i) { window.GalleryLightbox?.openLightbox(state.filteredGallery, i); };

  /* ── Premier rendu ── */
  renderTools();
  renderBlog();
  renderGallery();
  updateFavUI();

  /* ── Favoris toggle ── */
  window.toggleFav = async function(toolId, event) {
    event.stopPropagation();
    if (!window._user) {
      showToast('Connectez-vous pour sauvegarder des favoris');
      setTimeout(() => window.location.href = 'auth.html', 1500);
      return;
    }
    const id   = String(toolId);
    const snap = await db.collection('favorites')
      .where('user_id','==',window._user.uid).where('tool_id','==',id).get();
    if (!snap.empty) {
      const b = db.batch(); snap.docs.forEach(d=>b.delete(d.ref)); await b.commit();
      state.favorites.delete(id); showToast('Retiré des favoris');
    } else {
      await db.collection('favorites').add({ user_id:window._user.uid, tool_id:id, added_at:firebase.firestore.FieldValue.serverTimestamp() });
      state.favorites.add(id); showToast('♥ Ajouté aux favoris !');
    }
    updateFavUI();
    renderTools();
  };

  function updateFavUI() {
    const badge = $('nav-fav-count');
    if (badge) badge.textContent = state.favorites.size > 0 ? state.favorites.size : '';
  }
  window.updateFavCount = updateFavUI;

  /* ── Historique visite ── */
  window.cardClick = async function(toolId, page, url, event) {
    if (event.target.closest('.fav-btn') || event.target.closest('.col-btn')) return;
    if (window._user) {
      db.collection('history').add({
        user_id: window._user.uid, tool_id: String(toolId),
        visited_at: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(()=>{});
    }
    if (page) window.location.href = page;
    else if (url) window.open(url, '_blank');
  };

  /* ── Menu collections ── */
  window.openColMenu = async function(toolId, toolName, event) {
    event.stopPropagation();
    if (!window._user) { showToast('Connectez-vous pour créer des collections'); setTimeout(()=>window.location.href='auth.html',1500); return; }
    const old = $('col-menu-popup'); if (old) { old.remove(); return; }
    let cols = [];
    try {
      const snap = await db.collection('collections').where('user_id','==',window._user.uid).orderBy('created_at','desc').get();
      cols = snap.docs.map(d=>({id:d.id,...d.data()}));
    } catch{}
    const menu = document.createElement('div');
    menu.id = 'col-menu-popup'; menu.className = 'col-menu-popup';
    menu.innerHTML = `
      <div class="col-menu-header">Ajouter "${toolName}"</div>
      <div class="col-menu-list">${cols.length
        ? cols.map(c=>`<button class="col-menu-item" data-cid="${c.id}" data-tid="${toolId}">📁 ${c.name}</button>`).join('')
        : '<div class="col-menu-empty">Aucune collection</div>'}</div>
      <div class="col-menu-divider"></div>
      <div class="col-menu-new">
        <input type="text" id="col-menu-input" placeholder="Nouvelle collection…" maxlength="40"/>
        <button id="col-menu-create">+</button>
      </div>`;
    const rect = event.currentTarget.getBoundingClientRect();
    menu.style.top  = (rect.bottom+window.scrollY+6)+'px';
    menu.style.left = Math.min(rect.left, window.innerWidth-220)+'px';
    document.body.appendChild(menu);
    menu.querySelectorAll('.col-menu-item').forEach(btn => {
      btn.addEventListener('click', async () => {
        try { await db.collection('collections').doc(btn.dataset.cid).update({ tool_ids: firebase.firestore.FieldValue.arrayUnion(btn.dataset.tid) }); showToast('✓ Ajouté'); }
        catch { showToast('Déjà dans cette collection'); }
        menu.remove();
      });
    });
    $('col-menu-create').addEventListener('click', async () => {
      const name = $('col-menu-input').value.trim(); if (!name) return;
      await db.collection('collections').add({ user_id:window._user.uid, name, tool_ids:[String(toolId)], created_at:firebase.firestore.FieldValue.serverTimestamp() });
      showToast(`✓ Collection "${name}" créée`); menu.remove();
    });
    $('col-menu-input').addEventListener('keydown', e => { if(e.key==='Enter') $('col-menu-create').click(); });
    setTimeout(() => document.addEventListener('click', ()=>menu.remove(), {once:true}), 50);
  };

  /* ── Navigation ── */
  function showPage(id) {
    if (!id) return;
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(b=>b.classList.remove('active'));
    $(id)?.classList.add('active');
    document.querySelector(`.nav-link[data-page="${id}"]`)?.classList.add('active');
    window.scrollTo({top:0,behavior:'smooth'});
    if (id==='favorites') { window.location.href='profile.html#favorites'; return; }
  }
  window.showPage = showPage;

  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  /* ── Recherche ── */
  $('tool-search')?.addEventListener('input', e => {
    state.searchQuery = e.target.value;
    state.toolsPage = 1;
    const url = new URL(window.location);
    e.target.value ? url.searchParams.set('search',e.target.value) : url.searchParams.delete('search');
    window.history.replaceState({}, '', url.toString());
    renderTools();
  });

  const qParam = new URLSearchParams(window.location.search).get('search');
  if (qParam) { state.searchQuery=qParam; const s=$('tool-search'); if(s) s.value=qParam; showPage('tools'); }

  /* ── Langue ── */
  window.changerLangue = function(code) {
    if (!['fr','en','es'].includes(code)) return;
    localStorage.setItem('albexia_langue', code);
    state.langue=code; state.activeToolCat='Tous'; state.activeBlogCat='Tous';
    state.toolsPage=1; state.blogPage=1;
    document.querySelectorAll('.lang-btn').forEach(b=>b.classList.toggle('active',b.dataset.lang===code));
    renderTools(); renderBlog(); renderGallery();
  };

  /* ── Modal soumission ── */
  window.openModal = function() {
    ['f-name','f-url','f-cat','f-price','f-desc','f-emoji','f-email'].forEach(id=>{const e=$(id);if(e)e.value='';});
    const err=$('form-error'); if(err){err.style.display='none';err.textContent='';}
    const cnt=$('f-desc-count'); if(cnt) cnt.textContent='0 / 200';
    $('modal-overlay')?.classList.add('open');
    setTimeout(()=>$('f-name')?.focus(),100);
  };
  window.closeModal = function() { $('modal-overlay')?.classList.remove('open'); };

  $('open-submit-btn')?.addEventListener('click', window.openModal);
  $('modal-close')?.addEventListener('click', window.closeModal);
  $('modal-cancel')?.addEventListener('click', window.closeModal);
  $('modal-overlay')?.addEventListener('click', e=>{ if(e.target===e.currentTarget) window.closeModal(); });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') window.closeModal(); });

  $('f-desc')?.addEventListener('input', function() {
    const c=$('f-desc-count'); if(c) c.textContent=`${this.value.length} / 200`;
  });

  $('modal-submit')?.addEventListener('click', () => {
    const name=$('f-name')?.value.trim(), url=$('f-url')?.value.trim(),
          cat=$('f-cat')?.value, price=$('f-price')?.value,
          desc=$('f-desc')?.value.trim();
    const errEl = $('form-error');
    let err = null;
    if (!name)  err = "Le nom est requis.";
    else if (!url || !url.startsWith('http')) err = "URL invalide (http…).";
    else if (!cat)   err = "Choisissez une catégorie.";
    else if (!price) err = "Indiquez la tarification.";
    else if (!desc || desc.length < 20) err = "Description trop courte (min. 20 car.).";
    if (err) { if(errEl){errEl.textContent=err;errEl.style.display='block';} return; }
    if(errEl) errEl.style.display='none';
    const fd = new FormData();
    fd.append('nom_outil', name); fd.append('url', url); fd.append('categorie', cat);
    fd.append('tarification', price); fd.append('description', desc);
    fd.append('emoji', $('f-emoji')?.value.trim()||'🤖');
    fd.append('email', $('f-email')?.value.trim()||'');
    const btn = document.querySelector('.modal-footer .btn-main');
    if(btn){btn.disabled=true;btn.textContent='Envoi…';}
    fetch('https://formspree.io/f/xaqkgqlr',{method:'POST',body:fd,headers:{'Accept':'application/json'}})
      .then(()=>{
        document.querySelector('.modal-body').innerHTML=`<div class="form-success"><div class="success-icon">✅</div><h4>Soumission envoyée !</h4><p>Merci ! <strong>${name}</strong> sera examiné sous 48h.</p></div>`;
        document.querySelector('.modal-footer').innerHTML=`<button class="btn-main" onclick="closeModal()">Fermer</button>`;
      }).catch(()=>{ if(errEl){errEl.textContent='Erreur réseau.';errEl.style.display='block';} if(btn){btn.disabled=false;btn.textContent='Soumettre';} });
  });

  /* ── Newsletter ── */
  $('newsletter-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const email=$('footer-email')?.value.trim(), fb=$('nl-feedback');
    const btn=e.target.querySelector('button[type=submit]');
    if (!email) return;
    if(btn){btn.textContent='...';btn.disabled=true;}
    try {
      const r=await fetch(e.target.action,{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/json'},body:JSON.stringify({email})});
      if(r.ok){if(fb){fb.textContent='✓ Inscription confirmée !';fb.style.color='#00d4aa';}e.target.reset();}
      else{if(fb){fb.textContent='⚠ Erreur.';fb.style.color='#f5a623';}}
    }catch{if(fb){fb.textContent='⚠ Erreur réseau.';fb.style.color='#f5a623';}}
    if(btn){btn.textContent="S'abonner";btn.disabled=false;}
  });

  /* ── Spotlight ── */
  function checkSpotlight() {
    const raw = new URLSearchParams(window.location.search).get('tools');
    if (!raw) return;
    const found = raw.split(',').map(id=>state.tools.find(t=>String(t.id)===id.trim())).filter(Boolean);
    if (!found.length) return;
    const old=$('notif-spotlight'); if(old) old.remove();
    const panel=document.createElement('div'); panel.id='notif-spotlight';
    panel.innerHTML=`
      <div class="spotlight-header">
        <div class="spotlight-label"><span class="spotlight-dot"></span>Outils sélectionnés cette semaine</div>
        <button class="spotlight-close" onclick="closeSpotlight()">✕</button>
      </div>
      <div class="spotlight-grid">${found.map(buildCard).join('')}</div>`;
    $('tools-grid')?.insertAdjacentElement('beforebegin', panel);
    showPage('tools');
    setTimeout(()=>panel.scrollIntoView({behavior:'smooth',block:'start'}),100);
  }
  window.closeSpotlight = function() {
    const p=$('notif-spotlight'); if(!p) return;
    p.classList.add('spotlight-hiding'); setTimeout(()=>p.remove(),350);
    const u=new URL(window.location.href); u.searchParams.delete('tools'); window.history.replaceState({}, '', u.toString());
  };
  checkSpotlight();

  /* ── Quiz ── */
  const QUIZ_Q = [
    { id:'metier', q:'Tu es plutôt…', opts:[
      {l:'✍️ Rédacteur / Copywriter',v:'redacteur'},{l:'🎨 Designer / Créatif',v:'designer'},
      {l:'💻 Développeur',v:'developpeur'},{l:'🚀 Entrepreneur / Freelance',v:'entrepreneur'},
      {l:'🎓 Étudiant',v:'etudiant'},{l:'👤 Autre',v:'autre'}]},
    { id:'objectif', q:"Ton objectif principal avec l'IA…", opts:[
      {l:'⚡ Gagner du temps',v:'temps'},{l:'✏️ Créer du contenu',v:'contenu'},
      {l:'📚 Apprendre',v:'apprendre'},{l:'💰 Générer des revenus',v:'revenus'},
      {l:"📋 M'organiser",v:'organiser'}]},
    { id:'budget', q:'Ton budget mensuel…', opts:[
      {l:'🆓 Gratuit uniquement',v:'free'},{l:'💳 Moins de 20$/mois',v:'freemium'},
      {l:'💎 Plus de 20$/mois',v:'paid'}]},
    { id:'connexion', q:'Ta connexion internet…', opts:[
      {l:'🚀 Rapide et stable',v:'rapide'},{l:'📶 Correcte',v:'moyenne'},{l:'🐢 Lente',v:'lente'}]},
    { id:'niveau', q:'Ton niveau avec les outils IA…', opts:[
      {l:'🌱 Débutant complet',v:'debutant'},{l:'🌿 Quelques expériences',v:'intermediaire'},
      {l:'🌳 Utilisateur régulier',v:'avance'}]},
  ];
  const METIER_CATS={redacteur:['Texte','Productivité'],designer:['Image','Design','Vidéo'],developpeur:['Code','Productivité'],entrepreneur:['Texte','Productivité','Recherche'],etudiant:['Texte','Recherche','Productivité'],autre:['Texte','Productivité','Image']};
  const qz={step:0,ans:{}};

  window.openQuiz = function() {
    qz.step=0; qz.ans={};
    $('quiz-results').style.display='none'; $('quiz-body').style.display='block';
    $('quiz-overlay')?.classList.add('open'); document.body.style.overflow='hidden';
    renderQStep();
  };
  window.closeQuiz = function() { $('quiz-overlay')?.classList.remove('open'); document.body.style.overflow=''; };
  window.restartQuiz = function() { qz.step=0; qz.ans={}; $('quiz-results').style.display='none'; $('quiz-body').style.display='block'; const cc=$('quiz-copy-confirm'); if(cc)cc.style.display='none'; renderQStep(); };

  function renderQStep() {
    const q=QUIZ_Q[qz.step], tot=QUIZ_Q.length;
    $('quiz-progress-bar').style.width=`${(qz.step/tot)*100}%`;
    $('quiz-step-label').textContent=`Question ${qz.step+1} sur ${tot}`;
    $('quiz-question').textContent=q.q;
    $('quiz-options').innerHTML=q.opts.map(o=>`<button class="quiz-option" onclick="pickQ('${q.id}','${o.v}')">${o.l}</button>`).join('');
  }
  window.pickQ = function(qid, val) {
    qz.ans[qid]=val;
    document.querySelectorAll('.quiz-option').forEach(b=>{ if(b.textContent.trim()===QUIZ_Q[qz.step].opts.find(o=>o.v===val)?.l.trim()) b.classList.add('selected'); });
    setTimeout(()=>{ qz.step++; qz.step<QUIZ_Q.length?renderQStep():showQResults(); },280);
  };
  function showQResults() {
    const a=qz.ans, cats=METIER_CATS[a.metier]||['Texte'];
    const scored=byLang(state.tools).map(t=>{
      let s=0;
      if(cats[0]===t.category) s+=3; else if(cats.includes(t.category)) s+=1;
      if(a.budget==='free'&&t.price==='free') s+=3; if(a.budget==='freemium'&&t.price!=='paid') s+=2; if(a.budget==='paid') s+=1;
      if(a.connexion==='lente'&&['Vidéo','Image','Musique'].includes(t.category)) s-=3;
      if(a.niveau==='debutant'&&!t.page) s+=1; if(a.niveau==='avance'&&t.page) s+=1;
      s+=(t.rating||3)*0.3; return {t,s};
    }).sort((a,b)=>b.s-a.s);
    const sel=[]; const uc=new Set();
    for(const {t} of scored){ if(sel.length>=3) break; if(!uc.has(t.category)){sel.push(t);uc.add(t.category);} }
    for(const {t} of scored){ if(sel.length>=3) break; if(!sel.find(x=>x.id===t.id)) sel.push(t); }
    const lbl=QUIZ_Q[0].opts.find(o=>o.v===a.metier)?.l||'';
    setText('quiz-results-sub',`Profil : ${lbl} · Budget ${a.budget} · Connexion ${a.connexion}`);
    $('quiz-results-grid').innerHTML=sel.map(t=>{
      const act=t.page?`onclick="closeQuiz();window.location.href='${t.page}'"`:`onclick="closeQuiz();window.open('${t.url}','_blank')"`;
      const ico=t.favicon?`<img src="${t.favicon}" alt="${t.name}" style="width:32px;height:32px;border-radius:6px" onerror="this.style.display='none'">`:`<span style="font-size:28px">${t.emoji}</span>`;
      return `<div class="quiz-result-card" ${act}><div class="quiz-result-head"><div class="quiz-result-ico">${ico}</div><div style="flex:1"><div class="quiz-result-name">${t.name}</div><div class="quiz-result-cat">${t.category}</div></div><span class="price-tag price-${t.price}">${{free:'Gratuit',freemium:'Freemium',paid:'Payant'}[t.price]}</span></div><p class="quiz-result-desc">${t.description}</p><div class="quiz-result-cta">Voir la fiche →</div></div>`;
    }).join('');
    $('quiz-body').style.display='none'; $('quiz-results').style.display='block';
    $('quiz-progress-bar').style.width='100%';
  }
  window.copyQuizLink = function() {
    const a=qz.ans, p=[a.metier,a.objectif,a.budget,a.connexion,a.niveau].join('-');
    const url=`${location.origin}${location.pathname}?quiz=${p}`;
    navigator.clipboard.writeText(url).then(()=>{ const el=$('quiz-copy-confirm'); if(el){el.style.display='block';setTimeout(()=>el.style.display='none',2500);} });
  };
  window.shareWhatsApp = function() {
    const g=$('quiz-results-grid');
    const noms=[...g.querySelectorAll('.quiz-result-name')].map(e=>'• '+e.textContent).join('\n');
    const a=qz.ans, p=[a.metier,a.objectif,a.budget,a.connexion,a.niveau].join('-');
    window.open(`https://wa.me/?text=${encodeURIComponent(`Mes 3 outils IA recommandés par Albexia :\n${noms}\n\nTeste-le → ${location.origin}${location.pathname}?quiz=${p}`)}`, '_blank');
  };

  /* ── Hash navigation (depuis pages externes) ── */
  const h = window.location.hash.replace('#','');
  if (['tools','blog','gallery'].includes(h)) showPage(h);

  /* ── Init plugins ── */
  window.BlogReader?.createBlogReader();
  window.GalleryLightbox?.initLightbox();
}

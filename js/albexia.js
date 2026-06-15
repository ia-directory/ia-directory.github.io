/* ═══════════════════════════════════════════════════════
   Albexia — albexia.js  (Firebase Edition)
   Remplace Supabase par Firebase Auth + Firestore
   Usage :
     index.html   → <script src="js/albexia.js"></script>
     profile.html → <script src="js/albexia.js"></script>
     auth.html    → <script src="js/albexia.js"></script>
   ═══════════════════════════════════════════════════════ */

(async function () {
  'use strict';

  /* ════════════════════════════════════════
     1. CHARGER FIREBASE (CDN)
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
     2. INITIALISER FIREBASE
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

  /* Exposer globalement pour compatibilité avec app.js */
  window._firebase = { auth, db };

  /* ════════════════════════════════════════
     3. AUTH — fonctions principales
  ════════════════════════════════════════ */
  const IS_PROFILE = document.getElementById('profile-main') !== null;
  const IS_AUTH    = document.getElementById('btn-login')    !== null;
  const IS_INDEX   = !IS_PROFILE && !IS_AUTH;

  async function signOut() {
    await auth.signOut();
    window.location.href = 'index.html';
  }

  async function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
      window.location.href = 'profile.html';
    } catch (e) {
      console.error('Google OAuth:', e.message);
      throw e;
    }
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

  /* Exposer pour auth.html */
  window._auth = { signIn, signUp, signInWithGoogle, resetPassword };

  /* ════════════════════════════════════════
     4. PROFIL FIRESTORE
  ════════════════════════════════════════ */
  async function ensureProfile(user) {
    const ref = db.collection('profiles').doc(user.uid);
    const snap = await ref.get();
    if (snap.exists) return snap.data();
    const username = user.displayName || user.email?.split('@')[0] || 'utilisateur';
    const profile  = { username, email: user.email,
                       createdAt: firebase.firestore.FieldValue.serverTimestamp() };
    await ref.set(profile, { merge: true });
    return profile;
  }

  /* ════════════════════════════════════════
     5. NAV AVATAR (toutes les pages)
  ════════════════════════════════════════ */
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

  /* ════════════════════════════════════════
     6. TOOLS MAP (tools.json)
  ════════════════════════════════════════ */
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

  /* ════════════════════════════════════════
     7. HELPERS UI
  ════════════════════════════════════════ */
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
     8. PAGE PROFIL
  ════════════════════════════════════════ */
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

    /* ── Favoris ── */
    async function loadFavorites() {
      const snap = await db.collection('favorites')
        .where('user_id', '==', user.uid).get();
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
        const t = toolsMap[String(f.tool_id)] || {};
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
        .where('user_id', '==', user.uid)
        .where('tool_id', '==', String(toolId)).get();
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      showToast('Retiré des favoris');
      loadFavorites().then(renderFavorites);
    };

    /* ── Collections ── */
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
        user_id: user.uid,
        name,
        tool_ids: [],
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (input) input.value = '';
      showToast('Collection créée !');
      loadCollections().then(renderCollections);
    };

    /* ── Historique ── */
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

    /* ── Notifications ── */
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

    /* ── Paramètres ── */
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

    /* ── Onglets ── */
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
    const [favData, colData, histData, notifData] = await Promise.all([
      loadFavorites(), loadCollections(), loadHistory(), loadNotifications()
    ]);
    setCount('dash-fav-count',   favData.length);
    setCount('dash-col-count',   colData.length);
    setCount('dash-hist-count',  histData.length);
    const unread = notifData.filter(n => !n.read).length;
    setCount('notif-count', unread || '');

    const hash = window.location.hash.replace('#', '');
    if (hash) window.switchTab(hash);
  }

  /* ════════════════════════════════════════
     9. PAGE AUTH
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

    /* Onglets */
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

    /* Mot de passe oublié */
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

    /* Toggle mot de passe */
    document.querySelectorAll('.toggle-pw').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById(btn.dataset.target);
        input.type  = input.type === 'password' ? 'text' : 'password';
        btn.textContent = input.type === 'password' ? '👁' : '🙈';
      });
    });

    /* Force mot de passe */
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

    /* Connexion */
    document.getElementById('btn-login')?.addEventListener('click', async () => {
      const email    = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      const btn      = document.getElementById('btn-login');
      if (!email || !password) { showMessage('Veuillez remplir tous les champs.'); return; }
      setLoading(btn, true); hideMessage();
      try {
        await signIn(email, password);
        window.location.href = 'profile.html';
      } catch (err) { showMessage(translateError(err.code)); }
      finally { setLoading(btn, false); }
    });

    /* Inscription */
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

    /* Google */
    document.getElementById('btn-google-login')?.addEventListener('click', async () => {
      try { await signInWithGoogle(); }
      catch (err) { showMessage(translateError(err.code)); }
    });
    document.getElementById('btn-google-signup')?.addEventListener('click', async () => {
      try { await signInWithGoogle(); }
      catch (err) { showMessage(translateError(err.code)); }
    });

    /* Reset mot de passe */
    document.getElementById('btn-reset')?.addEventListener('click', async () => {
      const email = document.getElementById('reset-email').value.trim();
      const btn   = document.getElementById('btn-reset');
      if (!email) { showMessage('Entrez votre email.'); return; }
      setLoading(btn, true); hideMessage();
      try {
        await resetPassword(email);
        showMessage('Email envoyé ! Vérifiez votre boîte.', 'success');
      } catch (err) { showMessage(translateError(err.code)); }
      finally { setLoading(btn, false); }
    });

    /* Entrée clavier */
    document.getElementById('login-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-login').click();
    });
    document.getElementById('signup-password')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('btn-signup').click();
    });
  }

  /* ════════════════════════════════════════
     10. PAGE INDEX — Favoris depuis Firestore
  ════════════════════════════════════════ */
  function initIndexFavorites(user) {
    window._fbUser = user || null;

    if (!user) return;
    db.collection('favorites').where('user_id', '==', user.uid).get()
      .then(snap => {
        const ids = snap.docs.map(d => String(d.data().tool_id));
        if (window.state) {
          window.state.favorites = new Set(ids);
          if (typeof window.renderTools    === 'function') window.renderTools();
          if (typeof window.updateFavCount === 'function') window.updateFavCount();
        }
      });
  }

  /* ════════════════════════════════════════
     11. FAVORIS — toggleFavorite pour app.js
  ════════════════════════════════════════ */
  window.toggleFavoriteFirebase = async function(toolId, event) {
    event.stopPropagation();
    const id   = String(toolId);
    const user = auth.currentUser;

    if (!user) {
      if (typeof window.showToast === 'function') window.showToast('Connectez-vous pour sauvegarder des favoris');
      setTimeout(() => window.location.href = 'auth.html', 1500);
      return;
    }

    const snap = await db.collection('favorites')
      .where('user_id', '==', user.uid)
      .where('tool_id', '==', id).get();

    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      if (window.state) window.state.favorites.delete(id);
      if (typeof window.showToast === 'function') window.showToast('Retiré des favoris');
    } else {
      await db.collection('favorites').add({
        user_id: user.uid,
        tool_id: id,
        added_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      if (window.state) window.state.favorites.add(id);
      if (typeof window.showToast === 'function') window.showToast('♥ Ajouté aux favoris !');
    }

    if (typeof window.updateFavCount === 'function') window.updateFavCount();
    if (typeof window.renderTools    === 'function') window.renderTools();
  };

  /* ════════════════════════════════════════
     12. HISTORIQUE — enregistrer une visite
  ════════════════════════════════════════ */
  window.trackToolVisit = async function(toolId) {
    const user = auth.currentUser;
    if (!user) return;
    await db.collection('history').add({
      user_id:    user.uid,
      tool_id:    String(toolId),
      visited_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  };

  /* ════════════════════════════════════════
     13. INIT PRINCIPAL
  ════════════════════════════════════════ */
  const user = await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(u => { unsub(); resolve(u); });
  });

  let profile = null;
  if (user) profile = await ensureProfile(user);

  /* Nav avatar sur toutes les pages */
  await initNav(user, profile);

  if (IS_PROFILE) {
    document.getElementById('profile-loading')?.style &&
      (document.getElementById('profile-loading').style.display = 'none');

    if (!user) {
      const unauth = document.getElementById('profile-unauth');
      if (unauth) unauth.style.display = 'flex';
    } else {
      const main = document.getElementById('profile-main');
      if (main) main.style.display = 'flex';
      await initProfile(user, profile);
    }
  }

  if (IS_AUTH)  initAuth(user);
  if (IS_INDEX) initIndexFavorites(user);

  /* Compatibilité avec app.js (remplace window._sbUser) */
  window._sbUser = user;
  window._fbUser = user;

  /* Émettre un événement pour app.js */
  window.dispatchEvent(new CustomEvent('albexia:ready', { detail: { user, db } }));

})();

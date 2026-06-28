/* ═══════════════════════════════════════
   tutoriels.js — Albexia
   Annuaire vidéo des outils IA
   ═══════════════════════════════════════ */

'use strict';

/* ─── ÉTAT GLOBAL ─── */
const TUTO = {
  data: null,
  carteOuverte: null,
  modalOuverte: false,
  playerActif: null
};

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', async () => {
  await chargerDonnees();
  renderHero();
  renderCartes();
  renderEditorial();
  renderFAQ();
  bindNav();
  bindSoumissionGlobal();
  lireHashURL();
});

/* ─── CHARGEMENT JSON ─── */
async function chargerDonnees() {
  try {
    const res = await fetch('data/tutoriels.json');
    if (!res.ok) throw new Error('Erreur réseau');
    TUTO.data = await res.json();
  } catch (e) {
    console.error('[Albexia Tutoriels] Impossible de charger tutoriels.json :', e);
    document.getElementById('tuto-root')?.insertAdjacentHTML('afterbegin',
      `<div class="tuto-error">⚠️ Impossible de charger les données. Veuillez rafraîchir la page.</div>`
    );
  }
}

/* ─── HERO ─── */
function renderHero() {
  const el = document.getElementById('tuto-hero-stats');
  if (!el || !TUTO.data) return;
  const total = TUTO.data.outils.reduce((s, o) => s + o.videos.length, 0);
  el.innerHTML = `
    <div class="tuto-stat"><span class="tuto-stat-n">${TUTO.data.outils.length}</span><span class="tuto-stat-l">Outils référencés</span></div>
    <div class="tuto-stat"><span class="tuto-stat-n">${total}</span><span class="tuto-stat-l">Tutoriels sélectionnés</span></div>
    <div class="tuto-stat"><span class="tuto-stat-n">100%</span><span class="tuto-stat-l">Accès gratuit</span></div>
  `;
}

/* ─── GRILLE DE CARTES (vue principale) ─── */
function renderCartes() {
  const container = document.getElementById('tuto-grille');
  if (!container || !TUTO.data) return;

  container.innerHTML = TUTO.data.outils.map(outil => carteHTML(outil)).join('');

  /* Bind accordéon */
  container.querySelectorAll('.tuto-card-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleCarte(btn.dataset.id));
  });

  /* Charger les vraies notes Firestore pour chaque outil */
  TUTO.data.outils.forEach(outil => {
    const noteEl = document.getElementById(`note-${outil.id}`);
    const avisEl = document.getElementById(`avis-${outil.id}`);
    if (typeof window._chargerNoteOutil === 'function') {
      window._chargerNoteOutil(outil.id, noteEl, avisEl);
    }
  });
}

/* ─── CARTE HTML ─── */
function carteHTML(outil) {
  const videosPrev = outil.videos.slice(0, 5);
  return `
  <article class="tuto-card" id="carte-${outil.id}" data-id="${outil.id}">
    <div class="tuto-card-header">
      <div class="tuto-card-identity">
        <div class="tuto-card-logo" style="background:${hexToRgba(outil.couleur, 0.12)};color:${outil.couleur}">${outil.logo}</div>
        <div>
          <h3 class="tuto-card-nom">${outil.nom}</h3>
          <span class="tuto-card-cat">${outil.categorie}</span>
        </div>
      </div>
      <div class="tuto-card-meta">
        <!-- Note et avis : peuplés par Firestore, masqués si aucun avis réel -->
        <div class="tuto-card-note" id="note-${outil.id}"></div>
        <span class="tuto-card-avis" id="avis-${outil.id}"></span>
        <span class="tuto-card-badge-count">${outil.videos.length} vidéos</span>
      </div>
    </div>

    <p class="tuto-card-desc-courte">${outil.descriptionCourte}</p>

    <div class="tuto-card-tags">
      ${outil.tags.map(t => `<span class="tuto-tag">${t}</span>`).join('')}
    </div>

    <div class="tuto-card-actions">
      <button class="tuto-card-btn tuto-btn-voir" data-id="${outil.id}">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
        Voir les tutoriels
      </button>
      <button class="tuto-btn-soumettre" onclick="ouvrirModalSoumission('${outil.id}','${outil.nom}')">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Soumettre
      </button>
    </div>

    <div class="tuto-card-expand" id="expand-${outil.id}">
      <div class="tuto-expand-inner">
        <p class="tuto-desc-longue">${outil.descriptionLongue}</p>

        <div class="tuto-section-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          Tutoriels vidéo pour comprendre et utiliser ${outil.nom}
        </div>

        <div class="tuto-video-grid">
          ${videosPrev.map(v => miniatureHTML(v, outil)).join('')}
        </div>

        <a href="tutoriel-outil.html?outil=${outil.id}" class="tuto-voir-tout">
          Voir tous les tutoriels pour ${outil.nom}
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </a>
      </div>
    </div>
  </article>`;
}

/* ─── MINIATURE VIDÉO ─── */
function miniatureHTML(video, outil) {
  const videoDataAttr = escHTML(JSON.stringify({
    videoId:   video.id,
    outilId:   outil.id,
    titre:     video.titre,
    canal:     video.canal,
    duree:     video.duree,
    youtubeId: video.youtubeId,
  }));

  return `
  <div class="tuto-thumb" title="${escHTML(video.titre)}">
    <div class="tuto-thumb-img"
         onclick="ouvrirPlayer('${video.youtubeId}','${escHTML(video.titre).replace(/'/g,"&#39;")}')">
      <img src="https://img.youtube.com/vi/${video.youtubeId}/mqdefault.jpg"
           alt="${escHTML(video.titre)}"
           loading="lazy"
           onerror="this.src='assets/placeholder-video.svg'">
      <div class="thumb-play">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
      <span class="thumb-badge badge-video">▶ Vidéo</span>
      <span class="thumb-duree">${video.duree}</span>
    </div>
    <div class="tuto-thumb-footer">
      <div onclick="ouvrirPlayer('${video.youtubeId}','${escHTML(video.titre).replace(/'/g,"&#39;")}')">
        <p class="thumb-titre">${escHTML(video.titre)}</p>
        <p class="thumb-canal">${escHTML(video.canal)}</p>
      </div>
      <button
        class="btn-save-video"
        data-video-id="${escHTML(video.id)}"
        title="Sauvegarder cette vidéo"
        aria-label="Sauvegarder cette vidéo"
        onclick="event.stopPropagation(); window._toggleSaveVideo(this, JSON.parse(this.dataset.videoData));"
        data-video-data="${videoDataAttr}">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </button>
    </div>
  </div>`;
}

/* ─── TOGGLE ACCORDÉON ─── */
function toggleCarte(id) {
  const expand = document.getElementById(`expand-${id}`);
  const btn = document.querySelector(`.tuto-card-btn[data-id="${id}"]`);
  const card = document.getElementById(`carte-${id}`);
  if (!expand) return;

  const estOuverte = expand.classList.contains('open');

  /* Fermer l'ancienne */
  if (TUTO.carteOuverte && TUTO.carteOuverte !== id) {
    const ancien = document.getElementById(`expand-${TUTO.carteOuverte}`);
    const ancienBtn = document.querySelector(`.tuto-card-btn[data-id="${TUTO.carteOuverte}"]`);
    const ancienCard = document.getElementById(`carte-${TUTO.carteOuverte}`);
    if (ancien) { ancien.style.maxHeight = '0'; ancien.classList.remove('open'); }
    if (ancienBtn) ancienBtn.classList.remove('actif');
    if (ancienCard) ancienCard.classList.remove('actif');
  }

  if (!estOuverte) {
    expand.classList.add('open');
    expand.style.maxHeight = expand.scrollHeight + 80 + 'px';
    btn?.classList.add('actif');
    card?.classList.add('actif');
    TUTO.carteOuverte = id;
    /* Scroll doux */
    setTimeout(() => card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 200);
  } else {
    expand.style.maxHeight = '0';
    expand.classList.remove('open');
    btn?.classList.remove('actif');
    card?.classList.remove('actif');
    TUTO.carteOuverte = null;
  }
}

/* ─── PLAYER MODAL ─── */
function ouvrirPlayer(youtubeId, titre) {
  const modal = document.getElementById('tuto-player-modal');
  const iframe = document.getElementById('tuto-player-iframe');
  const titreEl = document.getElementById('tuto-player-titre');
  if (!modal || !iframe) return;

  iframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`;
  if (titreEl) titreEl.textContent = titre;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  TUTO.modalOuverte = true;
}

function fermerPlayer() {
  const modal = document.getElementById('tuto-player-modal');
  const iframe = document.getElementById('tuto-player-iframe');
  if (!modal) return;
  modal.classList.remove('open');
  if (iframe) iframe.src = '';
  document.body.style.overflow = '';
  TUTO.modalOuverte = false;
}

/* Fermer au clic backdrop */
document.addEventListener('click', e => {
  if (e.target.id === 'tuto-player-modal') fermerPlayer();
});

/* Fermer à Escape */
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    if (TUTO.modalOuverte) fermerPlayer();
    if (document.getElementById('tuto-modal-soumission')?.classList.contains('open')) {
      fermerModalSoumission();
    }
  }
});

/* ─── MODAL SOUMISSION ─── */
function ouvrirModalSoumission(outilId, outilNom) {
  const modal = document.getElementById('tuto-modal-soumission');
  const nomEl = document.getElementById('soumission-outil-nom');
  const idEl = document.getElementById('soumission-outil-id');
  if (!modal) return;
  if (nomEl) nomEl.textContent = outilNom || 'cet outil';
  if (idEl) idEl.value = outilId || '';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fermerModalSoumission() {
  const modal = document.getElementById('tuto-modal-soumission');
  if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
}

function bindSoumissionGlobal() {
  /* Bouton soumission dans le hero */
  document.getElementById('btn-soumettre-hero')?.addEventListener('click', () => {
    ouvrirModalSoumission('', '');
  });

  /* Fermer modal */
  document.getElementById('soumission-fermer')?.addEventListener('click', fermerModalSoumission);
  document.getElementById('tuto-modal-soumission')?.addEventListener('click', e => {
    if (e.target.id === 'tuto-modal-soumission') fermerModalSoumission();
  });

  /* Formulaire */
  document.getElementById('form-soumission')?.addEventListener('submit', e => {
    e.preventDefault();
    const btn  = document.getElementById('soumission-submit');
    const form = document.getElementById('form-soumission');
    if (btn) { btn.textContent = 'Envoi…'; btn.disabled = true; }

    fetch('https://formspree.io/f/xvzyjkaa', {
      method:  'POST',
      body:    new FormData(form),
      headers: { 'Accept': 'application/json' }
    }).then(() => {
      if (btn) { btn.textContent = 'Envoyé ✓'; btn.classList.add('success'); }
      setTimeout(() => {
        fermerModalSoumission();
        if (btn) { btn.textContent = 'Soumettre la vidéo →'; btn.disabled = false; btn.classList.remove('success'); }
        form.reset();
      }, 2000);
    }).catch(() => {
      if (btn) { btn.textContent = 'Erreur — Réessayez'; btn.disabled = false; }
    });
  });
}

/* ─── ÉDITORIAL ─── */
function renderEditorial() {
  /* Le texte est statique dans le HTML, rien à injecter */
}

/* ─── FAQ ─── */
function renderFAQ() {
  const container = document.getElementById('tuto-faq-list');
  if (!container || !TUTO.data) return;

  container.innerHTML = TUTO.data.faq.map((item, i) => `
    <div class="faq-item" id="faq-${i}">
      <button class="faq-question" onclick="toggleFAQ(${i})" aria-expanded="false">
        <span>${escHTML(item.question)}</span>
        <svg class="faq-icone" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
      <div class="faq-reponse" id="faq-rep-${i}">
        <p>${escHTML(item.reponse)}</p>
      </div>
    </div>
  `).join('');
}

function toggleFAQ(i) {
  const rep = document.getElementById(`faq-rep-${i}`);
  const btn = document.querySelector(`#faq-${i} .faq-question`);
  const item = document.getElementById(`faq-${i}`);
  if (!rep) return;

  const ouvert = rep.classList.contains('open');
  rep.classList.toggle('open', !ouvert);
  rep.style.maxHeight = ouvert ? '0' : rep.scrollHeight + 'px';
  btn?.setAttribute('aria-expanded', String(!ouvert));
  item?.classList.toggle('active', !ouvert);
}

/* ─── NAV ─── */
function bindNav() {
  /* Les liens de navigation sont gérés par le nav global du site */
}

/* ─── HASH URL (deep link vers un outil) ─── */
function lireHashURL() {
  const hash = window.location.hash.replace('#', '');
  if (hash && TUTO.data) {
    const outil = TUTO.data.outils.find(o => o.id === hash);
    if (outil) setTimeout(() => toggleCarte(hash), 400);
  }
}

/* ─── UTILITAIRES ─── */
function genEtoiles(note) {
  const plein = Math.floor(note);
  const demi = note % 1 >= 0.5 ? 1 : 0;
  const vide = 5 - plein - demi;
  return '★'.repeat(plein) + (demi ? '½' : '') + '☆'.repeat(vide);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/* ─── EXPORTS GLOBAUX ─── */
window.toggleCarte           = toggleCarte;
window.ouvrirPlayer          = ouvrirPlayer;
window.fermerPlayer          = fermerPlayer;
window.ouvrirModalSoumission = ouvrirModalSoumission;
window.fermerModalSoumission = fermerModalSoumission;
window.toggleFAQ             = toggleFAQ;

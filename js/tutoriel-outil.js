/* ═══════════════════════════════════════
   tutoriel-outil.js — Albexia
   Page profonde : vidéothèque d'un outil IA
   ═══════════════════════════════════════ */

'use strict';

/* ─── ÉTAT ─── */
const OUTIL = {
  data: null,        // tutoriels.json complet
  outil: null,       // objet outil courant
  filtreType: 'tout',          // 'tout' | 'video'
  filtreDureeMin: 0,
  filtreDureeMax: 999999,
  dropdownOuvert: false,
  modalOuverte: false
};

/* ─── INIT ─── */
document.addEventListener('DOMContentLoaded', async () => {
  const id = lireParamURL('outil');
  if (!id) { afficherErreur('Aucun outil spécifié.'); return; }

  await chargerDonnees();
  if (!OUTIL.data) return;

  OUTIL.outil = OUTIL.data.outils.find(o => o.id === id);
  if (!OUTIL.outil) { afficherErreur(`Outil "${id}" introuvable.`); return; }

  renderIdentite();
  renderFiltres();
  renderGrille();
  bindSoumission();
  bindEscape();
  peuplerSelectSoumission();

  /* Charger la note réelle depuis Firestore (via le script module dans le HTML).
     On utilise l'id de l'outil comme toolSlug, cohérent avec reviews.js */
  if (typeof window._chargerNoteReelle === 'function') {
    window._chargerNoteReelle(OUTIL.outil.id);
  }
});

/* ─── CHARGEMENT JSON ─── */
async function chargerDonnees() {
  try {
    const res = await fetch('data/tutoriels.json');
    if (!res.ok) throw new Error('Erreur réseau');
    OUTIL.data = await res.json();
  } catch (e) {
    console.error('[Albexia] Impossible de charger tutoriels.json :', e);
    afficherErreur('Impossible de charger les données. Veuillez rafraîchir.');
  }
}

/* ─── IDENTITÉ DE L'OUTIL ─── */
function renderIdentite() {
  const o = OUTIL.outil;

  /* Titre de la page */
  document.title = `Maîtrisez ${o.nom} : La vidéothèque complète | Albexia`;

  /* Meta description */
  const metaDesc = document.querySelector('meta[name="description"]');
  if (metaDesc) metaDesc.setAttribute('content',
    `Tous les tutoriels vidéo pour apprendre et maîtriser ${o.nom}. ${o.videos.length} vidéos sélectionnées, filtrables par durée. Gratuit, en français.`
  );

  /* H1 */
  const h1 = document.getElementById('outil-h1');
  if (h1) h1.textContent = `Maîtrisez ${o.nom} : La vidéothèque complète`;

  /* Logo + couleur */
  const logoEl = document.getElementById('outil-logo');
  if (logoEl) {
    logoEl.textContent = o.logo;
    logoEl.style.background = hexToRgba(o.couleur, 0.15);
    logoEl.style.color = o.couleur;
    logoEl.style.boxShadow = `0 0 40px ${hexToRgba(o.couleur, 0.2)}`;
  }

  /* Accent couleur CSS */
  document.documentElement.style.setProperty('--outil-color', o.couleur);
  document.documentElement.style.setProperty('--outil-color-soft', hexToRgba(o.couleur, 0.12));

  /* Sous-titre */
  const sub = document.getElementById('outil-sous-titre');
  if (sub) sub.textContent = o.descriptionCourte;

  /* Catégorie */
  const cat = document.getElementById('outil-cat');
  if (cat) cat.textContent = o.categorie;

  /* Zone note : laissée vide ici, peuplée par _chargerNoteReelle()
     qui lit Firestore. Si aucun avis réel → reste vide. */
  const note = document.getElementById('outil-note');
  if (note) note.innerHTML = '';

  /* Compteur vidéos */
  const count = document.getElementById('outil-count');
  if (count) count.textContent = `${o.videos.length} tutoriels`;

  /* Tags */
  const tags = document.getElementById('outil-tags');
  if (tags) tags.innerHTML = o.tags.map(t => `<span class="tuto-tag">${escHTML(t)}</span>`).join('');

  /* Lien retour */
  const retour = document.getElementById('lien-retour');
  if (retour) retour.href = `tutoriels.html#${o.id}`;

  /* Breadcrumb */
  const bcOutil = document.getElementById('bc-outil');
  if (bcOutil) bcOutil.textContent = o.nom;

  /* Bouton soumettre header */
  const btnHeader = document.getElementById('btn-soumettre-header');
  if (btnHeader) btnHeader.addEventListener('click', () => ouvrirModalSoumission(o.id, o.nom));
}

/* ─── FILTRES ─── */
function renderFiltres() {
  /* Boutons Tout / Vidéos */
  document.getElementById('filtre-tout')?.addEventListener('click', () => setFiltreType('tout'));
  document.getElementById('filtre-video')?.addEventListener('click', () => setFiltreType('video'));

  /* Dropdown durée */
  const btnDuree = document.getElementById('btn-duree-dropdown');
  const dropdown = document.getElementById('duree-dropdown');

  btnDuree?.addEventListener('click', e => {
    e.stopPropagation();
    OUTIL.dropdownOuvert = !OUTIL.dropdownOuvert;
    dropdown?.classList.toggle('open', OUTIL.dropdownOuvert);
    btnDuree.classList.toggle('actif', OUTIL.dropdownOuvert);
  });

  /* Fermer dropdown au clic ailleurs */
  document.addEventListener('click', () => {
    if (OUTIL.dropdownOuvert) {
      OUTIL.dropdownOuvert = false;
      dropdown?.classList.remove('open');
      btnDuree?.classList.remove('actif');
    }
  });

  /* Peupler le dropdown depuis le JSON */
  if (dropdown && OUTIL.data?.filtresDuree) {
    dropdown.innerHTML = OUTIL.data.filtresDuree.map((f, i) => `
      <button class="duree-option${i === 0 ? ' actif' : ''}"
              data-min="${f.min}" data-max="${f.max}"
              onclick="setFiltreDuree(${f.min},${f.max},this,'${escHTML(f.label)}')">
        ${escHTML(f.label)}
      </button>
    `).join('');
  }
}

function setFiltreType(type) {
  OUTIL.filtreType = type;

  /* UI : activer le bon bouton */
  ['tout','video'].forEach(t => {
    document.getElementById(`filtre-${t}`)?.classList.toggle('actif', t === type);
  });

  /* Montrer/cacher le bouton durée (seulement pour "video") */
  const wrapDuree = document.getElementById('wrap-duree');
  if (wrapDuree) wrapDuree.style.display = type === 'video' ? 'flex' : 'none';

  /* Si on quitte "video", reset durée */
  if (type !== 'video') {
    OUTIL.filtreDureeMin = 0;
    OUTIL.filtreDureeMax = 999999;
    const labelEl = document.getElementById('btn-duree-label');
    if (labelEl) labelEl.textContent = 'Durée';
    document.querySelectorAll('.duree-option').forEach((el, i) => el.classList.toggle('actif', i === 0));
  }

  renderGrille();
}

function setFiltreDuree(min, max, el, label) {
  OUTIL.filtreDureeMin = min;
  OUTIL.filtreDureeMax = max;

  /* UI */
  document.querySelectorAll('.duree-option').forEach(o => o.classList.remove('actif'));
  el.classList.add('actif');
  const labelEl = document.getElementById('btn-duree-label');
  if (labelEl) labelEl.textContent = label === 'Tout' ? 'Durée' : label;

  /* Fermer dropdown */
  OUTIL.dropdownOuvert = false;
  document.getElementById('duree-dropdown')?.classList.remove('open');
  document.getElementById('btn-duree-dropdown')?.classList.remove('actif');

  renderGrille();
}

/* ─── GRILLE VIDÉOS FILTRÉE ─── */
function renderGrille() {
  const container = document.getElementById('outil-video-grille');
  const compteur  = document.getElementById('outil-video-count');
  if (!container || !OUTIL.outil) return;

  const videos = filtrerVideos();

  if (compteur) compteur.textContent = `${videos.length} résultat${videos.length > 1 ? 's' : ''}`;

  if (videos.length === 0) {
    container.innerHTML = `
      <div class="outil-vide">
        <span class="outil-vide-ico">🎬</span>
        <p>Aucune vidéo ne correspond à ce filtre.</p>
        <button class="tuto-card-btn" onclick="setFiltreType('tout')">Voir toutes les vidéos</button>
      </div>`;
    return;
  }

  container.innerHTML = videos.map(v => carteVideoHTML(v)).join('');

  /* Rafraîchir l'état des boutons save selon les vidéos déjà sauvegardées */
  if (typeof window._refreshSaveBtns === 'function') {
    window._refreshSaveBtns();
  }
}

function filtrerVideos() {
  return OUTIL.outil.videos.filter(v => {
    if (OUTIL.filtreType === 'video') {
      if (v.dureeSecondes < OUTIL.filtreDureeMin) return false;
      if (v.dureeSecondes > OUTIL.filtreDureeMax) return false;
    }
    return true;
  });
}

/* ─── CARTE VIDÉO ─── */
function carteVideoHTML(v) {
  /* Données sérialisées pour le bouton save (pas de quotes simples dans les titres) */
  const videoDataAttr = escHTML(JSON.stringify({
    videoId:  v.id,
    outilId:  OUTIL.outil.id,
    titre:    v.titre,
    canal:    v.canal,
    duree:    v.duree,
    youtubeId: v.youtubeId,
  }));

  return `
  <div class="outil-video-card" title="${escHTML(v.titre)}">
    <div class="outil-video-thumb"
         onclick="ouvrirPlayer('${v.youtubeId}','${escHTML(v.titre).replace(/'/g,'&#39;')}')">
      <img src="https://img.youtube.com/vi/${v.youtubeId}/mqdefault.jpg"
           alt="${escHTML(v.titre)}"
           loading="lazy"
           onerror="this.src='assets/placeholder-video.svg'">
      <div class="outil-thumb-overlay">
        <div class="outil-play-btn">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <span class="thumb-badge badge-video">▶ Vidéo</span>
      <span class="thumb-duree">${escHTML(v.duree)}</span>
    </div>
    <div class="outil-video-info">
      <p class="outil-video-titre"
         onclick="ouvrirPlayer('${v.youtubeId}','${escHTML(v.titre).replace(/'/g,'&#39;')}')">
        ${escHTML(v.titre)}
      </p>
      <div class="outil-video-footer">
        <p class="outil-video-canal">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${escHTML(v.canal)}
        </p>
        <!-- Bouton sauvegarder -->
        <button
          class="btn-save-video"
          data-video-id="${escHTML(v.id)}"
          title="Sauvegarder cette vidéo"
          aria-label="Sauvegarder cette vidéo"
          onclick="event.stopPropagation(); window._toggleSaveVideo(this, JSON.parse(this.dataset.videoData));"
          data-video-data="${videoDataAttr}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
        </button>
      </div>
    </div>
  </div>`;
}

/* ─── PLAYER MODAL ─── */
function ouvrirPlayer(youtubeId, titre) {
  const modal  = document.getElementById('tuto-player-modal');
  const iframe = document.getElementById('tuto-player-iframe');
  const titreEl = document.getElementById('tuto-player-titre');
  if (!modal || !iframe) return;

  iframe.src = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`;
  if (titreEl) titreEl.textContent = titre;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  OUTIL.modalOuverte = true;
}

function fermerPlayer() {
  const modal  = document.getElementById('tuto-player-modal');
  const iframe = document.getElementById('tuto-player-iframe');
  if (!modal) return;
  modal.classList.remove('open');
  if (iframe) iframe.src = '';
  document.body.style.overflow = '';
  OUTIL.modalOuverte = false;
}

/* Clic backdrop */
document.addEventListener('click', e => {
  if (e.target.id === 'tuto-player-modal')    fermerPlayer();
  if (e.target.id === 'tuto-modal-soumission') fermerModalSoumission();
});

function bindEscape() {
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (OUTIL.modalOuverte) fermerPlayer();
    if (document.getElementById('tuto-modal-soumission')?.classList.contains('open')) fermerModalSoumission();
  });
}

/* ─── MODAL SOUMISSION ─── */
function ouvrirModalSoumission(outilId, outilNom) {
  const modal = document.getElementById('tuto-modal-soumission');
  const nomEl = document.getElementById('soumission-outil-nom');
  const idEl  = document.getElementById('soumission-outil-id');
  if (!modal) return;
  if (nomEl) nomEl.textContent = outilNom || 'cet outil';
  if (idEl)  idEl.value = outilId || '';
  const sel = document.getElementById('s-outil');
  if (sel && outilId) sel.value = outilId;
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function fermerModalSoumission() {
  const modal = document.getElementById('tuto-modal-soumission');
  if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; }
}

function bindSoumission() {
  document.getElementById('soumission-fermer')?.addEventListener('click', fermerModalSoumission);

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

function peuplerSelectSoumission() {
  const sel = document.getElementById('s-outil');
  if (!sel || !OUTIL.data) return;
  sel.innerHTML = `<option value="">Sélectionner un outil…</option>` +
    OUTIL.data.outils.map(o =>
      `<option value="${o.id}"${o.id === OUTIL.outil?.id ? ' selected' : ''}>${escHTML(o.nom)}</option>`
    ).join('') +
    `<option value="autre">Autre outil IA</option>`;
}

/* ─── UTILITAIRES ─── */
function lireParamURL(param) {
  return new URLSearchParams(window.location.search).get(param);
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3), 16);
  const g = parseInt(hex.slice(3,5), 16);
  const b = parseInt(hex.slice(5,7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function escHTML(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function afficherErreur(msg) {
  document.body.innerHTML = `
    <div style="max-width:500px;margin:100px auto;text-align:center;font-family:sans-serif;padding:32px">
      <p style="font-size:40px;margin-bottom:16px">⚠️</p>
      <p style="color:#ccc;font-size:15px">${msg}</p>
      <a href="tutoriels.html" style="display:inline-block;margin-top:20px;padding:10px 22px;
         background:#ff6b9d;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">
        ← Retour aux tutoriels
      </a>
    </div>`;
}

/* ─── EXPORTS GLOBAUX ─── */
window.ouvrirPlayer          = ouvrirPlayer;
window.fermerPlayer          = fermerPlayer;
window.ouvrirModalSoumission = ouvrirModalSoumission;
window.fermerModalSoumission = fermerModalSoumission;
window.setFiltreType         = setFiltreType;
window.setFiltreDuree        = setFiltreDuree;

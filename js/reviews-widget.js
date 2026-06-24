/* ═══════════════════════════════════════
   Albexia — reviews-widget.js  v2
   Widget avis : résumé + barres distribution
   + filtres + tri + pagination + votes Firestore
   ═══════════════════════════════════════ */

import { auth, onAuthStateChanged }
  from '../../js/firebase-config.js';

import {
  getToolSlugFromPath,
  getRatingSummary,
  getToolReviews,
  getUserReview,
  submitReview,
  deleteUserReview,
  reportReview,
  getUserVote,
  voteReview,
} from '../../js/reviews.js';

// ── Config ────────────────────────────────────
const TOOL_SLUG    = getToolSlugFromPath(window.location.pathname);
const TOOL_NAME    = document.querySelector('h1.tool-hero-title')?.textContent?.trim()
                  || document.title.split('—')[0].trim();
const TOOL_FAVICON = document.querySelector('.tool-logo-img')?.src || '';
const TOOL_EMOJI   = '🤖';
const TOOL_PAGE    = window.location.pathname;

const PAGE_SIZE = 3; // avis visibles par défaut

let currentUser  = null;
let userReview   = null;
let allReviews   = [];   // tous les avis chargés depuis Firestore
let filtered     = [];   // avis après filtre + tri
let visibleCount = PAGE_SIZE;
let activeFilter = 'all';
let activeSort   = 'recent';
let userVotes    = {};   // { reviewId: "yes"|"no"|null }

// ── Init ──────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await refreshWidget();
  await refreshHeroStars();
});

// ── Étoiles hero ─────────────────────────────
async function refreshHeroStars() {
  const summary = await getRatingSummary(TOOL_SLUG);
  if (!summary.ratingCount) return;
  const starsEl = document.querySelector('.tool-hero-stars');
  if (!starsEl) return;
  const avg  = summary.ratingAverage.toFixed(1);
  const full = Math.round(summary.ratingAverage);
  const starsHtml = [1,2,3,4,5].map(i =>
    `<span class="star ${i <= full ? 'on' : ''}">★</span>`
  ).join('');
  starsEl.innerHTML = `${starsHtml}
    <span class="star-label">${avg}/5 · ${summary.ratingCount} avis utilisateur${summary.ratingCount > 1 ? 's' : ''}</span>`;
}

// ── Widget principal ──────────────────────────
async function refreshWidget() {
  const container = document.getElementById('reviews-section');
  if (!container) return;

  container.innerHTML = buildSkeletonHTML();

  try {
    [allReviews, userReview] = await Promise.all([
      getToolReviews(TOOL_SLUG),
      currentUser ? getUserReview(currentUser.uid, TOOL_SLUG) : Promise.resolve(null),
    ]);

    // Charger les votes de l'utilisateur connecté sur tous les avis
    if (currentUser && allReviews.length) {
      const votePromises = allReviews.map(r =>
        getUserVote(r.id, currentUser.uid).then(v => ({ id: r.id, vote: v }))
      );
      const voteResults = await Promise.all(votePromises);
      userVotes = {};
      voteResults.forEach(({ id, vote }) => { userVotes[id] = vote; });
    }
  } catch {
    container.innerHTML = '';
    return;
  }

  visibleCount = PAGE_SIZE;
  applyFilterSort();
  render();
}

// ── Filtre + Tri ──────────────────────────────
function applyFilterSort() {
  let list = [...allReviews];

  if (activeFilter === 'positive') {
    list = list.filter(r => r.rating >= 4);
  } else if (activeFilter === 'negative') {
    list = list.filter(r => r.rating <= 2);
  } else if (['5','4','3','2','1'].includes(activeFilter)) {
    list = list.filter(r => r.rating === parseInt(activeFilter));
  }

  if (activeSort === 'recent') {
    list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  } else if (activeSort === 'useful') {
    list.sort((a, b) => {
      const scoreA = (a.helpful_yes || 0) - (a.helpful_no || 0);
      const scoreB = (b.helpful_yes || 0) - (b.helpful_no || 0);
      return scoreB - scoreA;
    });
  }

  filtered = list;
}

// ── Rendu principal ───────────────────────────
function render() {
  const container = document.getElementById('reviews-section');
  if (!container) return;
  container.innerHTML = buildWidgetHTML();
  attachEvents();
}

// ── Skeleton chargement ───────────────────────
function buildSkeletonHTML() {
  const skeletons = [1,2,3].map(() => `
    <div class="rv-skeleton-card">
      <div class="rv-skeleton rv-sk-avatar"></div>
      <div style="flex:1">
        <div class="rv-skeleton rv-sk-line" style="width:40%;margin-bottom:8px"></div>
        <div class="rv-skeleton rv-sk-line" style="width:100%"></div>
        <div class="rv-skeleton rv-sk-line" style="width:75%;margin-top:6px"></div>
      </div>
    </div>`).join('');
  return `<div class="rv-skeleton-wrap">${skeletons}</div>`;
}

// ── Distribution des notes ────────────────────
function buildDistribution() {
  const counts = {1:0, 2:0, 3:0, 4:0, 5:0};
  allReviews.forEach(r => { if (counts[r.rating] !== undefined) counts[r.rating]++; });
  const total = allReviews.length || 1;
  const avg   = allReviews.length
    ? (allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length).toFixed(1)
    : null;
  const fullStars = avg ? Math.round(parseFloat(avg)) : 0;

  const bars = [5,4,3,2,1].map(n => {
    const count = counts[n];
    const pct   = Math.round((count / total) * 100);
    return `
      <button class="rv-dist-row ${activeFilter === String(n) ? 'active' : ''}"
              data-filter="${n}" aria-label="Filtrer ${n} étoiles">
        <span class="rv-dist-label">${n}★</span>
        <div class="rv-dist-bar-bg">
          <div class="rv-dist-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="rv-dist-count">${count}</span>
      </button>`;
  }).join('');

  const starsDisplay = avg ? [1,2,3,4,5].map(i =>
    `<span class="${i <= fullStars ? 'on' : 'off'}">★</span>`
  ).join('') : '';

  return `
    <div class="rv-summary">
      <div class="rv-summary-left">
        ${avg
          ? `<div class="rv-avg-score">${avg}</div>
             <div class="rv-avg-stars">${starsDisplay}</div>
             <div class="rv-avg-count">${allReviews.length} avis</div>`
          : `<div class="rv-avg-empty">Aucun avis</div>`
        }
      </div>
      <div class="rv-dist-bars">${bars}</div>
    </div>`;
}

// ── Contrôles filtre + tri ────────────────────
function buildControls() {
  const filters = [
    { key: 'all',      label: 'Tous' },
    { key: 'positive', label: '👍 Positifs' },
    { key: 'negative', label: '👎 Négatifs' },
  ];
  const sorts = [
    { key: 'recent', label: 'Plus récents' },
    { key: 'useful', label: 'Plus utiles' },
  ];

  const filterBtns = filters.map(f =>
    `<button class="rv-ctrl-btn ${activeFilter === f.key ? 'active' : ''}"
             data-filter="${f.key}">${f.label}</button>`
  ).join('');

  const sortBtns = sorts.map(s =>
    `<button class="rv-sort-btn ${activeSort === s.key ? 'active' : ''}"
             data-sort="${s.key}">${s.label}</button>`
  ).join('');

  return `
    <div class="rv-controls">
      <div class="rv-filter-group">${filterBtns}</div>
      <div class="rv-sort-group">${sortBtns}</div>
    </div>`;
}

// ── HTML complet du widget ────────────────────
function buildWidgetHTML() {
  const totalReviews = allReviews.length;
  const visibleList  = filtered.slice(0, visibleCount);
  const remaining    = filtered.length - visibleCount;

  return `
  <section class="rv-section" id="avis-utilisateurs">
    <h2 class="rv-title">
      Avis utilisateurs
      ${totalReviews ? `<span class="rv-count">${totalReviews}</span>` : ''}
    </h2>

    ${totalReviews ? buildDistribution() : ''}
    ${buildFormHTML()}
    ${totalReviews ? buildControls() : ''}
    ${buildListHTML(visibleList)}
    ${remaining > 0 ? `
      <div class="rv-load-more-wrap">
        <button class="rv-load-more" id="rv-load-more">
          Voir ${Math.min(remaining, PAGE_SIZE)} avis de plus
          <span class="rv-load-more-count">(${filtered.length - visibleCount} restants)</span>
        </button>
      </div>` : ''}
  </section>

  ${buildStyles()}
  <div id="rv-toast" class="rv-toast"></div>`;
}

function buildFormHTML() {
  if (!currentUser) {
    return `
      <div class="rv-login-prompt">
        💬 <span>Connectez-vous pour laisser un avis.
        <a class="rv-login-link" href="/profil.html">Se connecter →</a></span>
      </div>`;
  }

  const editing    = !!userReview;
  const initRating = userReview?.rating || 0;
  const initText   = userReview?.comment || '';

  const stars = [1,2,3,4,5].map(i =>
    `<button type="button" class="rv-star-btn ${i <= initRating ? 'on' : ''}"
             data-value="${i}" aria-label="${i} étoile${i > 1 ? 's' : ''}">★</button>`
  ).join('');

  return `
    <div class="rv-form-card">
      <div class="rv-form-title">${editing ? '✏️ Modifier mon avis' : '💬 Donner mon avis'}</div>
      <div class="rv-stars-input" id="rv-stars-input" data-selected="${initRating}">
        ${stars}
      </div>
      <textarea class="rv-textarea" id="rv-comment" maxlength="500"
                placeholder="Votre expérience avec ${TOOL_NAME}… (optionnel)">${initText}</textarea>
      <div class="rv-char-count"><span id="rv-char-count">${initText.length}</span> / 500</div>
      <div class="rv-form-footer">
        <span class="rv-error" id="rv-error"></span>
        <div style="display:flex;gap:10px;margin-left:auto">
          ${editing ? `<button class="rv-delete-btn" id="rv-delete-btn">🗑 Supprimer mon avis</button>` : ''}
          <button class="rv-submit-btn" id="rv-submit-btn">
            ${editing ? 'Mettre à jour' : 'Publier mon avis'}
          </button>
        </div>
      </div>
    </div>`;
}

function buildListHTML(list) {
  if (!list.length) {
    if (filtered.length === 0 && allReviews.length > 0) {
      return `<div class="rv-empty">Aucun avis pour ce filtre.</div>`;
    }
    return `<div class="rv-empty">Aucun avis pour le moment. Soyez le premier !</div>`;
  }

  const items = list.map(r => {
    const initial = (r.displayName || '?').charAt(0).toUpperCase();
    const avatar  = r.avatarUrl
      ? `<img src="${r.avatarUrl}" alt="${esc(r.displayName)}" onerror="this.parentElement.textContent='${initial}'">`
      : initial;

    const date = r.updatedAt?.seconds
      ? new Date(r.updatedAt.seconds * 1000).toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric'
        })
      : '';

    const stars = [1,2,3,4,5].map(i =>
      `<span class="${i <= r.rating ? '' : 'off'}">★</span>`
    ).join('');

    const isOwn     = currentUser?.uid === r.uid;
    const myVote    = userVotes[r.id] || null;
    const yesCount  = r.helpful_yes || 0;
    const noCount   = r.helpful_no  || 0;

    const voteSection = `
      <div class="rv-vote-row">
        <span class="rv-vote-label">Utile ?</span>
        <button class="rv-vote-btn rv-vote-yes ${myVote === 'yes' ? 'voted' : ''}"
                data-review-id="${r.id}" data-value="yes"
                ${!currentUser ? 'title="Connectez-vous pour voter"' : ''}>
          👍 <span class="rv-vote-num">${yesCount}</span>
        </button>
        <button class="rv-vote-btn rv-vote-no ${myVote === 'no' ? 'voted' : ''}"
                data-review-id="${r.id}" data-value="no"
                ${!currentUser ? 'title="Connectez-vous pour voter"' : ''}>
          👎 <span class="rv-vote-num">${noCount}</span>
        </button>
        ${!isOwn ? `
          <button class="rv-report-btn" data-review-id="${r.id}">⚑ Signaler</button>
        ` : ''}
      </div>`;

    return `
      <div class="rv-card" data-review-id="${r.id}">
        <div class="rv-card-head">
          <div class="rv-avatar">${avatar}</div>
          <div class="rv-meta">
            <div class="rv-author">${esc(r.displayName)}</div>
            <div class="rv-date">${date}</div>
          </div>
          <div class="rv-stars-display">${stars}</div>
        </div>
        ${r.comment ? `<p class="rv-comment">${esc(r.comment)}</p>` : ''}
        ${voteSection}
      </div>`;
  }).join('');

  return `<div class="rv-list">${items}</div>`;
}

// ── Events ────────────────────────────────────
function attachEvents() {
  // Étoiles formulaire
  const starsInput = document.getElementById('rv-stars-input');
  if (starsInput) {
    starsInput.addEventListener('click', (e) => {
      const btn = e.target.closest('.rv-star-btn');
      if (!btn) return;
      const val = parseInt(btn.dataset.value);
      starsInput.dataset.selected = val;
      starsInput.querySelectorAll('.rv-star-btn').forEach((b, i) => {
        b.classList.toggle('on', i < val);
      });
    });
  }

  // Compteur chars
  const textarea  = document.getElementById('rv-comment');
  const charCount = document.getElementById('rv-char-count');
  if (textarea && charCount) {
    textarea.addEventListener('input', () => { charCount.textContent = textarea.value.length; });
  }

  // Soumettre / supprimer
  document.getElementById('rv-submit-btn')?.addEventListener('click', handleSubmit);
  document.getElementById('rv-delete-btn')?.addEventListener('click', handleDelete);

  // Bouton "Voir plus"
  document.getElementById('rv-load-more')?.addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    render();
  });

  // Filtres (barres de distribution + boutons)
  document.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      visibleCount = PAGE_SIZE;
      applyFilterSort();
      render();
    });
  });

  // Tri
  document.querySelectorAll('[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSort   = btn.dataset.sort;
      visibleCount = PAGE_SIZE;
      applyFilterSort();
      render();
    });
  });

  // Votes
  document.querySelectorAll('.rv-vote-btn').forEach(btn => {
    btn.addEventListener('click', () => handleVote(btn));
  });

  // Signaler
  document.querySelectorAll('.rv-report-btn').forEach(btn => {
    btn.addEventListener('click', () => handleReport(btn));
  });
}

// ── Handlers ──────────────────────────────────
async function handleSubmit() {
  const errorEl   = document.getElementById('rv-error');
  const submitBtn = document.getElementById('rv-submit-btn');
  const starsInput = document.getElementById('rv-stars-input');
  const textarea   = document.getElementById('rv-comment');

  errorEl.style.display = 'none';
  const rating  = parseInt(starsInput?.dataset.selected || '0');
  const comment = textarea?.value.trim() || '';

  if (!rating) {
    errorEl.textContent = 'Veuillez choisir une note (1 à 5 étoiles).';
    errorEl.style.display = 'block';
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = '…';

  try {
    const profile = window._userProfile || {};
    await submitReview(
      currentUser.uid, TOOL_SLUG,
      { name: TOOL_NAME, favicon: TOOL_FAVICON, emoji: TOOL_EMOJI, page: TOOL_PAGE },
      rating, comment,
      {
        displayName: profile.displayName || currentUser.displayName || 'Utilisateur',
        avatarUrl:   profile.photoURL    || currentUser.photoURL    || '',
      }
    );
    rvToast('✅ Avis publié, merci !');
    await refreshWidget();
    await refreshHeroStars();
  } catch (err) {
    errorEl.textContent = 'Erreur lors de la publication. Réessayez.';
    errorEl.style.display = 'block';
    submitBtn.disabled    = false;
    submitBtn.textContent = userReview ? 'Mettre à jour' : 'Publier mon avis';
  }
}

async function handleDelete() {
  if (!confirm('Supprimer votre avis définitivement ?')) return;
  try {
    await deleteUserReview(currentUser.uid, TOOL_SLUG);
    userReview = null;
    rvToast('Avis supprimé.');
    await refreshWidget();
    await refreshHeroStars();
  } catch {
    rvToast('⚠ Erreur lors de la suppression.');
  }
}

async function handleVote(btn) {
  if (!currentUser) {
    rvToast('Connectez-vous pour voter.');
    return;
  }

  const reviewId = btn.dataset.reviewId;
  const value    = btn.dataset.value; // "yes" | "no"

  // Désactiver les deux boutons de la carte pendant la requête
  const card     = btn.closest('.rv-card');
  const allBtns  = card?.querySelectorAll('.rv-vote-btn');
  allBtns?.forEach(b => { b.disabled = true; });

  try {
    const newVote = await voteReview(reviewId, currentUser.uid, value);
    userVotes[reviewId] = newVote;

    // Mettre à jour le compteur dans allReviews
    const review = allReviews.find(r => r.id === reviewId);
    if (review) {
      const oldVote = newVote === null ? value : null; // ce qu'on vient de toggle
      if (newVote === null) {
        // Vote annulé
        review[`helpful_${value}`] = Math.max(0, (review[`helpful_${value}`] || 0) - 1);
      } else if (oldVote) {
        // Changement de vote
        review[`helpful_${oldVote}`] = Math.max(0, (review[`helpful_${oldVote}`] || 0) - 1);
        review[`helpful_${newVote}`] = (review[`helpful_${newVote}`] || 0) + 1;
      } else {
        // Nouveau vote
        review[`helpful_${value}`] = (review[`helpful_${value}`] || 0) + 1;
      }
    }

    applyFilterSort();
    render();
  } catch {
    rvToast('⚠ Erreur lors du vote.');
    allBtns?.forEach(b => { b.disabled = false; });
  }
}

async function handleReport(btn) {
  if (!currentUser) { rvToast('Connectez-vous pour signaler un avis.'); return; }
  if (!confirm('Signaler cet avis comme inapproprié ?')) return;
  const reviewId = btn.dataset.reviewId;
  btn.disabled = true;
  try {
    await reportReview(reviewId, currentUser.uid, 'Contenu inapproprié');
    btn.textContent = '✓ Signalé';
    rvToast('Avis signalé. Merci.');
  } catch {
    btn.disabled = false;
    rvToast('⚠ Erreur lors du signalement.');
  }
}

// ── Toast ─────────────────────────────────────
let _rvToastTimer = null;
function rvToast(msg) {
  let el = document.getElementById('rv-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'rv-toast';
    el.className = 'rv-toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_rvToastTimer);
  _rvToastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Styles injectés ───────────────────────────
function buildStyles() {
  return `<style>
  /* ══ Reviews Widget v2 ══════════════════════════ */
  .rv-section { margin: 48px 0; }

  .rv-title {
    font-size: 1.3rem; font-weight: 700;
    margin-bottom: 24px;
    display: flex; align-items: center; gap: 10px;
  }
  .rv-count {
    background: rgba(108,99,255,0.15); color: var(--accent);
    border-radius: 20px; padding: 2px 10px;
    font-size: .8rem; font-weight: 600;
  }

  /* Skeleton */
  .rv-skeleton-wrap { display: flex; flex-direction: column; gap: 14px; padding: 8px 0; }
  .rv-skeleton-card { display: flex; gap: 14px; align-items: flex-start; background: var(--bg2); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; }
  .rv-skeleton { background: linear-gradient(90deg, var(--bg2) 25%, var(--bg3) 50%, var(--bg2) 75%); background-size: 200% 100%; animation: rv-shimmer 1.5s infinite; border-radius: 6px; }
  .rv-sk-avatar { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
  .rv-sk-line   { height: 12px; }
  @keyframes rv-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  /* Résumé + distribution */
  .rv-summary {
    display: flex; gap: 32px; align-items: center;
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 16px; padding: 24px 28px;
    margin-bottom: 28px;
  }
  .rv-summary-left {
    text-align: center; min-width: 90px;
  }
  .rv-avg-score {
    font-size: 3rem; font-weight: 800; line-height: 1;
    color: var(--text); font-family: 'Syne', sans-serif;
  }
  .rv-avg-stars { color: var(--accent-amber); font-size: 1.1rem; margin: 6px 0 4px; letter-spacing: 2px; }
  .rv-avg-stars .off { color: rgba(255,255,255,0.15); }
  .rv-avg-stars .on  { color: var(--accent-amber); }
  .rv-avg-count { font-size: .8rem; color: var(--text-muted); }
  .rv-avg-empty { font-size: .85rem; color: var(--text-dim); }
  .rv-dist-bars { flex: 1; display: flex; flex-direction: column; gap: 7px; }
  .rv-dist-row {
    display: flex; align-items: center; gap: 10px;
    background: none; border: 1px solid transparent;
    border-radius: 8px; padding: 4px 8px; cursor: pointer;
    transition: border-color .15s, background .15s;
    font-family: inherit; color: var(--text);
  }
  .rv-dist-row:hover { border-color: var(--border-hover); background: var(--bg3); }
  .rv-dist-row.active { border-color: rgba(108,99,255,0.35); background: rgba(108,99,255,0.08); }
  .rv-dist-label { font-size: .8rem; color: var(--text-muted); min-width: 22px; text-align: right; }
  .rv-dist-bar-bg  { flex: 1; height: 7px; background: var(--bg3); border-radius: 4px; overflow: hidden; }
  .rv-dist-bar-fill { height: 100%; background: var(--accent2); border-radius: 4px; transition: width .4s ease; }
  .rv-dist-count { font-size: .75rem; color: var(--text-dim); min-width: 22px; }

  /* Contrôles */
  .rv-controls {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; flex-wrap: wrap; margin-bottom: 20px;
  }
  .rv-filter-group, .rv-sort-group { display: flex; gap: 6px; flex-wrap: wrap; }
  .rv-ctrl-btn, .rv-sort-btn {
    padding: 6px 14px; border-radius: 20px; font-size: .8rem;
    font-weight: 500; font-family: inherit; cursor: pointer;
    background: var(--bg2); border: 1px solid var(--border);
    color: var(--text-muted); transition: all .15s;
  }
  .rv-ctrl-btn:hover, .rv-sort-btn:hover { border-color: var(--border-hover); color: var(--text); }
  .rv-ctrl-btn.active { background: rgba(255,107,157,0.12); border-color: rgba(255,107,157,0.35); color: var(--accent2); }
  .rv-sort-btn.active { background: rgba(108,99,255,0.12); border-color: rgba(108,99,255,0.35); color: var(--accent); }

  /* Formulaire */
  .rv-form-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 14px; padding: 24px; margin-bottom: 28px;
  }
  .rv-form-title { font-size: 1rem; font-weight: 600; margin-bottom: 16px; }
  .rv-stars-input { display: flex; gap: 6px; margin-bottom: 16px; }
  .rv-star-btn {
    font-size: 1.6rem; background: none; border: none;
    cursor: pointer; color: rgba(255,255,255,0.2);
    transition: color .15s, transform .1s; line-height: 1; padding: 0;
  }
  .rv-star-btn.on  { color: var(--accent-amber); }
  .rv-star-btn:hover { transform: scale(1.15); }
  .rv-textarea {
    width: 100%; min-height: 100px; background: var(--bg3);
    border: 1px solid var(--border); border-radius: 10px;
    color: var(--text); font-family: 'DM Sans', sans-serif;
    font-size: .9rem; padding: 12px 14px; resize: vertical;
    outline: none; transition: border-color .2s;
    margin-bottom: 12px; box-sizing: border-box;
  }
  .rv-textarea:focus { border-color: var(--accent); }
  .rv-char-count { text-align: right; font-size: .75rem; color: var(--text-muted); margin-bottom: 12px; margin-top: -8px; }
  .rv-form-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .rv-submit-btn {
    padding: 10px 20px; background: var(--accent); border: none;
    border-radius: 10px; color: #fff; font-size: .875rem;
    font-weight: 600; cursor: pointer; font-family: inherit;
    transition: opacity .2s;
  }
  .rv-submit-btn:hover    { opacity: .85; }
  .rv-submit-btn:disabled { opacity: .45; cursor: not-allowed; }
  .rv-delete-btn {
    padding: 10px 16px;
    background: rgba(255,71,87,0.1); border: 1px solid rgba(255,71,87,0.25);
    border-radius: 10px; color: #ff6b78;
    font-size: .875rem; font-weight: 500; cursor: pointer;
    font-family: inherit; transition: opacity .2s;
  }
  .rv-delete-btn:hover { opacity: .8; }
  .rv-error { color: #ff6b78; font-size: .85rem; display: none; }
  .rv-login-prompt {
    display: flex; align-items: center; gap: 12px;
    padding: 16px 20px;
    background: rgba(108,99,255,0.08); border: 1px solid rgba(108,99,255,0.2);
    border-radius: 12px; font-size: .9rem; color: #a8a3ff; margin-bottom: 28px;
  }
  .rv-login-link { color: var(--accent); font-weight: 600; text-decoration: none; }
  .rv-login-link:hover { text-decoration: underline; }

  /* Liste */
  .rv-list  { display: flex; flex-direction: column; gap: 14px; }
  .rv-empty { text-align: center; padding: 32px 20px; color: var(--text-muted); font-size: .9rem; }
  .rv-card {
    background: var(--bg2); border: 1px solid var(--border);
    border-radius: 12px; padding: 18px 20px; transition: border-color .2s;
  }
  .rv-card:hover { border-color: rgba(108,99,255,0.25); }
  .rv-card-head { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
  .rv-avatar {
    width: 36px; height: 36px; border-radius: 50%;
    background: var(--accent); display: flex; align-items: center;
    justify-content: center; font-size: .85rem; font-weight: 700;
    color: #fff; flex-shrink: 0; overflow: hidden;
  }
  .rv-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .rv-meta { flex: 1; min-width: 0; }
  .rv-author { font-size: .875rem; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rv-date   { font-size: .75rem; color: var(--text-muted); }
  .rv-stars-display { color: var(--accent-amber); font-size: .95rem; letter-spacing: 1px; }
  .rv-stars-display .off { color: rgba(255,255,255,0.15); }
  .rv-comment { font-size: .875rem; line-height: 1.6; color: var(--text-muted); }

  /* Votes */
  .rv-vote-row {
    display: flex; align-items: center; gap: 8px;
    margin-top: 14px; padding-top: 12px;
    border-top: 1px solid var(--border);
  }
  .rv-vote-label { font-size: .75rem; color: var(--text-dim); margin-right: 4px; flex: 1; }
  .rv-vote-btn {
    display: flex; align-items: center; gap: 5px;
    padding: 5px 12px; border-radius: 20px; font-size: .8rem;
    font-family: inherit; cursor: pointer; transition: all .15s;
    background: var(--bg3); border: 1px solid var(--border); color: var(--text-muted);
  }
  .rv-vote-btn:hover { border-color: var(--border-hover); color: var(--text); }
  .rv-vote-btn:disabled { opacity: .4; cursor: not-allowed; }
  .rv-vote-yes.voted { background: rgba(0,212,170,0.1); border-color: rgba(0,212,170,0.35); color: var(--accent3); }
  .rv-vote-no.voted  { background: rgba(255,107,157,0.1); border-color: rgba(255,107,157,0.35); color: var(--accent2); }
  .rv-vote-num { font-weight: 600; }
  .rv-report-btn {
    background: none; border: none; color: var(--text-dim);
    font-size: .75rem; cursor: pointer; padding: 4px 8px;
    border-radius: 6px; font-family: inherit;
    transition: color .15s, background .15s; margin-left: auto;
  }
  .rv-report-btn:hover { color: #ff6b78; background: rgba(255,71,87,0.08); }
  .rv-report-btn:disabled { opacity: .4; cursor: not-allowed; }

  /* Bouton Voir plus */
  .rv-load-more-wrap { display: flex; justify-content: center; margin-top: 20px; }
  .rv-load-more {
    padding: 10px 28px; background: none;
    border: 1px solid var(--border); border-radius: 24px;
    color: var(--text-muted); font-size: .875rem; font-weight: 500;
    font-family: inherit; cursor: pointer; transition: all .2s;
  }
  .rv-load-more:hover { border-color: var(--border-hover); color: var(--text); }
  .rv-load-more-count { font-size: .75rem; color: var(--text-dim); margin-left: 4px; }

  /* Toast */
  .rv-toast {
    position: fixed; bottom: 24px; left: 50%;
    transform: translateX(-50%) translateY(20px);
    background: var(--bg2); border: 1px solid rgba(255,255,255,0.08);
    border-radius: 24px; padding: 10px 20px;
    font-size: .875rem; color: var(--text);
    opacity: 0; transition: all .25s; z-index: 999;
    white-space: nowrap; pointer-events: none;
  }
  .rv-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

  /* Responsive */
  @media (max-width: 600px) {
    .rv-summary { flex-direction: column; gap: 20px; padding: 20px; }
    .rv-summary-left { display: flex; align-items: center; gap: 14px; }
    .rv-controls { flex-direction: column; align-items: flex-start; }
    .rv-vote-row { flex-wrap: wrap; }
  }
  </style>`;
}

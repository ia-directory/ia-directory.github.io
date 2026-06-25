/* ═══════════════════════════════════════
   Albexia — reviews-widget.js  v3
   Fiche outil : formulaire + 3 derniers avis
   + votes + bouton "Voir tous les avis →"
   ═══════════════════════════════════════ */

import { auth, onAuthStateChanged }
  from '/js/firebase-config.js';

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
} from '/js/reviews.js';

// ── Config ────────────────────────────────────
const TOOL_SLUG    = getToolSlugFromPath(window.location.pathname);
const TOOL_NAME    = document.querySelector('h1.tool-hero-title')?.textContent?.trim()
                  || document.title.split('—')[0].trim();
const TOOL_FAVICON = document.querySelector('.tool-logo-img')?.src || '';
const TOOL_EMOJI   = '🤖';
const TOOL_PAGE    = window.location.pathname;

const MAX_VISIBLE = 3;

let currentUser = null;
let userReview  = null;
let allReviews  = [];
let userVotes   = {};

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
    <span class="star-label">${avg}/5 · ${summary.ratingCount} avis</span>`;
}

// ── Chargement données ────────────────────────
async function refreshWidget() {
  const container = document.getElementById('reviews-section');
  if (!container) return;

  container.innerHTML = buildSkeletonHTML();

  try {
    [allReviews, userReview] = await Promise.all([
      getToolReviews(TOOL_SLUG),
      currentUser ? getUserReview(currentUser.uid, TOOL_SLUG) : Promise.resolve(null),
    ]);

    if (currentUser && allReviews.length) {
      const results = await Promise.all(
        allReviews.map(r => getUserVote(r.id, currentUser.uid).then(v => ({ id: r.id, vote: v })))
      );
      userVotes = {};
      results.forEach(({ id, vote }) => { userVotes[id] = vote; });
    }
  } catch {
    container.innerHTML = '';
    return;
  }

  render();
}

function render() {
  const container = document.getElementById('reviews-section');
  if (!container) return;
  container.innerHTML = buildWidgetHTML();
  attachEvents();
}

// ── HTML principal ────────────────────────────
function buildWidgetHTML() {
  const total   = allReviews.length;
  const visible = allReviews.slice(0, MAX_VISIBLE);

  return `
  <section class="rv-section" id="avis-utilisateurs">
    <h2 class="rv-title">
      Avis utilisateurs
      ${total ? `<span class="rv-count">${total}</span>` : ''}
    </h2>

    ${buildFormHTML()}

    ${total ? `
      <div class="rv-list">${visible.map(r => buildCardHTML(r)).join('')}</div>

      <div class="rv-see-all-wrap">
        <a class="rv-see-all-btn"
           href="/tools/avis-outil.html?tool=${TOOL_SLUG}">
          Voir tous les avis de ${TOOL_NAME}
          <span class="rv-see-all-count">${total} avis →</span>
        </a>
      </div>
    ` : `<div class="rv-empty">Aucun avis pour le moment. Soyez le premier !</div>`}
  </section>

  <div id="rv-toast" class="rv-toast"></div>`;
}

// ── Formulaire ────────────────────────────────
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

// ── Carte avis ────────────────────────────────
function buildCardHTML(r) {
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

  const isOwn    = currentUser?.uid === r.uid;
  const myVote   = userVotes[r.id] || null;
  const yesCount = r.helpful_yes || 0;
  const noCount  = r.helpful_no  || 0;

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
      <div class="rv-vote-row">
        <span class="rv-vote-label">Utile ?</span>
        ${!isOwn ? `
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
          <button class="rv-report-btn" data-review-id="${r.id}">⚑ Signaler</button>
        ` : `
          <span class="rv-vote-own">👍 ${yesCount} · 👎 ${noCount}</span>
        `}
      </div>
    </div>`;
}

// ── Events ────────────────────────────────────
function attachEvents() {
  // Étoiles
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

  document.getElementById('rv-submit-btn')?.addEventListener('click', handleSubmit);
  document.getElementById('rv-delete-btn')?.addEventListener('click', handleDelete);

  document.querySelectorAll('.rv-vote-btn').forEach(btn => {
    btn.addEventListener('click', () => handleVote(btn));
  });

  document.querySelectorAll('.rv-report-btn').forEach(btn => {
    btn.addEventListener('click', () => handleReport(btn));
  });
}

// ── Handlers ──────────────────────────────────
async function handleSubmit() {
  const errorEl    = document.getElementById('rv-error');
  const submitBtn  = document.getElementById('rv-submit-btn');
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
  } catch {
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
  if (!currentUser) { rvToast('Connectez-vous pour voter.'); return; }

  const reviewId = btn.dataset.reviewId;
  const value    = btn.dataset.value;
  const card     = btn.closest('.rv-card');
  const allBtns  = card?.querySelectorAll('.rv-vote-btn');
  allBtns?.forEach(b => { b.disabled = true; });

  try {
    const newVote = await voteReview(reviewId, currentUser.uid, value);
    userVotes[reviewId] = newVote;

    // Mise à jour locale des compteurs
    const review = allReviews.find(r => r.id === reviewId);
    if (review) {
      const prevVote = newVote === null ? value : (newVote !== value ? value : null);
      if (newVote === null) {
        review[`helpful_${value}`] = Math.max(0, (review[`helpful_${value}`] || 0) - 1);
      } else {
        if (prevVote && prevVote !== newVote) {
          review[`helpful_${prevVote}`] = Math.max(0, (review[`helpful_${prevVote}`] || 0) - 1);
        }
        review[`helpful_${newVote}`] = (review[`helpful_${newVote}`] || 0) + 1;
      }
    }
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

// ── Skeleton ──────────────────────────────────
function buildSkeletonHTML() {
  return `<div class="rv-skeleton-wrap">${[1,2,3].map(() => `
    <div class="rv-skeleton-card">
      <div class="rv-skeleton rv-sk-avatar"></div>
      <div style="flex:1">
        <div class="rv-skeleton rv-sk-line" style="width:40%;margin-bottom:8px"></div>
        <div class="rv-skeleton rv-sk-line" style="width:100%"></div>
        <div class="rv-skeleton rv-sk-line" style="width:70%;margin-top:6px"></div>
      </div>
    </div>`).join('')}</div>`;
}

function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

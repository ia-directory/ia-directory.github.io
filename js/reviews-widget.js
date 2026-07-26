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

// ── i18n helper ───────────────────────────────
// i18n.js expose window.t(key, langue) et window.detecterLangue().
// On garde un petit wrapper local avec interpolation {placeholder}.
function tr(key, vars) {
  const langue = window.detecterLangue ? window.detecterLangue() : 'fr';
  let str = window.t ? window.t(key, langue) : key;
  if (vars) {
    Object.keys(vars).forEach(k => {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), vars[k]);
    });
  }
  return str;
}

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
    <span class="star-label">${avg}/5 · ${summary.ratingCount} ${tr('reviews.avgLabel')}</span>`;
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
  } catch (err) {
    console.error('reviews-widget: échec chargement avis', err);
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
      ${tr('reviews.title')}
      ${total ? `<span class="rv-count">${total}</span>` : ''}
    </h2>

    ${buildFormHTML()}

    ${total ? `
      <div class="rv-list">${visible.map(r => buildCardHTML(r)).join('')}</div>

      <div class="rv-see-all-wrap">
        <a class="rv-see-all-btn"
           href="/tools/avis-outil.html?tool=${TOOL_SLUG}">
          ${tr('reviews.seeAllPrefix')} ${TOOL_NAME}
          <span class="rv-see-all-count">${tr('reviews.seeAllCount', { count: total })}</span>
        </a>
      </div>
    ` : `<div class="rv-empty">${tr('reviews.empty')}</div>`}
  </section>

  <div id="rv-toast" class="rv-toast"></div>`;
}

// ── Formulaire ────────────────────────────────
function buildFormHTML() {
  if (!currentUser) {
    return `
      <div class="rv-login-prompt">
        💬 <span>${tr('reviews.loginPrompt')}
        <a class="rv-login-link" href="/profil.html">${tr('reviews.loginLink')}</a></span>
      </div>`;
  }

  const editing    = !!userReview;
  const initRating = userReview?.rating || 0;
  const initText   = userReview?.comment || '';

  const stars = [1,2,3,4,5].map(i =>
    `<button type="button" class="rv-star-btn ${i <= initRating ? 'on' : ''}"
             data-value="${i}" aria-label="${tr(i > 1 ? 'reviews.starLabelPlural' : 'reviews.starLabel', { n: i })}">★</button>`
  ).join('');

  return `
    <div class="rv-form-card">
      <div class="rv-form-title">${editing ? tr('reviews.formTitleEdit') : tr('reviews.formTitleNew')}</div>
      <div class="rv-stars-input" id="rv-stars-input" data-selected="${initRating}">
        ${stars}
      </div>
      <textarea class="rv-textarea" id="rv-comment" maxlength="500"
                placeholder="${esc(tr('reviews.commentPlaceholder', { tool: TOOL_NAME }))}">${initText}</textarea>
      <div class="rv-char-count"><span id="rv-char-count">${initText.length}</span> / 500</div>
      <div class="rv-form-footer">
        <span class="rv-error" id="rv-error"></span>
        <div style="display:flex;gap:10px;margin-left:auto">
          ${editing ? `<button class="rv-delete-btn" id="rv-delete-btn">${tr('reviews.deleteBtn')}</button>` : ''}
          <button class="rv-submit-btn" id="rv-submit-btn">
            ${editing ? tr('reviews.submitBtnEdit') : tr('reviews.submitBtnNew')}
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

  const langue  = window.detecterLangue ? window.detecterLangue() : 'fr';
  const locales = { fr: 'fr-FR', en: 'en-US', es: 'es-ES' };
  const date = r.updatedAt?.seconds
    ? new Date(r.updatedAt.seconds * 1000).toLocaleDateString(locales[langue] || 'fr-FR', {
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

  const profileUrl = r.uid ? `/profil-public.html?id=${encodeURIComponent(r.uid)}` : null;

  return `
    <div class="rv-card" data-review-id="${r.id}">
      <div class="rv-card-head">
        ${profileUrl
          ? `<a class="rv-avatar" href="${profileUrl}" aria-label="Voir le profil de ${esc(r.displayName)}">${avatar}</a>`
          : `<div class="rv-avatar">${avatar}</div>`
        }
        <div class="rv-meta">
          ${profileUrl
            ? `<a class="rv-author" href="${profileUrl}">${esc(r.displayName)}</a>`
            : `<div class="rv-author">${esc(r.displayName)}</div>`
          }
          <div class="rv-date">${date}</div>
        </div>
        <div class="rv-stars-display">${stars}</div>
      </div>
      ${r.comment ? `<p class="rv-comment">${esc(r.comment)}</p>` : ''}
      <div class="rv-vote-row">
        <span class="rv-vote-label">${tr('reviews.helpfulLabel')}</span>
        ${!isOwn ? `
          <button class="rv-vote-btn rv-vote-yes ${myVote === 'yes' ? 'voted' : ''}"
                  data-review-id="${r.id}" data-value="yes"
                  ${!currentUser ? `title="${esc(tr('reviews.loginToVoteTitle'))}"` : ''}>
            👍 <span class="rv-vote-num">${yesCount}</span>
          </button>
          <button class="rv-vote-btn rv-vote-no ${myVote === 'no' ? 'voted' : ''}"
                  data-review-id="${r.id}" data-value="no"
                  ${!currentUser ? `title="${esc(tr('reviews.loginToVoteTitle'))}"` : ''}>
            👎 <span class="rv-vote-num">${noCount}</span>
          </button>
          <button class="rv-report-btn" data-review-id="${r.id}">${tr('reviews.reportBtn')}</button>
        ` : `
          <span class="rv-vote-own">👍 ${yesCount} · 👎 ${noCount}</span>
        `}
      </div>
    </div>`;
}

// ── Events ────────────────────────────────────
function attachEvents() {
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
    errorEl.textContent = tr('reviews.errorNoRating');
    errorEl.style.display = 'block';
    return;
  }

  submitBtn.disabled    = true;
  submitBtn.textContent = tr('reviews.submitBtnPending');

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
    rvToast(tr('reviews.toastSubmitted'));
    await refreshWidget();
    await refreshHeroStars();
  } catch (err) {
    console.error('reviews-widget: échec submitReview', err);
    errorEl.textContent = tr('reviews.errorSubmit');
    errorEl.style.display = 'block';
    submitBtn.disabled    = false;
    submitBtn.textContent = userReview ? tr('reviews.submitBtnEdit') : tr('reviews.submitBtnNew');
  }
}

async function handleDelete() {
  if (!confirm(tr('reviews.confirmDelete'))) return;
  try {
    await deleteUserReview(currentUser.uid, TOOL_SLUG);
    userReview = null;
    rvToast(tr('reviews.toastDeleted'));
    await refreshWidget();
    await refreshHeroStars();
  } catch {
    rvToast(tr('reviews.toastDeleteError'));
  }
}

async function handleVote(btn) {
  if (!currentUser) { rvToast(tr('reviews.loginToVote')); return; }

  const reviewId = btn.dataset.reviewId;
  const value    = btn.dataset.value;
  const card     = btn.closest('.rv-card');
  const allBtns  = card?.querySelectorAll('.rv-vote-btn');
  allBtns?.forEach(b => { b.disabled = true; });

  try {
    const prevVote = userVotes[reviewId] || null;  // lire AVANT écrasement
    const newVote = await voteReview(reviewId, currentUser.uid, value);
    userVotes[reviewId] = newVote;

    // FIX : mise à jour chirurgicale du DOM (sans re-render brutal)
    const yesBtn = card?.querySelector('.rv-vote-yes');
    const noBtn  = card?.querySelector('.rv-vote-no');
    const yesNum = yesBtn?.querySelector('.rv-vote-num');
    const noNum  = noBtn?.querySelector('.rv-vote-num');

    let yes = parseInt(yesNum?.textContent || '0');
    let no  = parseInt(noNum?.textContent  || '0');

    if (newVote === null) {
      // Toggle off — retirer le vote
      if (value === 'yes') yes = Math.max(0, yes - 1);
      else                  no  = Math.max(0, no  - 1);
    } else {
      // Nouveau vote
      if (newVote === 'yes') yes++;
      else                    no++;
      // Retirer l'ancien si changement de camp
      if (prevVote === 'yes') yes = Math.max(0, yes - 1);
      else if (prevVote === 'no') no = Math.max(0, no - 1);
    }

    if (yesNum) yesNum.textContent = yes;
    if (noNum)  noNum.textContent  = no;
    yesBtn?.classList.toggle('voted', newVote === 'yes');
    noBtn?.classList.toggle('voted',  newVote === 'no');
    allBtns?.forEach(b => { b.disabled = false; });

    // Sync allReviews en mémoire — évite le drift au changement de filtre/tri
    const review = allReviews.find(r => r.id === reviewId);
    if (review) {
      review.helpful_yes = yes;
      review.helpful_no  = no;
    }

  } catch(e) {
    rvToast('⚠ ' + (e?.code || e?.message || String(e)));
    allBtns?.forEach(b => { b.disabled = false; });
  }
}

async function handleReport(btn) {
  if (!currentUser) { rvToast(tr('reviews.loginToReport')); return; }
  if (!confirm(tr('reviews.confirmReport'))) return;
  const reviewId = btn.dataset.reviewId;
  btn.disabled = true;
  try {
    await reportReview(reviewId, currentUser.uid, 'Contenu inapproprié');
    btn.textContent = tr('reviews.reportBtnDone');
    rvToast(tr('reviews.toastReported'));
  } catch {
    btn.disabled = false;
    rvToast(tr('reviews.toastReportError'));
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

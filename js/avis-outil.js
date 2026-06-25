/* ═══════════════════════════════════════
   Albexia — avis-outil.js
   Page dédiée aux avis d'un outil
   URL : /tools/avis-outil.html?tool=canva
   ═══════════════════════════════════════ */

import { auth, onAuthStateChanged }
  from './js/firebase-config.js';

import {
  getToolReviews,
  getUserReview,
  getRatingSummary,
  submitReview,
  deleteUserReview,
  reportReview,
  getUserVote,
  voteReview,
} from './js/reviews.js';

// ── Config depuis URL ─────────────────────────
const params   = new URLSearchParams(window.location.search);
const TOOL_SLUG = params.get('tool') || '';

if (!TOOL_SLUG) {
  document.getElementById('avo-list').innerHTML =
    '<p style="color:var(--text-muted);padding:40px 0;text-align:center">Outil introuvable.</p>';
}

const PAGE_SIZE = 6;

let currentUser = null;
let userReview  = null;
let allReviews  = [];
let filtered    = [];
let visibleCount = PAGE_SIZE;
let activeFilter = 'all';
let activeSort   = 'recent';
let userVotes    = {};
let toolMeta     = { name: '', favicon: '', page: '' };

// ── Init ──────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (TOOL_SLUG) await loadAll();
});

async function loadAll() {
  try {
    [allReviews, userReview] = await Promise.all([
      getToolReviews(TOOL_SLUG),
      currentUser ? getUserReview(currentUser.uid, TOOL_SLUG) : Promise.resolve(null),
    ]);

    // Récupérer meta depuis premier avis ou ratings_summary
    if (allReviews.length) {
      const first = allReviews[0];
      toolMeta.name    = first.toolName    || TOOL_SLUG;
      toolMeta.favicon = first.toolFavicon || '';
      toolMeta.page    = first.toolPage    || '';
    }

    // Charger les votes de l'utilisateur
    if (currentUser && allReviews.length) {
      const results = await Promise.all(
        allReviews.map(r => getUserVote(r.id, currentUser.uid).then(v => ({ id: r.id, vote: v })))
      );
      userVotes = {};
      results.forEach(({ id, vote }) => { userVotes[id] = vote; });
    }
  } catch (e) {
    console.error(e);
  }

  // Mettre à jour le titre de la page
  if (toolMeta.name) {
    document.title = `Avis ${toolMeta.name} — Albexia`;
    const bcEl = document.getElementById('bc-tool-name');
    if (bcEl) bcEl.textContent = toolMeta.name;
  }

  applyFilterSort();
  renderAll();
}

// ── Filtre + Tri ──────────────────────────────
function applyFilterSort() {
  let list = [...allReviews];

  if (activeFilter === 'positive') list = list.filter(r => r.rating >= 4);
  else if (activeFilter === 'negative') list = list.filter(r => r.rating <= 2);
  else if (['5','4','3','2','1'].includes(activeFilter))
    list = list.filter(r => r.rating === parseInt(activeFilter));

  if (activeSort === 'recent') {
    list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
  } else if (activeSort === 'oldest') {
    list.sort((a, b) => (a.updatedAt?.seconds || 0) - (b.updatedAt?.seconds || 0));
  } else if (activeSort === 'useful') {
    list.sort((a, b) => {
      const sA = (a.helpful_yes || 0) - (a.helpful_no || 0);
      const sB = (b.helpful_yes || 0) - (b.helpful_no || 0);
      return sB - sA;
    });
  }

  filtered = list;
}

// ── Rendu ─────────────────────────────────────
function renderAll() {
  renderHeader();
  renderSummary();
  renderControls();
  renderList();
}

function renderHeader() {
  const el = document.getElementById('avo-header');
  const backUrl = toolMeta.page || `../../tools/${TOOL_SLUG}.html`;
  el.innerHTML = `
    <div class="avo-header-inner">
      <a class="avo-back" href="${backUrl}">← Retour à la fiche</a>
      <div class="avo-tool-info">
        ${toolMeta.favicon
          ? `<img src="${toolMeta.favicon}" alt="${esc(toolMeta.name)}" class="avo-tool-logo">`
          : `<div class="avo-tool-logo-placeholder">${(toolMeta.name || TOOL_SLUG).charAt(0).toUpperCase()}</div>`
        }
        <div>
          <div class="avo-tool-name">${esc(toolMeta.name || TOOL_SLUG)}</div>
          <div class="avo-tool-sub">Avis utilisateurs</div>
        </div>
      </div>
    </div>`;
}

function renderSummary() {
  const el = document.getElementById('avo-summary');
  if (!allReviews.length) { el.innerHTML = ''; return; }

  const counts = {1:0,2:0,3:0,4:0,5:0};
  allReviews.forEach(r => { if (counts[r.rating] !== undefined) counts[r.rating]++; });
  const total = allReviews.length;
  const avg   = (allReviews.reduce((s, r) => s + r.rating, 0) / total).toFixed(1);
  const full  = Math.round(parseFloat(avg));

  const starsHtml = [1,2,3,4,5].map(i =>
    `<span class="${i <= full ? 'on' : 'off'}">★</span>`
  ).join('');

  const bars = [5,4,3,2,1].map(n => {
    const count = counts[n];
    const pct   = Math.round((count / total) * 100);
    return `
      <button class="rv-dist-row ${activeFilter === String(n) ? 'active' : ''}"
              data-filter="${n}">
        <span class="rv-dist-label">${n}★</span>
        <div class="rv-dist-bar-bg">
          <div class="rv-dist-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="rv-dist-count">${count}</span>
      </button>`;
  }).join('');

  el.innerHTML = `
    <div class="rv-summary">
      <div class="rv-summary-left">
        <div class="rv-avg-score">${avg}</div>
        <div class="rv-avg-stars">${starsHtml}</div>
        <div class="rv-avg-count">${total} avis</div>
      </div>
      <div class="rv-dist-bars">${bars}</div>
    </div>`;

  el.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = activeFilter === btn.dataset.filter ? 'all' : btn.dataset.filter;
      visibleCount = PAGE_SIZE;
      applyFilterSort();
      renderSummary();
      renderControls();
      renderList();
    });
  });
}

function renderControls() {
  const el = document.getElementById('avo-controls');
  if (!allReviews.length) { el.innerHTML = ''; return; }

  const filters = [
    { key: 'all',      label: 'Tous' },
    { key: 'positive', label: '👍 Positifs' },
    { key: 'negative', label: '👎 Négatifs' },
  ];
  const sorts = [
    { key: 'recent', label: 'Plus récents' },
    { key: 'oldest', label: 'Plus anciens' },
    { key: 'useful', label: 'Plus utiles'  },
  ];

  el.innerHTML = `
    <div class="rv-controls">
      <div class="rv-filter-group">
        ${filters.map(f =>
          `<button class="rv-ctrl-btn ${activeFilter === f.key ? 'active' : ''}"
                   data-filter="${f.key}">${f.label}</button>`
        ).join('')}
      </div>
      <div class="rv-sort-group">
        ${sorts.map(s =>
          `<button class="rv-sort-btn ${activeSort === s.key ? 'active' : ''}"
                   data-sort="${s.key}">${s.label}</button>`
        ).join('')}
      </div>
    </div>`;

  el.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeFilter = btn.dataset.filter;
      visibleCount = PAGE_SIZE;
      applyFilterSort();
      renderSummary();
      renderControls();
      renderList();
    });
  });

  el.querySelectorAll('[data-sort]').forEach(btn => {
    btn.addEventListener('click', () => {
      activeSort = btn.dataset.sort;
      visibleCount = PAGE_SIZE;
      applyFilterSort();
      renderControls();
      renderList();
    });
  });
}

function renderList() {
  const el      = document.getElementById('avo-list');
  const visible = filtered.slice(0, visibleCount);
  const remaining = filtered.length - visibleCount;

  if (!filtered.length) {
    el.innerHTML = `<div class="rv-empty">${
      allReviews.length ? 'Aucun avis pour ce filtre.' : 'Aucun avis pour le moment.'
    }</div>`;
    return;
  }

  const cards = visible.map(r => buildCardHTML(r)).join('');

  const loadMoreBtn = remaining > 0 ? `
    <div class="rv-load-more-wrap">
      <button class="rv-load-more" id="avo-load-more">
        Voir ${Math.min(remaining, PAGE_SIZE)} avis de plus
        <span class="rv-load-more-count">(${remaining} restants)</span>
      </button>
    </div>` : '';

  el.innerHTML = `<div class="rv-list">${cards}</div>${loadMoreBtn}`;

  // Events votes + signaler + load more
  el.querySelectorAll('.rv-vote-btn').forEach(btn => {
    btn.addEventListener('click', () => handleVote(btn));
  });
  el.querySelectorAll('.rv-report-btn').forEach(btn => {
    btn.addEventListener('click', () => handleReport(btn));
  });
  document.getElementById('avo-load-more')?.addEventListener('click', () => {
    visibleCount += PAGE_SIZE;
    renderList();
  });
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

// ── Handlers vote / signaler ──────────────────
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
    applyFilterSort();
    renderList();
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
let _timer = null;
function rvToast(msg) {
  let el = document.getElementById('rv-toast');
  if (!el) { el = document.createElement('div'); el.id = 'rv-toast'; el.className = 'rv-toast'; document.body.appendChild(el); }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_timer);
  _timer = setTimeout(() => el.classList.remove('show'), 2500);
}

function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

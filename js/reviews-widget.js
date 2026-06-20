/* ═══════════════════════════════════════
   Albexia — reviews-widget.js
   Widget d'avis pour les fiches outils statiques.

   UTILISATION dans une fiche (ex: canva.html) :
   Ajouter avant </body> :

   <div id="reviews-section"></div>
   <script type="module" src="../../js/reviews-widget.js"></script>

   Le script détecte automatiquement le slug
   depuis window.location.pathname.
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
} from '../../js/reviews.js';

// ── Config ───────────────────────────────────
const TOOL_SLUG = getToolSlugFromPath(window.location.pathname);
const TOOL_NAME = document.querySelector('h1.tool-hero-title')?.textContent?.trim()
               || document.title.split('—')[0].trim();
const TOOL_FAVICON = document.querySelector('.tool-logo-img')?.src || '';
const TOOL_EMOJI   = '🤖';
const TOOL_PAGE    = window.location.pathname;

let currentUser = null;
let userReview  = null;
let allReviews  = [];

// ── Init ─────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  await refreshWidget();
  // Mettre à jour les étoiles dans le hero
  await refreshHeroStars();
});

// ── Étoiles hero ─────────────────────────────
async function refreshHeroStars() {
  const summary = await getRatingSummary(TOOL_SLUG);
  if (!summary.ratingCount) return;

  const starsEl = document.querySelector('.tool-hero-stars');
  if (!starsEl) return;

  const avg = summary.ratingAverage.toFixed(1);
  const full = Math.round(summary.ratingAverage);

  const starsHtml = [1,2,3,4,5].map(i =>
    `<span class="star ${i <= full ? 'on' : ''}">★</span>`
  ).join('');

  starsEl.innerHTML = `
    ${starsHtml}
    <span class="star-label">${avg}/5 · ${summary.ratingCount} avis utilisateur${summary.ratingCount > 1 ? 's' : ''}</span>`;
}

// ── Widget principal ─────────────────────────
async function refreshWidget() {
  const container = document.getElementById('reviews-section');
  if (!container) return;

  container.innerHTML = '<div class="rv-loading">Chargement des avis…</div>';

  try {
    [allReviews, userReview] = await Promise.all([
      getToolReviews(TOOL_SLUG),
      currentUser ? getUserReview(currentUser.uid, TOOL_SLUG) : Promise.resolve(null),
    ]);
  } catch (err) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = buildWidgetHTML();
  attachEvents();
}

// ── HTML du widget ────────────────────────────
function buildWidgetHTML() {
  const totalReviews = allReviews.length;

  return `
  <section class="rv-section" id="avis-utilisateurs">
    <h2 class="rv-title">Avis utilisateurs
      ${totalReviews ? `<span class="rv-count">${totalReviews}</span>` : ''}
    </h2>

    ${buildFormHTML()}
    ${buildListHTML()}
  </section>

  <style>
    /* ── Reviews Widget ── */
    .rv-section {
      margin: 48px 0;
    }
    .rv-title {
      font-size: 1.3rem;
      font-weight: 700;
      margin-bottom: 24px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .rv-count {
      background: rgba(108,99,255,0.15);
      color: #a8a3ff;
      border-radius: 20px;
      padding: 2px 10px;
      font-size: .8rem;
      font-weight: 600;
    }
    .rv-loading {
      color: #8888aa;
      font-size: .9rem;
      padding: 24px 0;
    }

    /* ── Formulaire ── */
    .rv-form-card {
      background: #13131f;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 24px;
      margin-bottom: 32px;
    }
    .rv-form-title {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 16px;
    }
    .rv-stars-input {
      display: flex;
      gap: 6px;
      margin-bottom: 16px;
    }
    .rv-star-btn {
      font-size: 1.6rem;
      background: none;
      border: none;
      cursor: pointer;
      color: rgba(255,255,255,0.2);
      transition: color .15s, transform .1s;
      line-height: 1;
      padding: 0;
    }
    .rv-star-btn.on  { color: #f5a623; }
    .rv-star-btn:hover { transform: scale(1.15); }
    .rv-textarea {
      width: 100%;
      min-height: 100px;
      background: #1a1a2e;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 10px;
      color: #f0f0f5;
      font-family: 'Inter', sans-serif;
      font-size: .9rem;
      padding: 12px 14px;
      resize: vertical;
      outline: none;
      transition: border-color .2s;
      margin-bottom: 12px;
      box-sizing: border-box;
    }
    .rv-textarea:focus { border-color: #6c63ff; }
    .rv-char-count {
      text-align: right;
      font-size: .75rem;
      color: #8888aa;
      margin-bottom: 12px;
      margin-top: -8px;
    }
    .rv-form-footer {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .rv-submit-btn {
      padding: 10px 20px;
      background: #6c63ff;
      border: none;
      border-radius: 10px;
      color: #fff;
      font-size: .875rem;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      transition: opacity .2s;
    }
    .rv-submit-btn:hover    { opacity: .85; }
    .rv-submit-btn:disabled { opacity: .45; cursor: not-allowed; }
    .rv-delete-btn {
      padding: 10px 16px;
      background: rgba(255,71,87,0.1);
      border: 1px solid rgba(255,71,87,0.25);
      border-radius: 10px;
      color: #ff6b78;
      font-size: .875rem;
      font-weight: 500;
      cursor: pointer;
      font-family: inherit;
      transition: opacity .2s;
    }
    .rv-delete-btn:hover { opacity: .8; }
    .rv-error {
      color: #ff6b78;
      font-size: .85rem;
      display: none;
    }
    .rv-login-prompt {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      background: rgba(108,99,255,0.08);
      border: 1px solid rgba(108,99,255,0.2);
      border-radius: 12px;
      font-size: .9rem;
      color: #a8a3ff;
      margin-bottom: 32px;
    }
    .rv-login-link {
      color: #6c63ff;
      font-weight: 600;
      text-decoration: none;
    }
    .rv-login-link:hover { text-decoration: underline; }

    /* ── Liste des avis ── */
    .rv-list { display: flex; flex-direction: column; gap: 16px; }
    .rv-empty {
      text-align: center;
      padding: 32px 20px;
      color: #8888aa;
      font-size: .9rem;
    }
    .rv-card {
      background: #13131f;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 12px;
      padding: 18px 20px;
      transition: border-color .2s;
    }
    .rv-card:hover { border-color: rgba(108,99,255,0.25); }
    .rv-card-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .rv-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: #6c63ff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: .85rem;
      font-weight: 700;
      color: #fff;
      flex-shrink: 0;
      overflow: hidden;
    }
    .rv-avatar img { width: 100%; height: 100%; object-fit: cover; }
    .rv-meta { flex: 1; min-width: 0; }
    .rv-author {
      font-size: .875rem;
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .rv-date {
      font-size: .75rem;
      color: #8888aa;
    }
    .rv-stars-display {
      color: #f5a623;
      font-size: .95rem;
      letter-spacing: 1px;
    }
    .rv-stars-display .off { color: rgba(255,255,255,0.15); }
    .rv-comment {
      font-size: .875rem;
      line-height: 1.6;
      color: #c0c0d8;
    }
    .rv-card-foot {
      display: flex;
      justify-content: flex-end;
      margin-top: 10px;
    }
    .rv-report-btn {
      background: none;
      border: none;
      color: #8888aa;
      font-size: .75rem;
      cursor: pointer;
      padding: 4px 8px;
      border-radius: 6px;
      font-family: inherit;
      transition: color .15s, background .15s;
    }
    .rv-report-btn:hover { color: #ff6b78; background: rgba(255,71,87,0.08); }
    .rv-report-btn:disabled { opacity: .4; cursor: not-allowed; }

    /* ── Toast local ── */
    .rv-toast {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(20px);
      background: #1e1e2e;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 24px;
      padding: 10px 20px;
      font-size: .875rem;
      color: #f0f0f5;
      opacity: 0;
      transition: all .25s;
      z-index: 999;
      white-space: nowrap;
      pointer-events: none;
    }
    .rv-toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }
  </style>

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

function buildListHTML() {
  if (!allReviews.length) {
    return `<div class="rv-empty">Aucun avis pour le moment. Soyez le premier !</div>`;
  }

  const items = allReviews.map(r => {
    const initial = (r.displayName || '?').charAt(0).toUpperCase();
    const avatar  = r.avatarUrl
      ? `<img src="${r.avatarUrl}" alt="${r.displayName}" onerror="this.parentElement.textContent='${initial}'">`
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
    const reportBtn = !isOwn
      ? `<button class="rv-report-btn" data-review-id="${r.id}" onclick="rvReportReview('${r.id}', this)">⚑ Signaler</button>`
      : '';

    return `
      <div class="rv-card">
        <div class="rv-card-head">
          <div class="rv-avatar">${avatar}</div>
          <div class="rv-meta">
            <div class="rv-author">${esc(r.displayName)}</div>
            <div class="rv-date">${date}</div>
          </div>
          <div class="rv-stars-display">${stars}</div>
        </div>
        ${r.comment ? `<p class="rv-comment">${esc(r.comment)}</p>` : ''}
        <div class="rv-card-foot">${reportBtn}</div>
      </div>`;
  }).join('');

  return `<div class="rv-list">${items}</div>`;
}

// ── Events ───────────────────────────────────
function attachEvents() {
  // Étoiles interactives
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

  // Compteur de caractères
  const textarea = document.getElementById('rv-comment');
  const charCount = document.getElementById('rv-char-count');
  if (textarea && charCount) {
    textarea.addEventListener('input', () => {
      charCount.textContent = textarea.value.length;
    });
  }

  // Soumettre
  const submitBtn = document.getElementById('rv-submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', handleSubmit);
  }

  // Supprimer
  const deleteBtn = document.getElementById('rv-delete-btn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', handleDelete);
  }
}

async function handleSubmit() {
  const errorEl  = document.getElementById('rv-error');
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
      currentUser.uid,
      TOOL_SLUG,
      { name: TOOL_NAME, favicon: TOOL_FAVICON, emoji: TOOL_EMOJI, page: TOOL_PAGE },
      rating,
      comment,
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
    console.error(err);
    submitBtn.disabled    = false;
    submitBtn.textContent = 'Publier mon avis';
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
  } catch (err) {
    rvToast('⚠ Erreur lors de la suppression.');
    console.error(err);
  }
}

// Exposé globalement pour les boutons inline
window.rvReportReview = async function(reviewId, btn) {
  if (!currentUser) {
    rvToast('Connectez-vous pour signaler un avis.');
    return;
  }
  if (!confirm('Signaler cet avis comme inapproprié ?')) return;
  btn.disabled = true;
  try {
    await reportReview(reviewId, currentUser.uid, 'Contenu inapproprié');
    btn.textContent = '✓ Signalé';
    rvToast('Avis signalé. Merci.');
  } catch {
    btn.disabled = false;
    rvToast('⚠ Erreur lors du signalement.');
  }
};

// ── Toast local ──────────────────────────────
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

// ── Helper ───────────────────────────────────
function esc(str) {
  return (str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* ═══════════════════════════════════════
   Albexia — collections-picker.js
   Remplace le bouton ♥ favori par un
   sélecteur de collection Firebase.
   À inclure après app.js dans index.html.
   ═══════════════════════════════════════ */

import { watchAuthState } from './auth.js';
import {
  getCollections, createCollection, addToolToCollection,
  saveQuizSession
} from './firestore.js';

// ─── STATE LOCAL ─────────────────────────────────
let _currentUser  = null;
let _collections  = [];
let _activePicker = null;  // id de la carte dont le picker est ouvert

// ─── OBSERVER AUTH ───────────────────────────────
watchAuthState(async (user) => {
  _currentUser = user;
  // Expose l'utilisateur courant à app.js (non-module)
  window._firebaseUser = user;
  if (user) {
    _collections = await getCollections(user.uid);
  } else {
    _collections = [];
  }
  // Rerender les cartes pour mettre à jour les boutons
  if (typeof renderTools === 'function') renderTools();
});

// ─── SAVE QUIZ → FIREBASE (appelé par app.js) ────
window._saveQuizToFirebase = async function(uid, answers, results) {
  try {
    await saveQuizSession(uid, answers, results);
  } catch (e) {
    console.warn('Quiz non sauvegardé:', e);
  }
};

// ─── PATCH buildToolCard ─────────────────────────
// On surcharge la fonction globale définie dans app.js
const _originalBuildToolCard = window.buildToolCard;

window.buildToolCard = function(t) {
  // Si non connecté → comportement original (bouton ♥ localStorage)
  if (!_currentUser) return _originalBuildToolCard(t);

  const priceLabel = { free: 'Gratuit', freemium: 'Freemium', paid: 'Payant' };
  const catColors  = window.catColors || {};
  const col        = catColors[t.category] || { bg: 'rgba(255,255,255,0.08)' };

  const inAnyCollection = _collections.some(c =>
    (c.tools || []).some(tool => String(tool.id) === String(t.id))
  );

  const plan     = t.plan || (t.page ? 'gratuit' : null);
  let cardClass  = 'tool-card';
  let planBadge  = '';

  if (plan === 'featured') cardClass = 'tool-card tool-card-featured tool-card-plan-featured';
  else if (plan === 'starter') cardClass = 'tool-card tool-card-featured tool-card-plan-starter';
  else if (plan === 'gratuit') cardClass = 'tool-card tool-card-plan-gratuit';

  if (t.page) planBadge = `<span class="tool-plan-badge tool-plan-badge-gratuit">Guide complet →</span>`;

  const cardAction = t.page
    ? `onclick="window.location.href='${t.page}'"`
    : `onclick="window.open('${t.url}','_blank')"`;

  const iconHtml = t.favicon
    ? `<img src="${t.favicon}" alt="${t.name}" class="tool-favicon"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           onload="this.nextElementSibling.style.display='none'">
       <span class="tool-ico-fallback" style="display:none">${t.emoji}</span>`
    : `<span class="tool-ico-fallback">${t.emoji}</span>`;

  return `
    <article class="${cardClass}" ${cardAction}>
      <div class="tool-head">
        <div class="tool-ico" style="background:${col.bg}">${iconHtml}</div>
        <div style="flex:1">
          <div class="tool-name">${t.name}</div>
          <div class="tool-cat">${t.category}</div>
        </div>
        <button class="fav-btn ${inAnyCollection ? 'active' : ''}"
          onclick="openCollectionPicker(event, ${JSON.stringify(t).replace(/"/g, '&quot;')})"
          title="${inAnyCollection ? 'Dans une collection' : 'Ajouter à une collection'}">
          ${inAnyCollection ? '♥' : '♡'}
        </button>
      </div>
      <p class="tool-desc">${t.description}</p>
      <div class="tool-foot">
        <span class="price-tag price-${t.price}">${priceLabel[t.price]}</span>
        <span class="stars">${renderStars(t.rating)}</span>
      </div>
      ${planBadge}
    </article>`;
};

// ─── OUVRIR LE PICKER ────────────────────────────
window.openCollectionPicker = function(event, tool) {
  event.stopPropagation();

  // Fermer tout picker déjà ouvert
  closeAllPickers();

  const btn    = event.currentTarget;
  const toolId = String(tool.id);
  _activePicker = toolId;

  // Construire le dropdown
  const dropdown = document.createElement('div');
  dropdown.id = 'col-picker';
  dropdown.style.cssText = `
    position: absolute;
    z-index: 300;
    background: #13131f;
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 12px;
    padding: 8px;
    min-width: 220px;
    box-shadow: 0 8px 32px rgba(0,0,0,.5);
    font-family: 'Inter', sans-serif;
  `;

  // Positionner le picker
  const rect = btn.getBoundingClientRect();
  dropdown.style.top  = (rect.bottom + window.scrollY + 6) + 'px';
  dropdown.style.left = Math.max(8, rect.left + window.scrollX - 160) + 'px';

  // Header
  dropdown.innerHTML = `
    <div style="font-size:.78rem;color:#8888aa;padding:4px 8px 8px;border-bottom:1px solid rgba(255,255,255,0.06);margin-bottom:6px">
      📁 Ajouter à une collection
    </div>`;

  // Collections existantes
  if (_collections.length === 0) {
    dropdown.innerHTML += `<div style="padding:8px;font-size:.85rem;color:#8888aa">Aucune collection.</div>`;
  } else {
    _collections.forEach(col => {
      const inCol  = (col.tools || []).some(t => String(t.id) === toolId);
      const item   = document.createElement('button');
      item.style.cssText = `
        display:flex;align-items:center;gap:8px;width:100%;
        padding:9px 10px;background:${inCol ? 'rgba(108,99,255,0.15)' : 'transparent'};
        border:none;border-radius:8px;color:${inCol ? '#a8a3ff' : '#f0f0f5'};
        font-size:.875rem;cursor:pointer;font-family:inherit;text-align:left;
        transition:background .15s;
      `;
      item.innerHTML = `
        <span>${inCol ? '✅' : '📁'}</span>
        <span style="flex:1">${col.name}</span>
        <span style="font-size:.75rem;color:#8888aa">${col.tools?.length || 0}</span>`;
      item.onmouseenter = () => { if (!inCol) item.style.background = 'rgba(255,255,255,0.06)'; };
      item.onmouseleave = () => { if (!inCol) item.style.background = 'transparent'; };
      item.onclick = async (e) => {
        e.stopPropagation();
        if (!inCol) {
          await addToolToCollection(_currentUser.uid, col.id, tool);
          _collections = await getCollections(_currentUser.uid);
          if (typeof renderTools === 'function') renderTools();
          showPickerToast(`✅ Ajouté à "${col.name}" !`);
        }
        closeAllPickers();
      };
      dropdown.appendChild(item);
    });
  }

  // Séparateur + créer une nouvelle
  const sep = document.createElement('div');
  sep.style.cssText = 'border-top:1px solid rgba(255,255,255,0.06);margin:6px 0';
  dropdown.appendChild(sep);

  const newBtn = document.createElement('button');
  newBtn.style.cssText = `
    display:flex;align-items:center;gap:8px;width:100%;
    padding:9px 10px;background:transparent;border:none;border-radius:8px;
    color:#6c63ff;font-size:.875rem;font-weight:600;cursor:pointer;
    font-family:inherit;transition:background .15s;
  `;
  newBtn.innerHTML = '<span>＋</span> Nouvelle collection';
  newBtn.onmouseenter = () => { newBtn.style.background = 'rgba(108,99,255,0.1)'; };
  newBtn.onmouseleave = () => { newBtn.style.background = 'transparent'; };
  newBtn.onclick = async (e) => {
    e.stopPropagation();
    closeAllPickers();
    const name = prompt('Nom de la nouvelle collection :');
    if (!name?.trim()) return;
    const colId = await createCollection(_currentUser.uid, name.trim());
    await addToolToCollection(_currentUser.uid, colId, tool);
    _collections = await getCollections(_currentUser.uid);
    if (typeof renderTools === 'function') renderTools();
    showPickerToast(`✅ Collection "${name.trim()}" créée !`);
  };
  dropdown.appendChild(newBtn);

  document.body.appendChild(dropdown);

  // Fermer en cliquant ailleurs
  setTimeout(() => {
    document.addEventListener('click', closeAllPickers, { once: true });
  }, 0);
};

function closeAllPickers() {
  document.getElementById('col-picker')?.remove();
  _activePicker = null;
}

// Toast léger pour le picker (réutilise le toast existant si disponible)
function showPickerToast(msg) {
  if (typeof window.showToast === 'function') {
    window.showToast(msg);
  } else {
    // Fallback toast minimal
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.style.cssText = `
        position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);
        background:#1e1e2e;border:1px solid rgba(255,255,255,.1);border-radius:24px;
        padding:10px 20px;font-size:.875rem;color:#f0f0f5;opacity:0;
        transition:all .25s;z-index:999;white-space:nowrap;font-family:Inter,sans-serif;
      `;
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(t._timer);
    t._timer = setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(20px)';
    }, 2500);
  }
}

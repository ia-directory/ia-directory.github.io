#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   migrate-videotheque.js — Migration usage unique
   data/tutoriels.json → Firestore outils/{id}.videotheque[]

   ── Pourquoi deux passes ──
   Les id de tutoriels.json ("chatgpt", "midjourney"...) ne
   correspondent PAS forcément aux id des docs Firestore
   "outils". Un mapping automatique par nom/domaine est donc
   proposé, mais DOIT être relu par un humain avant application
   — d'où les deux modes ci-dessous.

   ── Usage ──
   1) node migrate-videotheque.js
      → Dry-run. Ne touche PAS Firestore. Lit data/tutoriels.json,
        propose un mapping vers les docs "outils" existants,
        écrit migration-mapping.json (à committer et relire).

   2) Ouvrir migration-mapping.json, corriger à la main les entrées
      "firestoreId": null (ou une correspondance jugée fausse) en y
      mettant le bon id de document Firestore. Les ids Firestore
      sont visibles dans l'onglet 🛠 Outils de l'admin (recherche du
      nom → l'URL affichée dans le formulaire d'édition, ou export
      Firestore console).

   3) node migrate-videotheque.js --apply
      → Lit le migration-mapping.json relu/corrigé, écrit le champ
        videotheque[] sur chaque doc Firestore mappé. N'écrase
        aucun autre champ (update ciblé, pas de set global).

   Après l'étape 3 : relancer gen-fiches.js pour générer les pages
   vidéothèque, vérifier le résultat, PUIS supprimer tutoriels.json,
   tutoriels.html, tutoriel-outil.html, tutoriels.js, tutoriel-outil.js
   et ce script lui-même (usage unique).
   ═══════════════════════════════════════════════════════ */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const fs   = require('fs');
const path = require('path');

const TUTORIELS_JSON_PATH = path.join('data', 'tutoriels.json');
const MAPPING_PATH        = 'migration-mapping.json';
const APPLY_MODE          = process.argv.includes('--apply');

// ── Init Firebase Admin (même pattern que gen-fiches.js) ──
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Normalisation pour le matching ──────────────────────
function normaliser(s) {
  return (s || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ''); // espaces, tirets, ponctuation
}

function normaliserDomaine(url) {
  if (!url) return '';
  return url
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split('/')[0]
    .toLowerCase();
}

// ── Proposition de mapping automatique ──────────────────
// Retourne { firestoreId, confiance, raison } — firestoreId peut être null
// si aucune correspondance fiable n'est trouvée (mapping laissé à l'humain).
function proposerMatch(outilJson, docsFirestore) {
  const nomNorm = normaliser(outilJson.nom);
  const domaineJson = normaliserDomaine(outilJson.lien);

  // 1) Nom exact normalisé (le plus fiable)
  let candidat = docsFirestore.find(d => normaliser(d.name) === nomNorm);
  if (candidat) return { firestoreId: candidat.id, confiance: 'haute', raison: 'nom identique' };

  // 2) Domaine identique (fiable si le lien est propre des deux côtés)
  candidat = docsFirestore.find(d => normaliserDomaine(d.url) === domaineJson && domaineJson);
  if (candidat) return { firestoreId: candidat.id, confiance: 'haute', raison: 'domaine identique' };

  // 3) Nom Firestore inclus dans le nom JSON ou l'inverse (ex: "Runway" / "Runway ML")
  candidat = docsFirestore.find(d => {
    const dn = normaliser(d.name);
    return dn && (nomNorm.includes(dn) || dn.includes(nomNorm));
  });
  if (candidat) return { firestoreId: candidat.id, confiance: 'moyenne', raison: 'nom partiellement inclus — À VÉRIFIER' };

  return { firestoreId: null, confiance: 'aucune', raison: 'aucune correspondance automatique — à mapper à la main' };
}

// ── Conversion vidéo JSON → format Firestore ────────────
function convertirVideo(v) {
  return {
    youtube_id: v.youtubeId || v.youtube_id || '',
    titre:      v.titre || '',
    duree:      v.duree || '',
    canal:      v.canal || '',
  };
}

// ════════════════════════════════════════════════════════
// PASSE 1 — DRY RUN : proposer le mapping
// ════════════════════════════════════════════════════════
async function dryRun() {
  if (!fs.existsSync(TUTORIELS_JSON_PATH)) {
    console.error(`❌ Introuvable : ${TUTORIELS_JSON_PATH}`);
    process.exit(1);
  }
  const tutorielsData = JSON.parse(fs.readFileSync(TUTORIELS_JSON_PATH, 'utf8'));
  const outilsJson = tutorielsData.outils || [];

  console.log(`📥 Lecture de Firestore (outils)...`);
  const snap = await db.collection('outils').get();
  const docsFirestore = snap.docs.map(d => d.data());
  console.log(`✓ ${docsFirestore.length} documents Firestore, ${outilsJson.length} outils dans tutoriels.json\n`);

  const mapping = outilsJson.map(o => {
    const proposition = proposerMatch(o, docsFirestore);
    return {
      jsonId: o.id,
      nom: o.nom,
      lien: o.lien,
      nbVideos: (o.videos || []).length,
      firestoreId: proposition.firestoreId,
      confiance: proposition.confiance,
      raison: proposition.raison,
    };
  });

  fs.writeFileSync(MAPPING_PATH, JSON.stringify(mapping, null, 2), 'utf8');

  const ok = mapping.filter(m => m.confiance === 'haute').length;
  const aVerifier = mapping.filter(m => m.confiance === 'moyenne').length;
  const manquant = mapping.filter(m => m.confiance === 'aucune').length;

  console.log(`✅ Mapping proposé écrit dans ${MAPPING_PATH}\n`);
  console.log(`   ${ok} correspondance(s) fiable(s) (nom ou domaine identique)`);
  console.log(`   ${aVerifier} à vérifier (correspondance partielle)`);
  console.log(`   ${manquant} sans correspondance (à mapper à la main)\n`);
  console.log(`👉 Prochaine étape : ouvrir ${MAPPING_PATH}, corriger les "firestoreId": null`);
  console.log(`   et les entrées "confiance": "moyenne" douteuses, committer le fichier,`);
  console.log(`   puis relancer avec --apply.`);
}

// ════════════════════════════════════════════════════════
// PASSE 2 — APPLY : écrire videotheque[] sur Firestore
// ════════════════════════════════════════════════════════
async function apply() {
  if (!fs.existsSync(MAPPING_PATH)) {
    console.error(`❌ Introuvable : ${MAPPING_PATH}. Lance d'abord sans --apply pour le générer.`);
    process.exit(1);
  }
  if (!fs.existsSync(TUTORIELS_JSON_PATH)) {
    console.error(`❌ Introuvable : ${TUTORIELS_JSON_PATH}`);
    process.exit(1);
  }

  const mapping = JSON.parse(fs.readFileSync(MAPPING_PATH, 'utf8'));
  const tutorielsData = JSON.parse(fs.readFileSync(TUTORIELS_JSON_PATH, 'utf8'));
  const outilsJson = tutorielsData.outils || [];

  let ecrits = 0, ignores = 0;

  for (const entry of mapping) {
    if (!entry.firestoreId) {
      console.log(`⏭️  Ignoré (pas de firestoreId) : ${entry.nom} (${entry.jsonId})`);
      ignores++;
      continue;
    }

    const outilJson = outilsJson.find(o => o.id === entry.jsonId);
    if (!outilJson) { ignores++; continue; }

    const videotheque = (outilJson.videos || []).map(convertirVideo).filter(v => v.youtube_id && v.titre);
    if (!videotheque.length) { ignores++; continue; }

    const ref = db.collection('outils').doc(String(entry.firestoreId));
    const docSnap = await ref.get();
    if (!docSnap.exists) {
      console.log(`⚠️  Doc Firestore introuvable pour "${entry.nom}" (id: ${entry.firestoreId}) — vérifie le mapping.`);
      ignores++;
      continue;
    }

    await ref.update({ videotheque });
    console.log(`✅ ${entry.nom} → outils/${entry.firestoreId} (${videotheque.length} vidéos)`);
    ecrits++;
  }

  console.log(`\n✓ Terminé : ${ecrits} outil(s) mis à jour, ${ignores} ignoré(s).`);
  console.log(`👉 Relance maintenant gen-fiches.js pour générer les pages vidéothèque.`);
  console.log(`👉 Une fois vérifié, supprime tutoriels.json, tutoriels.html, tutoriel-outil.html,`);
  console.log(`   tutoriels.js, tutoriel-outil.js et ce script (usage unique).`);
}

(APPLY_MODE ? apply() : dryRun()).catch(err => {
  console.error('❌ Erreur:', err);
  process.exit(1);
});

#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   reset-catalogue.js — Vide les collections outils/niches et
   réamorce la collection categories avec la liste officielle.

   Usage :
     FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json node reset-catalogue.js --confirm

   Sans --confirm, le script affiche uniquement ce qu'il SUPPRIMERAIT
   (mode simulation) sans rien toucher — pour vérifier avant de lancer
   pour de vrai.

   Ce script supprime intégralement :
     - collection "outils"  (tous les outils, toutes langues)
     - collection "niches"  (toutes les micro-niches)
   Il NE touche PAS "comparaisons" — si des comparaisons référencent
   des outils qui viennent d'être supprimés, elles retomberont sur
   leur fallback manuel (nom/lien de secours) plutôt que de casser,
   mais tu voudras probablement les revoir manuellement après coup.

   Puis il réamorce "categories" avec la liste officielle fournie —
   sans dupliquer si une catégorie du même nom existe déjà.
   ═══════════════════════════════════════════════════════ */

const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const CONFIRM = process.argv.includes('--confirm');

let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
  serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_PATH, 'utf8'));
} else if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  console.error('❌ Ni FIREBASE_SERVICE_ACCOUNT_PATH ni FIREBASE_SERVICE_ACCOUNT ne sont définis.');
  process.exit(1);
}
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const slugify = (str) => (str || '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

// Liste officielle fournie — modifie ce tableau si tu veux ajuster avant de lancer.
const CATEGORIES_OFFICIELLES = [
  'Juridique', 'Productivité', 'Recherche', 'Audio', 'Texte', 'Marketing',
  'SEO', 'Contenu', 'Données', 'Automatisation', 'Traduction', 'Code',
  'Développement', 'Design', 'Design 3D', 'Vidéo', 'Musique', 'Éducation',
  'Santé', 'E-commerce', 'Vente', 'CRM', 'Email', 'Présentation',
  'Service Client', 'Web', 'Écriture créative',
];

async function viderCollection(nomCollection) {
  const snap = await db.collection(nomCollection).get();
  console.log(`\n📦 Collection "${nomCollection}" : ${snap.size} document(s) trouvé(s).`);

  if (!snap.size) return 0;

  if (!CONFIRM) {
    console.log(`   [SIMULATION] Aurait supprimé ${snap.size} document(s). Exemples :`);
    snap.docs.slice(0, 5).forEach(d => console.log(`     - ${d.id}`));
    if (snap.size > 5) console.log(`     ... et ${snap.size - 5} autre(s).`);
    return snap.size;
  }

  // Suppression par lots de 500 (limite Firestore par batch).
  let supprimes = 0;
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 500) {
    const batch = db.batch();
    docs.slice(i, i + 500).forEach(d => batch.delete(d.ref));
    await batch.commit();
    supprimes += Math.min(500, docs.length - i);
    console.log(`   → ${supprimes}/${docs.length} supprimé(s)...`);
  }
  return supprimes;
}

async function seedCategories() {
  const snap = await db.collection('categories').get();
  const existantes = new Set(snap.docs.map(d => (d.data().nom || '').toLowerCase()));

  const aCreer = CATEGORIES_OFFICIELLES.filter(nom => !existantes.has(nom.toLowerCase()));

  console.log(`\n📁 Catégories déjà présentes : ${existantes.size}. À créer : ${aCreer.length}.`);

  if (!aCreer.length) {
    console.log('   Rien à faire — toutes les catégories officielles existent déjà.');
    return 0;
  }

  if (!CONFIRM) {
    console.log(`   [SIMULATION] Créerait : ${aCreer.join(', ')}`);
    return aCreer.length;
  }

  const batch = db.batch();
  for (const nom of aCreer) {
    const id = slugify(nom);
    batch.set(db.collection('categories').doc(id), { id, nom, updatedAt: new Date() });
  }
  await batch.commit();
  console.log(`   ✓ ${aCreer.length} catégorie(s) créée(s).`);
  return aCreer.length;
}

async function main() {
  console.log(CONFIRM
    ? '⚠️  MODE RÉEL — les suppressions sont définitives et irréversibles.'
    : 'ℹ️  MODE SIMULATION — rien ne sera supprimé. Relance avec --confirm pour exécuter pour de vrai.');

  const outilsSupprimes = await viderCollection('outils');
  const nichesSupprimees = await viderCollection('niches');
  const categoriesCreees = await seedCategories();

  console.log(`\n${CONFIRM ? '✅ Terminé' : '✅ Simulation terminée'} :`);
  console.log(`   Outils ${CONFIRM ? 'supprimés' : 'à supprimer'} : ${outilsSupprimes}`);
  console.log(`   Niches ${CONFIRM ? 'supprimées' : 'à supprimer'} : ${nichesSupprimees}`);
  console.log(`   Catégories ${CONFIRM ? 'créées' : 'à créer'} : ${categoriesCreees}`);

  if (!CONFIRM) {
    console.log(`\n   Relance avec --confirm pour exécuter réellement :`);
    console.log(`   FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json node reset-catalogue.js --confirm`);
  } else {
    console.log(`\n   N'oublie pas de relancer "gen-fiches.js" pour nettoyer les pages HTML orphelines`);
    console.log(`   correspondant aux outils/niches supprimés.`);
  }
}

main().catch(err => { console.error('❌ Erreur:', err); process.exit(1); });

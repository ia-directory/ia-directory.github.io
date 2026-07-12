#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   bulk-create-niches.js — Crée en masse des documents "niches"
   dans Firestore à partir d'une liste, avec matching automatique
   des outils (même algorithme que l'admin : pertinence + plafond).

   Usage :
     FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json node bulk-create-niches.js niches-a-creer.json

   Format du fichier JSON en entrée (tableau d'objets) :
   [
     { "metier": "Avocats", "super_categorie": "Juridique",
       "mots_cles_matching": "juridique, contrat, recherche, rédaction, document" },
     { "metier": "Notaires", "super_categorie": "Juridique",
       "mots_cles_matching": "juridique, acte, contrat, immobilier" }
   ]

   Toutes les niches créées le sont en status "brouillon" — elles
   n'apparaissent jamais publiquement tant que tu ne les relis pas
   et ne les publies pas manuellement dans l'admin (ou que tu lances
   ensuite generate-niche-content.js + gen-fiches.js après relecture).

   Une niche dont le slug existe déjà (même métier déjà créé) est
   ignorée — ne écrase jamais une niche existante, pour ne pas perdre
   du contenu IA ou des ajustements manuels déjà faits.
   ═══════════════════════════════════════════════════════ */

const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

const inputFile = process.argv[2];
if (!inputFile) {
  console.error('❌ Usage : node bulk-create-niches.js chemin-vers-liste.json');
  process.exit(1);
}

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

// ── Même logique que l'admin (dédup par nom, pertinence, plafond) ──
const SEUIL_ALERTE = 6;
const MAX_RESULTATS = 40;
const MAX_PRESELECTION = 15;

function deduplicateParNom(tools) {
  const parNom = new Map();
  for (const t of tools) {
    const key = slugify(t.name);
    if (!key) continue;
    const existant = parNom.get(key);
    if (!existant) { parNom.set(key, t); continue; }
    const existantEstFr = !existant.langue || existant.langue === 'fr';
    const candidatEstFr = !t.langue || t.langue === 'fr';
    if (!existantEstFr && candidatEstFr) parNom.set(key, t);
  }
  return [...parNom.values()];
}

function rechercherOutilsParMotsCles(motsCles, tools) {
  const kws = motsCles.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
  if (!kws.length) return [];
  const toolsUniques = deduplicateParNom(tools);
  const scored = toolsUniques
    .map(t => {
      const hay = `${t.name||''} ${t.description||''} ${t.tags||''}`.toLowerCase();
      const score = kws.filter(kw => hay.includes(kw)).length;
      return { tool: t, score };
    })
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, MAX_RESULTATS).map(x => x.tool);
}

async function main() {
  const brief = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  if (!Array.isArray(brief) || !brief.length) {
    console.error('❌ Le fichier doit contenir un tableau JSON non vide.');
    process.exit(1);
  }

  console.log(`📥 Lecture de Firestore (outils, niches existantes)...`);
  const [outilsSnap, nichesSnap] = await Promise.all([
    db.collection('outils').get(),
    db.collection('niches').get(),
  ]);
  const tools = outilsSnap.docs.map(d => d.data());
  const existingSlugs = new Set(nichesSnap.docs.map(d => d.data().slug).filter(Boolean));
  console.log(`✓ ${tools.length} outil(s), ${existingSlugs.size} niche(s) déjà existante(s)\n`);

  let creees = 0, ignorees = 0, avertissements = 0;

  for (const item of brief) {
    const metier = (item.metier || '').trim();
    const categorie = (item.super_categorie || '').trim();
    const motsCles = (item.mots_cles_matching || '').trim();

    if (!metier || !categorie) {
      console.log(`✗ Entrée ignorée (métier ou super_categorie manquant) : ${JSON.stringify(item)}`);
      ignorees++;
      continue;
    }

    const slug = item.slug || `ia-pour-les-${slugify(metier)}`;
    if (existingSlugs.has(slug)) {
      console.log(`⏭️  "${metier}" (${slug}) — déjà existante, ignorée.`);
      ignorees++;
      continue;
    }

    const matches = motsCles ? rechercherOutilsParMotsCles(motsCles, tools) : [];
    const outilsSlugs = matches.slice(0, MAX_PRESELECTION).map(t => slugify(t.name));

    if (outilsSlugs.length < SEUIL_ALERTE) {
      console.log(`⚠️  "${metier}" — seulement ${outilsSlugs.length} outil(s) matché(s) (sous le seuil de ${SEUIL_ALERTE}). Créée quand même en brouillon, à revoir manuellement.`);
      avertissements++;
    }

    const docData = {
      id: slug, slug, metier, super_categorie: categorie,
      langue: 'fr', status: 'brouillon',
      mots_cles_matching: motsCles,
      outils_slugs: outilsSlugs,
      intro_ia: '', conseils_ia: '', faq: [],
      meta_title: '', meta_description: '',
      updatedAt: new Date(),
    };

    await db.collection('niches').doc(slug).set(docData);
    console.log(`✓ "${metier}" (${slug}) créée — ${outilsSlugs.length} outil(s) matché(s).`);
    existingSlugs.add(slug);
    creees++;
  }

  console.log(`\n✅ Terminé — ${creees} niche(s) créée(s), ${ignorees} ignorée(s), ${avertissements} avec avertissement (peu d'outils).`);
  if (creees > 0) {
    console.log(`   Toutes en statut "brouillon". Prochaines étapes :`);
    console.log(`   1. Relis/ajuste les outils sélectionnés dans l'admin si besoin`);
    console.log(`   2. Lance "generate-niche-content.js" (ou son workflow) pour générer intro/conseils/FAQ via Gemini`);
    console.log(`   3. Relis le contenu généré, publie chaque niche dans l'admin`);
    console.log(`   4. Lance "gen-fiches.js" pour publier les pages HTML`);
  }
}

main().catch(err => { console.error('❌ Erreur fatale :', err); process.exit(1); });

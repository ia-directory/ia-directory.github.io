#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   backup-firestore.js — Exporte les collections Firestore
   importantes vers des fichiers JSON horodatés, dans backups/.

   Usage :
     FIREBASE_SERVICE_ACCOUNT_PATH=./service-account.json node backup-firestore.js

   Écrit un fichier par collection dans backups/{horodatage}/,
   ex: backups/2026-07-12T21-05-00/outils.json

   Pour restaurer manuellement : ouvre le fichier JSON concerné,
   et réimporte les documents un par un via l'admin ou un petit
   script — ce script fait la sauvegarde, pas la restauration
   automatique (le format brut Firestore n'est pas identique au
   format attendu par les formulaires admin, une restauration
   1:1 pourrait recréer des champs incohérents sans relecture).
   ═══════════════════════════════════════════════════════ */

const fs = require('fs');
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

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

// Collections sauvegardées — ajuste cette liste si tu veux en couvrir d'autres.
const COLLECTIONS = ['outils', 'niches', 'categories', 'comparaisons', 'articles', 'deals', 'galerie'];

async function main() {
  const horodatage = new Date().toISOString().replace(/:/g, '-').split('.')[0];
  const dossier = path.join('backups', horodatage);
  fs.mkdirSync(dossier, { recursive: true });

  console.log(`📦 Sauvegarde vers ${dossier}/\n`);

  let total = 0;
  for (const nomCollection of COLLECTIONS) {
    const snap = await db.collection(nomCollection).get();
    const docs = snap.docs.map(d => d.data());
    const filePath = path.join(dossier, `${nomCollection}.json`);
    fs.writeFileSync(filePath, JSON.stringify(docs, null, 2), 'utf8');
    console.log(`✓ ${nomCollection} — ${docs.length} document(s) → ${filePath}`);
    total += docs.length;
  }

  console.log(`\n✅ Terminé — ${total} document(s) sauvegardé(s) au total.`);
  console.log(`   N'oublie pas que ce dossier doit être commité/poussé sur le repo pour être conservé.`);
}

main().catch(err => { console.error('❌ Erreur:', err); process.exit(1); });

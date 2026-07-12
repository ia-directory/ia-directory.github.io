#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   generate-niche-content.js — Génération IA du contenu des
   micro-niches (intro / conseils / FAQ) via Google Gemini API.

   Usage :
     GEMINI_API_KEY=xxx FIREBASE_SERVICE_ACCOUNT='{...}' node generate-niche-content.js

   Options :
     --force   Régénère même les niches qui ont déjà un intro_ia
                (par défaut, seules les niches vides sont traitées)
     --slug=x  Ne traite qu'une seule niche (par son slug), utile pour tester

   Ce script est INDÉPENDANT de gen-fiches.js — il ne génère aucun
   fichier HTML, il se contente d'écrire le contenu texte dans les
   documents Firestore "niches", avec le statut laissé tel quel
   (donc "brouillon" reste "brouillon" — à toi de relire et publier
   manuellement dans l'admin une fois le contenu généré).

   Prérequis : chaque niche doit déjà avoir ses outils_slugs remplis
   (via l'admin, matching auto + ajustement manuel) AVANT de lancer
   ce script — le brief envoyé à l'IA s'appuie sur les vrais outils
   déjà sélectionnés, pas sur une liste générique.

   Clé API Gemini gratuite (sans carte bancaire) :
     https://aistudio.google.com/apikey
   ═══════════════════════════════════════════════════════ */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');

// ── Config ──────────────────────────────────────────────
// gemini-2.0-flash est un bon compromis qualité/quota gratuit au moment de
// l'écriture. Si Google renomme ou déprécie ce modèle, vérifie le nom exact
// disponible sur https://aistudio.google.com avant de relancer.
const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const DELAI_ENTRE_APPELS_MS = 4500; // reste sous les limites RPM du tier gratuit

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY manquant. Génère une clé gratuite sur https://aistudio.google.com/apikey');
  process.exit(1);
}

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ── Arguments CLI ───────────────────────────────────────
const args = process.argv.slice(2);
const FORCE = args.includes('--force');
const SLUG_FILTER = args.find(a => a.startsWith('--slug='))?.split('=')[1];

// ── Appel Gemini API (fetch natif, aucune dépendance npm) ──
async function appellerGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.7,
      responseMimeType: 'application/json',
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API ${res.status} : ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Réponse Gemini vide ou inattendue : ' + JSON.stringify(data).slice(0, 300));

  return JSON.parse(text);
}

// ── Construction du brief envoyé à l'IA ────────────────────
function construireBrief(niche, outilsResolus) {
  const listeOutils = outilsResolus.length
    ? outilsResolus.map(t => `- ${t.name} (${t.category || 'catégorie non précisée'}) : ${t.description || 'pas de description'}`).join('\n')
    : '(aucun outil sélectionné pour l\'instant — reste générique)';

  return `Tu écris pour Albexia, un annuaire francophone d'outils IA (France, Québec, Afrique francophone, Caraïbes). Ton style : confiant, concret, jamais condescendant, pas de superlatifs creux ("révolutionnaire", "incontournable").

Métier ciblé : ${niche.metier}
Catégorie : ${niche.super_categorie}

Outils déjà sélectionnés pour cette page (ne pas en inventer d'autres, ne pas les décrire un par un dans l'intro) :
${listeOutils}

Génère un contenu au format JSON strict avec exactement ces clés :
{
  "intro": "Un paragraphe de 150 à 220 mots expliquant concrètement pourquoi l'IA est utile pour ce métier précis — des cas d'usage réels de ce métier, pas des généralités sur l'IA. Écrit en français, ton direct.",
  "conseils": "Un paragraphe de 100 à 150 mots donnant un conseil concret pour choisir entre les outils listés selon les besoins spécifiques de ce métier (budget, confidentialité, langue, intégration...).",
  "faq": [
    {"question": "Une question que se poserait vraiment un professionnel de ce métier", "reponse": "Réponse concrète de 40 à 80 mots"},
    {"question": "...", "reponse": "..."},
    {"question": "...", "reponse": "..."},
    {"question": "...", "reponse": "..."}
  ]
}

Génère exactement 4 questions de FAQ, pertinentes et spécifiques à ce métier (pas des questions génériques sur l'IA en général). Réponds UNIQUEMENT avec le JSON, sans texte avant ou après, sans balises markdown.`;
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  console.log(`📥 Lecture de Firestore (niches, outils)...`);
  const [nichesSnap, outilsSnap] = await Promise.all([
    db.collection('niches').get(),
    db.collection('outils').get(),
  ]);
  const niches = nichesSnap.docs.map(d => d.data());
  const outils = outilsSnap.docs.map(d => d.data());
  console.log(`✓ ${niches.length} niche(s), ${outils.length} outil(s) trouvés\n`);

  const slugify = (str) => (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  let aTraiter = niches.filter(n => {
    if (SLUG_FILTER) return n.slug === SLUG_FILTER;
    return FORCE || !n.intro_ia || !n.intro_ia.trim();
  });

  if (!aTraiter.length) {
    console.log('✅ Rien à générer — toutes les niches ont déjà un contenu (utilise --force pour régénérer).');
    return;
  }

  console.log(`🎯 ${aTraiter.length} niche(s) à traiter.\n`);

  let succes = 0, echecs = 0;

  for (const [i, niche] of aTraiter.entries()) {
    process.stdout.write(`[${i+1}/${aTraiter.length}] ${niche.metier}... `);
    try {
      const outilsResolus = (niche.outils_slugs || [])
        .map(s => outils.find(t => slugify(t.name) === s))
        .filter(Boolean);

      const prompt = construireBrief(niche, outilsResolus);
      const contenu = await appellerGemini(prompt);

      if (!contenu.intro || !contenu.faq || !Array.isArray(contenu.faq)) {
        throw new Error('Format de réponse inattendu (intro ou faq manquant)');
      }

      await db.collection('niches').doc(String(niche.id || niche.slug)).update({
        intro_ia: contenu.intro,
        conseils_ia: contenu.conseils || '',
        faq: contenu.faq,
      });

      console.log('✓');
      succes++;
    } catch (err) {
      console.log(`✗ (${err.message})`);
      echecs++;
    }

    // Respecte le quota RPM du tier gratuit — pas de rafale.
    if (i < aTraiter.length - 1) {
      await new Promise(r => setTimeout(r, DELAI_ENTRE_APPELS_MS));
    }
  }

  console.log(`\n✅ Terminé — ${succes} niche(s) générée(s), ${echecs} échec(s).`);
  if (succes > 0) {
    console.log(`   Le statut reste "brouillon" — relis et publie chaque niche dans l'admin avant qu'elle apparaisse sur le site.`);
  }
}

main().catch(err => { console.error('❌ Erreur fatale :', err); process.exit(1); });

#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════
   autofill-outil.js — Pré-remplissage IA d'une fiche outil
   Albexia à partir de l'URL du site officiel, via Gemini.

   Usage :
     GEMINI_API_KEY=xxx node autofill-outil.js --url=https://exemple.com

   Ce script NE TOUCHE PAS Firestore : il affiche uniquement un
   JSON dans le terminal, prêt à copier-coller dans les champs
   correspondants du formulaire admin (onglet Outils).

   Limite connue : certains sites modernes (React/Vue) chargent leur
   contenu via JavaScript après coup — ce script ne voit que le HTML
   statique renvoyé au premier chargement, qui peut être partiel ou
   vide sur ces sites. Si le résultat semble pauvre, complète à la main.

   Clé API Gemini gratuite (sans carte bancaire) :
     https://aistudio.google.com/apikey
   ═══════════════════════════════════════════════════════ */

const GEMINI_MODEL = 'gemini-3.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY manquant. Génère une clé gratuite sur https://aistudio.google.com/apikey');
  process.exit(1);
}

const args = process.argv.slice(2);
const URL_ARG = args.find(a => a.startsWith('--url='))?.split('=').slice(1).join('=');

if (!URL_ARG) {
  console.error('❌ Usage : node autofill-outil.js --url=https://exemple.com');
  process.exit(1);
}

// ── Récupération + nettoyage du HTML ───────────────────────
async function recupererTexteUtile(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AlbexiaBot/1.0)' },
  });
  if (!res.ok) throw new Error(`Impossible de charger la page (HTTP ${res.status})`);
  const html = await res.text();

  const extraireMeta = (nom) => {
    const re = new RegExp(`<meta[^>]+(?:name|property)=["']${nom}["'][^>]+content=["']([^"']+)["']`, 'i');
    return html.match(re)?.[1] || '';
  };

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
  const metaDesc = extraireMeta('description') || extraireMeta('og:description');

  // Retire script/style/commentaires, puis tous les tags HTML restants
  let texte = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  // Tronque pour rester raisonnable niveau prompt (le tier gratuit reste sensible à la taille)
  texte = texte.slice(0, 7000);

  if (texte.length < 200) {
    console.warn('⚠️  Très peu de texte statique trouvé sur cette page — le site charge probablement son contenu en JavaScript après coup. Le résultat risque d\'être pauvre ; complète à la main si besoin.');
  }

  return { title, metaDesc, texte };
}

// ── Appel Gemini API (fetch natif, aucune dépendance npm) ──
async function appellerGemini(prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.6,
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

async function appellerGeminiAvecRetry(prompt, maxTentatives = 3) {
  let derniereErreur;
  for (let tentative = 1; tentative <= maxTentatives; tentative++) {
    try {
      return await appellerGemini(prompt);
    } catch (err) {
      derniereErreur = err;
      if (tentative < maxTentatives) {
        await new Promise(r => setTimeout(r, 3000 * tentative));
      }
    }
  }
  throw derniereErreur;
}

// ── Construction du prompt ──────────────────────────────────
function construireBrief(url, title, metaDesc, texte) {
  return `Tu remplis une fiche pour Albexia, un annuaire francophone d'outils IA (France, Québec, Afrique francophone, Caraïbes). Ton style : confiant, concret, jamais condescendant, pas de superlatifs creux ("révolutionnaire", "incontournable", "révolutionne le secteur").

Voici le contenu brut extrait du site officiel de l'outil à décrire :

URL : ${url}
Titre de la page : ${title}
Meta description : ${metaDesc}

Texte de la page (extrait brut, peut contenir du bruit de navigation/footer à ignorer) :
"""
${texte}
"""

Génère un JSON strict avec exactement ces clés, correspondant aux champs d'une fiche outil Albexia :
{
  "name": "Nom exact de l'outil",
  "category": "Une suggestion de catégorie parmi : redaction, code, image, video, audio, productivite, marketing, chatbot, recherche, design, data, autre",
  "emoji": "Un seul emoji pertinent représentant l'outil",
  "description": "Description courte de 150 à 200 caractères, en français, présentant l'outil pour un lecteur pressé",
  "ideal_pour": "Une phrase courte type profil cible, ex: Rédacteurs et community managers",
  "points_forts": "2 à 4 points forts, un par ligne, phrases courtes",
  "limite": "Une limite ou inconvénient honnête de l'outil, une phrase",
  "tags": "3 à 6 mots-clés séparés par des virgules",
  "presentation": "Un texte de présentation complet de 150 à 300 mots, plusieurs paragraphes possibles, qui explique ce que fait l'outil, pour qui, et ce qui le différencie",
  "meta_description": "Une meta description SEO de 155 caractères maximum",
  "maker": "Le nom de l'entreprise ou du créateur de l'outil, si identifiable, sinon chaîne vide",
  "plateformes": "Plateformes disponibles séparées par des virgules, ex: Web, iOS, Android, Windows",
  "prix_estime": "Un résumé court du modèle de prix observé (ex: Gratuit avec plan payant à partir de 15$/mois), pour t'aider à choisir le champ price/plan dans l'admin — ce champ n'est pas un champ Firestore direct, juste une aide"
}

Si une information n'est pas identifiable avec confiance dans le texte fourni, laisse une chaîne vide plutôt que d'inventer. N'invente jamais de chiffres, de prix exacts, ou de fonctionnalités qui ne sont pas mentionnées dans le texte fourni.

RÈGLE STRICTE DE FORMAT : n'utilise JAMAIS de guillemets doubles ( " ) à l'intérieur des textes générés — même pour citer un exemple ou un nom. Reformule sans guillemets. Réponds UNIQUEMENT avec le JSON, sans texte avant ou après, sans balises markdown.`;
}

// ── Main ──────────────────────────────────────────────────
async function main() {
  console.log(`🌐 Récupération de ${URL_ARG}...`);
  const { title, metaDesc, texte } = await recupererTexteUtile(URL_ARG);
  console.log(`✓ Page récupérée (${texte.length} caractères de texte utile)\n`);

  console.log(`🤖 Génération du contenu via Gemini...`);
  const prompt = construireBrief(URL_ARG, title, metaDesc, texte);
  const contenu = await appellerGeminiAvecRetry(prompt);

  console.log(`\n✅ Résultat — à copier-coller dans les champs correspondants du formulaire admin (onglet Outils) :\n`);
  console.log(JSON.stringify(contenu, null, 2));

  console.log(`\n📋 Rappel des champs admin correspondants :`);
  console.log(`   name        → o-name-fr`);
  console.log(`   category    → o-cat (choisis la valeur la plus proche dans le <select>)`);
  console.log(`   emoji       → o-emoji`);
  console.log(`   description → o-desc-fr`);
  console.log(`   ideal_pour  → o-ideal-fr`);
  console.log(`   points_forts→ o-points-forts`);
  console.log(`   limite      → o-limite`);
  console.log(`   tags        → o-tags`);
  console.log(`   presentation→ o-presentation`);
  console.log(`   meta_description → o-meta-desc`);
  console.log(`   maker       → o-maker`);
  console.log(`   plateformes → o-plateformes`);
  console.log(`   prix_estime → à toi de choisir manuellement o-price / o-plan dans l'admin (pas un champ direct)`);
  console.log(`\n⚠️  Relis tout avant de sauvegarder — l'IA peut se tromper, surtout sur les prix et fonctionnalités précises.`);
}

main().catch(err => { console.error('❌ Erreur :', err.message); process.exit(1); });

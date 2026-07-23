/* ═══════════════════════════════════════
   Albexia — app.js
   Fonctionnalités : navigation, JSON,
   collections Firebase, soumission d'outil
   ═══════════════════════════════════════ */

'use strict';

// LS_KEY favoris supprimé → remplacé par Firebase collections
const LS_LANG_KEY = 'albexia_langue';

// ─── SLUG / URL FICHE ────────────────────
// Identique à la logique de gen-fiches.js — garantit que les URLs
// reconstruites ici correspondent toujours aux fichiers réellement générés,
// sans dépendre du champ "page" stocké en Firestore (qui peut être obsolète).
function slugify(str) {
  return (str || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

function buildToolPageUrl(t) {
  if (t.generer_fiche === false) return null; // pas de fiche générée pour cet outil
  const slug = slugify(t.name);
  if (!slug) return null;
  const folder = t.plan === 'featured' ? 'featured' : t.plan === 'starter' ? 'starter' : 'standard';
  const langue = t.langue || 'fr';
  return `/tools/${folder}/${langue}/${slug}/`;
}

// Reconstruit toujours l'URL de l'article à partir du slug + de la langue
// (schéma Firestore "articles"), sans dépendre d'un champ "url" potentiellement
// obsolète — même logique que buildToolPageUrl.
function buildBlogPageUrl(p) {
  const slug = p.slug || slugify(p.title);
  if (!slug) return '#';
  const langue = p.langue || 'fr';
  return `/articles/${langue}/${slug}/index.html`;
}
window.slugify = slugify;
window.buildToolPageUrl = buildToolPageUrl;
window.buildBlogPageUrl = buildBlogPageUrl;

// ─── LANGUE ──────────────────────────────
const LANGUES_SUPPORTEES = ['fr', 'en', 'es'];

function detecterLangue() {
  const saved = localStorage.getItem(LS_LANG_KEY);
  if (saved && LANGUES_SUPPORTEES.includes(saved)) return saved;
  const nav = (navigator.language || 'fr').slice(0, 2).toLowerCase();
  if (LANGUES_SUPPORTEES.includes(nav)) return nav;
  return 'fr';
}

// Slugs (noms normalisés) des outils actuellement affichés dans le panneau
// spotlight, si présent. Permet de retrouver la variante linguistique du
// même outil quand l'utilisateur change de langue (FR/EN/ES) — on suppose
// que le nom de l'outil (une fois slugifié) reste stable ou très proche
// d'une langue à l'autre, comme le fait déjà buildToolPageUrl().
let _spotlightSlugs = null;

// ─── TRADUCTIONS UI STATIQUE ─────────────
// Dictionnaire pour tous les textes fixes du HTML (nav, hero, boutons,
// titres de page, footer, kebab menu, quiz — hors contenu Firestore qui
// est déjà traduit via le champ "langue" de chaque item).
const UI_TRANSLATIONS = {
  fr: {
    'nav.home': 'Accueil',
    'nav.tools': 'Outils',
    'nav.blog': 'Blog',
    'nav.gallery': 'Galerie',
    'nav.login': 'Connexion',
    'nav.submit': 'Soumettre un outil +',
    'hero.badge': 'Nouvelle plateforme · 2026',
    'hero.title': "Explorez<br>l'univers de <span class=\"grad\">l'IA</span>",
    'hero.subtitle': "Outils, articles et œuvres générées par intelligence artificielle — tout en un seul endroit pour le grand public.",
    'hero.ctaTools': 'Explorer les outils',
    'hero.ctaGallery': 'Voir la galerie',
    'hero.quizCta': 'Trouver mon outil IA en 30 secondes',
    'hero.quizSub': '5 questions · Recommandations personnalisées · Gratuit',
    'hero.statTools': 'Outils IA',
    'hero.statArticles': 'Articles',
    'hero.statWorks': 'Œuvres créatives',
    'tools.title': 'Outils & logiciels IA',
    'tools.subtitle': "Découvrez les meilleurs outils d'intelligence artificielle, classés et évalués.",
    'tools.searchPlaceholder': 'Rechercher un outil, une catégorie, un tag...',
    'tools.loading': 'Chargement des outils...',
    'blog.title': 'Blog IA',
    'blog.subtitle': "Articles, guides et tutoriels sur l'intelligence artificielle pour tous.",
    'blog.loading': 'Chargement des articles...',
    'gallery.title': 'Galerie IA',
    'gallery.subtitle': 'Images, vidéos et musiques générées par intelligence artificielle.',
    'gallery.loading': 'Chargement de la galerie...',
    'quiz.title': 'Trouver mon outil IA',
    'quiz.questionOf': 'Question {n} sur {total}',
    'quiz.resultsTitle': 'Vos 3 outils recommandés',
    'quiz.restart': 'Recommencer',
    'quiz.copyLink': 'Copier le lien',
    'quiz.linkCopied': 'Lien copié !',
    'quiz.viewSheet': 'Voir la fiche →',
    'quiz.profileSummary': 'Profil : {metier} · Budget {budget} · Connexion {connexion}',
    'footer.newsletterLabel': 'Newsletter hebdomadaire',
    'footer.subscribe': "S'abonner",
    'footer.newsletterBadge': '✓ Gratuit · Sans spam · Désabonnement en 1 clic',
    'footer.navTitle': 'Navigation',
    'footer.toolsLink': 'Outils IA',
    'footer.favorites': 'Mes favoris',
    'footer.submitTool': 'Soumettre un outil',
    'footer.categoriesTitle': 'Catégories',
    'footer.catText': 'Texte & Rédaction',
    'footer.catImage': 'Image & Design',
    'footer.catVideo': 'Vidéo',
    'footer.catMusic': 'Musique & Audio',
    'footer.catCode': 'Code',
    'footer.catProductivity': 'Productivité',
    'footer.legalTitle': 'Légal',
    'footer.legalNotice': 'Mentions légales',
    'footer.privacyPolicy': 'Politique de confidentialité',
    'footer.terms': "Conditions d'utilisation",
    'footer.cookies': 'Gestion des cookies',
    'footer.contactTitle': 'Contact',
    'footer.contactUs': 'Nous contacter',
    'footer.partnerships': 'Partenariats',
    'footer.copyright': '&copy; 2025-2026 Albexia — Tous droits réservés',
    'footer.privacy': 'Vie privée',
    'footer.madeWith': 'Fait avec ❤️ pour la communauté IA',
    'kebab.mustHave': 'Incontournables',
    'kebab.glossary': 'Glossaire IA',
    'kebab.glossarySub': 'Tous les termes en français',
    'kebab.compare': 'Comparateur',
    'kebab.compareSub': 'Comparer les outils côte à côte',
    'kebab.deals': 'Deals & Promos',
    'kebab.dealsSub': 'Essais gratuits · Offres exclusives',
    'kebab.hub': 'Voir toutes les sections',
    'kebab.hubSub': "Carte complète d'Albexia →",
    'editorial.introTitle': "L'intelligence artificielle, <span class=\"grad\">enfin accessible à tous</span>",
    'editorial.introLead': "L'IA n'est plus réservée aux ingénieurs et aux grandes entreprises. Un chat, une phrase tapée au clavier suffisent aujourd'hui à générer une image, rédiger un texte ou automatiser une tâche répétitive. Pas besoin de coder, pas besoin de diplôme technique — juste une idée à formuler.",
    'editorial.block1Title': 'Un annuaire, un blog, une galerie',
    'editorial.block1P1': "Albexia réunit plus de 120 outils IA classés par catégorie, des articles pour s'y retrouver, et une galerie d'œuvres générées par IA. Chaque outil a une note et un prix clair, mis à jour à mesure que l'écosystème change. L'objectif est simple : rester un guide honnête sur l'IA, sans jargon ni promesse en l'air, pour que chacun puisse en tirer parti dès aujourd'hui.",
  },
  en: {
    'nav.home': 'Home',
    'nav.tools': 'Tools',
    'nav.blog': 'Blog',
    'nav.gallery': 'Gallery',
    'nav.login': 'Log in',
    'nav.submit': 'Submit a tool +',
    'hero.badge': 'New platform · 2026',
    'hero.title': 'Explore<br>the world of <span class="grad">AI</span>',
    'hero.subtitle': 'Tools, articles and works generated by artificial intelligence — all in one place for everyone.',
    'hero.ctaTools': 'Explore tools',
    'hero.ctaGallery': 'View gallery',
    'hero.quizCta': 'Find my AI tool in 30 seconds',
    'hero.quizSub': '5 questions · Personalized recommendations · Free',
    'hero.statTools': 'AI Tools',
    'hero.statArticles': 'Articles',
    'hero.statWorks': 'Creative works',
    'tools.title': 'AI Tools & Software',
    'tools.subtitle': 'Discover the best artificial intelligence tools, ranked and reviewed.',
    'tools.searchPlaceholder': 'Search a tool, category, tag...',
    'tools.loading': 'Loading tools...',
    'blog.title': 'AI Blog',
    'blog.subtitle': 'Articles, guides and tutorials on artificial intelligence for everyone.',
    'blog.loading': 'Loading articles...',
    'gallery.title': 'AI Gallery',
    'gallery.subtitle': 'Images, videos and music generated by artificial intelligence.',
    'gallery.loading': 'Loading gallery...',
    'quiz.title': 'Find my AI tool',
    'quiz.questionOf': 'Question {n} of {total}',
    'quiz.resultsTitle': 'Your 3 recommended tools',
    'quiz.restart': 'Restart',
    'quiz.copyLink': 'Copy link',
    'quiz.linkCopied': 'Link copied!',
    'quiz.viewSheet': 'View sheet →',
    'quiz.profileSummary': 'Profile: {metier} · Budget {budget} · Connection {connexion}',
    'footer.newsletterLabel': 'Weekly newsletter',
    'footer.subscribe': 'Subscribe',
    'footer.newsletterBadge': '✓ Free · No spam · Unsubscribe in 1 click',
    'footer.navTitle': 'Navigation',
    'footer.toolsLink': 'AI Tools',
    'footer.favorites': 'My favorites',
    'footer.submitTool': 'Submit a tool',
    'footer.categoriesTitle': 'Categories',
    'footer.catText': 'Text & Writing',
    'footer.catImage': 'Image & Design',
    'footer.catVideo': 'Video',
    'footer.catMusic': 'Music & Audio',
    'footer.catCode': 'Code',
    'footer.catProductivity': 'Productivity',
    'footer.legalTitle': 'Legal',
    'footer.legalNotice': 'Legal notice',
    'footer.privacyPolicy': 'Privacy policy',
    'footer.terms': 'Terms of use',
    'footer.cookies': 'Cookie settings',
    'footer.contactTitle': 'Contact',
    'footer.contactUs': 'Contact us',
    'footer.partnerships': 'Partnerships',
    'footer.copyright': '&copy; 2025-2026 Albexia — All rights reserved',
    'footer.privacy': 'Privacy',
    'footer.madeWith': 'Made with ❤️ for the AI community',
    'kebab.mustHave': 'Must-haves',
    'kebab.glossary': 'AI Glossary',
    'kebab.glossarySub': 'All the terms explained',
    'kebab.compare': 'Comparator',
    'kebab.compareSub': 'Compare tools side by side',
    'kebab.deals': 'Deals & Promos',
    'kebab.dealsSub': 'Free trials · Exclusive offers',
    'kebab.hub': 'See all sections',
    'kebab.hubSub': "Albexia's full map →",
    'editorial.introTitle': "Artificial intelligence, <span class=\"grad\">finally accessible to everyone</span>",
    'editorial.introLead': "AI is no longer reserved for engineers and big companies. A chat, a sentence typed on a keyboard is enough today to generate an image, write a text or automate a repetitive task. No coding required, no technical degree needed — just an idea to put into words.",
    'editorial.block1Title': 'A directory, a blog, a gallery',
    'editorial.block1P1': "Albexia brings together over 120 AI tools sorted by category, articles to help you make sense of it all, and a gallery of AI-generated works. Every tool comes with a rating and a clear price, kept up to date as the landscape changes. The goal is simple: stay an honest guide to AI, with no jargon or empty promises, so everyone can make the most of it today.",
  },
  es: {
    'nav.home': 'Inicio',
    'nav.tools': 'Herramientas',
    'nav.blog': 'Blog',
    'nav.gallery': 'Galería',
    'nav.login': 'Iniciar sesión',
    'nav.submit': 'Enviar una herramienta +',
    'hero.badge': 'Nueva plataforma · 2026',
    'hero.title': 'Explora<br>el universo de <span class="grad">la IA</span>',
    'hero.subtitle': 'Herramientas, artículos y obras generadas por inteligencia artificial — todo en un solo lugar para el público general.',
    'hero.ctaTools': 'Explorar herramientas',
    'hero.ctaGallery': 'Ver galería',
    'hero.quizCta': 'Encuentra mi herramienta IA en 30 segundos',
    'hero.quizSub': '5 preguntas · Recomendaciones personalizadas · Gratis',
    'hero.statTools': 'Herramientas IA',
    'hero.statArticles': 'Artículos',
    'hero.statWorks': 'Obras creativas',
    'tools.title': 'Herramientas y software IA',
    'tools.subtitle': 'Descubre las mejores herramientas de inteligencia artificial, clasificadas y evaluadas.',
    'tools.searchPlaceholder': 'Buscar una herramienta, categoría, etiqueta...',
    'tools.loading': 'Cargando herramientas...',
    'blog.title': 'Blog de IA',
    'blog.subtitle': 'Artículos, guías y tutoriales sobre inteligencia artificial para todos.',
    'blog.loading': 'Cargando artículos...',
    'gallery.title': 'Galería IA',
    'gallery.subtitle': 'Imágenes, vídeos y música generados por inteligencia artificial.',
    'gallery.loading': 'Cargando galería...',
    'quiz.title': 'Encontrar mi herramienta IA',
    'quiz.questionOf': 'Pregunta {n} de {total}',
    'quiz.resultsTitle': 'Tus 3 herramientas recomendadas',
    'quiz.restart': 'Reiniciar',
    'quiz.copyLink': 'Copiar enlace',
    'quiz.linkCopied': '¡Enlace copiado!',
    'quiz.viewSheet': 'Ver ficha →',
    'quiz.profileSummary': 'Perfil: {metier} · Presupuesto {budget} · Conexión {connexion}',
    'footer.newsletterLabel': 'Boletín semanal',
    'footer.subscribe': 'Suscribirse',
    'footer.newsletterBadge': '✓ Gratis · Sin spam · Cancela en 1 clic',
    'footer.navTitle': 'Navegación',
    'footer.toolsLink': 'Herramientas IA',
    'footer.favorites': 'Mis favoritos',
    'footer.submitTool': 'Enviar una herramienta',
    'footer.categoriesTitle': 'Categorías',
    'footer.catText': 'Texto y redacción',
    'footer.catImage': 'Imagen y diseño',
    'footer.catVideo': 'Vídeo',
    'footer.catMusic': 'Música y audio',
    'footer.catCode': 'Código',
    'footer.catProductivity': 'Productividad',
    'footer.legalTitle': 'Legal',
    'footer.legalNotice': 'Aviso legal',
    'footer.privacyPolicy': 'Política de privacidad',
    'footer.terms': 'Condiciones de uso',
    'footer.cookies': 'Gestión de cookies',
    'footer.contactTitle': 'Contacto',
    'footer.contactUs': 'Contáctanos',
    'footer.partnerships': 'Colaboraciones',
    'footer.copyright': '&copy; 2025-2026 Albexia — Todos los derechos reservados',
    'footer.privacy': 'Privacidad',
    'footer.madeWith': 'Hecho con ❤️ para la comunidad IA',
    'kebab.mustHave': 'Imprescindibles',
    'kebab.glossary': 'Glosario IA',
    'kebab.glossarySub': 'Todos los términos explicados',
    'kebab.compare': 'Comparador',
    'kebab.compareSub': 'Compara herramientas lado a lado',
    'kebab.deals': 'Ofertas y promos',
    'kebab.dealsSub': 'Pruebas gratis · Ofertas exclusivas',
    'kebab.hub': 'Ver todas las secciones',
    'kebab.hubSub': 'Mapa completo de Albexia →',
    'editorial.introTitle': "La inteligencia artificial, <span class=\"grad\">por fin al alcance de todos</span>",
    'editorial.introLead': "La IA ya no está reservada a ingenieros y grandes empresas. Un chat, una frase escrita en el teclado bastan hoy para generar una imagen, redactar un texto o automatizar una tarea repetitiva. No hace falta programar, no hace falta un título técnico — solo una idea que formular.",
    'editorial.block1Title': 'Un directorio, un blog, una galería',
    'editorial.block1P1': "Albexia reúne más de 120 herramientas de IA clasificadas por categoría, artículos para entender mejor, y una galería de obras generadas por IA. Cada herramienta tiene una valoración y un precio claro, actualizados a medida que cambia el ecosistema. El objetivo es simple: ser una guía honesta sobre la IA, sin jerga ni promesas vacías, para que cada persona pueda aprovecharla desde hoy.",
  },
};
window.UI_TRANSLATIONS = UI_TRANSLATIONS;

// Récupère une clé de traduction pour la langue courante, avec repli sur le
// français si la clé est absente (évite un texte vide en cas d'oubli).
function t(key, langue) {
  const dict = UI_TRANSLATIONS[langue] || UI_TRANSLATIONS.fr;
  return dict[key] ?? UI_TRANSLATIONS.fr[key] ?? key;
}
window.t = t;
// Alias dédié pour les endroits où le nom "t" est déjà utilisé comme
// variable locale (ex : .map(t => ...) sur une liste d'outils).
function translateQuizViewSheet(langue) {
  return t('quiz.viewSheet', langue);
}

// Applique les traductions statiques à tout le DOM courant : texte simple
// (data-i18n), HTML avec balises (data-i18n-html) et placeholders
// d'input (data-i18n-placeholder). Appelée au chargement initial et à
// chaque changement de langue.
function appliquerTraductionsStatiques(langue) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    el.textContent = t(key, langue);
  });
  document.querySelectorAll('[data-i18n-html]').forEach(el => {
    const key = el.getAttribute('data-i18n-html');
    el.innerHTML = t(key, langue);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    el.setAttribute('placeholder', t(key, langue));
  });
  document.documentElement.lang = langue;
}
window.appliquerTraductionsStatiques = appliquerTraductionsStatiques;

function changerLangue(code) {
  if (!LANGUES_SUPPORTEES.includes(code)) return;
  localStorage.setItem(LS_LANG_KEY, code);
  state.langue = code;
  state.activeToolCat    = 'Tous';
  state.activeBlogCat    = 'Tous';
  state.activeGalleryCat = 'Tous';
  state.toolsPage  = 1;
  state.blogPage   = 1;
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === code);
  });
  appliquerTraductionsStatiques(code);
  renderTools();
  renderBlog();
  renderGallery();

  // Si un panneau spotlight (venant d'un CTA article) est affiché, on le
  // reconstruit dans la nouvelle langue en retrouvant les outils par slug
  // de nom (même logique que buildToolPageUrl), au lieu de le laisser
  // dans l'ancienne langue ou de le perdre.
  if (_spotlightSlugs && _spotlightSlugs.length) {
    const found = _spotlightSlugs
      .map(slug => state.tools.find(t => t.langue === code && slugify(t.name) === slug))
      .filter(Boolean);
    if (found.length) {
      renderSpotlight(found, true);
    } else {
      // Pas de variante disponible dans cette langue : on retire le panneau
      // plutôt que de laisser un panneau obsolète/incohérent affiché.
      const old = document.getElementById('notif-spotlight');
      if (old) old.remove();
    }
  }
}

// ─── STATE ───────────────────────────────
const state = {
  tools:   [],
  blog:    [],
  gallery: [],
  langue:  detecterLangue(),
  activeToolCat:    'Tous',
  activeBlogCat:    'Tous',
  activeGalleryCat: 'Tous',
  searchQuery: '',
  toolsPage:   1,
  blogPage:    1,
  galleryPage: 1,
  itemsPerPage: 20,
};
window.state = state;

// ─── COLOR PALETTES ──────────────────────
const catColors = {
  Texte:        { bg: 'rgba(108,99,255,0.18)'  },
  Image:        { bg: 'rgba(255,107,157,0.18)' },
  Musique:      { bg: 'rgba(0,212,170,0.18)'   },
  Code:         { bg: 'rgba(108,99,255,0.18)'  },
  Vidéo:        { bg: 'rgba(255,107,157,0.18)' },
  Recherche:    { bg: 'rgba(0,212,170,0.18)'   },
  Audio:        { bg: 'rgba(108,99,255,0.18)'  },
  Productivité: { bg: 'rgba(245,166,35,0.18)'  },
  Autre:        { bg: 'rgba(255,255,255,0.08)' },
};

const blogColors = {
  Guide:      { bg: 'rgba(108,99,255,0.2)',  tagBg: 'rgba(108,99,255,0.15)',  tagColor: '#a8a3ff' },
  Sélection:  { bg: 'rgba(255,107,157,0.2)', tagBg: 'rgba(255,107,157,0.15)', tagColor: '#ff6b9d' },
  Débutant:   { bg: 'rgba(0,212,170,0.2)',   tagBg: 'rgba(0,212,170,0.15)',   tagColor: '#00d4aa' },
  Comparatif: { bg: 'rgba(245,166,35,0.2)',  tagBg: 'rgba(245,166,35,0.15)',  tagColor: '#f5a623' },
  Tutoriel:   { bg: 'rgba(108,99,255,0.2)',  tagBg: 'rgba(108,99,255,0.15)',  tagColor: '#a8a3ff' },
  Analyse:    { bg: 'rgba(0,212,170,0.2)',   tagBg: 'rgba(0,212,170,0.15)',   tagColor: '#00d4aa' },
};
window.blogColorsMap = blogColors;

const galleryColors = {
  image:   'rgba(108,99,255,0.2)',
  vidéo:   'rgba(255,107,157,0.18)',
  musique: 'rgba(0,212,170,0.2)',
};

// ═══════════════════════════════════════
// TOAST
// ═══════════════════════════════════════

let toastTimer = null;

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════
// MODAL — SOUMISSION D'OUTIL
// ═══════════════════════════════════════

function openModal() {
  resetForm();
  document.getElementById('modal-overlay').classList.add('open');
  setTimeout(() => document.getElementById('f-name').focus(), 100);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
}

function resetForm() {
  ['f-name','f-url','f-cat','f-price','f-desc','f-emoji','f-email'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  const err = document.getElementById('form-error');
  if (err) { err.style.display = 'none'; err.textContent = ''; }
  const countEl = document.getElementById('f-desc-count');
  if (countEl) countEl.textContent = '0 / 200';
}

function validateForm() {
  const name  = document.getElementById('f-name').value.trim();
  const url   = document.getElementById('f-url').value.trim();
  const cat   = document.getElementById('f-cat').value;
  const price = document.getElementById('f-price').value;
  const desc  = document.getElementById('f-desc').value.trim();
  if (!name)  return "Le nom de l'outil est requis.";
  if (!url)   return "L'URL officielle est requise.";
  if (!url.startsWith('http')) return "L'URL doit commencer par http:// ou https://";
  if (!cat)   return 'Veuillez choisir une catégorie.';
  if (!price) return 'Veuillez indiquer la tarification.';
  if (!desc)  return 'La description est requise.';
  if (desc.length < 20) return 'La description doit faire au moins 20 caractères.';
  return null;
}

function handleSubmit() {
  const errMsg = validateForm();
  const errEl  = document.getElementById('form-error');

  if (errMsg) {
    errEl.textContent = errMsg;
    errEl.style.display = 'block';
    return;
  }
  errEl.style.display = 'none';

  const nomOutil = document.getElementById('f-name').value.trim();

  const formData = new FormData();
  formData.append('nom_outil',    nomOutil);
  formData.append('url',          document.getElementById('f-url').value.trim());
  formData.append('categorie',    document.getElementById('f-cat').value);
  formData.append('tarification', document.getElementById('f-price').value);
  formData.append('description',  document.getElementById('f-desc').value.trim());
  formData.append('emoji',        document.getElementById('f-emoji').value.trim() || '🤖');
  formData.append('email',        document.getElementById('f-email').value.trim());

  const submitBtn = document.querySelector('.modal-footer .btn-main');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Envoi…'; }

  fetch('https://formspree.io/f/xaqkgqlr', {
    method:  'POST',
    body:    formData,
    headers: { 'Accept': 'application/json' }
  }).then(() => {
    document.querySelector('.modal-body').innerHTML = `
      <div class="form-success">
        <div class="success-icon">✅</div>
        <h4>Soumission envoyée !</h4>
        <p>Merci pour votre contribution. L'outil <strong>${nomOutil}</strong>
        sera examiné par notre équipe et ajouté sous 48h si approuvé.</p>
      </div>`;
    document.querySelector('.modal-footer').innerHTML =
      `<button class="btn-main" onclick="closeModal()">Fermer</button>`;
  }).catch(() => {
    errEl.textContent = 'Erreur réseau. Réessayez dans quelques instants.';
    errEl.style.display = 'block';
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Soumettre'; }
  });
}

// ═══════════════════════════════════════
// DATA LOADING
// ═══════════════════════════════════════

async function loadJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Erreur chargement ${path}`);
  return res.json();
}

async function loadAllData() {
  try {
    // Outils, articles et galerie viennent tous de Firestore désormais
    // (mise à jour immédiate sans redéploiement ni fichier JSON à régénérer
    // manuellement). Les fiches/articles HTML individuels restent générés
    // en statique par gen-fiches.js pour le SEO, mais l'INDEX affiché ici
    // (grille d'outils, liste blog, galerie) est toujours lu en direct.
    const { db, collection, getDocs } = await import('./firebase-config.js');

    const [toolsSnap, articlesSnap, gallerySnap] = await Promise.all([
      getDocs(collection(db, 'outils')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'articles')).catch(() => ({ docs: [] })),
      getDocs(collection(db, 'galerie')).catch(() => ({ docs: [] })),
    ]);

    state.tools   = toolsSnap.docs.map(d => d.data());
    state.blog    = articlesSnap.docs.map(d => d.data());
    state.gallery = gallerySnap.docs.map(d => d.data());
    renderTools();
    renderBlog();
    renderGallery();
    checkToolsParam();
  } catch (err) {
    console.error('Erreur chargement données:', err);
    showError('tools-grid',   'Impossible de charger les outils.');
    showError('blog-list',    'Impossible de charger les articles.');
    showError('gallery-grid', 'Impossible de charger la galerie.');
  }
}

function filtrerParLangue(items) {
  return items.filter(item => !item.langue || item.langue === state.langue);
}

// ═══════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════

function showPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(b => b.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');
  const btn = document.querySelector(`.nav-link[data-page="${pageId}"]`);
  if (btn) btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (pageId === 'profile') window.location.href = 'profil.html';
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function getColor(map, key, fallback = {}) {
  return map[key] || fallback;
}

function showError(containerId, msg) {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>${msg}</div>`;
}

function showEmpty(containerId, msg = 'Aucun résultat trouvé.') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="empty"><div class="empty-icon">🔍</div>${msg}</div>`;
}

// ═══════════════════════════════════════
// CARTE OUTIL — source unique de vérité
// ═══════════════════════════════════════

function buildToolCard(t, direct = false) {
  const priceLabel = { free: 'Gratuit', freemium: 'Freemium', paid: 'Payant' };
  const col  = catColors[t.category] || { bg: 'rgba(255,255,255,0.08)' };
  const pageUrl = buildToolPageUrl(t);
  const plan = t.plan || (pageUrl ? 'gratuit' : null);

  const iconHtml = t.favicon
    ? `<img src="${t.favicon}" alt="${t.name}" class="tool-favicon"
           onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
           onload="this.nextElementSibling.style.display='none'">
       <span class="tool-ico-fallback" style="display:none">${t.emoji}</span>`
    : `<span class="tool-ico-fallback">${t.emoji}</span>`;

  // direct=true : l'utilisateur vient d'un CTA article (?tools=... via
  // checkToolsParam → renderSpotlight). L'article a déjà convaincu — on
  // saute la fiche et on envoie directement vers le site officiel de l'outil.
  // direct=false (défaut) : comportement habituel, fiche → site officiel.
  const cardAction = (direct && t.url)
    ? `onclick="window.open('${t.url}','_blank')"`
    : pageUrl
      ? `onclick="window.location.href='${pageUrl}'"`
      : `onclick="window.open('${t.url}','_blank')"`;

  let planBadge = '';
  let cardClass = 'tool-card';

  if (plan === 'featured') {
    cardClass = 'tool-card tool-card-featured tool-card-plan-featured';
  } else if (plan === 'starter') {
    cardClass = 'tool-card tool-card-featured tool-card-plan-starter';
  } else if (plan === 'gratuit') {
    cardClass = 'tool-card tool-card-plan-gratuit';
  }

  const BADGE_LABELS = {
    fr: { direct: 'Aller sur le site officiel →', guide: 'Guide complet →' },
    en: { direct: 'Go to official website →',     guide: 'Full guide →' },
    es: { direct: 'Ir al sitio oficial →',         guide: 'Guía completa →' },
  };
  const badgeT9n = BADGE_LABELS[state.langue] || BADGE_LABELS.fr;

  if (direct && t.url) {
    planBadge = `<span class="tool-plan-badge tool-plan-badge-direct">${badgeT9n.direct}</span>`;
  } else if (pageUrl) {
    planBadge = `<span class="tool-plan-badge tool-plan-badge-gratuit">${badgeT9n.guide}</span>`;
  }

  const toolJson = JSON.stringify(t)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;');

  // Slug pour Firestore ratings — même logique que gen-fiches.js (slugify du nom)
  const slug = slugify(t.name) || String(t.id);

  return `
    <article class="${cardClass}" ${cardAction} data-tool-slug="${slug}">
      <div class="tool-head">
        <div class="tool-ico" style="background:${col.bg}">${iconHtml}</div>
        <div style="flex:1">
          <div class="tool-name">${t.name}</div>
          <div class="tool-cat">${t.category}</div>
        </div>
        <button class="fav-btn"
          onclick="openCollectionPicker(event, ${toolJson})"
          title="Ajouter à une collection">♡</button>
      </div>
      <p class="tool-desc">${t.description}</p>
      <div class="tool-foot">
        <span class="price-tag price-${t.price}">${priceLabel[t.price]}</span>
        <span class="tool-rating-badge" data-slug="${slug}"></span>
      </div>
      ${planBadge}
    </article>`;
}
window.buildToolCard = buildToolCard;

// ════════════════════════════════════════
// RATINGS FIRESTORE — enrichir les cartes
// Appelé après chaque renderTools()
// ════════════════════════════════════════
async function renderRatingsOnCards() {
  if (typeof window._getRatingSummaries !== 'function') return;
  try {
    const cards = document.querySelectorAll('.tool-card');
    if (!cards.length) return;

    const slugs = [];
    cards.forEach(card => {
      const slug = card.getAttribute('data-tool-slug');
      if (slug) slugs.push(slug);
    });

    if (!slugs.length) return;

    const summaries = await window._getRatingSummaries([...new Set(slugs)]);
    if (!summaries) return;

    cards.forEach(card => {
      const slug = card.getAttribute('data-tool-slug');
      if (!slug) return;

      const badge = card.querySelector('.tool-rating-badge');
      if (!badge) return;

      const summary = summaries.get(slug);

      // Aucun avis → badge vide (pas de fausses étoiles)
      if (!summary || !summary.ratingCount) {
        badge.innerHTML = '';
        return;
      }

      const avg   = summary.ratingAverage.toFixed(1);
      const count = summary.ratingCount;
      badge.innerHTML = `★ ${avg} <span style="font-size:0.85em;opacity:0.75;font-weight:normal">(${count} avis)</span>`;
    });
  } catch (err) {
    console.warn('Ratings Firestore non chargés:', err);
  }
}

// ═══════════════════════════════════════
// TOOLS
// ═══════════════════════════════════════

function renderTools() {
  const toolsLangue = filtrerParLangue(state.tools);
  const cats = ['Tous', ...new Set(toolsLangue.map(t => t.category))];

  document.getElementById('tool-filters').innerHTML = cats.map(c =>
    `<button class="filter${c === state.activeToolCat ? ' active' : ''}"
      onclick="setToolCat('${c}')">${c}</button>`
  ).join('');

  const filtered = toolsLangue.filter(t =>
    (state.activeToolCat === 'Tous' || t.category === state.activeToolCat) &&
    (matchRecherche(state.searchQuery, t.name) ||
     matchRecherche(state.searchQuery, t.description) ||
     t.tags.some(tag => matchRecherche(state.searchQuery, tag)))
  );

  if (!filtered.length) { showEmpty('tools-grid'); setPaginationEl('tools-grid', ''); return; }

  const total      = filtered.length;
  const totalPages = Math.ceil(total / state.itemsPerPage);
  if (state.toolsPage > totalPages) state.toolsPage = 1;
  const start    = (state.toolsPage - 1) * state.itemsPerPage;
  const paged    = filtered.slice(start, start + state.itemsPerPage);
  const shownEnd = start + paged.length;

  document.getElementById('tools-grid').innerHTML = paged.map(t => buildToolCard(t)).join('');
  setPaginationEl('tools-grid', buildPaginationHTML(state.toolsPage, totalPages, total, start + 1, shownEnd, 'tools', 'outils'));

  // Ratings Firestore après chaque rendu
  renderRatingsOnCards();
}

function buildPaginationHTML(current, totalPages, totalItems, shownStart, shownEnd, section, label) {
  if (totalPages <= 1) return '';
  let pages = '';
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= current - 1 && i <= current + 1)) {
      pages += `<button class="pg-btn${i === current ? ' active' : ''}" onclick="goToPage('${section}',${i})">${i}</button>`;
    } else if (i === current - 2 || i === current + 2) {
      pages += `<span class="pg-dots">…</span>`;
    }
  }
  return `
    <div class="pagination">
      <span class="pg-info">${shownStart}–${shownEnd} sur ${totalItems} ${label}</span>
      <div class="pg-controls">
        <button class="pg-btn pg-arrow" onclick="goToPage('${section}',${current - 1})" ${current === 1 ? 'disabled' : ''}>‹</button>
        ${pages}
        <button class="pg-btn pg-arrow" onclick="goToPage('${section}',${current + 1})" ${current === totalPages ? 'disabled' : ''}>›</button>
      </div>
    </div>`;
}

function setPaginationEl(containerId, html) {
  let el = document.getElementById(containerId + '-pagination');
  if (!el) {
    el = document.createElement('div');
    el.id = containerId + '-pagination';
    document.getElementById(containerId).insertAdjacentElement('afterend', el);
  }
  el.innerHTML = html;
}

function goToPage(section, page) {
  if (section === 'tools') {
    state.toolsPage = page;
    renderTools(); // renderRatingsOnCards() appelé à l'intérieur
    document.getElementById('tools').scrollIntoView({behavior:'smooth',block:'start'});
  }
  if (section === 'blog')    { state.blogPage    = page; renderBlog();    document.getElementById('blog').scrollIntoView({behavior:'smooth',block:'start'}); }
  if (section === 'gallery') { state.galleryPage = page; renderGallery(); document.getElementById('gallery').scrollIntoView({behavior:'smooth',block:'start'}); }
}

function setToolCat(cat) {
  state.activeToolCat = cat;
  state.toolsPage = 1;
  renderTools(); // renderRatingsOnCards() appelé à l'intérieur
}

// ═══════════════════════════════════════
// BLOG
// ═══════════════════════════════════════

function renderBlog() {
  const blogLangue = filtrerParLangue(state.blog);
  const cats = ['Tous', ...new Set(blogLangue.map(p => p.category))];
  document.getElementById('blog-filters').innerHTML = cats.map(c =>
    `<button class="filter${c === state.activeBlogCat ? ' active' : ''}"
      onclick="setBlogCat('${c}')">${c}</button>`
  ).join('');

  const filtered = blogLangue.filter(p =>
    state.activeBlogCat === 'Tous' || p.category === state.activeBlogCat
  );

  if (!filtered.length) { showEmpty('blog-list'); setPaginationEl('blog-list', ''); return; }

  const total      = filtered.length;
  const totalPages = Math.ceil(total / state.itemsPerPage);
  if (state.blogPage > totalPages) state.blogPage = 1;
  const start    = (state.blogPage - 1) * state.itemsPerPage;
  const paged    = filtered.slice(start, start + state.itemsPerPage);
  const shownEnd = start + paged.length;

  document.getElementById('blog-list').innerHTML = paged.map(p => {
    const col = getColor(blogColors, p.category, { bg: 'rgba(255,255,255,0.08)', tagBg: 'rgba(255,255,255,0.08)', tagColor: '#aaa' });
    const href = buildBlogPageUrl(p);
    const thumbImage = p.og_image || p.image; // og_image = schéma Firestore actuel, image = compat ancien blog.json
    const thumbContent = thumbImage
      ? `<img src="${thumbImage}" alt="${p.title}" loading="lazy"
             onerror="this.style.display='none';this.parentElement.innerHTML='<span style=font-size:48px>${p.emoji || '📝'}</span>'">`
      : `<span>${p.emoji || '📝'}</span>`;
    return `
      <a href="${href}" class="blog-card-link" style="text-decoration:none;display:block;">
        <article class="blog-card">
          <div class="blog-thumb">${thumbContent}</div>
          <div class="blog-body">
            <div class="blog-title">${p.title}</div>
            <div class="blog-meta">${p.date} · ${p.author}</div>
            <p class="blog-excerpt">${p.excerpt}</p>
            <span class="blog-tag" style="background:${col.tagBg};color:${col.tagColor}">${p.category}</span>
          </div>
          <div class="blog-mins">⏱ ${p.readTime} de lecture</div>
        </article>
      </a>`;
  }).join('');

  setPaginationEl('blog-list', buildPaginationHTML(state.blogPage, totalPages, total, start + 1, shownEnd, 'blog', 'articles'));
}

function setBlogCat(cat) {
  state.activeBlogCat = cat;
  state.blogPage = 1;
  renderBlog();
}

// ═══════════════════════════════════════
// GALLERY
// ═══════════════════════════════════════

function renderGallery() {
  const types = ['Tous', 'image', 'vidéo', 'musique'];
  const typeLabels = { Tous: 'Tous', image: 'Image', vidéo: 'Vidéo', musique: 'Musique' };
  const typeIcons  = { image: '🖼', vidéo: '▶', musique: '♪' };

  document.getElementById('gallery-filters').innerHTML = types.map(t =>
    `<button class="filter${t === state.activeGalleryCat ? ' active' : ''}"
      onclick="setGalleryCat('${t}')">${typeLabels[t]}</button>`
  ).join('');

  const filtered = state.gallery.filter(g =>
    state.activeGalleryCat === 'Tous' || g.type === state.activeGalleryCat
  );

  if (!filtered.length) { showEmpty('gallery-grid'); setPaginationEl('gallery-grid', ''); return; }

  const total      = filtered.length;
  const totalPages = Math.ceil(total / state.itemsPerPage);
  if (state.galleryPage > totalPages) state.galleryPage = 1;
  const start    = (state.galleryPage - 1) * state.itemsPerPage;
  const paged    = filtered.slice(start, start + state.itemsPerPage);
  const shownEnd = start + paged.length;

  document.getElementById('gallery-grid').innerHTML = paged.map((g, i) => {
    const realIndex = start + i;
    const isMusic = g.type === 'musique';
    const thumbStyle = isMusic ? `background:linear-gradient(135deg,#6c63ff,#ff6b9d);` : `background:#111;`;
    const thumbContent = isMusic
      ? `<span style="font-size:48px">🎵</span>`
      : `<img src="${g.thumb}" alt="${g.title}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="lazy">`;
    return `
      <article class="gallery-card" onclick="openGalleryItem(${realIndex})" style="cursor:pointer;">
        <div class="gallery-thumb" style="${thumbStyle}position:relative;overflow:hidden;">
          ${thumbContent}
          <span class="gallery-type type-${g.type}">${typeLabels[g.type]}</span>
          <div class="gallery-play-icon">${typeIcons[g.type]}</div>
        </div>
        <div class="gallery-info">
          <div class="gallery-title">${g.title}</div>
          <div class="gallery-tool">${g.tool}</div>
          <div class="gallery-likes"><span>♥</span> ${g.likes} likes</div>
        </div>
      </article>`;
  }).join('');

  state.filteredGallery = filtered;
  setPaginationEl('gallery-grid', buildPaginationHTML(state.galleryPage, totalPages, total, start + 1, shownEnd, 'gallery', 'œuvres'));
}

function openGalleryItem(index) {
  if (window.GalleryLightbox) {
    window.GalleryLightbox.openLightbox(state.filteredGallery, index);
  }
}

function setGalleryCat(cat) {
  state.activeGalleryCat = cat;
  state.galleryPage = 1;
  renderGallery();
}

// ═══════════════════════════════════════
// NEWSLETTER (Formspree)
// ═══════════════════════════════════════

function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('footer-email').value.trim();
    const feedback = document.getElementById('nl-feedback');
    const btn      = form.querySelector('button[type=submit]');
    if (!email) return;
    btn.textContent = '...';
    btn.disabled = true;
    try {
      const res = await fetch(form.action, {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        feedback.textContent = '✓ Inscription confirmée ! Merci ' + email.split('@')[0] + ' !';
        feedback.style.color = '#00d4aa';
        form.reset();
      } else {
        feedback.textContent = '⚠ Erreur. Réessayez dans un instant.';
        feedback.style.color = '#f5a623';
      }
    } catch {
      feedback.textContent = '⚠ Erreur réseau. Réessayez.';
      feedback.style.color = '#f5a623';
    }
    btn.textContent = 'S\'abonner';
    btn.disabled = false;
  });
}

// ═══════════════════════════════════════
// SEARCH
// ═══════════════════════════════════════

function normaliser(str) {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function levenshtein(a, b) {
  if (!a) return b.length;
  if (!b) return a.length;
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i]);
  for (let j = 1; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

function matchRecherche(query, target) {
  const q = normaliser(query);
  const t = normaliser(target);
  if (!q) return true;
  if (t.includes(q)) return true;
  const mots = q.split(' ').filter(Boolean);
  const motsTarget = t.split(' ').filter(Boolean);
  return mots.every(mot => {
    if (motsTarget.some(mt => mt.includes(mot) || mot.includes(mt))) return true;
    const seuil = mot.length <= 3 ? 0 : mot.length <= 5 ? 1 : 2;
    return motsTarget.some(mt => levenshtein(mot, mt) <= seuil);
  });
}

function handleSearch(e) {
  state.searchQuery = e.target.value;
  state.toolsPage = 1;
  const url = new URL(window.location);
  if (e.target.value) {
    url.searchParams.set('search', e.target.value);
  } else {
    url.searchParams.delete('search');
  }
  window.history.replaceState({}, '', url);
  renderTools();
}

function readSearchFromURL() {
  const params = new URLSearchParams(window.location.search);
  const q = params.get('search');
  if (q) {
    state.searchQuery = q;
    const searchEl = document.getElementById('tool-search');
    if (searchEl) searchEl.value = q;
    showPage('tools');
  }
}

// ═══════════════════════════════════════
// INIT
// ═══════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  document.querySelectorAll('.nav-link').forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  const searchEl = document.getElementById('tool-search');
  if (searchEl) searchEl.addEventListener('input', handleSearch);

  const descEl = document.getElementById('f-desc');
  if (descEl) {
    descEl.addEventListener('input', () => {
      document.getElementById('f-desc-count').textContent = `${descEl.value.length} / 200`;
    });
  }

  // Applique la langue détectée (localStorage ou navigateur) au chargement
  // initial : texte statique + bouton FR/EN/ES actif, sans quoi seule la
  // langue par défaut FR s'affichait tant que l'utilisateur n'avait pas
  // cliqué manuellement sur le sélecteur.
  appliquerTraductionsStatiques(state.langue);
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === state.langue);
  });

  document.getElementById('open-submit-btn')?.addEventListener('click', openModal);
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('modal-submit')?.addEventListener('click', handleSubmit);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  initNewsletter();
  readSearchFromURL();
  loadAllData();

  if (window.BlogReader) window.BlogReader.createBlogReader();
  if (window.GalleryLightbox) window.GalleryLightbox.initLightbox();
});

// ═══════════════════════════════════════
// QUIZ — TROUVER MON OUTIL IA
// ═══════════════════════════════════════

// Questions et options du quiz, traduites FR/EN/ES. Les "value" (metier,
// objectif, budget, connexion, niveau) restent les clés internes utilisées
// par scoreOutil() et METIER_CATS — seuls les labels affichés changent.
const QUIZ_QUESTIONS_I18N = {
  fr: [
    {
      id: 'metier',
      question: 'Tu es plutôt…',
      options: [
        { label: '✍️ Rédacteur / Copywriter',   value: 'redacteur'    },
        { label: '🎨 Designer / Créatif',        value: 'designer'     },
        { label: '💻 Développeur',               value: 'developpeur'  },
        { label: '🚀 Entrepreneur / Freelance',  value: 'entrepreneur' },
        { label: '🎓 Étudiant',                  value: 'etudiant'     },
        { label: '👤 Autre',                     value: 'autre'        },
      ]
    },
    {
      id: 'objectif',
      question: "Ton objectif principal avec l'IA…",
      options: [
        { label: '⚡ Gagner du temps',           value: 'temps'     },
        { label: '✏️ Créer du contenu',          value: 'contenu'   },
        { label: '📚 Apprendre',                 value: 'apprendre' },
        { label: '💰 Générer des revenus',       value: 'revenus'   },
        { label: "📋 M'organiser",               value: 'organiser' },
      ]
    },
    {
      id: 'budget',
      question: 'Ton budget mensuel pour un outil IA…',
      options: [
        { label: '🆓 Gratuit uniquement',        value: 'free'     },
        { label: '💳 Moins de 20$/mois',         value: 'freemium' },
        { label: '💎 Plus de 20$/mois',          value: 'paid'     },
      ]
    },
    {
      id: 'connexion',
      question: 'Ta connexion internet est…',
      options: [
        { label: '🚀 Rapide et stable',          value: 'rapide'  },
        { label: '📶 Correcte',                  value: 'moyenne' },
        { label: '🐢 Lente ou instable',         value: 'lente'   },
      ]
    },
    {
      id: 'niveau',
      question: 'Ton niveau avec les outils IA…',
      options: [
        { label: '🌱 Débutant complet',          value: 'debutant'      },
        { label: '🌿 Quelques expériences',      value: 'intermediaire' },
        { label: '🌳 Utilisateur régulier',      value: 'avance'        },
      ]
    }
  ],
  en: [
    {
      id: 'metier',
      question: 'You are more of a…',
      options: [
        { label: '✍️ Writer / Copywriter',       value: 'redacteur'    },
        { label: '🎨 Designer / Creative',        value: 'designer'     },
        { label: '💻 Developer',                  value: 'developpeur'  },
        { label: '🚀 Entrepreneur / Freelancer',  value: 'entrepreneur' },
        { label: '🎓 Student',                    value: 'etudiant'     },
        { label: '👤 Other',                      value: 'autre'        },
      ]
    },
    {
      id: 'objectif',
      question: 'Your main goal with AI…',
      options: [
        { label: '⚡ Save time',                  value: 'temps'     },
        { label: '✏️ Create content',             value: 'contenu'   },
        { label: '📚 Learn',                      value: 'apprendre' },
        { label: '💰 Generate income',            value: 'revenus'   },
        { label: '📋 Get organized',              value: 'organiser' },
      ]
    },
    {
      id: 'budget',
      question: 'Your monthly budget for an AI tool…',
      options: [
        { label: '🆓 Free only',                  value: 'free'     },
        { label: '💳 Under $20/month',            value: 'freemium' },
        { label: '💎 Over $20/month',             value: 'paid'     },
      ]
    },
    {
      id: 'connexion',
      question: 'Your internet connection is…',
      options: [
        { label: '🚀 Fast and stable',            value: 'rapide'  },
        { label: '📶 Decent',                     value: 'moyenne' },
        { label: '🐢 Slow or unstable',           value: 'lente'   },
      ]
    },
    {
      id: 'niveau',
      question: 'Your level with AI tools…',
      options: [
        { label: '🌱 Complete beginner',          value: 'debutant'      },
        { label: '🌿 Some experience',            value: 'intermediaire' },
        { label: '🌳 Regular user',               value: 'avance'        },
      ]
    }
  ],
  es: [
    {
      id: 'metier',
      question: 'Eres más bien…',
      options: [
        { label: '✍️ Redactor / Copywriter',      value: 'redacteur'    },
        { label: '🎨 Diseñador / Creativo',        value: 'designer'     },
        { label: '💻 Desarrollador',               value: 'developpeur'  },
        { label: '🚀 Emprendedor / Freelance',     value: 'entrepreneur' },
        { label: '🎓 Estudiante',                  value: 'etudiant'     },
        { label: '👤 Otro',                        value: 'autre'        },
      ]
    },
    {
      id: 'objectif',
      question: 'Tu objetivo principal con la IA…',
      options: [
        { label: '⚡ Ahorrar tiempo',              value: 'temps'     },
        { label: '✏️ Crear contenido',             value: 'contenu'   },
        { label: '📚 Aprender',                    value: 'apprendre' },
        { label: '💰 Generar ingresos',            value: 'revenus'   },
        { label: '📋 Organizarme',                 value: 'organiser' },
      ]
    },
    {
      id: 'budget',
      question: 'Tu presupuesto mensual para una herramienta IA…',
      options: [
        { label: '🆓 Solo gratis',                 value: 'free'     },
        { label: '💳 Menos de 20$/mes',            value: 'freemium' },
        { label: '💎 Más de 20$/mes',              value: 'paid'     },
      ]
    },
    {
      id: 'connexion',
      question: 'Tu conexión a internet es…',
      options: [
        { label: '🚀 Rápida y estable',            value: 'rapide'  },
        { label: '📶 Correcta',                    value: 'moyenne' },
        { label: '🐢 Lenta o inestable',           value: 'lente'   },
      ]
    },
    {
      id: 'niveau',
      question: 'Tu nivel con las herramientas IA…',
      options: [
        { label: '🌱 Principiante total',          value: 'debutant'      },
        { label: '🌿 Algo de experiencia',         value: 'intermediaire' },
        { label: '🌳 Usuario habitual',            value: 'avance'        },
      ]
    }
  ],
};

// Retourne les questions du quiz dans la langue courante (repli FR).
function getQuizQuestions(langue) {
  return QUIZ_QUESTIONS_I18N[langue] || QUIZ_QUESTIONS_I18N.fr;
}
window.getQuizQuestions = getQuizQuestions;

// Alias conservé pour compatibilité : toujours la version FR par défaut,
// utilisée uniquement en repli si du code externe y fait encore référence.
const QUIZ_QUESTIONS = QUIZ_QUESTIONS_I18N.fr;

const METIER_CATS = {
  redacteur:    ['Texte', 'Productivité'],
  designer:     ['Image', 'Design', 'Vidéo'],
  developpeur:  ['Code', 'Productivité'],
  entrepreneur: ['Texte', 'Productivité', 'Recherche'],
  etudiant:     ['Texte', 'Recherche', 'Productivité'],
  autre:        ['Texte', 'Productivité', 'Image'],
};

const CATS_LOURDES = ['Vidéo', 'Image', 'Musique'];

const quizState = { step: 0, answers: {} };

function openQuiz() {
  if (!window._firebaseUser) {
    window.location.href = 'profil.html?redirect=quiz';
    return;
  }
  const params = new URLSearchParams(window.location.search);
  const quizParam = params.get('quiz');
  if (quizParam) {
    const parts = quizParam.split('-');
    const ids = ['metier','objectif','budget','connexion','niveau'];
    ids.forEach((id, i) => { if (parts[i]) quizState.answers[id] = parts[i]; });
    quizState.step = 5;
    document.getElementById('quiz-overlay').classList.add('open');
    document.body.style.overflow = 'hidden';
    showQuizResults();
    return;
  }
  quizState.step    = 0;
  quizState.answers = {};
  document.getElementById('quiz-results').style.display = 'none';
  document.getElementById('quiz-body').style.display    = 'block';
  document.getElementById('quiz-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderQuizStep();
}

function closeQuiz() {
  document.getElementById('quiz-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

function renderQuizStep() {
  const questions = getQuizQuestions(state.langue);
  const q     = questions[quizState.step];
  const total = questions.length;
  const pct   = (quizState.step / total) * 100;
  document.getElementById('quiz-progress-bar').style.width = pct + '%';
  document.getElementById('quiz-step-label').textContent   =
    t('quiz.questionOf', state.langue).replace('{n}', quizState.step + 1).replace('{total}', total);
  document.getElementById('quiz-question').textContent     = q.question;
  document.getElementById('quiz-options').innerHTML = q.options.map(o =>
    `<button class="quiz-option" onclick="selectQuizOption('${q.id}','${o.value}')">${o.label}</button>`
  ).join('');
}

function selectQuizOption(questionId, value) {
  quizState.answers[questionId] = value;
  const questions = getQuizQuestions(state.langue);
  document.querySelectorAll('.quiz-option').forEach(btn => {
    if (btn.textContent.trim() ===
        questions[quizState.step].options.find(o => o.value === value)?.label.trim()) {
      btn.classList.add('selected');
    }
  });
  setTimeout(() => {
    quizState.step++;
    if (quizState.step < questions.length) renderQuizStep();
    else showQuizResults();
  }, 280);
}

function scoreOutil(tool, answers) {
  let score = 0;
  const cats = METIER_CATS[answers.metier] || ['Texte'];
  if (cats[0] === tool.category)         score += 3;
  else if (cats.includes(tool.category)) score += 1;
  if (answers.budget === 'free'     && tool.price === 'free') score += 3;
  if (answers.budget === 'freemium' && tool.price !== 'paid') score += 2;
  if (answers.budget === 'paid')                               score += 1;
  if (answers.connexion === 'lente' && CATS_LOURDES.includes(tool.category)) score -= 3;
  const hasPage = !!buildToolPageUrl(tool);
  if (answers.niveau === 'debutant' && !hasPage) score += 1;
  if (answers.niveau === 'avance'   && hasPage)  score += 1;
  score += (tool.rating || 3) * 0.3;
  return score;
}

function showQuizResults() {
  const answers = quizState.answers;
  const outils  = filtrerParLangue(state.tools);
  const scored  = outils.map(t => ({ tool: t, score: scoreOutil(t, answers) }));
  scored.sort((a, b) => b.score - a.score);

  const selected = [];
  const usedCats = new Set();
  for (const item of scored) {
    if (selected.length >= 3) break;
    if (!usedCats.has(item.tool.category)) {
      selected.push(item.tool);
      usedCats.add(item.tool.category);
    }
  }
  for (const item of scored) {
    if (selected.length >= 3) break;
    if (!selected.find(t => t.id === item.tool.id)) selected.push(item.tool);
  }

  const metierLabel = getQuizQuestions(state.langue)[0].options.find(o => o.value === answers.metier)?.label || '';
  document.getElementById('quiz-results-sub').textContent =
    t('quiz.profileSummary', state.langue)
      .replace('{metier}', metierLabel)
      .replace('{budget}', answers.budget)
      .replace('{connexion}', answers.connexion);

  const priceLabel = { free: 'Gratuit', freemium: 'Freemium', paid: 'Payant' };
  document.getElementById('quiz-results-grid').innerHTML = selected.map(t => {
    const quizPageUrl = buildToolPageUrl(t);
    const action = quizPageUrl
      ? `onclick="closeQuiz();window.location.href='${quizPageUrl}'"`
      : `onclick="closeQuiz();window.open('${t.url}','_blank')"`;
    const iconHtml = t.favicon
      ? `<img src="${t.favicon}" alt="${t.name}" style="width:32px;height:32px;border-radius:6px;" onerror="this.style.display='none'">`
      : `<span style="font-size:28px">${t.emoji}</span>`;
    return `
      <div class="quiz-result-card" ${action}>
        <div class="quiz-result-head">
          <div class="quiz-result-ico">${iconHtml}</div>
          <div style="flex:1">
            <div class="quiz-result-name">${t.name}</div>
            <div class="quiz-result-cat">${t.category}</div>
          </div>
          <span class="price-tag price-${t.price}">${priceLabel[t.price]}</span>
        </div>
        <p class="quiz-result-desc">${t.description}</p>
        <div class="quiz-result-cta">${translateQuizViewSheet(state.langue)}</div>
      </div>`;
  }).join('');

  document.getElementById('quiz-body').style.display    = 'none';
  document.getElementById('quiz-results').style.display = 'block';
  document.getElementById('quiz-progress-bar').style.width = '100%';

  if (window._firebaseUser && window._saveQuizToFirebase) {
    window._saveQuizToFirebase(window._firebaseUser.uid, answers, selected);
  }
}

function restartQuiz() {
  quizState.step    = 0;
  quizState.answers = {};
  document.getElementById('quiz-results').style.display = 'none';
  document.getElementById('quiz-body').style.display    = 'block';
  document.getElementById('quiz-copy-confirm').style.display = 'none';
  renderQuizStep();
}

function copyQuizLink() {
  const a     = quizState.answers;
  const param = [a.metier, a.objectif, a.budget, a.connexion, a.niveau].join('-');
  const url   = `${window.location.origin}${window.location.pathname}?quiz=${param}`;
  navigator.clipboard.writeText(url).then(() => {
    const el = document.getElementById('quiz-copy-confirm');
    el.style.display = 'block';
    setTimeout(() => { el.style.display = 'none'; }, 2500);
  });
}

function shareWhatsApp() {
  const grid = document.getElementById('quiz-results-grid');
  const noms = [...grid.querySelectorAll('.quiz-result-name')].map(el => '• ' + el.textContent).join('\n');
  const a    = quizState.answers;
  const param = [a.metier, a.objectif, a.budget, a.connexion, a.niveau].join('-');
  const url  = `${window.location.origin}${window.location.pathname}?quiz=${param}`;
  const msg  = encodeURIComponent(`J'ai testé le quiz Albexia et voici mes 3 outils IA recommandés :\n${noms}\n\nTeste-le toi aussi → ${url}`);
  window.open(`https://wa.me/?text=${msg}`, '_blank');
}

window.openQuiz      = openQuiz;
window.closeQuiz     = closeQuiz;
window.restartQuiz   = restartQuiz;
window.copyQuizLink  = copyQuizLink;
window.shareWhatsApp = shareWhatsApp;

// ═══════════════════════════════════════
// SPOTLIGHT
// ═══════════════════════════════════════

function checkToolsParam() {
  const params = new URLSearchParams(window.location.search);
  const raw    = params.get('tools');
  if (!raw) return;
  const ids   = raw.split(',').map(s => s.trim()).filter(Boolean);
  if (!ids.length) return;
  const found = ids
    .map(id => state.tools.find(t => String(t.id) === id))
    .filter(Boolean);
  if (!found.length) return;
  // Mémorise les slugs de nom pour pouvoir reconstruire le panneau dans la
  // bonne langue si l'utilisateur change de langue ensuite (voir changerLangue).
  _spotlightSlugs = found.map(t => slugify(t.name));
  // Le hash #tools est nécessaire en plus de showPage('tools') pour que
  // la navigation visuelle s'aligne correctement — on le force ici pour
  // que le CTA article n'ait besoin que de ?tools=ID, sans avoir à
  // penser à ajouter #tools à la main dans chaque article.
  if (window.location.hash !== '#tools') {
    window.location.hash = 'tools';
  }
  // Ce paramètre ?tools= vient toujours d'un CTA article (voir reveal
  // du bouton "Voir l'outil / ces outils" dans les pages d'article) —
  // donc on active systématiquement le lien direct vers le site officiel.
  renderSpotlight(found, true);
}

function renderSpotlight(outils, fromArticle = false) {
  const old = document.getElementById('notif-spotlight');
  if (old) old.remove();
  // direct=true : ces cards viennent d'un CTA article, on saute la fiche
  // et on va tout droit au site officiel (voir buildToolCard).
  const cardsHTML = outils.map(t => buildToolCard(t, fromArticle)).join('');
  const panel = document.createElement('div');
  panel.id = 'notif-spotlight';
  if (fromArticle) panel.classList.add('spotlight-highlight');

  const SPOTLIGHT_LABELS = {
    fr: { articleMulti: 'Outils mentionnés dans l\'article', articleSingle: 'Outil mentionné dans l\'article', weekly: 'Outils sélectionnés cette semaine' },
    en: { articleMulti: 'Tools mentioned in the article',    articleSingle: 'Tool mentioned in the article',    weekly: 'Tools selected this week' },
    es: { articleMulti: 'Herramientas mencionadas en el artículo', articleSingle: 'Herramienta mencionada en el artículo', weekly: 'Herramientas seleccionadas esta semana' },
  };
  const t9n = SPOTLIGHT_LABELS[state.langue] || SPOTLIGHT_LABELS.fr;
  const label = fromArticle
    ? (outils.length > 1 ? t9n.articleMulti : t9n.articleSingle)
    : t9n.weekly;

  panel.innerHTML = `
    <div class="spotlight-header">
      <div class="spotlight-label">
        <span class="spotlight-dot"></span>
        ${label}
      </div>
      <button class="spotlight-close" onclick="closeSpotlight()" aria-label="Fermer">✕</button>
    </div>
    <div class="spotlight-grid">${cardsHTML}</div>
  `;
  const toolsGrid = document.getElementById('tools-grid');
  if (toolsGrid) toolsGrid.insertAdjacentElement('beforebegin', panel);
  showPage('tools');
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
}

function closeSpotlight() {
  const panel = document.getElementById('notif-spotlight');
  if (!panel) return;
  panel.classList.add('spotlight-hiding');
  setTimeout(() => panel.remove(), 350);
  _spotlightSlugs = null;
  const url = new URL(window.location.href);
  url.searchParams.delete('tools');
  window.history.replaceState({}, '', url.toString());
}

window.closeSpotlight = closeSpotlight;

// ── NAVIGATION DEPUIS LES PAGES SECONDAIRES ──
(function() {
  const hash = window.location.hash.replace('#', '');
  const pages = ['tools', 'blog', 'gallery', 'favorites'];
  if (pages.includes(hash)) {
    window.addEventListener('DOMContentLoaded', () => {
      if (typeof showPage === 'function') showPage(hash);
    });
  }
})();

// ═══════════════════════════════════════
// COLLECTION PICKER — fallback
// ═══════════════════════════════════════
if (typeof window.openCollectionPicker === 'undefined') {
  window.openCollectionPicker = function(event, tool) {
    event.stopPropagation();
    window.location.href = 'profil.html';
  };
}

/* ═══════════════════════════════════════════════════
   article.css — Albexia
   Partagé par 3 templates :
   · article-fond.html      (articles éditoriaux)
   · analyse-technique.html (fiches outils)
   · guide-alternatif.css   (guides alternatives)
   ═══════════════════════════════════════════════════ */

/* ─── NAV ─── */
nav a.nav-link { text-decoration: none; display: inline-block; }
nav a.nav-cta  { text-decoration: none; }

/* ─── LAYOUT COMMUN ─── */
.article-main {
  min-height: calc(100vh - 120px);
  padding: 48px 24px 80px;
}
.article-container {
  max-width: 740px;
  margin: 0 auto;
}

/* ─── BREADCRUMB ─── */
.article-breadcrumb {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-dim);
  margin-bottom: 24px;
  flex-wrap: wrap;
}
.article-breadcrumb a {
  color: var(--text-dim);
  text-decoration: none;
  transition: color .15s;
}
.article-breadcrumb a:hover { color: var(--accent2); }
.article-breadcrumb .sep { color: var(--text-dim); opacity: .5; }
.article-breadcrumb .current { color: var(--text-muted); }

/* ─── HEADER COMMUN ─── */
.article-header { margin-bottom: 40px; }

.article-meta-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}

.article-cat {
  font-size: 11px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 6px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
/* Variantes couleur catégorie */
.article-cat.fond     { background: rgba(108,99,255,.12); color: #a8a3ff; border: 1px solid rgba(108,99,255,.25); }
.article-cat.analyse  { background: rgba(0,212,170,.12);  color: var(--accent3); border: 1px solid rgba(0,212,170,.25); }
.article-cat.guide    { background: rgba(255,107,157,.12); color: var(--accent2); border: 1px solid rgba(255,107,157,.25); }

.article-read-time {
  font-size: 12px;
  color: var(--text-dim);
}
.article-date {
  font-size: 12px;
  color: var(--text-dim);
}
.article-meta-top .dot {
  width: 3px; height: 3px;
  border-radius: 50%;
  background: var(--text-dim);
  opacity: .4;
}

.article-title {
  font-family: 'Syne', sans-serif;
  font-size: clamp(24px, 4.5vw, 40px);
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.5px;
  color: var(--text);
  margin-bottom: 18px;
}

.article-intro {
  font-size: 17px;
  color: var(--text-muted);
  line-height: 1.8;
  font-weight: 300;
  border-left: 3px solid var(--accent);
  padding-left: 20px;
  margin: 0 0 32px;
}

/* ─── CORPS ARTICLE (fond éditorial) ─── */
.article-body {
  font-size: 16px;
  color: var(--text-muted);
  line-height: 1.9;
  font-weight: 300;
}
.article-body h2 {
  font-family: 'Syne', sans-serif;
  font-size: 22px;
  font-weight: 700;
  color: var(--text);
  margin: 44px 0 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--border);
  letter-spacing: -0.3px;
}
.article-body h3 {
  font-family: 'Syne', sans-serif;
  font-size: 17px;
  font-weight: 600;
  color: var(--text);
  margin: 28px 0 12px;
}
.article-body p  { margin-bottom: 20px; }
.article-body strong { color: var(--text); font-weight: 500; }
.article-body em { color: #a8a3ff; font-style: italic; }
.article-body ul,
.article-body ol { margin: 0 0 20px 24px; }
.article-body li { margin-bottom: 8px; line-height: 1.7; }

/* Lien contextuel dans le corps */
.article-body a.inline-link {
  color: #a8a3ff;
  text-decoration: underline;
  text-decoration-color: rgba(168,163,255,.35);
  text-underline-offset: 3px;
  transition: color .15s;
}
.article-body a.inline-link:hover { color: var(--accent2); }

/* ─── BLOCS SPÉCIAUX (fond + analyse) ─── */
.article-tip {
  background: rgba(108,99,255,.1);
  border: 1px solid rgba(108,99,255,.25);
  border-radius: 12px;
  padding: 16px 20px;
  font-size: 14px;
  color: #a8a3ff;
  line-height: 1.7;
  margin: 24px 0;
}
.article-tip::before { content: '💡 '; }

.article-warn {
  background: rgba(245,166,35,.1);
  border: 1px solid rgba(245,166,35,.25);
  border-radius: 12px;
  padding: 16px 20px;
  font-size: 14px;
  color: #f5a623;
  line-height: 1.7;
  margin: 24px 0;
}
.article-warn::before { content: '⚠️ '; }

.article-body pre,
.article-code {
  background: var(--bg3);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 16px 20px;
  font-family: var(--font-mono, monospace);
  font-size: 13px;
  color: var(--text);
  overflow-x: auto;
  margin: 24px 0;
  line-height: 1.7;
}

/* ─── CONCLUSION (articles de fond) ─── */
.article-conclusion {
  background: rgba(0,212,170,.08);
  border: 1px solid rgba(0,212,170,.2);
  border-radius: 12px;
  padding: 20px 24px;
  font-size: 15px;
  color: #00d4aa;
  line-height: 1.8;
  margin: 36px 0 28px;
}

/* ─── IMAGES ─── */
.article-img {
  width: 100%;
  border-radius: 12px;
  margin: 28px 0;
  display: block;
}
.article-img-caption {
  text-align: center;
  font-size: 12px;
  color: var(--text-dim);
  margin-top: -16px;
  margin-bottom: 24px;
}
figure.article-image {
  text-align: center;
  margin: 40px 0;
}
figure.article-image img {
  max-width: 100%;
  height: auto;
  border: 1px solid var(--border);
  padding: 10px;
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,.15);
  transition: transform .3s ease, box-shadow .3s ease;
}
figure.article-image img:hover {
  transform: scale(1.02);
  box-shadow: 0 8px 24px rgba(0,0,0,.2);
}
figure.article-image figcaption {
  font-size: 12px;
  color: var(--text-dim);
  margin-top: 8px;
  font-style: italic;
}

/* ════════════════════════════════════════
   ANALYSE TECHNIQUE — classes spécifiques
   ════════════════════════════════════════ */

/* Fiche technique */
.analyse-fiche {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 24px;
  margin: 32px 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px 24px;
}
.analyse-fiche-header {
  grid-column: 1 / -1;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-dim);
  letter-spacing: .1em;
  text-transform: uppercase;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 10px;
}
.analyse-fiche-header img {
  border-radius: 6px;
}
.analyse-fiche-item .label {
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: .07em;
  margin-bottom: 3px;
}
.analyse-fiche-item .value {
  font-size: 13px;
  color: var(--text);
  font-weight: 500;
}
.analyse-fiche-item .value.green { color: var(--accent3); }
.analyse-fiche-item .value.red   { color: var(--accent2); }
.analyse-fiche-item .value.purple{ color: #a8a3ff; }

/* Sections forces / limites */
.analyse-section-title {
  font-family: 'Syne', sans-serif;
  font-size: 16px;
  font-weight: 700;
  margin: 36px 0 14px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}

.analyse-points {
  list-style: none;
  padding: 0;
  margin: 0 0 24px;
}
.analyse-points li {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 18px;
  margin-bottom: 10px;
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.6;
  transition: border-color .2s;
}
.analyse-points li:hover { border-color: var(--border-hover); }
.analyse-points li strong { color: var(--text); font-weight: 600; display: block; margin-bottom: 4px; }
.analyse-points.forces li { border-left: 3px solid var(--accent3); }
.analyse-points.limites li { border-left: 3px solid var(--accent2); }

/* Pour qui */
.analyse-profils {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 12px;
  margin: 16px 0 32px;
}
.analyse-profil {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 14px 16px;
  font-size: 13px;
}
.analyse-profil .profil-nom {
  font-weight: 600;
  color: var(--text);
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.analyse-profil .profil-detail {
  font-size: 12px;
  color: var(--text-dim);
  line-height: 1.5;
}
.profil-oui { color: var(--accent3); }
.profil-non { color: var(--accent2); }

/* Tableau tarifs */
.analyse-table-wrap {
  overflow-x: auto;
  border-radius: 12px;
  border: 1px solid var(--border);
  margin: 16px 0 32px;
}
.analyse-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.analyse-table th {
  background: var(--bg2);
  padding: 11px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: .07em;
  border-bottom: 1px solid var(--border);
  white-space: nowrap;
}
.analyse-table td {
  padding: 11px 16px;
  border-bottom: 1px solid var(--border);
  color: var(--text-muted);
  vertical-align: middle;
}
.analyse-table tr:last-child td { border-bottom: none; }
.analyse-table tr:hover td { background: rgba(255,255,255,.02); }
.analyse-table .plan-name { font-weight: 600; color: var(--text); }
.analyse-table .gratuit   { color: var(--accent3); font-weight: 600; }
.analyse-table .payant    { color: var(--accent2); }

/* Verdict */
.analyse-verdict {
  background: var(--bg2);
  border: 1px solid var(--border);
  border-radius: 14px;
  padding: 20px 24px;
  margin: 32px 0;
  display: flex;
  align-items: flex-start;
  gap: 16px;
}
.analyse-verdict-score {
  flex-shrink: 0;
  text-align: center;
  background: rgba(108,99,255,.1);
  border: 1px solid rgba(108,99,255,.25);
  border-radius: 10px;
  padding: 12px 16px;
  min-width: 72px;
}
.analyse-verdict-score .score-num {
  font-family: 'Syne', sans-serif;
  font-size: 28px;
  font-weight: 800;
  color: #a8a3ff;
  line-height: 1;
}
.analyse-verdict-score .score-label {
  font-size: 10px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: .07em;
  margin-top: 4px;
}
.analyse-verdict-text {
  font-size: 14px;
  color: var(--text-muted);
  line-height: 1.75;
  font-weight: 300;
}
.analyse-verdict-text strong { color: var(--text); font-weight: 600; }

/* CTA maillage analyse */
.analyse-cta {
  background: linear-gradient(135deg, rgba(108,99,255,.1), rgba(255,107,157,.08));
  border: 1px solid rgba(255,107,157,.25);
  border-radius: 14px;
  padding: 24px;
  margin: 36px 0;
  position: relative;
  overflow: hidden;
}
.analyse-cta::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, #6c63ff, #ff6b9d);
}
.analyse-cta p {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0 0 14px;
  font-weight: 300;
}
.analyse-cta-links {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.btn-cta-primary {
  padding: 9px 18px;
  font-size: 13px;
  font-weight: 600;
  background: linear-gradient(135deg, #6c63ff, #ff6b9d);
  color: #fff;
  border-radius: 8px;
  text-decoration: none;
  transition: opacity .2s;
}
.btn-cta-primary:hover { opacity: .85; }
.btn-cta-secondary {
  padding: 9px 18px;
  font-size: 13px;
  font-weight: 500;
  background: transparent;
  color: var(--text-muted);
  border: 1px solid var(--border-hover);
  border-radius: 8px;
  text-decoration: none;
  transition: all .15s;
}
.btn-cta-secondary:hover {
  color: var(--text);
  border-color: rgba(255,255,255,.25);
}

/* ─── TAGS ─── */
.article-tags {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 36px;
  padding-top: 24px;
  border-top: 1px solid var(--border);
}
.article-tag {
  font-size: 12px;
  padding: 4px 12px;
  background: rgba(255,255,255,.06);
  border: 1px solid var(--border);
  border-radius: 20px;
  color: var(--text-dim);
  text-decoration: none;
  transition: border-color .15s, color .15s;
}
.article-tag:hover { color: var(--text-muted); border-color: var(--border-hover); }

/* ─── NAVIGATION BAS DE PAGE ─── */
.article-nav-bottom {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  margin-top: 56px;
  padding-top: 28px;
  border-top: 1px solid var(--border);
  flex-wrap: wrap;
}
.article-nav-btn {
  display: inline-block;
  padding: 10px 20px;
  font-size: 13px;
  font-weight: 500;
  text-decoration: none;
  border: 1px solid var(--border-hover);
  border-radius: 10px;
  color: var(--text-muted);
  transition: all .2s;
}
.article-nav-btn:hover {
  color: var(--text);
  border-color: var(--accent);
  background: rgba(108,99,255,.08);
}

/* ─── RESPONSIVE ─── */
@media (max-width: 600px) {
  .article-main    { padding: 28px 16px 56px; }
  .article-title   { font-size: 22px; }
  .article-intro   { font-size: 15px; }
  .article-body    { font-size: 15px; }
  .analyse-verdict { flex-direction: column; }
  .analyse-profils { grid-template-columns: 1fr 1fr; }
  .analyse-cta-links { flex-direction: column; }
}
@media (max-width: 380px) {
  .analyse-profils { grid-template-columns: 1fr; }
   }

/* ═══════════════════════════════════════════════
   Images dans le corps d'article (figure.article-image)
   ═══════════════════════════════════════════════ */
.article-image {
  margin: 28px 0;
  text-align: center;
}

.article-image img {
  max-width: 100%;
  height: auto;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.07);
  display: block;
  margin: 0 auto;
}

.article-image figcaption {
  margin-top: 10px;
  font-size: 13px;
  color: #7a7a9a;
  font-style: italic;
  line-height: 1.4;
}

/* Évite un cadre vide disgracieux si une image placeholder
   n'a pas encore été remplacée par le vrai fichier */
.article-image img:not([src]),
.article-image img[src=""] {
  display: none;
}

/* Empêche un décalage de mise en page pendant le chargement
   de l'image (bonne pratique Core Web Vitals / CLS) */
.article-image img {
  aspect-ratio: 16 / 9;
  object-fit: cover;
  background: rgba(255, 255, 255, 0.03);
}

@media (max-width: 640px) {
  .article-image {
    margin: 20px 0;
  }
  .article-image figcaption {
    font-size: 12px;
  }
}


/* ═══════════════════════════════════════════════
   Tableaux dans le corps d'article
   ═══════════════════════════════════════════════ */
.article-body table {
  width: 100%;
  border-collapse: collapse;
  margin: 24px 0;
  font-size: 14px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
  overflow: hidden;
}

.article-body th,
.article-body td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.article-body th {
  background: rgba(108, 99, 255, 0.1);
  color: #a8a3ff;
  font-weight: 600;
  font-family: 'Syne', sans-serif;
  font-size: 13px;
  letter-spacing: 0.02em;
}

.article-body td {
  color: #c8c8d0;
}

.article-body tr:last-child td {
  border-bottom: none;
}

.article-body tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

@media (max-width: 640px) {
  .article-body table {
    font-size: 13px;
  }
  .article-body th,
  .article-body td {
    padding: 10px 12px;
  }
                   }
   

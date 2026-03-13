# Changelog

Toutes les modifications notables de ce projet seront documentées dans ce fichier.

## [Unreleased]

### Changed
- **Gemini** : passage à l’API REST (`X-goog-api-key`, modèle `gemini-flash-latest`) à la place du SDK ; suppression de la dépendance `@google/generative-ai`.

### Added
- Protection par clé API (**API_SECRET**) : accès restreint à l’API. Seules les requêtes avec `Authorization: Bearer <API_SECRET>` ou `X-API-Key: <API_SECRET>` sont acceptées. `/api/chat` et `/api/health` protégés. `lib/auth.js` + doc dans README et `.env.example`.
- Application des standards **prompt-ai** (Gardien du README + Architecte Documentation) : structure du projet documentée, CHANGELOG Keep a Changelog.

### Changed
- (À remplir)

### Fixed
- (À remplir)

### Removed
- (À remplir)

---

## [2.0.0] - 2025-03-13

### Added
- API Vercel : endpoint `POST /api/chat` et `GET /api/health`.
- Router multi-providers avec fallback (Gemini → Groq).
- Providers : `lib/providers/gemini.js`, `lib/providers/groq.js`.
- Scripts : `env:push` (pousse .env vers Vercel), `env:sync` (sync .env + .env.example + Vercel), `test:providers`, `test:api`.
- Configuration Vercel (`vercel.json`) pour les fonctions serverless dans `api/`.

### Changed
- Documentation README alignée avec la structure et les commandes réelles.

### Fixed
- Gestion de l’environnement preview (branche Git / non lié) dans env:push.
- Détection « not_linked » avec message clair pour `vercel link`.

---

*Format basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.0.0/).*

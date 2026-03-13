# AI Smart Router (API Vercel)

API unique sur **Vercel** que toutes vos applications peuvent appeler. Elle route les requêtes vers les APIs IA disponibles (Gemini → Groq → autres) avec **fallback automatique** en cas d’erreur ou de quota.

## Structure du projet

```text
ai-smart-router/
├── api/                    # Endpoints Vercel (serverless)
│   ├── chat.js             # POST /api/chat — routage IA
│   └── health.js           # GET /api/health
├── lib/
│   ├── auth.js             # Vérification API_SECRET (accès restreint)
│   ├── router.js           # Ordre des providers et fallback
│   └── providers/
│       ├── gemini.js       # Provider Gemini
│       └── groq.js         # Provider Groq
├── scripts/
│   ├── vercel-env-push.js  # Pousse .env vers Vercel
│   ├── env-sync.js         # Sync .env → .env.example + Vercel
│   ├── test-providers.js   # Test local des providers
│   ├── test-api.js         # Test HTTP /api/chat
│   └── generate-api-secret.py  # Génère une clé API_SECRET
├── .env.example            # Modèle des variables (sans valeurs)
├── vercel.json             # Config déploiement Vercel
├── package.json
├── CHANGELOG.md            # Historique des versions (Keep a Changelog)
└── README.md               # Ce fichier
```

*(Non versionnés : `.env`, `.vercel`, `node_modules`.)*

---

## Fonctionnement

1. **Un seul endpoint** : `POST /api/chat`
2. **Ordre des providers** : Gemini (priorité) → Groq → (autres à ajouter)
3. Si un provider renvoie 429 / 500 / 503 ou dépasse son quota, le router essaie le suivant.

## Déploiement sur Vercel

1. Cloner le repo et se placer dans le dossier :
   ```bash
   cd ai-smart-router
   ```

2. Installer les dépendances et déployer :
   ```bash
   npm install
   vercel
   ```

3. Configurer les variables d’environnement dans **Vercel** :  
   Remplir `.env` puis lancer **`npm run env:sync`** pour synchroniser partout (Vercel + mise à jour de `.env.example`). Alternative : `npm run env:push` pour Vercel uniquement. Prérequis : **vercel login** puis **vercel link** (une fois par dépôt). Sinon, définir les variables à la main : **Project → Settings → Environment Variables**.
   - **`API_SECRET`** — Secret pour restreindre l’accès (toi uniquement). Min. 8 caractères. Sans lui, toutes les requêtes reçoivent 401. Pour en générer une : `python scripts/generate-api-secret.py` (ou `py -3 scripts/generate-api-secret.py` sous Windows).
   - `GEMINI_API_KEY` — [Créer une clé](https://aistudio.google.com/apikey) (API REST avec `X-goog-api-key`, modèle `gemini-flash-latest`)
   - `GROQ_API_KEY` — [Créer une clé](https://console.groq.com/keys)

   **API_SECRET** est obligatoire. Au moins **une** clé de provider (Gemini ou Groq) doit être définie.

## Utilisation de l’API

**URL** : `https://votre-projet.vercel.app/api/chat`

**Méthode** : `POST`  
**Headers** : `Content-Type: application/json` + **`Authorization: Bearer <API_SECRET>`** (ou `X-API-Key: <API_SECRET>`). Sans cette clé, l’API renvoie 401.

**Body (format type OpenAI)** :
```json
{
  "messages": [
    { "role": "user", "content": "Explique-moi les microservices en une phrase." }
  ]
}
```

**Réponse** :
```json
{
  "content": "Les microservices sont...",
  "provider": "gemini",
  "model": "gemini-1.5-flash"
}
```

### Options avancées

Vous pouvez forcer un modèle par provider avec `models` :

```json
{
  "messages": [{ "role": "user", "content": "Bonjour !" }],
  "models": {
    "gemini": "gemini-1.5-pro",
    "groq": "llama-3.3-70b-versatile"
  }
}
```

## Tester en local

### Test des providers (sans lancer l’API)

Vérifie que chaque clé (.env) et le router fonctionnent :

```bash
npm run test:providers
```

ou `npm test`. Affiche un ✅/❌ pour Gemini, Groq et le router (fallback).

### Test de l’API HTTP

Lance l’API puis appelle l’endpoint :

```bash
npm run dev
```

Dans un autre terminal :

```bash
npm run test:api
```

Ou avec l’URL de ton déploiement : `node scripts/test-api.js https://ton-projet.vercel.app`

Équivalent en curl : `curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"messages\":[{\"role\":\"user\",\"content\":\"Dis bonjour\"}]}"`

## Injection des clés API vers Vercel (script)

**Commande à utiliser après avoir ajouté une clé dans `.env` :**

```bash
npm run env:sync
```

Cela met à jour `.env.example` avec les noms des nouvelles clés, puis pousse toutes les variables vers Vercel (production + development). Une seule commande pour tout synchroniser.

```bash
# Variante : pousser vers Vercel uniquement (sans toucher à .env.example)
npm run env:push

# Fichier personnalisé
node scripts/vercel-env-push.js mon-fichier.env

# Limiter aux environnements
node scripts/vercel-env-push.js .env --env production,preview
```

Prérequis : **vercel login** puis **vercel link** (si l’erreur « not_linked » apparaît, exécuter `vercel link` puis relancer). Pour ajouter d’autres variables, éditer `EXCLUDE` dans le script pour exclure d'autres noms.

## Ajouter un nouveau provider

1. Créer `lib/providers/nom-provider.js` qui exporte `generate({ apiKey, model, messages })` et retourne `{ text, provider, model }`.
2. L’enregistrer dans `lib/router.js` dans le tableau `PROVIDERS` (ordre = priorité).
3. Documenter la variable d’environnement (ex. `NOM_PROVIDER_API_KEY`) dans `.env.example` et dans le README.

---

## Maintenance & qualité

Ce projet suit les standards **prompt-ai** :
- **Keep a Changelog** pour l'historique des modifications (`CHANGELOG.md`).
- **Semantic Versioning (SemVer)** via `package.json` → `version`.
- README synchronisé avec le code (rôle « Gardien du README »).

---
*API prête pour Gemini, Groq et extensible pour d’autres fournisseurs.*

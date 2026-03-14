# API – ai-smart-router

Documentation des endpoints exposés par l’API (Vercel serverless).

**Base URL** (exemple) : `https://votre-projet.vercel.app` ou `http://localhost:3000` en local.

---

## Authentification

Les endpoints **protégés** (ex. `POST /api/chat`) exigent un secret partagé. **`GET /` et `GET /api/health` sont publics** (pas d’auth, pour sondes et monitoring).

- **Variable d’environnement** : `API_SECRET` (minimum 8 caractères).
- **En-têtes acceptés** (endpoints protégés) :
  - `Authorization: Bearer <API_SECRET>`
  - `X-API-Key: <API_SECRET>`

Si la clé est absente ou invalide sur un endpoint protégé, la réponse est **401** avec un body JSON `{ "error": "…" }`.

---

## Endpoints

### 1. POST `/api/chat`

Envoie une conversation au router IA. Un provider est choisi aléatoirement parmi ceux configurés ; en cas d’échec, le suivant dans l’ordre tiré est utilisé (fallback).

#### Requête

| Élément   | Détail |
|----------|--------|
| **Méthode** | `POST` |
| **Content-Type** | `application/json` |
| **Headers** | `Authorization: Bearer <API_SECRET>` ou `X-API-Key: <API_SECRET>` |

**Body (JSON)** :

```json
{
  "messages": [
    { "role": "user", "content": "Votre message" }
  ],
  "models": {
    "gemini": "gemini-flash-latest",
    "groq": "llama-3.3-70b-versatile",
    "nvapi": "meta/llama-3.1-8b-instruct",
    "deepseek": "deepseek-chat",
    "openrouter": "meta-llama/llama-3.1-70b-instruct"
  }
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `messages` | `array` | Oui | Liste de messages au format OpenAI. Au moins un message (souvent `role: "user"`). |
| `messages[].role` | `string` | Oui | `"user"`, `"assistant"` ou `"system"`. |
| `messages[].content` | `string` | Oui | Contenu du message. |
| `models` | `object` | Non | Override du modèle par provider (clés : `gemini`, `groq`, `nvapi`, `deepseek`, `openrouter`). |

#### Réponse succès (200)

```json
{
  "content": "Réponse générée par le modèle.",
  "provider": "gemini",
  "model": "gemini-flash-latest"
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `content` | `string` | Réponse texte du modèle. |
| `provider` | `string` | Provider utilisé : `gemini`, `groq`, `nvapi`, `deepseek`, `openrouter`. |
| `model` | `string` | Modèle effectivement utilisé. |

#### Réponses d’erreur

| Code | Signification |
|------|----------------|
| **400** | Body JSON invalide ou `messages` absent/vide. `{ "error": "…" }` |
| **401** | Clé API manquante ou invalide. |
| **405** | Méthode autre que POST. |
| **500** | Erreur côté routeur (ex. tous les providers ont échoué). `{ "error": "…" }` |
| **502** | Tous les providers ont échoué (message d’erreur dans `error`). |

#### Exemple cURL

```bash
curl -X POST "https://votre-projet.vercel.app/api/chat" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_API_SECRET" \
  -d '{"messages":[{"role":"user","content":"Qu'\''est-ce qu'\''un microservice ?"}]}'
```

---

### 2. POST `/api/normalize`

Extraction de données structurées : envoie un texte libre et reçoit un JSON normalisé (id, statut, donnees, message). Utilise le même router IA que `/api/chat` avec un prompt d’extraction dédié. **Protégé** par `API_SECRET`.

#### Requête

| Élément   | Détail |
|----------|--------|
| **Méthode** | `POST` |
| **Content-Type** | `application/json` |
| **Headers** | `Authorization: Bearer <API_SECRET>` ou `X-API-Key: <API_SECRET>` |

**Body (JSON)** :

```json
{
  "text": "L'utilisateur Jean Dupont a fini son test avec 85% aujourd'hui le 13 mars 2026."
}
```

| Champ | Type | Obligatoire | Description |
|-------|------|-------------|-------------|
| `text` | `string` | Oui | Texte à analyser (max 32 Ko). |

#### Réponse succès (200)

Objet JSON normalisé (exemple) :

```json
{
  "id": "USR-001",
  "statut": "actif",
  "donnees": {
    "nom": "Jean Dupont",
    "score": 85,
    "date_iso": "2026-03-13"
  },
  "message": "Test terminé avec succès"
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `id` | `string` \| `null` | Identifiant unique si trouvé. |
| `statut` | `string` | `"actif"` \| `"inactif"` \| `"erreur"`. |
| `donnees` | `object` | `nom`, `score` (number 0–100), `date_iso` (YYYY-MM-DD). Valeurs manquantes → `null`. |
| `message` | `string` \| `null` | Résumé court. |

#### Réponses d’erreur

| Code | Signification |
|------|----------------|
| **400** | Body invalide ou champ `text` absent. |
| **401** | Clé API manquante ou invalide. |
| **405** | Méthode autre que POST. |
| **413** | Texte trop long. |
| **422** | Le modèle n’a pas renvoyé un JSON valide. |
| **500** / **502** | Erreur routeur ou providers. |

#### Exemple cURL

```bash
curl -X POST "https://votre-projet.vercel.app/api/normalize" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer VOTRE_API_SECRET" \
  -d '{"text":"L'\''utilisateur Jean Dupont a fini son test avec 85% aujourd'\''hui le 13 mars 2026."}'
```

---

### 3. GET `/api/health` (et `GET /`)

Vérification de l’état du service et liste des providers configurés. La racine **`GET /`** est réécrite vers `/api/health` (même réponse, évite un 404). **Public** : aucune authentification requise (sondes, monitoring, load balancers).

#### Requête

| Élément | Détail |
|---------|--------|
| **Méthode** | `GET` |
| **Headers** | Aucun requis. |

Pas de body.

#### Réponse succès (200)

```json
{
  "ok": true,
  "service": "ai-smart-router",
  "providers": ["gemini", "groq", "nvapi", "deepseek", "openrouter"]
}
```

| Champ | Type | Description |
|-------|------|-------------|
| `ok` | `boolean` | Toujours `true` en 200. |
| `service` | `string` | Nom du service. |
| `providers` | `string[]` | Liste des providers enregistrés dans le router. |

#### Réponses d’erreur

| Code | Signification |
|------|----------------|
| **405** | Méthode autre que GET. |

#### Exemple cURL

```bash
curl -X GET "https://votre-projet.vercel.app/api/health"
```

---

## CORS

- **Access-Control-Allow-Origin** : `*`
- **Access-Control-Allow-Methods** : selon l’endpoint (GET pour `/api/health`, POST pour `/api/chat` et `/api/normalize`).
- **Access-Control-Allow-Headers** : `Content-Type`, `Authorization`, `X-API-Key`.

Les requêtes **OPTIONS** sont acceptées et renvoient **204** sans body.

---

## Sécurité

- **Authentification** : comparaison constant-time du token (réduction des attaques par timing).
- **En-têtes de réponse** : `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `X-XSS-Protection`, `Referrer-Policy`, `Cache-Control: no-store`.
- **POST /api/chat** :
  - Body brut limité à 256 Ko (réponse **413** si dépassement).
  - `messages` : max 50 messages, rôles autorisés `user` / `assistant` / `system`, contenu max 64 Ko par message.
  - Au moins un message `user` non vide requis.
  - Clés `models` (overrides) validées (chaînes, max 200 caractères par modèle).

---

## Ordre des providers (répartition aléatoire + fallback)

À **chaque requête**, l’ordre des providers est **tiré aléatoirement** parmi ceux qui ont une clé configurée. Ainsi le quota est réparti entre tous les providers au lieu de surcharger toujours le premier.

En cas d’échec (quota 429, 5xx, etc.), le router essaie le provider **suivant dans cet ordre aléatoire**.

Providers possibles : **gemini**, **groq**, **nvapi** (NVIDIA NIM), **deepseek**, **openrouter**. Ceux sans clé API dans l’environnement sont ignorés.

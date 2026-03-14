# API – ai-smart-router

Documentation des endpoints exposés par l’API (Vercel serverless).

**Base URL** (exemple) : `https://votre-projet.vercel.app` ou `http://localhost:3000` en local.

---

## Authentification

Tous les endpoints sont protégés par un secret partagé.

- **Variable d’environnement** : `API_SECRET` (minimum 8 caractères).
- **En-têtes acceptés** :
  - `Authorization: Bearer <API_SECRET>`
  - `X-API-Key: <API_SECRET>`

Si la clé est absente ou invalide, les réponses sont en **401** avec un body JSON `{ "error": "…" }`.

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

### 2. GET `/api/health` (et `GET /`)

Vérification de l’état du service et liste des providers configurés. La racine **`GET /`** est réécrite vers `/api/health` (même réponse, évite un 404).

#### Requête

| Élément | Détail |
|---------|--------|
| **Méthode** | `GET` |
| **Headers** | `Authorization: Bearer <API_SECRET>` ou `X-API-Key: <API_SECRET>` |

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
| **401** | Clé API manquante ou invalide. |
| **405** | Méthode autre que GET. |

#### Exemple cURL

```bash
curl -X GET "https://votre-projet.vercel.app/api/health" \
  -H "Authorization: Bearer VOTRE_API_SECRET"
```

---

## CORS

- **Access-Control-Allow-Origin** : `*`
- **Access-Control-Allow-Methods** : selon l’endpoint (GET pour `/api/health`, POST pour `/api/chat`).
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

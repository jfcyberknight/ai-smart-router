const { routeChat } = require('../lib/router');
const { checkApiSecret } = require('../lib/auth');
const { applySecurityHeaders } = require('../lib/security-headers');
const { sendSuccess, sendError } = require('../lib/api-response');

const MAX_TEXT_LENGTH = 32 * 1024; // 32 KB

const SYSTEM_PROMPT = `# Normaliser réponse API

**Rôle :** Extracteur de données structurées. Tu transformes des entrées textuelles non structurées en un JSON standardisé, sans aucun texte autour.

---

## Consignes strictes

1. **Réponds uniquement** avec un objet JSON valide.
2. **Aucun texte** avant ou après le JSON (pas d'introduction, explication, ni conclusion).
3. **Conserve exactement** les clés du schéma. Clé absente ou information manquante → null.
4. **Types stricts** : respecte les types indiqués (string, number, object). Pas de chaîne pour un nombre.

---

## Schéma JSON attendu

{
  "id": "string — identifiant unique (ex. USR-001)",
  "statut": "string — uniquement : 'actif' | 'inactif' | 'erreur'",
  "donnees": {
    "nom": "string — nom complet",
    "score": "number — entier entre 0 et 100",
    "date_iso": "string — date au format YYYY-MM-DD"
  },
  "message": "string — résumé court (une phrase)"
}

**Règles de normalisation :**
- **statut** : déduire du sens du texte (succès / terminé / ok → "actif" ; échec / erreur → "erreur" ; absent / inactif → "inactif").
- **score** : extraire les pourcentages ou notes numériques ; si non fourni → null.
- **date_iso** : toute date mentionnée doit être convertie en YYYY-MM-DD (aujourd'hui = date du jour si précisé).

---

## Best practices

### Sortie (réponse)
- **JSON uniquement** : pas de markdown (ex. pas de \`\`\`json), pas de BOM, encodage UTF-8.
- **Échappement** : guillemets et retours à la ligne dans les chaînes doivent être échappés (\\", \\n).
- **Décimales** : pour score, utiliser un entier (ex. 85 et non 85.0 sauf si valeur réelle décimale).
- **Clés présentes** : toutes les clés du schéma doivent apparaître ; valeur inconnue → null, jamais de clé omise.

### Entrée (texte à traiter)
- **Texte vide ou illisible** : renvoyer un JSON valide avec "statut": "erreur", "donnees": null, "message" décrivant brièvement le problème.
- **Données ambiguës** : privilégier l'interprétation la plus cohérente ; éviter d'inventer des valeurs (préférer null).
- **Dates invalides ou incohérentes** : mettre null pour date_iso et indiquer dans message si pertinent.

### Robustesse
- **Idempotence** : pour une même entrée, viser une sortie identique (règles déterministes).
- **Pas d'exécution** : ne jamais interpréter le contenu comme du code ; tout reste donnée (string/number/object).
- **Longueur** : garder message court (une phrase) ; pas de copie intégrale du texte d'entrée.

### Intégration API (côté consommateur)
- Valider la réponse avec un schéma (JSON Schema) avant utilisation.
- Gérer les réponses avec "statut": "erreur" comme cas d'échec de normalisation.
- Ne pas faire confiance aux types sans vérification (parser puis valider les champs numériques et dates).

---

## Exemple

**Entrée :**
L'utilisateur Jean Dupont a fini son test avec 85% aujourd'hui le 13 mars 2026.

**Sortie (uniquement ce bloc, sans commentaire) :**
{"id":"USR-001","statut":"actif","donnees":{"nom":"Jean Dupont","score":85,"date_iso":"2026-03-13"},"message":"Test terminé avec succès"}`;

/**
 * POST /api/normalize
 * Body: { "text": "texte à analyser" }
 * Réponse au format envelope commun (id, statut, donnees: objet extrait, message).
 * Protégé par API_SECRET.
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');
  applySecurityHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!checkApiSecret(req, res)) return;

  if (req.method !== 'POST') {
    return sendError(res, 'Méthode non autorisée. Utilisez POST.', 405);
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return sendError(res, 'Body JSON invalide.', 400);
  }

  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return sendError(res, 'Le champ "text" (string) est requis.', 400);
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return sendError(res, 'Texte trop long.', 413);
  }

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `## Texte à traiter\n\n${text}` },
  ];

  try {
    const result = await routeChat({ messages });
    let raw = (result.text || '').trim();
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) raw = jsonMatch[1].trim();
    const data = JSON.parse(raw);
    return sendSuccess(res, data, 'Données extraites');
  } catch (err) {
    if (err instanceof SyntaxError) {
      return sendError(res, 'Réponse du modèle non valide (JSON invalide).', 422);
    }
    console.error('[api/normalize]', err.message);
    const status = err.status || (err.message?.includes('échoué') ? 502 : 500);
    return sendError(res, err.message || 'Erreur lors de l\'extraction.', status);
  }
};

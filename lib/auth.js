const crypto = require('crypto');
const { sendError } = require('./api-response');

/**
 * Comparaison constant-time pour éviter les attaques par timing.
 */
function secureCompare(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  if (ha.length !== hb.length) return false;
  return crypto.timingSafeEqual(ha, hb);
}

/**
 * Vérifie que la requête contient le secret API (réservé à l'usage personnel).
 * En-têtes acceptés : Authorization: Bearer <API_SECRET> ou X-API-Key: <API_SECRET>
 * Si API_SECRET n'est pas défini en env, toutes les requêtes sont rejetées (401).
 * Réponse 401 au format envelope commun (statut: "erreur", donnees: null, message).
 */
function checkApiSecret(req, res) {
  const secret = process.env.API_SECRET;
  if (!secret || secret.length < 8) {
    sendError(res, 'Accès refusé. Définissez API_SECRET dans les variables d\'environnement (8 caractères min).', 401);
    return false;
  }
  const authHeader = req.headers.authorization || '';
  const apiKeyHeader = req.headers['x-api-key'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : apiKeyHeader.trim();
  if (!token || !secureCompare(token, secret)) {
    sendError(res, 'Clé API invalide ou manquante.', 401);
    return false;
  }
  return true;
}

module.exports = { checkApiSecret };

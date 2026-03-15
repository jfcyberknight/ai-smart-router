const crypto = require('crypto');

/**
 * Génère un identifiant de requête pour corrélation et logs.
 * @returns {string} "req-" + 8 caractères hex
 */
function genRequestId() {
  return 'req-' + crypto.randomBytes(4).toString('hex');
}

/**
 * Envelope commun de réponse API (toutes les routes).
 * @param {string|null} id - Identifiant de la requête (optionnel)
 * @param {'actif'|'inactif'|'erreur'} statut
 * @param {object|array|null} donnees - Payload métier
 * @param {string} message - Résumé court ou message d'erreur
 * @returns {object}
 */
function envelope(id, statut, donnees, message) {
  return {
    id: id || null,
    statut,
    donnees: donnees ?? null,
    message: typeof message === 'string' ? message : '',
  };
}

/**
 * Envoie une réponse succès (2xx) au format envelope.
 * @param {object} res - Objet réponse HTTP
 * @param {object|array|null} donnees - Payload métier
 * @param {string} message - Résumé court
 * @param {number} [statusCode=200]
 * @param {string|null} [requestId=null] - Si null, un id est généré
 */
function sendSuccess(res, donnees, message, statusCode = 200, requestId = null) {
  const id = requestId ?? genRequestId();
  res.status(statusCode).json(envelope(id, 'actif', donnees, message));
}

/**
 * Envoie une réponse erreur (4xx/5xx) au format envelope.
 * Pas de fuite de détail technique dans message (usage production).
 * @param {object} res - Objet réponse HTTP
 * @param {string} message - Message lisible pour le client
 * @param {number} statusCode - 400, 401, 404, 405, 413, 422, 500, 502, etc.
 * @param {string|null} [requestId=null]
 */
function sendError(res, message, statusCode, requestId = null) {
  const id = requestId ?? genRequestId();
  res.status(statusCode).json(envelope(id, 'erreur', null, message));
}

module.exports = {
  genRequestId,
  envelope,
  sendSuccess,
  sendError,
};

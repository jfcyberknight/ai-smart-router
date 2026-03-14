const { routeChat } = require('../lib/router');
const { checkApiSecret } = require('../lib/auth');
const { applySecurityHeaders } = require('../lib/security-headers');
const { sendSuccess, sendError } = require('../lib/api-response');
const {
  validateBodySize,
  validateMessages,
  validateModelOverrides,
} = require('../lib/validate-chat');

/**
 * POST /api/chat
 * Header requis : Authorization: Bearer <API_SECRET> ou X-API-Key: <API_SECRET>
 * Body: { messages: [...], models?: {...} }
 * Réponse au format envelope commun (id, statut, donnees: { content, provider, model }, message).
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

  const rawBody = typeof req.body === 'string' ? req.body : (req.body && JSON.stringify(req.body)) || '';
  const sizeCheck = validateBodySize(rawBody);
  if (!sizeCheck.ok) {
    return sendError(res, sizeCheck.error, 413);
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return sendError(res, 'Body JSON invalide.', 400);
  }

  const { messages, models: modelOverrides } = body;
  const msgValidation = validateMessages(messages);
  if (!msgValidation.ok) {
    return sendError(res, msgValidation.error, 400);
  }
  const modelOverridesValid = validateModelOverrides(modelOverrides);

  try {
    const result = await routeChat({
      messages: msgValidation.messages,
      modelOverrides: modelOverridesValid,
    });
    return sendSuccess(
      res,
      {
        content: result.text,
        provider: result.provider,
        model: result.model,
      },
      'Réponse générée'
    );
  } catch (err) {
    console.error('[api/chat]', err.message);
    const status = err.status || (err.message?.includes('échoué') ? 502 : 500);
    return sendError(res, err.message || 'Erreur lors du routage vers les APIs IA.', status);
  }
};

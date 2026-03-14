const { PROVIDERS } = require('../lib/router');
const { applySecurityHeaders } = require('../lib/security-headers');
const { sendSuccess, sendError } = require('../lib/api-response');

/**
 * GET /api/health (et GET / via rewrite)
 * Public : pas d’authentification, pour sondes de disponibilité et monitoring.
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-API-Key');
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    return sendError(res, 'Méthode non autorisée', 405);
  }
  sendSuccess(
    res,
    {
      ok: true,
      service: 'ai-smart-router',
      providers: PROVIDERS.map((p) => p.id),
    },
    'Service opérationnel'
  );
};

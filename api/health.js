const { checkApiSecret } = require('../lib/auth');
const { PROVIDERS } = require('../lib/router');
const { applySecurityHeaders } = require('../lib/security-headers');

/**
 * GET /api/health
 * Protégé par API_SECRET (même clé que /api/chat).
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-API-Key');
  applySecurityHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!checkApiSecret(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });
  res.status(200).json({
    ok: true,
    service: 'ai-smart-router',
    providers: PROVIDERS.map((p) => p.id),
  });
};

const { routeChat } = require('../lib/router');
const { checkApiSecret } = require('../lib/auth');

/**
 * POST /api/chat
 * Header requis : Authorization: Bearer <API_SECRET> ou X-API-Key: <API_SECRET>
 * Body: { messages: [{ role: "user"|"assistant"|"system", content: string }], models?: { gemini?: string, groq?: string } }
 * Réponse: { content: string, provider: string, model: string }
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!checkApiSecret(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée. Utilisez POST.' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
  } catch {
    return res.status(400).json({ error: 'Body JSON invalide.' });
  }

  const { messages, models: modelOverrides } = body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({
      error: 'Le champ "messages" est requis et doit être un tableau non vide (format OpenAI).',
    });
  }

  try {
    const result = await routeChat({
      messages,
      modelOverrides: modelOverrides || {},
    });
    return res.status(200).json({
      content: result.text,
      provider: result.provider,
      model: result.model,
    });
  } catch (err) {
    console.error('[api/chat]', err.message);
    const status = err.status || (err.message?.includes('échoué') ? 502 : 500);
    return res.status(status).json({
      error: err.message || 'Erreur lors du routage vers les APIs IA.',
    });
  }
};

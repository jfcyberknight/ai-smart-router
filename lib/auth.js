/**
 * Vérifie que la requête contient le secret API (réservé à l'usage personnel).
 * En-têtes acceptés : Authorization: Bearer <API_SECRET> ou X-API-Key: <API_SECRET>
 * Si API_SECRET n'est pas défini en env, toutes les requêtes sont rejetées (401).
 */
function checkApiSecret(req, res) {
  const secret = process.env.API_SECRET;
  if (!secret || secret.length < 8) {
    res.status(401).json({
      error: 'Accès refusé. Définissez API_SECRET dans les variables d\'environnement (8 caractères min).',
    });
    return false;
  }
  const authHeader = req.headers.authorization || '';
  const apiKeyHeader = req.headers['x-api-key'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : apiKeyHeader.trim();
  if (token !== secret) {
    res.status(401).json({ error: 'Clé API invalide ou manquante.' });
    return false;
  }
  return true;
}

module.exports = { checkApiSecret };

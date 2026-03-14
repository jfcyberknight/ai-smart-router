/**
 * En-têtes de sécurité pour les réponses API (bonnes pratiques OWASP).
 * Réduit les risques XSS, clickjacking, MIME sniffing.
 */
function applySecurityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
}

module.exports = { applySecurityHeaders };

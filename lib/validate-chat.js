/**
 * Validation des entrées pour POST /api/chat (limites et format).
 * Limite les abus et les payloads malformés.
 */

const ALLOWED_ROLES = new Set(['user', 'assistant', 'system']);
const MAX_MESSAGES = 50;
const MAX_CONTENT_LENGTH = 64 * 1024; // 64 KB par message
const MAX_BODY_RAW_LENGTH = 256 * 1024; // 256 KB body brut

/**
 * Valide le body brut (taille) avant parsing.
 * @param {string|object} rawBody - Body reçu (string ou déjà parsé)
 * @returns {{ ok: boolean, error?: string }}
 */
function validateBodySize(rawBody) {
  if (typeof rawBody === 'string' && rawBody.length > MAX_BODY_RAW_LENGTH) {
    return { ok: false, error: 'Body trop volumineux.' };
  }
  return { ok: true };
}

/**
 * Valide le tableau messages (format OpenAI).
 * @param {unknown} messages
 * @returns {{ ok: boolean, error?: string, messages?: Array<{ role: string, content: string }> }}
 */
function validateMessages(messages) {
  if (!Array.isArray(messages)) {
    return { ok: false, error: 'Le champ "messages" doit être un tableau.' };
  }
  if (messages.length === 0) {
    return { ok: false, error: 'Le tableau "messages" ne doit pas être vide.' };
  }
  if (messages.length > MAX_MESSAGES) {
    return { ok: false, error: `Maximum ${MAX_MESSAGES} messages par requête.` };
  }

  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (!m || typeof m !== 'object') {
      return { ok: false, error: `Message ${i + 1}: objet invalide.` };
    }
    const role = m.role;
    if (!role || !ALLOWED_ROLES.has(role)) {
      return { ok: false, error: `Message ${i + 1}: role invalide (user, assistant, system).` };
    }
    let content = m.content;
    if (typeof content !== 'string') {
      if (Array.isArray(content) && content[0]?.text) {
        content = content[0].text;
      } else {
        content = '';
      }
    }
    if (content.length > MAX_CONTENT_LENGTH) {
      return { ok: false, error: `Message ${i + 1}: contenu trop long (max ${MAX_CONTENT_LENGTH} caractères).` };
    }
    out.push({ role, content: content.trim() });
  }

  const hasUser = out.some((m) => m.role === 'user' && m.content.length > 0);
  if (!hasUser) {
    return { ok: false, error: 'Au moins un message utilisateur non vide est requis.' };
  }

  return { ok: true, messages: out };
}

/**
 * Valide models override (objet optionnel, clés string, valeurs string).
 */
function validateModelOverrides(models) {
  if (models == null || typeof models !== 'object') return {};
  const out = {};
  for (const [k, v] of Object.entries(models)) {
    if (typeof k === 'string' && typeof v === 'string' && v.length <= 200) {
      out[k] = v;
    }
  }
  return out;
}

module.exports = {
  validateBodySize,
  validateMessages,
  validateModelOverrides,
  MAX_MESSAGES,
  MAX_CONTENT_LENGTH,
};

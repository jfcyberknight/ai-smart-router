const DEFAULT_MODEL = 'gemini-flash-latest';

const GEMINI_URL = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

/**
 * Convertit les messages OpenAI (role/content) en contents Gemini (role + parts).
 */
function toGeminiContents(messages) {
  const contents = [];
  for (const msg of messages) {
    const role = msg.role === 'assistant' ? 'model' : 'user';
    const text = typeof msg.content === 'string' ? msg.content : msg.content?.[0]?.text ?? '';
    if (!text.trim()) continue;
    contents.push({ role, parts: [{ text }] });
  }
  return contents;
}

/**
 * Provider Gemini – appel REST (X-goog-api-key), modèle gemini-flash-latest par défaut.
 */
async function generate({ apiKey, model = DEFAULT_MODEL, messages }) {
  if (!apiKey) throw new Error('GEMINI_API_KEY manquant');

  const contents = toGeminiContents(messages);
  if (contents.length === 0) throw new Error('Aucun message utilisateur');

  const body = { contents };

  const res = await fetch(GEMINI_URL(model), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error?.message || `Gemini API ${res.status}`);
    err.status = res.status;
    err.response = { status: res.status };
    throw err;
  }

  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
  return { text, provider: 'gemini', model };
}

module.exports = { generate, DEFAULT_MODEL };

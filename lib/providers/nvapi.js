/**
 * Provider NVIDIA NIM (NVAPI) – API compatible OpenAI.
 * Doc: https://docs.api.nvidia.com/nim/reference/create_chat_completion_v1_chat_completions_post-4
 * Pas de SDK requis : REST avec Bearer token.
 */
const NVAPI_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODEL = 'meta/llama-3.1-8b-instruct';

async function generate({ apiKey, model = DEFAULT_MODEL, messages }) {
  if (!apiKey) throw new Error('NVAPI_API_KEY manquant');

  const res = await fetch(NVAPI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content : m.content?.[0]?.text ?? '',
      })),
      max_tokens: 4096,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    const e = new Error(`NVIDIA NIM API: ${res.status} ${err}`);
    e.status = res.status;
    e.response = { status: res.status };
    throw e;
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return { text, provider: 'nvapi', model: data.model || model };
}

module.exports = { generate, DEFAULT_MODEL };

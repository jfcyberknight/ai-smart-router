#!/usr/bin/env node
/**
 * Teste l'API déployée (health + chat) depuis ici.
 * Usage: node scripts/test-api-deployed.js [URL]
 * URL par défaut: https://ai-smart-router.vercel.app (ou API_BASE_URL dans .env)
 * Lit .env pour API_SECRET.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return {};
  const content = fs.readFileSync(envPath, 'utf8');
  const vars = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1).replace(/\\n/g, '\n');
    }
    vars[key] = value;
  }
  return vars;
}

const env = loadEnv();
Object.assign(process.env, env);

const base = process.argv[2] || process.env.API_BASE_URL || 'https://ai-smart-router.vercel.app';
const baseNorm = base.replace(/\/$/, '');
const apiSecret = env.API_SECRET;

function authHeaders() {
  const h = {};
  if (apiSecret) h['Authorization'] = 'Bearer ' + apiSecret;
  return h;
}

async function testHealth() {
  const url = baseNorm + '/api/health';
  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
    signal: AbortSignal.timeout(10000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Health: réponse non-JSON (${res.status}) ${text.slice(0, 100)}`);
  }
  if (!res.ok) {
    throw new Error(`Health ${res.status}: ${data.message || text}`);
  }
  if (data.statut !== 'actif' || !data.donnees || data.donnees.ok !== true || !Array.isArray(data.donnees.providers)) {
    throw new Error(`Health: format invalide (envelope statut/donnees attendu): ${JSON.stringify(data)}`);
  }
  return data.donnees;
}

async function testChat() {
  const url = baseNorm + '/api/chat';
  const body = JSON.stringify({
    messages: [{ role: 'user', content: 'Réponds en un mot : bonjour.' }],
  });
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body,
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Chat: réponse non-JSON (${res.status}) ${text.slice(0, 100)}`);
  }
  if (!res.ok) {
    throw new Error(`Chat ${res.status}: ${data.message || text}`);
  }
  const payload = data.donnees || {};
  if (data.statut !== 'actif' || typeof payload.content !== 'string' || !payload.provider || !payload.model) {
    throw new Error(`Chat: format invalide (content, provider, model attendus): ${JSON.stringify(Object.keys(data))}`);
  }
  return payload;
}

async function run() {
  if (!apiSecret) {
    console.error('❌ API_SECRET manquant dans .env (requis pour l’API déployée).');
    process.exit(1);
  }
  console.log('🧪 Test API déployée:', baseNorm, '\n');

  try {
    const health = await testHealth();
    console.log('✅ GET /api/health');
    console.log('   service:', health.service);
    console.log('   providers:', health.providers?.join(', ') || '-', '\n');

    const chat = await testChat();
    console.log('✅ POST /api/chat');
    console.log('   provider:', chat.provider);
    console.log('   model:', chat.model);
    console.log('   content:', (chat.content || '').trim().slice(0, 120) + (chat.content?.length > 120 ? '…' : ''), '\n');

    console.log('✅ Tous les tests API ont réussi.');
  } catch (err) {
    console.error('❌', err.message);
    if (err.message.includes('404')) {
      console.error('\n   → Redéployez (npm run deploy ou git push) puis attendez la fin du build.');
      console.error('   → Vercel > Project Settings > General : Framework Preset = Other (pas Next.js).');
    }
    process.exit(1);
  }
}

run();

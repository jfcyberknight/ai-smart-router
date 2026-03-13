#!/usr/bin/env node
/**
 * Teste chaque provider dont la clé API est présente dans .env.
 * Détecte automatiquement les variables *_API_KEY et teste les providers
 * qui ont un module dans lib/providers/<id>.js (id = préfixe en minuscules).
 * Usage: node scripts/test-providers.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PROVIDERS_DIR = path.join(ROOT, 'lib', 'providers');

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

/**
 * Retourne la liste des providers détectés depuis .env :
 * clés *_API_KEY (hors API_SECRET) → id = préfixe en minuscules.
 */
function getProviderKeysFromEnv(env) {
  const providerKeys = [];
  for (const key of Object.keys(env)) {
    if (key === 'API_SECRET') continue;
    const m = key.match(/^(.+)_API_KEY$/);
    if (!m) continue;
    const id = m[1].toLowerCase();
    const value = env[key];
    if (value && value.trim()) providerKeys.push({ id, envKey: key });
  }
  return providerKeys;
}

function providerModulePath(id) {
  return path.join(PROVIDERS_DIR, `${id}.js`);
}

function hasProviderModule(id) {
  return fs.existsSync(providerModulePath(id));
}

const TEST_MESSAGES = [
  { role: 'user', content: 'Réponds en une seule phrase : qu\'est-ce qu\'un microservice ?' },
];

function truncate(str, max = 120) {
  if (!str || typeof str !== 'string') return '(vide)';
  const s = str.trim();
  return s.length <= max ? s : s.slice(0, max) + '…';
}

function displayName(id) {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

async function testOneProvider(env, { id, envKey }) {
  const modulePath = providerModulePath(id);
  if (!hasProviderModule(id)) {
    console.log(`⏭️  ${displayName(id)} (${envKey} présente, lib/providers/${id}.js absent)\n`);
    return;
  }
  const apiKey = env[envKey];
  if (!apiKey) {
    console.log(`⏭️  ${displayName(id)} (${envKey} absente)\n`);
    return;
  }
  try {
    const provider = require(modulePath);
    const out = await provider.generate({
      apiKey,
      messages: TEST_MESSAGES,
    });
    console.log(`✅ ${displayName(id)}`);
    console.log('   Réponse:', truncate(out.text));
    console.log('   Modèle:', out.model ?? '-', '\n');
  } catch (e) {
    console.log(`❌ ${displayName(id)}`);
    console.log('   Erreur:', e.message, '\n');
  }
}

async function run() {
  const env = loadEnv();
  const providerKeys = getProviderKeysFromEnv(env);

  if (providerKeys.length === 0) {
    console.error('❌ Aucune clé *_API_KEY trouvée dans .env (ex. GEMINI_API_KEY, GROQ_API_KEY).');
    process.exit(1);
  }

  console.log('🧪 Test des providers (clés trouvées dans .env)\n');

  for (const item of providerKeys) {
    await testOneProvider(env, item);
  }

  // Test du router (fallback) : on injecte tout le .env
  const routerProviders = providerKeys.filter((p) => hasProviderModule(p.id)).map((p) => p.id);
  if (routerProviders.length > 0) {
    for (const key of Object.keys(env)) {
      process.env[key] = env[key];
    }
    console.log('🔄 Test du router (fallback ' + routerProviders.join(' → ') + ')');
    try {
      const { routeChat } = require('../lib/router');
      const result = await routeChat({ messages: TEST_MESSAGES });
      console.log('✅ Router');
      console.log('   Provider utilisé:', result.provider);
      console.log('   Réponse:', truncate(result.text));
      console.log('   Modèle:', result.model);
    } catch (e) {
      console.log('❌ Router');
      console.log('   Erreur:', e.message);
    }
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
/**
 * Teste l'endpoint POST /api/chat (API locale ou déployée).
 * Usage: node scripts/test-api.js [URL]
 * Lit .env pour API_SECRET (obligatoire si l'API est protégée).
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
Object.assign(process.env, loadEnv());

const base = process.argv[2] || 'http://localhost:3000';
const url = base.replace(/\/$/, '') + '/api/chat';
const apiSecret = process.env.API_SECRET;
const body = JSON.stringify({
  messages: [{ role: 'user', content: 'Réponds en une phrase : qu’est-ce qu’un microservice ?' }],
});
const headers = { 'Content-Type': 'application/json' };
if (apiSecret) headers['Authorization'] = 'Bearer ' + apiSecret;

async function run() {
  console.log('🧪 Test API:', url, apiSecret ? '(avec API_SECRET)' : '(sans clé)', '\n');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    const data = await res.json();
    if (!res.ok) {
      console.log('❌ Erreur', res.status, data.error || data);
      process.exit(1);
    }
    console.log('✅ Statut:', res.status);
    console.log('   Provider:', data.provider);
    console.log('   Modèle:', data.model);
    console.log('   Réponse:', (data.content || '').trim().slice(0, 200) + (data.content?.length > 200 ? '…' : ''));
  } catch (e) {
    console.error('❌', e.message);
    if (e.cause?.code === 'ECONNREFUSED') {
      console.error('   Lancez l’API dans un autre terminal : npm run dev');
    }
    process.exit(1);
  }
}

run();

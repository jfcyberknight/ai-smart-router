#!/usr/bin/env node
/**
 * Teste l'endpoint POST /api/chat (API locale ou déployée).
 * Si l'URL cible localhost et que le serveur ne répond pas, démarre automatiquement vercel dev.
 * Usage: node scripts/test-api.js [URL]
 * Lit .env pour API_SECRET (obligatoire si l'API est protégée).
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DEFAULT_PORT = 3000;
const SERVER_START_TIMEOUT_MS = 45000;
const POLL_INTERVAL_MS = 800;

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

const base = process.argv[2] || `http://localhost:${DEFAULT_PORT}`;
const baseNorm = base.replace(/\/$/, '');
const url = baseNorm + '/api/chat';
const apiSecret = process.env.API_SECRET;
const body = JSON.stringify({
  messages: [{ role: 'user', content: 'Réponds en une phrase : qu\'est-ce qu\'un microservice ?' }],
});
const headers = { 'Content-Type': 'application/json' };
if (apiSecret) headers['Authorization'] = 'Bearer ' + apiSecret;

function isLocalhost(u) {
  try {
    const host = new URL(u).hostname;
    return host === 'localhost' || host === '127.0.0.1';
  } catch {
    return false;
  }
}

function getPort(u) {
  try {
    const p = new URL(u).port;
    return p ? parseInt(p, 10) : DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT;
  }
}

async function checkServerReady(healthUrl) {
  try {
    const res = await fetch(healthUrl, {
      method: 'GET',
      headers: apiSecret ? { 'Authorization': 'Bearer ' + apiSecret } : {},
      signal: AbortSignal.timeout(3000),
    });
    return res.status === 200 || res.status === 401;
  } catch {
    return false;
  }
}

function startVercelDev(port) {
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['vercel', 'dev', '--listen', String(port)], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      detached: process.platform !== 'win32',
    });
    let resolved = false;
    const onReady = () => {
      if (resolved) return;
      resolved = true;
      child.removeAllListeners();
      resolve();
    };
    const checkOutput = (data) => {
      const text = data.toString();
      if (/Ready!|Available at|ready in/i.test(text)) setTimeout(onReady, 1500);
    };
    child.stdout.on('data', checkOutput);
    child.stderr.on('data', checkOutput);
    child.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        reject(err);
      }
    });
    child.on('close', (code, signal) => {
      if (!resolved && code !== 0 && code != null) {
        resolved = true;
        reject(new Error(`vercel dev a quitté (code ${code})`));
      }
    });
    if (child.unref) child.unref();
  });
}

async function ensureServerRunning() {
  if (!isLocalhost(baseNorm)) return;
  const port = getPort(baseNorm);
  const healthUrl = `http://localhost:${port}/api/health`;
  if (await checkServerReady(healthUrl)) return;
  console.log('🔄 Serveur local non démarré. Démarrage de vercel dev sur le port', port, '...\n');
  const serverPromise = startVercelDev(port);
  const start = Date.now();
  while (Date.now() - start < SERVER_START_TIMEOUT_MS) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    if (await checkServerReady(healthUrl)) {
      await serverPromise.catch(() => {});
      console.log('✅ Serveur prêt.\n');
      return;
    }
  }
  await serverPromise.catch(() => {});
  if (!(await checkServerReady(healthUrl))) {
    console.error('❌ Le serveur n’a pas répondu à temps. Vérifiez que le projet est lié (vercel link) et relancez.');
    process.exit(1);
  }
}

async function run() {
  await ensureServerRunning();
  console.log('🧪 Test API:', url, apiSecret ? '(avec API_SECRET)' : '(sans clé)', '\n');
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body,
    });
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (res.status === 404 || /<!DOCTYPE|The page could not be found/i.test(text)) {
        console.error('❌ Route /api/chat introuvable (404). Liez le projet avec: vercel link');
        process.exit(1);
      }
      console.error('❌ Réponse non-JSON:', text.slice(0, 200));
      process.exit(1);
    }
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
      console.error('   Le serveur n’a pas démarré. Vérifiez: vercel link puis npm run test:api');
    }
    process.exit(1);
  }
}

run();

#!/usr/bin/env node
/**
 * Installe les hooks Git (pre-push → env:sync).
 * Appelé automatiquement après npm install via le script "prepare".
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const hooksDir = path.join(root, '.git', 'hooks');
if (!fs.existsSync(path.join(root, '.git'))) {
  process.exit(0);
}
if (!fs.existsSync(hooksDir)) {
  fs.mkdirSync(hooksDir, { recursive: true });
}

const prePushContent = `#!/bin/sh
cd "$(git rev-parse --show-toplevel)" && node scripts/git-hooks/pre-push.js
exit $?
`;

const prePushPath = path.join(hooksDir, 'pre-push');
let needsWrite = !fs.existsSync(prePushPath);
if (!needsWrite) {
  try {
    needsWrite = fs.readFileSync(prePushPath, 'utf8') !== prePushContent;
  } catch {
    needsWrite = true;
  }
}
if (needsWrite) {
  fs.writeFileSync(prePushPath, prePushContent, 'utf8');
}
try {
  fs.chmodSync(prePushPath, 0o755);
} catch (_) {}

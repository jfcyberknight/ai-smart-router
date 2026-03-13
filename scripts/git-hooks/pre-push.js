#!/usr/bin/env node
/**
 * Hook pre-push : exécute env:sync avant de pousser (met à jour .env.example et pousse les variables vers Vercel).
 * Pour contourner : git push --no-verify
 */
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.resolve(__dirname, '../..');
const r = spawnSync('npm', ['run', 'env:sync'], {
  stdio: 'inherit',
  cwd: root,
  shell: process.platform === 'win32',
});
process.exit(r.status !== null ? r.status : 1);

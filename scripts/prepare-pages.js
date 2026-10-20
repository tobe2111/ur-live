#!/usr/bin/env node

/**
 * Prepare Cloudflare Pages deployment
 * - Bundle worker code into _worker.js
 * - Ensure _routes.json is present
 */

const fs = require('fs');
const path = require('path');

const distClientPath = path.join(__dirname, '..', 'dist', 'client');
const workerIndexPath = path.join(__dirname, '..', 'dist', 'worker', 'worker', 'index.js');
const workerOutputPath = path.join(distClientPath, '_worker.js');
const routesPath = path.join(distClientPath, '_routes.json');

console.log('📦 Preparing Cloudflare Pages deployment...');

// Check if worker build exists
if (!fs.existsSync(workerIndexPath)) {
  console.error('❌ Worker build not found at:', workerIndexPath);
  console.error('   Run npm run build:worker first');
  process.exit(1);
}

// Copy worker to _worker.js
console.log('📄 Copying worker to _worker.js...');
fs.copyFileSync(workerIndexPath, workerOutputPath);
console.log('✅ Worker copied successfully');

// Verify _routes.json exists
if (!fs.existsSync(routesPath)) {
  console.error('❌ _routes.json not found at:', routesPath);
  console.error('   This file should be copied from public/ during build');
  process.exit(1);
}

console.log('✅ _routes.json verified');

// Get file sizes
const workerSize = (fs.statSync(workerOutputPath).size / 1024).toFixed(2);
console.log(`📊 _worker.js size: ${workerSize} KB`);

console.log('✅ Pages deployment prepared successfully!');
console.log('');
console.log('Files ready in dist/client/:');
console.log('  - _worker.js (API routes handler)');
console.log('  - _routes.json (routing configuration)');
console.log('  - index.html + assets (static files)');

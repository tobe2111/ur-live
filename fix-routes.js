import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

// Configuration for Cloudflare Pages routing:
// - include: Only API and Auth routes handled by Worker
// - exclude: Static assets (CRITICAL: assets/* for code-splitting chunks)
const routes = {
  version: 1,
  include: ['/api/*', '/auth/*'],  // Worker handles only API and Auth
  exclude: [
    '/assets/*',   // ✅ CRITICAL: Exclude all Vite chunks
    '/static/*',   // Exclude static assets
    '/*.js',       // Exclude root-level JS
    '/*.css',      // Exclude root-level CSS
    '/*.html',     // Exclude HTML files
    '/*.ico',      // Exclude favicon
    '/*.png',      // Exclude images
    '/*.svg',      // Exclude SVG
    '/*.json'      // Exclude JSON (manifest, etc.)
  ]
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json - Worker for /api/* and /auth/* only');

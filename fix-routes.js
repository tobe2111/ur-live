import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

// Configuration for Cloudflare Pages routing:
// - include: ALL routes handled by Worker (SPA + API)
// - exclude: Static assets only
const routes = {
  version: 1,
  include: ['/*'],  // Worker handles ALL routes (SPA + API)
  exclude: ['/assets/*', '/*.png', '/*.jpg', '/*.svg', '/*.ico', '/*.webp']  // Only exclude static assets
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json - Worker for /api/* and /auth/*, all other routes served as SPA');

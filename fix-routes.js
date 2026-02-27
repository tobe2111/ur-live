import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

// Configuration for Cloudflare Pages routing:
// - include: ALL routes should be handled by the Worker for React Router SPA
// - exclude: Only static assets
const routes = {
  version: 1,
  include: ['/*'],  // ALL routes go to Worker for React Router
  exclude: [
    '/assets/*',  // Vite build assets
    '/static/*',  // Static files
    '/*.png',
    '/*.jpg',
    '/*.jpeg',
    '/*.gif',
    '/*.ico',
    '/*.svg',
    '/*.woff',
    '/*.woff2',
    '/*.ttf',
    '/*.eot'
  ]
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json - Worker for /api/* and /auth/*, all other routes served as SPA');

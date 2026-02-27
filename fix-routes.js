import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

// Configuration for Cloudflare Pages routing:
// - include: Routes that should be handled by the Worker (API + Auth)
// - exclude: Static files
// - All other routes are served as React SPA
const routes = {
  version: 1,
  include: ['/api/*', '/auth/*'],  // API and Auth routes go to Worker
  exclude: ['/static/*']  // Static assets excluded
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json - Worker for /api/* and /auth/*, all other routes served as SPA');

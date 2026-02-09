import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

// Configuration for Cloudflare Pages routing:
// - include: Routes that should be handled by the Worker (API only)
// - exclude: Static files
// - All other routes (including /auth/kakao/callback) are served as React SPA
const routes = {
  version: 1,
  include: ['/api/*'],  // Only API routes go to Worker
  exclude: ['/static/*']  // Static assets excluded
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json - Worker for /api/* only, all other routes served as SPA');

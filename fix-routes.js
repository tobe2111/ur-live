import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

// Configuration for Cloudflare Pages routing:
// - include: Routes that should be handled by the Worker (API and auth)
// - exclude: None - routes not matching 'include' are served as static files
const routes = {
  version: 1,
  include: ['/api/*', '/auth/*'],
  exclude: []
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json - Worker for API/auth, static for all others');

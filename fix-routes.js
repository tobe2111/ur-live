import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

// Configuration for Cloudflare Pages routing:
// - include: Only API and Auth routes handled by Worker
// - exclude: Static assets
const routes = {
  version: 1,
  include: ['/api/*', '/auth/*'],  // Worker handles only API and Auth
  exclude: ['/static/*']  // Exclude static assets
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json - Worker for /api/* and /auth/* only');

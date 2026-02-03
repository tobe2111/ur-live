import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

const routes = {
  version: 1,
  include: ['/api/*'],
  exclude: ['/assets/*', '/static/*', '/favicon.svg']
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json - API only, SPA for frontend');

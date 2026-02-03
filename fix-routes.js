import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

const routes = {
  version: 1,
  include: ['/*'],
  exclude: ['/assets/*', '/static/*']
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json for SPA routing');

import fs from 'fs';
import path from 'path';

const routesPath = path.join(process.cwd(), 'dist', '_routes.json');

// Configuration for Cloudflare Pages routing:
// Worker handles ALL routes including SPA pages.
// Static assets (JS/CSS chunks) are EXCLUDED so they bypass Worker and
// are served directly by Cloudflare Pages CDN for maximum performance.
//
// ⚠️  CRITICAL: Do NOT exclude /*.html — the _redirects SPA fallback
// rewrites /* → /index.html and that internal request must NOT be
// intercepted by serveStatic (which errors with __STATIC_CONTENT_MANIFEST).
// Worker serves index.html via ASSETS binding instead.
const routes = {
  version: 1,
  include: ['/*'],  // Worker handles ALL routes (API, Auth, and SPA pages)
  exclude: [
    '/assets/*',   // ✅ CRITICAL: Exclude all Vite code-splitting chunks
    '/static/*',   // Exclude static assets folder
    '/locales/*',  // Exclude i18n files
    '/*.js',       // Exclude root-level JS
    '/*.css',      // Exclude root-level CSS
    '/*.ico',      // Exclude favicon
    '/*.png',      // Exclude images
    '/*.svg',      // Exclude SVG
    '/*.json',     // Exclude JSON (manifest, version, etc.)
    '/*.txt',      // Exclude text files
    '/*.xml',      // Exclude XML files
    '/*.woff',     // Exclude fonts
    '/*.woff2',    // Exclude fonts
    '/*.ttf',      // Exclude fonts
  ]
};

fs.writeFileSync(routesPath, JSON.stringify(routes, null, 2));
console.log('✅ Fixed _routes.json - Worker handles ALL routes (API + SPA pages), static assets excluded');

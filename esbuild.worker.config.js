const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/worker/_worker-wrapper.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  outfile: 'dist/_worker.js',
  external: [
    'cloudflare:*',
    '__STATIC_CONTENT_MANIFEST',
    'firebase-admin',
    'firebase-admin/*',
    'google-auth-library',
    'gaxios',
    'node-forge'
  ],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  mainFields: ['browser', 'module', 'main'],
  conditions: ['worker', 'browser'],
  logLevel: 'info',
  minify: false,
  sourcemap: false
}).catch(() => process.exit(1));

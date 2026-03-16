const esbuild = require('esbuild');

esbuild.build({
  entryPoints: ['src/worker/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  outfile: 'dist/_worker.js',
  external: [
    'cloudflare:*',
    '__STATIC_CONTENT_MANIFEST'
  ],
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  mainFields: ['browser', 'module', 'main'],
  conditions: ['worker', 'browser'],
  logLevel: 'info'
}).catch(() => process.exit(1));

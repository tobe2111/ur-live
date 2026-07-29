// 🆕 2026-07-14 유어애즈 독립 Worker(ur-ads) 번들 — esbuild.worker.config.js 미러.
//   entry: src/worker-ads/index.ts (Hono app, export default) → dist-ads/index.js (ESM module Worker).
//   @/ alias 를 esbuild 에게 알려 번들 시 resolve(메인 worker 와 동일 — 2026-04-22 사고 방지).
//   배포: wrangler-ads.toml 의 [build] 가 이 스크립트를 실행 후 dist-ads/index.js 를 deploy.
const esbuild = require('esbuild');
const path = require('path');

esbuild.build({
  entryPoints: ['src/worker-ads/index.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  outfile: 'dist-ads/index.js',
  alias: {
    '@': path.resolve(__dirname, '..', 'src'),
  },
  external: [
    'cloudflare:*',
    '__STATIC_CONTENT_MANIFEST',
    'firebase-admin',
    'firebase-admin/*',
    'google-auth-library',
    'gaxios',
    'node-forge',
  ],
  define: {
    'process.env.NODE_ENV': '"production"',
    'import.meta.env.DEV': 'false',
    'import.meta.env.PROD': 'true',
    'import.meta.env.MODE': '"production"',
    'import.meta.env.SSR': 'true',
  },
  mainFields: ['browser', 'module', 'main'],
  conditions: ['worker', 'browser'],
  logLevel: 'info',
  minify: false,
  sourcemap: false,
}).then(() => {
  console.log('✅ ur-ads worker 번들 완료 → dist-ads/index.js');
}).catch(() => process.exit(1));

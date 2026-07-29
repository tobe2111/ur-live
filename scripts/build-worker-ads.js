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
    // 🕐 빌드 시각 스탬프 — cron 회차가 **새 배포 직후인지**를 하트비트가 스스로 말하게 한다.
    //   2026-07-29 에 배포 창과 겹친 정각 회차를 세 번 오진했다(11:00 · 13:00 · 09~11시 구간).
    //   매번 GitHub 배포 로그를 파러 가야 했는데, 그 정보는 워커가 이미 갖고 있다.
    '__ADS_BUILD_AT__': JSON.stringify(new Date().toISOString()),
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

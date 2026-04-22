const esbuild = require('esbuild');
const path = require('path');

// 🛡️ 2026-04-22 사고 후 영구 방지:
// tsconfig의 paths alias(@/*)를 esbuild에게도 알려서, dynamic import도 빌드 시 resolve.
// 이 설정이 없으면 `await import('@/foo')`가 번들에 문자열 그대로 남아 런타임 crash.
esbuild.build({
  entryPoints: ['src/worker/_worker-wrapper.ts'],
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2020',
  outfile: 'dist/_worker.js',
  alias: {
    '@': path.resolve(__dirname, 'src'),
  },
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

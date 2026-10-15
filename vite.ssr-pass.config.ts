/**
 * 🧊 이용권 상세 서버 렌더 번들(워커용 한 파일) — `src/ssr/pass-detail-entry.tsx`.
 * 손님 번들 설정(vite.config.ts)과 분리한다: 청크 나누기(manualChunks)·HTML 플러그인이 필요 없고,
 * 워커는 한 파일만 받으므로 동적 import 를 전부 안으로 접는다 — 단 **허용목록만**(앱 전체가 들어가지 않게 —
 * `scripts/ssr-dynamic-import-allowlist.mjs`).
 */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { i18nSplitPlugin } from './scripts/i18n-split.mjs'
import { lucideDeepImportsPlugin } from './scripts/lucide-deep-imports.mjs'
import { ssrDynamicImportAllowlistPlugin } from './scripts/ssr-dynamic-import-allowlist.mjs'

export default defineConfig({
  json: { stringify: true },
  plugins: [ssrDynamicImportAllowlistPlugin(__dirname), react(), i18nSplitPlugin(__dirname), lucideDeepImportsPlugin()],
  define: {
    __BUILD_VERSION__: JSON.stringify('ssr'),
    __APP_VERSION__: JSON.stringify('ssr'),
  },
  resolve: { alias: { '@': path.resolve(__dirname, './src') }, dedupe: ['react', 'react-dom'] },
  publicDir: false,
  ssr: { target: 'webworker', noExternal: true, resolve: { conditions: ['worker', 'browser'], externalConditions: ['worker', 'browser'] } },
  build: {
    ssr: 'src/ssr/pass-detail-entry.tsx',
    outDir: 'dist/ssr-pass',
    emptyOutDir: true,
    minify: true,
    target: 'es2022',
    copyPublicDir: false,
    rollupOptions: { output: { format: 'es', inlineDynamicImports: true, entryFileNames: 'pass-detail-entry.js' } },
  },
})

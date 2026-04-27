import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

// 빌드마다 유니크한 버전 — 타임스탬프 기반
const BUILD_VERSION = `${new Date().toISOString().slice(0, 10)}-${Date.now().toString(36)}`;

// 빌드 후 훅: Service Worker의 CACHE_VERSION 자동 치환
function swVersionPlugin() {
  return {
    name: 'sw-version-injector',
    closeBundle() {
      const swPath = path.resolve('dist/client/sw.js');
      if (fs.existsSync(swPath)) {
        let content = fs.readFileSync(swPath, 'utf-8');
        content = content.replace(/const CACHE_VERSION = ['"][^'"]+['"]/, `const CACHE_VERSION = '${BUILD_VERSION}'`);
        fs.writeFileSync(swPath, content);
        console.log(`[SW] CACHE_VERSION set to ${BUILD_VERSION}`);
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), swVersionPlugin()],
  define: {
    __BUILD_VERSION__: JSON.stringify(BUILD_VERSION),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  publicDir: 'public',
  build: {
    outDir: 'dist/client',
    emptyOutDir: true,
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/')) {
            return 'react-core'
          }
          // React Router
          if (id.includes('react-router')) return 'react-router'
          // Firebase — 별도 청크 (lazy load)
          if (id.includes('firebase/')) return 'firebase'
          // TanStack Query
          if (id.includes('@tanstack/react-query')) return 'tanstack-query'
          // Payment SDKs
          if (id.includes('@tosspayments') || id.includes('@stripe')) return 'payments'
          // Charts (관리자 전용)
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          // Icons
          if (id.includes('lucide-react')) return 'lucide'
          // Sentry
          if (id.includes('@sentry')) return 'sentry'
          // Embla carousel
          if (id.includes('embla-carousel')) return 'embla'
        },
      },
    },
    chunkSizeWarningLimit: 600,
    // 🛡️ 2026-04-26 (O1): hidden 소스맵 생성 — 클라이언트 노출 X, Sentry 업로드 용도
    //   배포 후 Sentry CLI 가 dist/client/assets/*.map 업로드 → 그 다음 삭제 또는 .gitignore.
    //   sourcemap: false 면 production 에러가 minified — Sentry 디버깅 어려움.
    sourcemap: 'hidden',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.debug', 'console.info'],
      },
      mangle: {
        safari10: true,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 🚨 2026-04-27 사고: vite-plugin-pwa 가 OAuth redirect 차단 → 사이트 ERR_FAILED.
//   재발 방지: 패키지 제거 + import 금지. 재도입은 별도 PR (CLAUDE.md 참조).
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
  plugins: [
    react(),
    swVersionPlugin(),
    // 🚨 2026-04-27 (긴급 롤백): vite-plugin-pwa 비활성화.
    //   원인: navigateFallback 이 카카오 OAuth redirect 도 가로채 ERR_FAILED 발생.
    //   복구: 모든 SW 사용자측 unregister + 새 sw.js 생성 안 함.
    //   재도입: redirect 처리 + denylist 더 엄격하게 한 후 별도 PR.
    // VitePWA({...}) — 비활성화
  ],
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
          // 🛡️ 2026-04-27 추가 분할 — index entry 크기 줄이기
          // i18next + 6개 언어 번들 (모든 페이지에서 쓰지만 별도 lazy 가능)
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n'
          // Radix UI components (대부분 셀러/어드민 페이지에서만 사용)
          if (id.includes('@radix-ui')) return 'radix-ui'
          // Date utility (date-fns 등)
          if (id.includes('date-fns') || id.includes('/dayjs/')) return 'date-utils'
          // Validation (zod, yup)
          if (id.includes('node_modules/zod/') || id.includes('node_modules/yup/')) return 'validation'
          // Animation
          if (id.includes('framer-motion')) return 'animation'
          // QR / 바코드
          if (id.includes('qrcode') || id.includes('jsbarcode') || id.includes('html5-qrcode')) return 'codes'
          // 🛡️ 2026-05-03: index entry 추가 분할 — i18n 확장 누적으로 800KB 근접 → 마진 확보.
          //   axios: ~50KB (모든 페이지가 사용하지만 별도 청크로 캐싱 분리)
          //   zustand: ~3KB (작지만 모든 store 의존 — 별도)
          //   react-helmet-async: ~10KB (SEO, lazy 페이지 진입 시 필요)
          if (id.includes('node_modules/axios/')) return 'axios'
          if (id.includes('node_modules/zustand/')) return 'zustand'
          if (id.includes('react-helmet-async')) return 'helmet'
          // Capacitor (native SDK — 웹에선 no-op이지만 main chunk에서 분리해 캐싱 개선)
          if (id.includes('@capacitor/')) return 'capacitor'
          // Image compression (seller upload pages만 사용 — 지연 캐싱)
          if (id.includes('browser-image-compression')) return 'img-utils'
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

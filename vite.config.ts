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
    // 🛡️ 2026-05-14 S3: modulePreload polyfill 활성 — 모든 브라우저에서 동작 보장.
    //   Vite 가 entry → import 한 chunk 들을 자동 preload (병렬 fetch) → JS 파싱 -300ms.
    modulePreload: { polyfill: true },
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
          // 🛡️ 2026-05-28 (Stripe 232KB 메인 진입 사고 fix): Stripe 와 Tosspayments 분리.
          //   이전: 둘 다 'payments' chunk → main 이 toss 호출 시 stripe 도 같이 download (232KB).
          //   변경: 각각 별도 chunk. Stripe = StripeCheckout (lazy) 진입 시만, Toss = checkout 시만.
          if (id.includes('@stripe')) return 'stripe'
          if (id.includes('@tosspayments')) return 'tosspayments'
          // Charts (관리자/셀러 대시보드 전용) — recharts + d3-* 패키지 + 우리 chart 컴포넌트들.
          //   🛡️ 2026-05-17: /src/components/charts/* 도 'charts' 청크에 포함 (이전엔 'app-components' 로 분류돼서
          //     app-components → recharts static dep 만들어 charts (518 KB) 가 초기 preload 됨).
          //   이제 charts 청크는 dashboard 페이지가 lazy-load 할 때만 fetch.
          if (id.includes('recharts') || id.includes('d3-') || id.includes('/src/components/charts/')) return 'charts'
          // Icons
          if (id.includes('lucide-react')) return 'lucide'
          // Sentry
          if (id.includes('@sentry')) return 'sentry'
          // Embla carousel
          if (id.includes('embla-carousel')) return 'embla'
          // 🛡️ 2026-04-27 추가 분할 — index entry 크기 줄이기
          // i18next + 6개 언어 번들 (모든 페이지에서 쓰지만 별도 lazy 가능)
          if (id.includes('i18next') || id.includes('react-i18next')) return 'i18n'
          // 🛡️ 2026-05-07: locale JSON 파일 — 언어별 별도 청크로 분할.
          //   src/i18n.ts 가 dynamic import 로 로드 → 사용자 언어만 fetch.
          //   이전: locales-*.js 949KB (6개 언어 통합) → 약 150-180KB × 6.
          {
            const localeMatch = id.match(/\/locales\/(ko|en|ja|zh|es|fr)\/translation\.json/)
            if (localeMatch) return `locale-${localeMatch[1]}`
          }
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
          // 🛡️ 2026-05-06: 소스 코드 분할 — index entry 추가 분리.
          // 인증 스토어: App.tsx 에서 eagerly import 되지만 별도 청크로 캐싱 분리.
          if (id.includes('/src/shared/stores/')) return 'app-stores'
          // 🛡️ 2026-05-27 (loading P1): env-validator + env-schema 별도 chunk —
          //   main.tsx dynamic import + zod 의존 → 둘 다 critical path 에서 lazy.
          //   이전: app-shared (critical path) 에 묶여있어 zod (validation 52KB) 도 같이 preload.
          if (id.includes('/shared/config/env-schema') || id.includes('/shared/config/env-validator')) return 'env-validator'
          // 공유 설정/유틸: region, feature-flags 등 — 변경 빈도 낮음
          if (id.includes('/src/shared/config/') || id.includes('/src/shared/utils/')) return 'app-shared'
          // 공유 타입/상수: 런타임 코드 없이 타입 + 상수 → 별도 캐싱
          if (id.includes('/src/shared/constants/') || id.includes('/src/shared/types/')) return 'app-constants'
          // 레이아웃 컴포넌트: BottomNav, DesktopTopNav, DesktopLiveSidebar 등
          if (id.includes('/src/components/main/')) return 'app-layout'
          // 인증 컴포넌트: RouteGuards, KakaoLinkButton 등
          if (id.includes('/src/components/auth/')) return 'app-auth'
          // 🛡️ 2026-05-27 (loading P1 phase 4): utils/hooks/lib 중 페이지 전용 파일 별도 chunk.
          //   라이브 페이지만 사용하는 hook 은 app-live-components 로 묶음.
          if (id.includes('/src/hooks/useLiveStream')) return 'app-live-components'
          // 셀러/어드민 페이지만 사용하는 utils.
          if (id.includes('/src/utils/product-template')) return 'app-seller-components'
          // 🛡️ 2026-05-28 (SSR phase 5): 메인 페이지 미사용 lib 별도 chunk.
          //   이전: app-utils chunk 에 같이 묶여 메인 진입 시도 다운로드.
          //   변경: 셀러 페이지 / Kakao 사용 시점만 fetch.
          if (id.includes('/src/lib/seller-tracking')) return 'app-seller-components'
          if (id.includes('/src/lib/kakao-sdk')) return 'app-kakao-sdk'
          if (id.includes('/src/lib/firebase-auth') || id.includes('/src/lib/firebase-config')) return 'app-firebase-wrapper'
          // 🛡️ phase 5: 페이지별 hook 분리 (사용처 1곳).
          if (id.includes('/src/hooks/useCart')) return 'app-cart'
          if (id.includes('/src/hooks/useSearch')) return 'app-search'
          // 셀러/어드민/에이전시 Layout 의 토큰 자동 갱신 — Layout 진입 시만 필요.
          if (id.includes('/src/hooks/useTokenAutoRefresh')) return 'app-auth'
          // 앱 유틸: src/utils/, src/hooks/, src/lib/ — App 전체에 공유되지만 별도 캐싱
          if (id.includes('/src/utils/') || id.includes('/src/hooks/') || id.includes('/src/lib/')) return 'app-utils'
          // 기능 모듈 API — seller/admin/agency/auth 기능 코드 (대시보드에서만 사용)
          if (id.includes('/src/features/')) return 'app-features'
          // 라우트 그룹 정의 파일 — seller/admin/agency 라우트 (큰 Route 트리)
          if (id.includes('/src/routes/')) return 'app-routes'
          // 기타 공유 컴포넌트 — 하위 디렉터리 별 분리
          // 🛡️ 2026-05-24 (loading P0): 셀러/스트리밍 컴포넌트 분리 → app-components -248KB.
          //   유저 페이지 (홈/쇼핑/공구) 는 절대 안 쓰는데 이전엔 app-components 통합되어
          //   첫 진입 시 다운로드. 이제 seller/admin 진입 시만 fetch.
          if (id.includes('/src/components/live/')) return 'app-live-components'
          if (id.includes('/src/components/streaming/')) return 'app-streaming'
          // 🛡️ 2026-05-27 (loading P1): app-components 305KB 추가 분할.
          //   기존 'seller' 폴더 외에 SellerLayout / BulkUploadModal / ProductOptionForm /
          //   seller-public 폴더도 셀러 전용 → app-seller-components 로 묶음.
          if (id.includes('/src/components/seller/')) return 'app-seller-components'
          if (id.includes('/src/components/SellerLayout')) return 'app-seller-components'
          if (id.includes('/src/components/seller-public/')) return 'app-seller-components'
          if (id.includes('/src/components/BulkUploadModal')) return 'app-seller-components'
          if (id.includes('/src/components/ProductOptionForm')) return 'app-seller-components'
          // 어드민 전용
          if (id.includes('/src/components/AdminLayout')) return 'app-admin-components'
          // 에이전시 전용
          if (id.includes('/src/components/AgencyLayout')) return 'app-agency-components'
          if (id.includes('/src/components/agency/')) return 'app-agency-components'
          // 대시보드 카드 (셀러/어드민/에이전시 공통)
          if (id.includes('/src/components/dashboard/')) return 'app-dashboard'
          // 결제 페이지 전용
          if (id.includes('/src/components/payments/')) return 'app-payments'
          // 장바구니 / 검색 / 마이페이지 — 페이지별 lazy
          if (id.includes('/src/components/cart/')) return 'app-cart'
          if (id.includes('/src/components/search/')) return 'app-search'
          if (id.includes('/src/components/mypage/') || id.includes('/src/components/my-page/')) return 'app-mypage'
          if (id.includes('/src/components/wallet/')) return 'app-wallet'
          // 🛡️ 2026-05-27 (loading P1 phase 3): 페이지별 폴더 추가 분리.
          //   각 폴더가 1-3 개 페이지에서만 사용 → 일반 사용자 critical path 진입 회피.
          if (id.includes('/src/components/group-buy/')) return 'app-group-buy'
          if (id.includes('/src/components/product/')) return 'app-product-components'
          if (id.includes('/src/components/guide/')) return 'app-guide'
          if (id.includes('/src/components/shipping/')) return 'app-shipping'
          if (id.includes('/src/components/upload/')) return 'app-upload'
          if (id.includes('/src/components/glass/')) return 'app-glass'
          if (id.includes('/src/components/settings/')) return 'app-settings'
          // 라이브 전용 — components/ 직속이지만 라이브 페이지만 사용.
          //   ⚠️ FrameWrapper / GripFrameLayout 은 App.tsx 에서 import → critical path 유지 필수.
          //     (app-live-components 로 옮기면 app-live-components chunk 가 critical path 진입 → 손해)
          if (id.includes('/src/components/LiveDonation')) return 'app-live-components'
          if (id.includes('/src/components/')) return 'app-components'
          // 나머지 src/ 디렉터리 — types, constants, config, layouts
          if (id.includes('/src/types/') || id.includes('/src/constants/') ||
              id.includes('/src/config/') || id.includes('/src/layouts/')) return 'app-misc'
        },
      },
    },
    chunkSizeWarningLimit: 600,
    // 🛡️ 2026-04-26 (O1): hidden 소스맵 생성 — 클라이언트 노출 X, Sentry 업로드 용도
    //   배포 후 Sentry CLI 가 dist/client/assets/*.map 업로드 → 그 다음 삭제 또는 .gitignore.
    //   sourcemap: false 면 production 에러가 minified — Sentry 디버깅 어려움.
    sourcemap: 'hidden',
    // 🛡️ 2026-05-27 (Lighthouse): es2020 → esnext. modern browser only.
    //   효과: Array.from/Object.assign 등 polyfill 제거 (-24KB) + parse 시간 ↓ + TBT ↓.
    //   대상: Chrome 85+, Firefox 79+, Safari 14+ (2020 이후 — Cloudflare Workers 환경과 일관).
    target: 'esnext',
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

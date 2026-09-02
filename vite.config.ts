import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 🚨 2026-04-27 사고: vite-plugin-pwa 가 OAuth redirect 차단 → 사이트 ERR_FAILED.
//   재발 방지: 패키지 제거 + import 금지. 재도입은 별도 PR (CLAUDE.md 참조).
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';

// 빌드마다 유니크한 버전 — 정형화된 타임스탬프 (YYYYMMDD.HHmm, UTC). SW 캐시 키 + 빌드 표시 겸용.
//   🏁 2026-06-13 (사용자 요청 "빌드 정보 숫자 정형화"): base36 난수 → 사람이 읽는 날짜.시각 형식.
const _bv = new Date();
const _p2 = (n: number) => String(n).padStart(2, '0');
const BUILD_VERSION = `${_bv.getUTCFullYear()}${_p2(_bv.getUTCMonth() + 1)}${_p2(_bv.getUTCDate())}.${_p2(_bv.getUTCHours())}${_p2(_bv.getUTCMinutes())}`;

// 🏭 2026-06-05 (사용자 요청): 앱 버전 = v1.0.<커밋수> — 배포마다 숫자가 올라감.
//   git 전체 히스토리(main.yml fetch-depth:0)에서 커밋 수를 patch 로. git 불가 시 날짜 기반 폴백(단조 증가).
function computeAppVersion(): string {
  let n = 0;
  try { n = parseInt(execSync('git rev-list --count HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(), 10) || 0; } catch { /* no git */ }
  // shallow clone(=1) / git 부재 → 2026-01-01 기준 경과일로 폴백(단조 증가, 최소 git count 보다 크게).
  if (n < 2) n = Math.floor((Date.now() - Date.UTC(2026, 0, 1)) / 86400000) + 400;
  return `1.0.${n}`;
}
const APP_VERSION = computeAppVersion();

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
    __APP_VERSION__: JSON.stringify(APP_VERSION),
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
    // 🚀 2026-07-12 (로딩 — 상세 하드로드 청크 병렬화): 라우트→청크 매핑용 매니페스트 출력.
    //   scripts/generate-route-chunk-map.mjs 가 읽어 워커 modulepreload 주입 맵을 생성(빌드 체인).
    manifest: true,
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
          // 🎭 2026-08-27 [UNLOCK_LOADING] 역할 판별 SSOT 는 **공유**다 — 셀러 봉투에 두면 안 된다.
          //   `seller-roles.ts`(116줄, 순수 헬퍼)는 CLAUDE.md 가 "모든 UI 가 반드시 쓰라"고 못박은
          //   SSOT 인데, 규칙이 없어 Rollup 이 셀러 컴포넌트들과 한 청크(app-seller-components)에
          //   묶었다. 그래서 공용 `RoleGate.tsx` 하나가 그걸 import 하는 것만으로 **소비자 홈이
          //   SellerLayout·BulkUploadModal·SellerKpiDashboard 까지 65KB 를 통째로 받았다**
          //   (실측: 홈 modulepreload 에 app-seller-components 가 올라 있었다).
          //   ⚠️ 이 줄을 지우면 그 65KB 가 곧바로 돌아온다. 가드: check-critical-chunks.
          if (id.includes('/src/shared/seller-roles')) return 'app-shared'
          // 🖊️ 2026-08-30: 유어딜 전용 아이콘(`components/icons/urdeal-icons`)도 **정확히 같은 함정**에
          //   빠졌다. 60줄짜리 순수 SVG 리프 모듈인데 `/src/components/` catch-all 에 걸려
          //   `app-components`(166KB · 58모듈)로 들어갔고, 그걸 **BottomNav·DesktopTopNav**
          //   (앱 셸)가 import 하는 순간 그 청크가 통째로 첫 페인트로 끌려왔다 —
          //   실측: 크리티컬 패스가 17 → 23청크(app-components 가 app-constants·app-features·
          //   app-ui-utils·radix-ui·app-kakao-sdk 까지 끌고 왔다). `check-critical-chunks` 가 잡았다.
          //   ⚠️ 이 줄을 지우면 그 6청크가 곧바로 돌아온다.
          if (id.includes('/src/components/icons/')) return 'app-shared'
          // 🏠 2026-09-02 [UNLOCK_LOADING] 홈 첫 화면이 **실제로 닿는** 소비자 홈 모듈을 자기 청크(app-home)로.
          //   근거(번들러 실측 — generateBundle 로 chunk.modules + 모듈 import 그래프를 덤프해 홈 정적 폐쇄를 계산):
          //   홈 폐쇄 27청크 956KB 중 `app-components` 281KB 는 홈이 21/66 모듈(70KB)만 쓰고, 나머지 45개
          //   (온보딩 모달·이미지 업로드·교환권 스캐너·선물 모달·PWA 프롬프트…)가 같은 봉투라 통째로 preload 됐다.
          //   더 나쁜 건 **딸려오는 것** — 그 안 쓰는 모듈들이 `components/ui/button` 등을 import 해
          //   `app-ui-utils`(tailwind-merge 97KB, 홈 도달 0/3)·`radix-ui`·`app-kakao-sdk` 를 청크 단위로 끌고
          //   왔고, `app-features`(48KB) 도 홈은 2/25 만 쓴다. ⇒ 홈이 닿는 모듈을 여기 모으면 그 청크 간선이 끊긴다.
          //   목록은 실측 도달 집합 그대로다(추측 아님). ⚠️ 이 블록을 지우면 홈 preload 에 그 네 청크가 곧바로 돌아온다.
          //   가드: `home-chunk-diet.test.ts` + check-critical-chunks / check-surface-role-leak.
          if (
            // ⚠️ `pages/pc-home/` 폴더째는 안 된다 — 페이지 파일(PcHomePage.tsx)까지 삼켜 lazy 페이지 청크가 사라지고
            //   route-chunk-map 이 홈 표면을 못 찾는다(3차 실측). 홈 두 페이지가 같이 쓰는 `PcHomeLocationBar` 만.
            id.includes('/src/components/home/') || id.includes('/src/pages/pc-home/PcHomeLocationBar') ||
            id.includes('/src/pages/main-home/GroupBuyFeedCard') ||
            // ⚠️ deal/ 폴더 통째는 안 된다 — DetailFloatingHeader(상세 전용)가 WishlistButton·PinButton·KakaoShareButton 을
            //   import 해 app-components 를 도로 끌고 온다(2차 실측). 홈이 닿는 셋만 짚는다.
            id.includes('/src/components/deal/DealCardMedia') || id.includes('/src/components/deal/WishlistHeart') ||
            id.includes('/src/components/deal/StarRating') ||
            id.includes('/src/components/region/') || id.includes('/src/components/SEO') ||
            id.includes('/src/components/ui/sort-menu') || id.includes('/src/shared/seo/') ||
            id.includes('/src/shared/home-') || id.includes('/src/shared/product-flow') ||
            id.includes('/src/shared/deal-category-icon') ||
            id.includes('/src/features/group-buy/FcfsBadge') || id.includes('/src/features/group-buy/useFcfs')
          ) return 'app-home'
          // 셀러/어드민 페이지만 사용하는 utils.
          if (id.includes('/src/utils/product-template')) return 'app-seller-components'
          // 🛡️ 2026-05-28 (SSR phase 5): 메인 페이지 미사용 lib 별도 chunk.
          //   이전: app-utils chunk 에 같이 묶여 메인 진입 시도 다운로드.
          //   변경: 셀러 페이지 / Kakao 사용 시점만 fetch.
          // 🔁 2026-08-27 [UNLOCK_LOADING] 위 전제가 틀렸다 — `seller-tracking` 은 **이름만 셀러**다.
          //   실제 소비자가 URL 로 들고 온 추천코드를 캡처하는 70줄짜리 유틸이고,
          //   쇼핑(`BrowsePage`)·상품상세·공구상세·이용권상세 **4개 소비자 페이지**가 import 한다.
          //   그래서 그 2KB 때문에 셀러 대시보드 65KB(SellerLayout·BulkUploadModal…)가 딸려왔다
          //   (실측: `/browse` 표면 preload 에 app-seller-components 가 올라 있었다).
          //   ⇒ 소비자 공용 청크로. 셀러 페이지는 app-shared 를 어차피 받는다.
          if (id.includes('/src/lib/seller-tracking')) return 'app-shared'
          if (id.includes('/src/lib/kakao-sdk')) return 'app-kakao-sdk'
          // 🖼️ 2026-07-01 [UNLOCK_LOADING] (링크샵 로딩 딥다이브): toss-preload 는 모듈 평가 즉시
          //   Toss SDK CDN 다운로드 + client-key fetch 를 시작하는 사이드이펙트 모듈인데, /src/lib/
          //   catch-all 로 app-utils(전 페이지 공유)에 묶여 **모든 페이지**(링크샵 포함)가 결제 SDK 를
          //   로드했음. SDK 와 같은 'tosspayments' 청크로 분리 → import 하는 결제 표면
          //   (Checkout/PointsCharge/TossWidgetPay 등)만 로드. 결제 페이지 preload 동작은 불변.
          if (id.includes('/src/lib/toss-preload')) return 'tosspayments'
          // 🛡️ phase 5: 페이지별 hook 분리 (사용처 1곳).
          if (id.includes('/src/hooks/useCart')) return 'app-cart'
          if (id.includes('/src/hooks/useSearch')) return 'app-search'
          // 셀러/어드민/에이전시 Layout 의 토큰 자동 갱신 — Layout 진입 시만 필요.
          if (id.includes('/src/hooks/useTokenAutoRefresh')) return 'app-auth'
          // 🛡️ 2026-07-29 (critical path): `cn()` + tailwind-merge 를 app-utils 에서 들어낸다.
          //   `src/lib/utils.ts` 는 아래 catch-all(`/src/lib/`)에 걸려 app-utils 로 갔는데,
          //   **app-utils 는 엔트리가 쓰는 청크(api.ts·auth.ts 등)라 preload 된다** → 같이 실려 올라갔다.
          //   그런데 실측하면 `src/lib/utils.ts` 는 **엔트리에서 도달 불가**다 —
          //   importer 가 `components/ui/skeleton.tsx` · `separator.tsx` **둘뿐**이고 둘 다 lazy.
          //   더 큰 문제는 딸려오는 것: `tailwind-merge` 는 manualChunks 규칙이 **없어서**
          //   rollup 이 "importer 가 있는 청크"에 넣는데, 그 유일한 importer 가 이 파일이라
          //   **97.1 KB raw 가 통째로 크리티컬 패스에 있었다**(app-utils 285.2 KB 의 34%).
          //   → 전용 leaf 청크로 빼면 tailwind-merge 가 규칙이 없어 **이 청크를 따라 나간다**.
          //   ⚠️ `/src/lib/utils` 는 `/src/lib/` 보다 **먼저** 와야 한다(먼저 매칭되는 규칙이 이긴다).
          //   ⚠️⚠️ **왜 기존 청크(app-components)에 합치지 않고 전용 청크인가 — 실측으로 걸러낸 함정.**
          //   `manualChunks` 는 `build:ssr`(`vite build --ssr`, **같은 vite.config**)에도 적용돼
          //   **SSR 모듈 초기화 순서를 바꾼다.** 이 모듈을 `app-components` 로 보냈더니
          //   `prerender:main` 출력이 **25,718 → 2,873 chars 로 붕괴**했다(SSR 중 컴포넌트가 던져
          //   React 가 서브트리를 스트립 → "SSR-unsafe 경계" 경고). **빌드는 exit 0, tsc 도 0** 이라
          //   조용히 지나갈 뻔했다. 전용 leaf 청크로 두면 25,718 chars 그대로 + 같은 이득(216 KB).
          //   ⇒ 청크를 옮길 때는 **번들 크기만 보지 말고 `prerender:main` 의 chars 도 같이 볼 것.**
          if (id.includes('/src/lib/utils')) return 'app-ui-utils'
          // 🛡️ 2026-07-29 (서비스 분리 + critical path): 도매(B2B) 훅을 소비자 크리티컬 패스에서 제거.
          //   useWholesale(12.0 KB) · useWholesaleChat(3.7 KB) 이 `/src/hooks/` catch-all 로 app-utils 에
          //   들어가 **도매몰을 한 번도 안 여는 소비자도 매번 받고 있었다.** 엔트리 폐쇄집합에 없다(=lazy 전용).
          //   도매 페이지는 각자 lazy 청크라 그쪽에서 이 청크를 받으면 된다.
          if (id.includes('/src/hooks/queries/useWholesale')) return 'app-wholesale-hooks'
          // 🍽️ 2026-09-02 [UNLOCK_LOADING] (대표 "모두 다 진행" — 로딩 후속 ②): **app-utils 다이어트.**
          //   번들러 실측 그래프(#1310 과 같은 방법)로 app-utils 104.6KB 를 뜯어 보니 홈(엔트리+홈 페이지 정적 폐쇄)이
          //   닿는 모듈은 47개 103.5KB… 가 아니라 **47개 / 103개**, 크기로는 **73.8KB(56개)가 홈 미도달**이었다 —
          //   sentry·performance-monitor·web-vitals-report(엔트리가 *동적* import 하는데 결제/로그인 페이지가
          //   정적으로도 써서 공유 봉투로 끌려옴) · errorHandler(결제) · kakao-login-overlay(로그인 3곳) ·
          //   read-table-file/supplier-api/courier-tracking/useChatPoll(도매) · useMy*(마이 쿼리 훅) · in-app-warning ….
          //   그런데 app-utils 는 엔트리가 쓰는 api.ts 와 한 봉투라 **홈이 매번 통째로 받았다.**
          //   ⇒ 홈 미도달 모듈 중 큰 것들을 `app-utils-deferred` 로. 규칙은 **파일 이름 열거**(폴더 규칙은 #1310 에서
          //   두 번 밟은 함정 — 필수 모듈을 같이 삼킨다). 새 모듈이 여기 없으면 종전대로 app-utils 로 간다(안전한 기본).
          //   ⚠️ 이 목록의 모듈이 홈/엔트리 정적 폐쇄에 들어오면 `check-critical-chunks`·`home-chunk-diet` 가 빨강이다.
          if (/\/src\/(?:lib\/(?:sentry|performance-monitor|web-vitals-report|acquisition|errorHandler|in-app-warning|kakao-touch-shim|read-table-file|supplier-api|seller-auth|biz-favicon|image-compress)|utils\/(?:kakao-login-overlay|courier-tracking|csv-download|currency|format-phone|enter-store|orderIdGenerator)|hooks\/(?:queries\/(?:useMy[A-Za-z]+|useReferral|useAffiliate|useDealHistory|useDigitalLibrary|useAddresses|useBlogPost|useFollowing|useMapProducts)|useChatPoll|useFocusTrap|useProduct|usePersistScroll|useForceLightTheme|usePrefetchProduct))\.tsx?$/.test(id)) return 'app-utils-deferred'
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
          // 🧹 2026-08-27 [UNLOCK_LOADING] 소비자 첫 화면이 절대 안 쓰는 것들을 app-components 에서 뺀다.
          //   2026-07-29 주석이 이미 지적한 그대로다 — *"기본값이 '크리티컬'인 구조라 새 컴포넌트가
          //   생길 때마다 예산이 다시 차오른다"*. 실제로 다시 찼다: 실측 app-components 72모듈 안에
          //   admin/* 6개 · wholesale/* 4개 · marketing 2개 · 도매 로고/테마가 들어 있었고, 그 전부가
          //   홈 modulepreload 로 나갔다. 어느 것도 소비자 화면에서 렌더되지 않는다.
          //   ⚠️ 서비스 분리 관점에서도 도매(유통스타트) 코드가 소비자 임계 경로에 있을 이유가 없다.
          if (id.includes('/src/components/admin/')) return 'app-admin-components'
          if (id.includes('/src/components/wholesale/')) return 'app-wholesale-components'
          if (id.includes('/src/pages/wholesale-catalog/WholesaleLogo')) return 'app-wholesale-components'
          if (id.includes('/src/pages/wholesale/wholesale-theme')) return 'app-wholesale-components'
          if (id.includes('/src/components/MarketingDashboardShell')) return 'app-marketing'
          if (id.includes('/src/pages/marketing/dashboard-tabs')) return 'app-marketing'
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
          // 🛡️ 2026-07-29 (critical path): app-shell — **엔트리가 실제로 eager 로 쓰는 컴포넌트만.**
          //   배경: 이 아래 catch-all(`/src/components/` → app-components)이 **분류 규칙의 기본값**이라,
          //   폴더 규칙에 이름이 적히지 않은 컴포넌트는 전부 app-components 로 떨어졌다. 그런데
          //   app-components 는 엔트리가 (아래 14개 때문에) 필요로 하는 청크라 **modulepreload 에 오른다**
          //   → 그 안에 같이 실린 것들이 전부 첫 페인트 바이트가 된다.
          //   실측(2026-07-29 로컬 빌드, generateBundle 덤프): app-components 76 모듈 327.2 KB raw 중
          //   **엔트리 eager 는 14 모듈 46.8 KB(14%)뿐이고, 62 모듈 280.4 KB(86%)가 얹혀 가고 있었다** —
          //   MarketingDashboardShell·admin-nav-config·wholesale/PlusMembershipCard·VoucherScanner 처럼
          //   소비자 첫 화면이 절대 안 쓰는 대시보드/도매 코드까지 포함.
          //   ⚠️ 지금까지의 대응은 "큰 폴더를 하나씩 app-components 에서 빼내는" **블록리스트**였다
          //   (2026-05-24 live/streaming, 05-27 seller/cart/search/… — 그때마다 -248KB·-305KB 를 얻었지만
          //   기본값이 '크리티컬' 인 구조는 그대로라 **새 컴포넌트가 생길 때마다 예산이 다시 차올랐다**).
          //   그래서 기본값을 뒤집는다: **여기 명시된 것만 크리티컬**, 나머지는 자동으로 lazy 쪽.
          //   이 목록은 main.tsx 로부터의 **정적(eager) import 폐쇄집합**이다 — dynamic import() 는 경계.
          //   ❗ 목록을 늘리기 전에: 정말 App.tsx/main.tsx 가 **정적으로** import 하는가?
          //     lazy 페이지에서만 쓰면 여기 넣지 말 것(넣는 순간 첫 페인트 바이트가 된다).
          //     반대로 여기 있는 모듈이 정적 import 하는 컴포넌트는 **함께 들어와야 한다**(안 그러면
          //     app-shell → app-components 정적 엣지가 생겨 app-components 가 다시 preload 된다).
          if (
            id.includes('/src/components/FrameWrapper') ||
            id.includes('/src/components/GripFrameLayout') ||
            id.includes('/src/components/MobileAppLayout') ||
            id.includes('/src/components/DesktopLiveSidebar') ||
            id.includes('/src/components/ErrorBoundary') ||
            id.includes('/src/components/ToastContainer') ||
            id.includes('/src/components/ScrollToTop') ||
            id.includes('/src/components/OfflineBanner') ||
            id.includes('/src/components/ThemeProvider') ||
            id.includes('/src/components/IosTopupGate') ||
            id.includes('/src/components/KakaoConsultButton') ||
            id.includes('/src/components/brand/') ||
            id.includes('/src/components/ui/confirm-dialog')
          ) return 'app-shell'
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

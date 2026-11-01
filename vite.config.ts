import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// 🚨 2026-04-27 사고: vite-plugin-pwa 가 OAuth redirect 차단 → 사이트 ERR_FAILED.
//   재발 방지: 패키지 제거 + import 금지. 재도입은 별도 PR (CLAUDE.md 참조).
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
// 🌐 2026-10-11: 번역 파일을 손님용(core)/대시보드용(dash)으로 나누는 빌드 플러그인 — src/i18n.ts 가 `?i18n-core|dash` 로 부른다.
import { i18nSplitPlugin } from './scripts/i18n-split.mjs';
// 🧩 2026-10-13: lucide 이름 import → 아이콘 파일 직접 import(배럴이 모듈 그래프를 흐리지 않게 — scripts/surface-chunks.mjs 참조).
import { lucideDeepImportsPlugin } from './scripts/lucide-deep-imports.mjs';
import { ROUTES as SURFACE_ROUTES } from './scripts/generate-route-chunk-map.mjs';
import { createSurfaceChunker } from './scripts/surface-chunks.mjs';
import { slimHtml } from './scripts/html-slim.mjs';
import { transform as esbuildTransform } from 'esbuild';
import { stripHtmlCommentsPlugin } from './scripts/strip-html-comments.mjs';

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

/**
 * 📄 dev 전용: 대외 소개서 PDF 를 배포와 **같은 주소**(`/static/proposals/*.pdf`)로 이어 준다.
 *
 *   소개서의 집은 `docs/business/proposals/`(생성기 `.build.mjs` + `.pptx` + `.pdf`)이고,
 *   배포 때 `scripts/build-prepare.mjs` 가 PDF 만 `dist/client/static/proposals/` 로 복사한다.
 *   `public/` 에 사본을 두면 PDF 를 다시 뽑을 때 한쪽만 갱신돼 **어드민이 옛 소개서를 조용히
 *   서빙**하므로(2026-10-12 덱 드리프트와 같은 클래스) 사본을 만들지 않는다.
 *
 *   그래서 dev 서버에는 그 복사가 없어 `/admin/proposals` 미리보기가 빈 화면이 된다 —
 *   그걸 보고 다음 세션이 "고치려고" `public/` 에 사본을 만드는 것이 이 플러그인이 막는 것이다.
 *
 *   ⚠️ `apply: 'serve'` — 프로덕션 번들·산출물에 **한 바이트도** 들어가지 않는다.
 */
function proposalPdfDevPlugin() {
  const dir = path.resolve('docs/business/proposals');
  return {
    name: 'ur-proposal-pdf-dev',
    apply: 'serve' as const,
    configureServer(server: { middlewares: { use: (fn: (req: { url?: string }, res: NodeJS.WritableStream & { setHeader: (k: string, v: string) => void }, next: () => void) => void) => void } }) {
      server.middlewares.use((req, res, next) => {
        const m = /^\/static\/proposals\/([^/?#]+\.pdf)(?:[?#]|$)/.exec(req.url || '');
        if (!m) return next();
        const file = path.resolve(dir, decodeURIComponent(m[1]));
        // 경로 이탈 차단(dev 전용이라도 디렉터리 밖 파일을 서빙하지 않는다).
        if (!file.startsWith(dir + path.sep) || !fs.existsSync(file)) return next();
        res.setHeader('Content-Type', 'application/pdf');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

/**
 * 🩺 셀(엔트리 정적 폐쇄)이 실제로 쓰는 lucide 아이콘 — 파일명(kebab) 기준.
 * 이 목록은 손으로 고치지 말 것: `src/tests/unit/lucide-shell-icons.test.ts` 가 `src/main.tsx` 에서
 * 정적 import 를 따라 가 **다시 계산**하고 불일치하면 빨간불을 낸다(새 아이콘을 셀에 넣었는데
 * 여기 안 적으면 첫 화면이 다시 256개짜리 봉투를 끌고 온다 — 에러 없이 느려지는 부류).
 */
// 🪒 2026-09-29: 43 → 26. UI④ 아이콘 이행으로 셸이 lucide 뜻 아이콘 17개를 더는 안 쓴다
//    (`alert-circle`·`bell`·`gift`·`heart`·`home`/`house`·`info`·`log-out`·`message-circle`·
//     `package`·`settings`·`shopping-cart`·`store`·`ticket`·`check-circle-2`/`circle-check`/`circle-alert`
//     → `urdeal-icons.tsx`). 안 쓰는 것을 목록에 남기면 그만큼 셸 봉투가 커진다.
// 🖥️ 2026-10-18: 25 → 2. PC 상단 네비가 lazy(`app-desktop-chrome`)가 되면서 셸 폐쇄가 쓰는 lucide 는 둘뿐이다.
//    네비가 쓰던 아이콘은 홈이 쓰는 것은 `LUCIDE_HOME_ICONS`, 나머지는 `LUCIDE_DESKTOP_ICONS` 로 갔다.
const LUCIDE_SHELL_ICONS = new Set([
  'refresh-cw', 'x',
])

/**
 * 🏠 **홈 첫 화면이 셸 밖에서 쓰는 lucide 아이콘** (2026-10-12 실측).
 *
 * 왜 세 번째 봉투가 필요한가: 2026-09-16 에 셸을 떼어 냈지만 **나머지가 여전히 한 봉투**다.
 * 빌드 산출물을 뜯어 세 보니 그 봉투에 **214개**가 들어 있는데, 홈 정적 폐쇄가 실제로
 * import 하는 것은 **11개**다(아래 목록 — `app-home`·`GroupBuyFeed`·`PcHomePage`).
 * 즉 홈이 아이콘 11개 때문에 **54.2KB raw(17.0KB br)** 를 통째로 받고 있었다.
 * 어느 페이지든 비-셸 아이콘을 **하나라도** 쓰면 214개가 전부 딸려 오는 구조다.
 *
 * ⚠️ **별칭이 아니라 구현 파일 이름을 적는다** — 분할은 모듈 id(`icons/<name>.js`)로 판정한다.
 *   `Loader2` 는 별칭이고 구현은 `loader-circle` 이다(2026-09-16 에 이 함정을 실제로 밟았다:
 *   별칭만 적으면 **빌드는 성공하고 총량만 안 준다**).
 * 🔒 이 목록은 손으로 관리하지 않는다 — `lucide-shell-icons.test.ts` 가 소스에서 홈 폐쇄를
 *   다시 계산해 대조한다(홈에 새 아이콘을 쓰고 여기 안 적으면 조용히 큰 봉투가 돌아온다).
 */
const LUCIDE_HOME_ICONS = new Set([
  'chevron-left', 'dumbbell', 'flame', 'gift', 'locate-fixed',
  // ⚠️ `Loader2` 는 **별칭**이고 구현은 `loader-circle` 이다 — 둘 다 적는다(2026-09-16 함정).
  'loader-2', 'loader-circle',
  'party-popper', 'paw-print', 'play', 'tag', 'ticket',
  // 🖥️ 2026-10-18: 셸(PC 네비)에서 넘어온 홈 아이콘 — 카테고리 줄·정렬·검색
  'bed-double', 'chevron-down', 'chevron-right', 'layout-grid', 'scissors', 'search', 'shapes', 'utensils',
  // 🏠 2026-10-20: '생활'(이사·청소) 카테고리 — 홈 칩·카드 카테고리 표(deal-category-icon)가 쓴다
  'house',
])

/**
 * 🖥️ **PC 상단 네비만 쓰는 lucide 아이콘** (2026-10-18). 네비가 lazy 청크(`app-desktop-chrome`)가 되면서
 * 이 아이콘들이 셸 봉투를 떠났다. 목록이 없으면 214개짜리 `lucide` 봉투로 떨어져 **PC 가 네비 하나 때문에
 * 54KB 를 받는다**. 홈 목록과 겹치는 것은 홈 쪽에 둔다(PC 홈은 그 봉투를 이미 받는다).
 * 🔒 손으로 관리하지 않는다 — `lucide-shell-icons.test.ts` ④ 가 네비 폐쇄를 다시 계산해 대조한다.
 */
const LUCIDE_DESKTOP_ICONS = new Set([
  'book-open', 'check', 'circle-help', 'coins', 'help-circle', 'log-in', 'radio', 'smartphone',
  'sparkles', 'user', 'user-plus', 'zap',
  // PC 사이드바(`DesktopLiveSidebar` — 같은 `app-desktop-chrome` 청크). 빠지면 PC 가 아이콘 둘 때문에 214개 봉투를 받는다(실측).
  'compass', 'plus',
])


/**
 * 🔀 2026-10-18 [LOADING_ADDITIVE] 공용 부품 묶음 하나를 통째로 받던 것 — `app-cross`.
 *   실측(번들러 모듈→청크 간선): 장바구니는 '쇼핑 계속하기' 링크(`components/mall/ContinueShoppingLink`) **하나** 때문에,
 *   로그아웃 마이는 딜 카드(`components/deal/DealMiniCard`) **하나** 때문에 화면 밖 공용 부품 묶음 `app-components`
 *   (br 26.6KB)를 받았고, 그 묶음이 다시 상품 화면 묶음(lz-product · lz-productL → 사진 슬라이드 embla)을 끌고 왔다.
 *   ⇒ 그 작은 부품들과 그들이 쓰는 모듈(몰 출처 · 빼기 아이콘)만 작은 고정 묶음으로 뺀다. 묶음기는 이 이름을 안 건드린다.
 *   결과(정적 폐쇄 brotli): 장바구니 266.4 → 195.5 · 로그아웃 마이 249.7 → 197.3 · 어드민 −4.6 · 에이전시 −4.7 ·
 *   상품 상세 +1.3(몰 출처·빼기 아이콘을 이 묶음에서 받는다) · 나머지 손님 화면 ±0.3.
 *   🩸 버린 길 셋(실측): ① 묶음기가 '밖에서 쓰는 모듈'을 자동으로 고르게 하면 대시보드가 거의 전부를 써서 43KB 봉투가 생겨
 *      손님 화면이 15~26KB 무거워졌다 ② 미리받기 전용 화면을 사용자로 세면 홈 +1.6 · 장바구니 그대로 ③ 작은 유틸 9개를
 *      넣었더니 홈·상세가 그중 한둘 때문에 봉투 전체(2.9KB)를 받았다 — **손님 첫 화면이 쓰는 모듈은 넣지 말 것.**
 *   ⚠️ 이 목록의 모듈은 페이지 묶음(lz-*)에 있는 것을 import 하면 안 된다 — 순환이 생긴다(빌드 게이트가 잡는다).
 *   가드: `cross-envelope-2026-10-18.test.ts` + `check-surface-budgets`(cart·guestMy 무게 래칫).
 */
export const CROSS_MODULES = [
  '/src/components/mall/', '/src/shared/mall/origin', '/src/components/deal/DealMiniCard',
  '/lucide-react/dist/esm/icons/minus.js',
]

/**
 * 🔎 2026-10-19 [LOADING_ADDITIVE] 지도 목록 한 줄 — `app-map-row`.
 *   검색 화면은 결과 한 줄(`RestaurantRow`)과 상세 미리받기(`prefetch-detail`)를 지도에서 빌려 쓴다(그 둘과 의존 둘, 5.2KB).
 *   그런데 그 넷이 지도 화면 봉투(`lz-map`, br 18.9KB)에 들어 있어서 검색 첫 화면이 지도 봉투를 통째로 받았고,
 *   그 봉투가 다시 홈·지도 공용 봉투 · `app-ui-utils` · 카카오 SDK 로더를 끌고 왔다(실측: 검색 216.9KB).
 *   ⇒ 그 넷만 작은 고정 묶음으로 뺀다. 넷의 의존(react·app-shared·app-utils·lz-common·tanstack)은 전부 첫 화면에 이미 있어서
 *   이 묶음이 남의 봉투를 끌고 오지 않는다(🩸 2026-10-19 숙소 아이콘에서 배운 것: 옮길 때는 **옮긴 모듈의 의존**을 먼저 볼 것).
 *   가드: `search-first-screen-2026-10-19.test.ts` + `check-surface-budgets`(search 무게 래칫).
 */
export const MAP_ROW_MODULES = [
  '/src/pages/restaurant-map/RestaurantRow', '/src/pages/restaurant-map/prefetch-detail',
  '/src/pages/restaurant-map/utils.ts', '/src/pages/restaurant-map/CatIcon',
]

/**
 * 🏪 2026-10-19 [LOADING_ADDITIVE] 마이 목록 부품 — `app-owner-kit`.
 *   주인 관리 시트(`components/deal/OwnerManageSheet`)는 상세에서 lazy 로 받는데, 그 시트가 마이의 목록 부품
 *   (`list-grammar`)과 셀러 도착 주소(`seller-deep-link`)를 쓴다. 묶음기는 그 둘을 상세의 lazy 사용(`gbDetailL`)으로
 *   세어 상세 봉투로 옮겼고, 그러면 그 둘을 첫 화면에 쓰는 마이·대시보드가 상세 봉투를 받았다(실측 dash:my +3.7 · admin +5.6).
 *   ⇒ 둘만 작은 고정 묶음으로 둔다. 마이는 바이트가 같고(요청 하나), 상세는 [관리하기]를 누를 때만 받는다.
 */
export const OWNER_KIT_MODULES = ['/src/pages/user-profile/list-grammar', '/src/lib/seller-deep-link']
/** 주인 판정·버튼(상세 첫 화면 — 손님에겐 판정 요청 하나와 숨은 버튼뿐)과 시트(누를 때만)도 각자의 봉투에 둔다 —
 *  묶음기가 같은 사용자 집합의 공용 봉투(카카오 공유·사진 압축이 사는 곳)에 섞으면 그 공용 부품을 쓰는 어드민·마이가
 *  주인 코드까지 받았다(실측 dash:admin +6.1). */
export const OWNER_UI_MODULES = ['/src/components/deal/useOwnerManage', '/src/pages/group-buy/OwnerManagePanel', '/src/pages/group-buy/useViewerIsOwner']

/**
 * 🗺️ 2026-10-19 [LOADING_ADDITIVE] 지역 링크 표 — `app-region-grid`.
 *   지역 페이지(`/region/*`, 색인 44개)는 `RegionLinkGrid` 하나를 PC 홈과 같이 쓴다. 그 부품이 PC 홈 전용 봉투
 *   (`lz-homePc` — 히어로 배너·앱 띠·지역 타일·사이드바, br 5.6KB)에 들어 있어서 지역 첫 화면이 그 봉투를 통째로 받았다.
 *   지역은 묶음용 ROUTES 밖(PRELOAD_ONLY — 순환 때문)이라 묶음기가 '사용자'로 세지 못한다. ⇒ 그 부품만 작은 고정 묶음으로.
 *   의존(react·react-router·useApiQuery·region-slugs)은 둘 다 이미 받는다 — 이 묶음이 남의 봉투를 끌고 오지 않는다.
 *   가드: `region-first-screen-2026-10-19.test.ts` + `check-surface-budgets`(region 무게 래칫).
 */
export const REGION_GRID_MODULES = ['/src/components/region/RegionLinkGrid']

// 🧩 2026-10-13 [LOADING_ADDITIVE] 손님 페이지 lazy 코드를 쓰는 페이지끼리 묶는다 — 근거·실측·규칙은 scripts/surface-chunks.mjs.
const gateLazy = createSurfaceChunker({
  routes: SURFACE_ROUTES,
  root: __dirname,
  commonMin: Number(process.env.LZ_COMMON || 4),
  minGroupBytes: Number(process.env.LZ_MIN || 2000),
})
// 🚨 청크 순환 허용목록 — 2026-10-13 실측으로 이미 존재하던 둘(함수 export 만 오가서 평가 순서와 무관).
//   **새 항목 추가 금지.** 새 순환은 manualChunks 규칙으로 푼다(위 onLog 게이트 주석).
export const KNOWN_CIRCULAR_CHUNKS = new Set<string>([
  'app-shared -> app-utils -> app-shared',
  'app-shared -> app-utils -> capacitor -> app-shared',
])

export default defineConfig({
  /**
   * ⚙️ 2026-10-14 실행 비용 — JSON 은 **JS 객체 리터럴이 아니라 `JSON.parse("…")` 문자열**로 낸다.
   *   번역 파일(ko 105KB · 대시보드 ko 113KB)이 모든 화면에서 큰 객체 리터럴로 파싱·컴파일되고 있었다.
   *   V8 은 같은 데이터를 JSON 문자열로 받으면 훨씬 싸게 읽는다(JS 파서 대신 JSON 파서 — V8 공식 권고,
   *   10KB 이상에서 효과). 값은 똑같고 바뀌는 건 **읽는 방식**뿐이다. 이름 있는 export(`import { a } from x.json`)
   *   는 안 생기는데, 소스에 그런 import 는 0건이다(전부 default — `src/i18n.ts` 가 `mod.default` 로 읽는다).
   *   가드: `exec-cost-2026-10-14.test.ts` · 측정: `scripts/check-exec-cost.mjs`.
   */
  json: { stringify: true },
  plugins: [
    react(),
    swVersionPlugin(),
    i18nSplitPlugin(__dirname),
    lucideDeepImportsPlugin(),
    proposalPdfDevPlugin(),
    stripHtmlCommentsPlugin(),
    // ✂️ 2026-10-15: 위 플러그인(#1834)이 HTML 주석을 걷고, 이것은 그 뒤에 **인라인 스크립트 속** 주석·공백을 압축한다
    //   (첫 그림 전 <head> 압축 34KB 중 주석 ~8.5KB + 스크립트 속 ~8KB — scripts/html-slim.mjs). 빌드 산출물에만.
    {
      name: 'ur-html-slim',
      apply: 'build' as const,
      transformIndexHtml: {
        order: 'post' as const,
        handler: (html: string) => slimHtml(html, async (code: string) => (await esbuildTransform(code, { minify: true, loader: 'js', target: 'es2017' })).code),
      },
    },
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
      // 🚨 2026-10-13 청크 순환 게이트 — **경고로 두지 않는다.**
      //   manualChunks 가 두 청크를 서로 import 하게 만들면, 한쪽 청크의 최상위 코드가 아직 평가 안 된
      //   다른 쪽 값을 읽는 순간 `Cannot access 'X' before initialization` 으로 앱 전체가 죽는다.
      //   그날 실제로 그랬다(app-components ↔ app-seller-components, 전 페이지 오류 화면). Rollup 은 이걸
      //   'Circular chunk' 경고로만 찍고 빌드를 통과시켜서 CI 도 배포도 초록이었다.
      //   ⇒ 이미 있던 순환(아래 KNOWN_CIRCULAR_CHUNKS — 함수만 주고받아 안 터지는 것으로 확인된 둘)만
      //     허용하고, **새 순환은 빌드를 멈춘다.** 목록을 늘리지 말 것 — 고치는 법은 그 공용 파일에
      //     manualChunks 규칙을 주는 것이다(보통 app-shared).
      onLog(level, log, handler) {
        if (log.code === 'CIRCULAR_CHUNK') {
          const cycle = (log.ids || []).join(' -> ')
          if (!KNOWN_CIRCULAR_CHUNKS.has(cycle)) {
            throw new Error(`[chunk-cycle] 새 청크 순환: ${cycle} — 런타임 TDZ 크래시 위험. 공용 모듈에 manualChunks 규칙을 줄 것(vite.config.ts KNOWN_CIRCULAR_CHUNKS 참조).`)
          }
        }
        handler(level, log)
      },
      output: {
        manualChunks(id, meta) { return gateLazy(id, ((): string | undefined => {
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
          // 🔀 2026-10-18 화면 밖 공용 유틸 — 근거는 위 CROSS_MODULES 주석
          if (CROSS_MODULES.some((p) => id.includes(p))) return 'app-cross'
          // ← 2026-10-19 하위 화면 머리줄 한 벌(마이 하위 화면 + FAQ). catch-all(app-components)로 떨어지면 FAQ 첫 화면이
          //   그 묶음 + embla·lucide 를 끌고 와 171 → 230KB 가 됐다(surface-budgets). app-cross 에 넣으면 몰·딜카드까지 +1.8KB.
          //   의존이 react-router·화살표 하나뿐인 부품이라 자기 봉투를 준다(묶음기 고정 목록 LIBRARY_ENVELOPES 에도 등록).
          if (id.includes('/src/components/ui/sub-page-header')) return 'app-subpage'
          // 🔎 2026-10-19 지도 목록 한 줄 — 근거는 위 MAP_ROW_MODULES 주석
          if (MAP_ROW_MODULES.some((p) => id.includes(p))) return 'app-map-row'
          // 🏪 2026-10-19 마이 목록 부품 — 근거는 위 OWNER_KIT_MODULES 주석
          if (OWNER_KIT_MODULES.some((p) => id.includes(p))) return 'app-owner-kit'
          if (OWNER_UI_MODULES.some((p) => id.includes(p))) return 'app-owner-ui'
          if (id.includes('/src/components/deal/OwnerManageSheet')) return 'app-owner-sheet'
          // 🏠 2026-10-25 생활 칩 견적 카드(lazy) — 업종 그림이 공용 봉투에 섞여 전 화면 첫 방문이 +2KB 를 받았다(실측).
          if (id.includes('/src/pages/main-home/LifeQuoteBanner') || id.includes('/src/pages/life/life-tiles')) return 'app-life-banner'
          // 🗺️ 2026-10-19 지역 링크 표 — 근거는 위 REGION_GRID_MODULES 주석
          if (REGION_GRID_MODULES.some((p) => id.includes(p))) return 'app-region-grid'
          // Icons
          // 🩺 2026-09-16 [UNLOCK_LOADING] 아이콘 다이어트 — 셀이 쓰는 42개만 첫 화면으로.
          //   실측(번들러 모듈→청크 그래프): 트리쉐이킹은 멀정하다(1,534개 중 260개만 남는다).
          //   문제는 그 260개가 **한 봉투**라, 어드민·셀러 페이지에서만 쓰는 아이콘까지
          //   홈 첫 화면이 같이 받고 있었다(셀 폐쇄는 42개만 닿는다 — 64.8KB 중 약 11KB).
          //   ⚠️ 규칙을 지우면 될 것 같지만 아니다 — 지워 보니 Rollup 이 256개를 통째로
          //   `app-shell` 에 넣어 총량이 그대로였다(695.0 → 694.0KB). 명시 분할만 효과가 있다.
          //   가드: `lucide-shell-icons.test.ts` 가 소스에서 셀 폐쇄를 **다시 계산**해 이 목록과 대조한다
          //   (셀 파일에 새 아이콘을 추가하고 여기 안 적으면 조용히 큰 봉투를 다시 끌고 온다 — 그걸 막는다).
          if (id.includes('lucide-react')) {
            const icon = id.replace(/\\/g, '/').match(/\/icons\/([a-z0-9-]+)\.js$/)
            // 아이콘이 아닌 코어(Icon/createLucideIcon/defaultAttributes/utils/배럴)는 셀 쪽에.
            //   배럴은 트리쉐이킹 후 0바이트라 의존을 만들지 않는다(실측 확인).
            if (!icon || LUCIDE_SHELL_ICONS.has(icon[1])) return 'lucide-shell'
            // 🏠 2026-10-12: 홈이 쓰는 11개만 따로 — 214개 봉투를 첫 화면에서 뗀다(위 주석 참조).
            if (LUCIDE_HOME_ICONS.has(icon[1])) return 'lucide-home'
            // 🖥️ 2026-10-18: PC 상단 네비만 쓰는 것 — 네비가 lazy 라 셸에서 빠졌다(위 목록 주석)
            return LUCIDE_DESKTOP_ICONS.has(icon[1]) ? 'lucide-desktop' : 'lucide'
          }
          // Sentry
          // 📦 2026-10-11: `src/lib/sentry-sdk.ts`(쓰는 함수만 다시 내보내는 진입점)도 같은 청크 — 다른 청크로 새면
          //   그 청크가 Sentry 를 정적으로 끌고 와 첫 페인트에 실릴 수 있다.
          if (id.includes('@sentry') || id.includes('/src/lib/sentry-sdk')) return 'sentry'
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
            // 🌐 2026-10-11: 대시보드용 절반은 따로 — 손님은 이 청크를 안 받는다(규칙 추가만).
            if (localeMatch && id.includes('?i18n-dash')) return `locale-${localeMatch[1]}-dash`
            if (localeMatch && id.includes('?i18n-rest')) return `locale-${localeMatch[1]}-rest` // 🧹 2026-10-18 소스가 안 가리키는 키(i18n-split 머리말)
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
          // 🧩 2026-10-14 [LOADING_ADDITIVE] `cn()` 의 두 의존을 그 봉투(app-ui-utils)에 **명시**한다. 규칙이 없으면 묶음기가
          //   clsx(cva 와 공유라 '라이브러리 전용' 이 아님)를 지도 봉투로 옮겨 app-ui-utils ↔ lz-map 순환이 생긴다(빌드 게이트가 잡았다).
          //   app-ui-utils 는 묶음기 보호 목록(LIBRARY_ENVELOPES)에 있다 — 근거: scripts/surface-chunks.mjs.
          if (id.includes('node_modules/clsx/') || id.includes('node_modules/tailwind-merge/')) return 'app-ui-utils'
          if (id.includes('react-helmet-async')) return 'helmet'
          // Capacitor (native SDK — 웹에선 no-op이지만 main chunk에서 분리해 캐싱 개선)
          if (id.includes('@capacitor/')) return 'capacitor'
          // 📱 2026-10-12 `lib/native.ts`(Capacitor 래퍼)는 Capacitor 와 **같은 봉투**로 — `/src/lib/` catch-all 로
          //   app-utils 에 들어가면 app-utils 가 capacitor 청크를 정적으로 끌어와 **모든 첫 방문**이 받는다
          //   (판정만 필요한 자리는 `lib/native-platform.ts`, 실제 기능은 앱 안에서만 동적으로).
          if (id.includes('/src/lib/native.ts')) return 'capacitor'
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
          //   🩸 2026-09-03: 이 주석은 오래 "feature-flags 등"이라고 적어 놓았는데, 그 파일은
          //   `/src/shared/feature-flags.ts` 라 **`config/` 조건에 안 걸리고** catch-all 로 떨어지고 있었다
          //   (`home-chunk-diet` 의 거울 검사를 새로 넣자마자 드러났다 — 주석과 코드가 어긋난 전형).
          if (id.includes('/src/shared/config/') || id.includes('/src/shared/utils/')) return 'app-shared'
          if (id.includes('/src/shared/feature-flags')) return 'app-shared'
          if (id.includes('/src/shared/category-palette')) return 'app-shared' // 🏠 2026-10-25 엔트리가 쓰는 색 표 — 생활 그림 봉투로 끌려가 첫 화면 청크가 하나 늘었다
          // 공유 타입/상수: 런타임 코드 없이 타입 + 상수 → 별도 캐싱
          if (id.includes('/src/shared/constants/') || id.includes('/src/shared/types/')) return 'app-constants'
          // 레이아웃 컴포넌트: BottomNav, DesktopTopNav, DesktopLiveSidebar 등
          // 🔔 2026-10-11 — 알림 **패널 몸통과 벨 배선 훅**도 여기다. 둘은 `components/main/`
          //   (=이 청크)에서 **정적으로** 닿는다(`DesktopTopNav`→드롭다운→패널, `HomeTopHeader`→훅).
          //   규칙이 없으면 catch-all `app-components` 로 떨어지고, 그 순간 엔트리→app-layout→
          //   app-components 정적 엣지가 생겨 radix-ui·app-features·app-kakao-sdk 까지 줄줄이
          //   첫 페인트로 들어온다(`check-critical-chunks` 가 **새 청크 9개**로 잡았다).
          //   ⚠️ `NotificationSheet`(시트 셸)는 **여기 넣지 않는다** — 벨을 누른 뒤에야 필요하고,
          //     `useNotificationSheet` 이 `lazy()` 로 경계를 긋는다. 넣으면 첫 페인트 바이트가 된다.
          // 🖥️ 2026-10-18: 패널 몸통은 자기 청크로 — 정적으로 닿던 길(`DesktopTopNav`→드롭다운)이 lazy 가 되어
          //   이제 PC 네비와 벨 시트(둘 다 lazy)만 쓴다. app-layout 에 두면 첫 화면이 패널과 그 아이콘 봉투를 받는다.
          //   시트 몸통(`NotificationSheet`)도 같은 봉투 — 묶음기가 `lz-common`(대부분의 첫 화면)으로 옮기지 않게 이름을 지킨다
          //   (`scripts/surface-chunks.mjs` LAZY_ENVELOPES). 벨을 누를 때만 받는다.
          if (/\/src\/components\/notifications\/Notification(Panel|Sheet)\.tsx/.test(id)) return 'app-notification-panel'
          if (id.includes('/src/components/notifications/useNotificationSheet')) return 'app-layout'
          // 🖥️ 2026-10-18 PC 상단 네비와 그것만 쓰는 부품 — 폰 첫 방문에서 뺀다(ConsumerTopChrome 머리말). 넓은 화면이면 첫 렌더 전에 받는다.
          if (/\/src\/components\/main\/(DesktopTopNav|AccountMenu|AppDownloadModal|NotificationDropdown)\.tsx/.test(id)) return 'app-desktop-chrome'
          if (id.includes('/src/components/main/')) return 'app-layout'
          // 인증 컴포넌트 — 🩺 2026-09-16: **`RouteGuards` 만** 여기다.
          //   이전엔 `auth/` 폴더를 통째로 묶었는데, 그 봉투는 `RouteGuards`(셀 폐쇄) 때문에
          //   첫 페인트에 올라온다 → 같은 폴더의 `KakaoLinkButton`·`SellerPinPrompt`(셀러 프로필 편집
          //   페이지 **하나만** 쓴다)가 같이 딸려왔다(13.7KB + lucide 아이콘 6개).
          //   나머지는 아래 일반 규칙으로 떨어져 lazy 페이지와 함께 받는다.
          if (id.includes('/src/components/auth/RouteGuards')) return 'app-auth'
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
          // 🏢 2026-10-11: 에이전시 좌석 판정 — 공용 부품(SellerKakaoLinkBanner)이 쓴다. 셀러 청크에 두면 소비자 화면으로 샌다.
          if (id.includes('/src/shared/agency-seat-token')) return 'app-shared'
          // 🪟 2026-09-26: 마이 시트 임베드 신호(순수 React context, ~1KB)도 **공유**다 —
          //   `SellerLayout`(셀러 봉투)과 마이 시트가 **같은 모듈**을 봐야 한다. 셀러 봉투에 두면
          //   마이가 그걸 읽는 순간 83.8KB 를 통째로 끌고 온다(위 `seller-roles` 와 정확히 같은 함정).
          if (id.includes('/src/shared/seller-embed')) return 'app-shared'
          // 📐 2026-09-03: 딜 카드 격자 간격 상수 — 홈·찜·유어샵·편성 섹션이 함께 읽는 한 줄짜리 SSOT.
          //   catch-all 로 떨어지면 홈 폐쇄가 app-shared 밖 청크를 하나 더 끌고 온다(home-chunk-diet 가 잡는다).
          if (id.includes('/src/shared/deal-card-grid')) return 'app-shared'
          // 💸 2026-09-08: 가격·할인율 표시 규칙 SSOT — 홈 딜 카드와 유어쇼츠 구매 바가 함께 읽는다.
          //   위 `deal-card-grid` 와 **정확히 같은 함정**이라 같은 자리에 둔다(가드가 바로 잡아냈다).
          if (id.includes('/src/shared/price-display')) return 'app-shared'
          // 🩸 2026-10-13: 장소 URL SSOT — 손님 매장 지도(RestaurantMiniMap)와 셀러 매장 등록이 함께 읽는다.
          //   규칙이 없어 Rollup 이 셀러 봉투(app-seller-components)에 넣었고, 그러자 app-components →
          //   app-seller-components → app-components **순환**이 생겨 셀러 청크의 최상위 코드가 아직 평가 안 된
          //   app-components 값(StatusTone·TONE_PILL)을 읽다 TDZ("Cannot access before initialization") 로
          //   터졌다 — **소비자 전 페이지가 ErrorBoundary 로** 떨어졌다. 시작은 #1756 이 RestaurantMiniMap
          //   에서 이 파일을 import 한 것이었다. 아래 onLog 게이트가 이 클래스(새 청크 순환)를 이제
          //   빌드 실패로 막는다.
          //   🩸 2026-10-13(후속): 이 줄이 **두 벌**이었다 — 같은 장애를 두 세션이 각자 고쳤고 둘 다
          //     머지됐다(각각은 초록이었다). 두 번째는 첫 `return` 때문에 **닿지 않는 죽은 규칙**이었고,
          //     주입 앵커가 "여러 곳에 맞는다" 로 그걸 잡았다. 그리고 그게 왜 나쁜가 — **중복 잠금은
          //     각 잠금을 시험 불가능하게 만든다**(주입이 하나를 지워도 다른 하나가 같은 일을 해서
          //     가드가 실패할 수 없다). 설명은 합치고 규칙은 하나만 둔다.
          //     ⚠️ 그 중복이 실제로 main 을 두 번 빨갛게 만들었다 — `Guard mutations (full)` 이
          //     `#1722`·`#1760` head 에서 `주입 대상이 2곳 — 유일해야 한다` 로 멎었다(빌드·화면은 초록).
          if (id.includes('/src/shared/kakao-place-url')) return 'app-shared'
          // 🎬 2026-09-09: 유어쇼츠 SSOT(카드 크기·뷰어 주소·유튜브 id 파싱) — import 0 인 순수 상수 모듈인데
          //   홈 헤더 진입점이 `URSHORTS_VIEWER_PATH` 를 읽는 순간 catch-all 로 떨어져 홈 폐쇄가
          //   청크를 하나 더 끌고 왔다. 위 둘과 **정확히 같은 함정**이라 같은 자리에 둔다(가드가 잡았다).
          if (id.includes('/src/shared/urshorts')) return 'app-shared'
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
            (id.includes('/src/shared/home-') && !id.includes('/src/shared/home-service')) || id.includes('/src/shared/product-flow') ||
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
          // 📱 2026-10-11 카톡 간편로그인 준비 모듈은 SDK 와 같은 봉투로 — app-utils 에 두면 그 정적 import 가
          //   app-kakao-sdk 를 첫 페인트로 끌고 온다(check-critical-chunks 가 잡았다). 로그인 화면만 쓴다.
          if (id.includes('/src/lib/kakao-sdk') || id.includes('/src/lib/kakao-talk-login')) return 'app-kakao-sdk'
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
          // 🪝 2026-10-20: 포커스 가두기 훅(react 만 import). 공용 묶음(app-components)의 장바구니 옵션 모달이 이것 하나를
          //   쓰는데, 규칙이 없어 쇼핑 상세 봉투(lz-productL — 사진 캐러셀·선물 모달 + embla 18.7KB)에 들어가 있었다 →
          //   app-components 를 정적으로 받는 어드민·셀러가 그 봉투를 통째로 받았다(라이브 /admin 실측).
          //   app-components 가 이미 받는 leaf 봉투로 옮겨 요청 수를 늘리지 않는다.
          if (id.includes('/src/hooks/useFocusTrap')) return 'app-ui-utils'
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
          // 🔁 2026-10-15: Vite 의 동적 import 도우미(`vite/preload-helper`)는 **처음 필요한 청크**로 간다. 하단 탭 미리받기
          //   (`lib/tab-warm.ts`, app-utils)가 들어오자 도우미가 app-shared → app-utils 로 옮겨 app-shared(지역 판정의 동적
          //   import)가 app-utils 를 import 하게 됐고, app-utils 는 원래 app-shared 를 import 한다 ⇒ 순환(check-chunk-cycles).
          //   main 처럼 app-shared 에 고정한다.
          if (id.endsWith('vite/preload-helper.js')) return 'app-shared' // 라이브러리 아님(Vite 내부 도우미) — includes 로 쓰면 surface-chunks 시험이 라이브러리 봉투로 오인한다
          // 🚪 2026-10-15: 하단 탭 미리받기는 App 이 마운트 뒤 **동적으로** 부른다 — 부팅 봉투(app-utils)에 넣지 않는다.
          if (id.includes('/src/lib/tab-warm')) return 'app-tab-warm'
          // 앱 유틸: src/utils/, src/hooks/, src/lib/ — App 전체에 공유되지만 별도 캐싱
          if (id.includes('/src/utils/') || id.includes('/src/hooks/') || id.includes('/src/lib/')) return 'app-utils'
          // 기능 모듈 API — seller/admin/agency/auth 기능 코드 (대시보드에서만 사용)
          // 📝 2026-10-19: 블로그 본문 렌더러·커버(`features/blog/`)와 서버 첫 화면과 같이 쓰는 상수(`shared/blog-page`)는
          //   블로그 화면만 쓴다 — `app-features` 에 섞이면 그 봉투를 받는 마이(dash:my)까지 블로그 코드를 받는다
          //   (surface-budgets 가 잡았다: 상수 이전으로 app-features +1.6KB → 마이·블로그 상세 예산 초과).
          if (id.includes('/src/features/blog/') || id.includes('/src/shared/blog-page')) return 'app-blog'
          if (id.includes('/src/features/')) return 'app-features'
          // 라우트 그룹 정의 파일 — seller/admin/agency 라우트 (큰 Route 트리)
          // ⚡ 2026-10-12 어드민 라우트 표는 App 이 `/admin/*` 에서 lazy 로 받는다 — 같은 봉투면 소비자 첫 방문이 받는다.
          if (id.includes('/src/routes/admin.routes')) return 'app-routes-admin'
          if (id.includes('/src/routes/seller.routes')) return 'app-routes-seller' // ⚡ 2026-10-18 셀러 표 — /seller/* 에서만(seller-public.routes 머리말)
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
          // 📱 2026-09-14 (모바일 우선 재설계): `components/seller-layout/`(하단 탭·nav 모델)은 SellerLayout 의 부품이라
          //   셀러 봉투다. 규칙이 없으면 `components/` catch-all 로 app-components 에 떨어지고, 그 파일들이
          //   `components/seller/seller-primary-nav` 를 import 하므로 **app-components → app-seller-components 순환**이 생겨
          //   상세·유어샵·교환권 표면이 셀러 봉투(+app-dashboard)를 첫 페인트에 받았다(CI surface-role-leak 8건, 빌드 경고 'Circular chunk').
          // 🧭 2026-09-26 [UNLOCK_LOADING] **나브 색인은 껍데기가 아니다** — 따로 가른다.
          //   배경(실측): 마이의 '전체 도구' 시트가 `useSellerNavModel`(색인 SSOT)을 읽는데,
          //   그 파일들이 `/src/components/seller{,-layout}/` catch-all 로 `app-seller-components`
          //   (83.8KB)에 묶여 있었다. 그래서 **목록 한 장을 그리려고** StoreRegisterModal(29.5KB)·
          //   SellerLayout(19.3KB)·BulkUploadModal(12.8KB)·ProductOptionForm(11.2KB) 까지 받았다 —
          //   그중 어느 것도 마이에서 렌더되지 않는다.
          //   ⚠️ 이 네 줄은 아래 두 catch-all 보다 **먼저** 와야 한다(먼저 매칭되는 규칙이 이긴다).
          //   ⚠️ 색인은 순수 데이터·훅이라 대시보드도 같은 청크를 재사용한다(중복 0).
          if (id.includes('/src/components/seller/seller-nav')) return 'app-seller-nav'
          if (id.includes('/src/components/seller/seller-tab-groups')) return 'app-seller-nav'
          if (id.includes('/src/components/seller/seller-primary-nav')) return 'app-seller-nav'
          if (id.includes('/src/components/seller-layout/useSellerNavModel')) return 'app-seller-nav'
          // 🪪 2026-10-19 — 승인 상태 키(`seller-approval`, 1.6KB · import 0)는 **app-shared** 로.
          //   마이 판매 구역의 안내문(`store-status-note`)이 상수 하나를 읽는데 그 파일이 이 색인 봉투에 있어서,
          //   판매자 마이 첫 화면이 나브 색인 + lucide(10.2) + lucide-desktop 을 통째로 받았다(위 `seller-roles` 와 같은 함정).
          if (id.includes('/src/shared/seller-approval')) return 'app-shared'
          // 📜 같은 함정(2026-10-19): 약관 버전 상수(`pages/terms/terms-types`, 1.2KB · import 0)에 규칙이 없어
          //   Rollup 이 판매자 가입 화면과 함께 `app-seller-components` 에 넣었다 → 에이전시 콘솔이 매장 등록 카드에서
          //   `TERMS_CURRENT_VERSION` 하나를 읽느라 판매자 대시보드 봉투(+그 의존 전부)를 첫 화면에 받았다.
          if (id.includes('/src/pages/terms/terms-types')) return 'app-shared'
          // 🏠 2026-10-25 같은 함정: 생활 업종 SSOT(`life-deal-subcat`, import 0 — 타입만)를 홈 피드와 사장님 수정 화면이 함께 써서
          //   묶음기가 홈 봉투에 넣었고, 어드민이 홈 PC 봉투 넷(+23KB)을 끌고 왔다 → 자기 작은 봉투.
          if (id.includes('/src/shared/life-deal-subcat')) return 'app-life-subcat' // 묶음기 보호 목록(LIBRARY_ENVELOPES)에 함께 — 안 그러면 다시 홈 봉투로 간다
          // 🎁 2026-10-31 무상 체험 — 라벨은 공용으로, 나머지(신청 시트·제공 설정·연동 목록·규칙 표)는 자기 봉투로.
          //   라벨이 상세 봉투에 들어가면 그걸 부르는 공용 묶음을 타고 어드민이 상세 봉투를 통째로 받는다(dash:admin +23KB 실측).
          //   팔아보기 카드(SellThisCard)는 상세 첫 화면에 그려지므로 일부러 제외 — 상세 봉투로 간다.
          if (id.includes('/src/shared/seeding-labels')) return 'app-shared'
          if (id.includes('/src/shared/seeding') || (id.includes('/src/components/seeding/') && !id.includes('/SellThisCard'))) return 'app-seeding'
          // 🏠 2026-10-26 같은 함정: 업체 소개 페이지 SEO 헬퍼(`life-biz-seo`)가 규칙 없이 묶음기로 가자 교환권 첫 화면 청크가 25→27 로 쪼개졌다 → 자기 봉투.
          if (id.includes('/src/shared/life-biz-seo')) return 'app-life-biz'
          if (id.includes('/src/components/seller-layout/')) return 'app-seller-components'
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
          // 🖥️ 2026-10-13: PC 사이드바는 넓은 화면에서만 lazy 로 받는다(MobileAppLayout) — 셸 목록에서 뺐다.
          //   셸에 남겨 두면 lazy 로 바꿔도 app-shell 안에 그대로 실려 폰도 받는다(그리고 그 아이콘이 lz-common 을 끌고 온다).
          if (id.includes('/src/components/DesktopLiveSidebar')) return 'app-desktop-chrome'
          if (
            id.includes('/src/components/FrameWrapper') ||
            id.includes('/src/components/GripFrameLayout') ||
            id.includes('/src/components/MobileAppLayout') ||
            id.includes('/src/components/ErrorBoundary') ||
            id.includes('/src/components/ToastContainer') ||
            id.includes('/src/components/ScrollToTop') ||
            id.includes('/src/components/OfflineBanner') ||
            id.includes('/src/components/ThemeProvider') ||
            id.includes('/src/components/IosTopupGate') ||
            id.includes('/src/components/KakaoConsultButton') ||
            id.includes('/src/components/brand/') ||
            id.includes('/src/components/ui/confirm-dialog') ||
            // 🦦 2026-10-07: ErrorBoundary(셸)가 유달이 부품을 정적 import 한다 → 함께 들어와야
            //   app-components 가 다시 preload 되지 않는다(critical-chunks 가 9개 청크 진입으로 잡았다).
            //   부품은 ~1KB 이고 이미지는 /assets/*.webp 별도 파일이라 렌더 전엔 내려받지 않는다.
            id.includes('/src/components/mascot/')
          ) return 'app-shell'
          if (id.includes('/src/components/')) return 'app-components'
          // 나머지 src/ 디렉터리 — types, constants, config, layouts
          if (id.includes('/src/types/') || id.includes('/src/constants/') ||
              id.includes('/src/config/') || id.includes('/src/layouts/')) return 'app-misc'
          return undefined
        })(), meta) },
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

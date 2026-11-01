// 🖼️ 2026-10-18 교환권 머리 배너를 서버 첫 화면에 — 가드: src/tests/unit/vouchers-hero-banner-ssr-2026-10-18.test.tsx
export default [
  {
    name: '🖼️ 교환권 머리에 배너가 되살아난다 (첫 상품이 다시 196px 아래로)',
    file: 'src/worker/utils/vouchers-first-screen.ts',
    find: "  topRow: VOUCHERS_TOP_ROW.row,",
    replace: "  topRow: 'relative h-[196px] overflow-hidden bg-gray-900 dark:bg-surface',",
    test: 'src/tests/unit/vouchers-hero-banner-ssr-2026-10-18.test.tsx',
    why: '2026-11-01 대표 확정 A안은 머리가 56px 한 줄이다. 196px 판으로 되돌리면 첫 상품이 y=230 → 432 로 내려가는데 빌드도 화면도 안 깨진다.',
  },
  {
    name: '🖼️ 교환권이 다시 배너 보조 시드를 받는다 (self-fetch 가 하나 는다)',
    file: 'src/worker/index.ts',
    find: " // 🎟️ 2026-11-01 A안 — 머리에 배너가 없다",
    replace: " if (!url.search) ssrExtra = { slot: 'BANNERS', path: '/api/banners' }; // 🎟️ 2026-11-01 A안 — 머리에 배너가 없다",
    test: 'src/tests/unit/vouchers-hero-banner-ssr-2026-10-18.test.tsx',
    why: '머리에 배너가 없으니 그 시드는 쓰이지 않는다. 받아도 화면은 멀쩡하고 교환권 요청마다 self-fetch 하나가 조용히 늘 뿐이다(서브리퀘스트 예산).',
  },
  // 🪦 2026-11-01 제거: '🖼️ 앱이 배너 시드를 안 읽는다 — 서버 배너가 사라졌다 다시 나타난다'
  //   그 결함은 **더 이상 결함이 아니다.** A안으로 교환권 머리에 배너가 없어지면서 워커가
  //   `__SSR_INITIAL_BANNERS__` 를 아예 안 싣고(주입처 0), 그러면 리더를 지워도 **행동이 안 변한다**
  //   (늘 `undefined` 였다) — 실제로 CI 에서 "가드가 지키는 척만 한다"로 빨간불이 났다(run 41286191380).
  //   처방은 가드 재조준이 아니라 **죽은 가지 제거**였다(`useHomeBanners.ts` 의 `readBannersSeed`).
  //   ⚠️ 이 자리에 주입을 다시 만들려 하지 말 것 — 출력으로 판정할 수 없다. 되살아나는 방향은
  //   위 '🖼️ 교환권이 다시 배너 보조 시드를 받는다' 가 잡는다.
  {
    name: '🖼️ 홈이 섹션 시드로 첫 배너를 안 세운다 — 상단 배너가 마운트 때 사라진다',
    file: 'src/components/home/useHomeBanners.ts',
    find: '    const strip = stripBannersOf(raw)',
    replace: '    const strip = [] as ReturnType<typeof stripBannersOf>',
    test: 'src/tests/unit/vouchers-hero-banner-ssr-2026-10-18.test.tsx',
    why: '교환권 BANNERS 시드를 걷으면서 홈의 *살아 있는* 시드 경로까지 같이 걷는 방향. 서버가 그린 상단 배너가 마운트 때 사라졌다가 응답 뒤 다시 나타나며 첫 섹션을 흔든다(빌드·화면 안 깨짐).',
  },
  {
    name: '🖼️ 상세 히어로 화질이 다시 85',
    file: 'src/shared/detail-hero-image.ts',
    find: 'export const DETAIL_HERO_QUALITY = 75',
    replace: 'export const DETAIL_HERO_QUALITY = 85',
    test: 'src/tests/unit/image-quality-2026-10-18.test.ts',
    why: '2026-10-20 대표 승인으로 75 — 85 로 돌아가면 상세의 LCP 사진이 20% 무거워진다(숙소 105 → 132KB).',
  },
  {
    name: '🖼️ 기본 화질이 다시 85',
    file: 'src/utils/cf-image.ts',
    find: 'export const CF_IMAGE_DEFAULT_QUALITY = 75',
    replace: 'export const CF_IMAGE_DEFAULT_QUALITY = 85',
    test: 'src/tests/unit/image-quality-2026-10-18.test.ts',
    why: '홈 카드 사진이 다시 23~34% 무거워진다(첫 방문 사진 470KB). 화면은 그대로라 아무도 모른다.',
  },
  {
    name: '🖼️ 높게 명시한 사진이 데이터 절약 모드를 우회한다',
    file: 'src/utils/cf-image.ts',
    find: 'if (getSaveData() && !(opts.quality && opts.quality <= 65)) {',
    replace: 'if (getSaveData() && !opts.quality) {',
    test: 'src/tests/unit/image-quality-2026-10-18.test.ts',
    why: '상세 히어로가 85 를 명시하면서 데이터 절약 사용자도 85 를 받게 된다.',
  },
  {
    name: '⚡ 셀러 라우트 표를 다시 정적으로 import — 손님 첫 방문에 28KB',
    file: 'src/App.tsx',
    find: "const SellerRouteTree = lazy(() => import('./routes/seller.routes'))",
    replace: "import SellerRouteTree from './routes/seller.routes'",
    test: 'src/tests/unit/seller-route-tree-2026-10-13.test.tsx',
    why: '셀러 대시보드 표(raw 28KB)가 모든 손님의 첫 방문에 다시 실린다. 화면은 그대로라 아무도 모른다.',
  },
  {
    name: '🧹 rest 를 core 가 오기 전에도 부른다 — 모든 손님이 받는다',
    file: 'src/i18n.ts',
    find: "if (loaded.has(lng) && !restLoaded.has(lng) &&",
    replace: "if (!restLoaded.has(lng) &&",
    test: 'src/tests/unit/i18n-rest-split-2026-10-18.test.ts',
    why: 'core 도착 전엔 모든 키가 빠진 상태라 첫 렌더마다 rest 를 받게 된다 — 줄인 7KB 를 다시 받는다.',
  },
  {
    name: '🧹 rest 판정이 소스가 가리키는 키까지 뺀다',
    file: 'scripts/i18n-split.mjs',
    find: "      if (refKeep(p)) put(core, parts, node)",
    replace: "      if (refKeep(p) && !p.startsWith('common.')) put(core, parts, node)",
    test: 'src/tests/unit/i18n-rest-split-2026-10-18.test.ts',
    why: '화면이 쓰는 키가 core 에서 빠지면 rest 가 올 때까지 키 이름이나 기본값이 보인다.',
  },
  {
    name: '🧹 빠진 키를 rest 에도 안 넣는다 — 키가 사라진다',
    file: 'scripts/i18n-split.mjs',
    find: "      else put(rest, parts, node)",
    replace: "      else { /* drop */ }",
    test: 'src/tests/unit/i18n-rest-split-2026-10-18.test.ts',
    why: '안전망이 받아 올 곳이 없어 그 문구가 영영 안 뜬다.',
  },
  {
    name: '🖥️ PC 상단 네비를 다시 정적 import — 폰 첫 방문에 33KB',
    file: 'src/components/main/ConsumerTopChrome.tsx',
    find: "const DesktopTopNav = lazyPage(() => import('./DesktopTopNav'))",
    replace: "import DesktopTopNavStatic from './DesktopTopNav'\nconst DesktopTopNav = Object.assign(DesktopTopNavStatic, { load: () => Promise.resolve({ default: DesktopTopNavStatic }) })",
    test: 'src/tests/unit/desktop-chrome-lazy-2026-10-18.test.ts',
    why: '폰은 그리지도 않는 PC 네비 코드를 매 첫 방문에 받는다. 화면은 같다.',
  },
  {
    name: '🖥️ PC 는 첫 렌더 전에 네비를 안 받는다 — 늦게 끼어들며 본문을 민다',
    file: 'src/main.tsx',
    find: 'await Promise.all([preloadBootPage(bootSurface()), warmDesktopChrome()])',
    replace: 'await preloadBootPage(bootSurface())',
    test: 'src/tests/unit/desktop-chrome-lazy-2026-10-18.test.ts',
    why: 'PC 첫 렌더에 네비가 없다가 0.x초 뒤 위에 끼어들며 아래 전체를 민다(2026-10-13 이 lazy 를 피한 이유).',
  },
  {
    name: '🧹 한국어 기본값이 있는 키로도 rest 를 부른다 — 거의 모든 화면이 rest 를 받는다',
    file: 'src/i18n.ts',
    find: "(fb === key || fb == null || lng !== 'ko')",
    replace: "(true)",
    test: 'src/tests/unit/i18n-rest-split-2026-10-18.test.ts',
    why: '실측 5화면(유어샵·지도·마이·FAQ·지갑)이 기본값 있는 키 때문에 rest 10KB 를 받았다',
  },
  {
    name: '🧹 FAQ 답이 rest 로 빠진다 — 다른 언어 화면에 한국어 답',
    file: 'scripts/i18n-split.mjs',
    find: "    if (qa !== p && exact.has(qa)) return true",
    replace: "",
    test: 'src/tests/unit/i18n-rest-split-2026-10-18.test.ts',
    why: '`t(f.key.replace(/\\.q/, \'.a\'))` 는 답 키를 문자열로 남기지 않는다',
  },
  {
    name: '🔔 알림 시트가 다시 lz-common 으로 — 폰 첫 화면이 패널과 아이콘 봉투를 받는다',
    file: 'scripts/surface-chunks.mjs',
    find: "export const LAZY_ENVELOPES = new Set(['app-notification-panel', ", // 2026-10-25 재조준(app-life-banner 추가)
    replace: "export const LAZY_ENVELOPES = new Set([",
    test: 'src/tests/unit/desktop-chrome-lazy-2026-10-18.test.ts',
    why: '실측(gz): 홈 218.8 → 221.6 · 블로그 글 203.0 → 205.9 — lazy 시트가 거의 모든 첫 화면에 실린다',
  },
  {
    name: '🖥️ PC 사이드바 아이콘이 목록에서 빠진다 — PC 가 214개 lucide 봉투를 받는다',
    file: 'vite.config.ts',
    find: "  'compass', 'plus',\n",
    replace: "",
    test: 'src/tests/unit/lucide-shell-icons.test.ts',
    why: 'PC 홈 실행 JS 372 → 410KB(실측)',
  },
]

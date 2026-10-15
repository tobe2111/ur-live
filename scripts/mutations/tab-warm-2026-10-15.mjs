/**
 * 🧬 주입 — 하단 탭 화면 코드 미리받기 (2026-10-15 대표 *"각 페이지 들어갈 때 시간이 걸려 아직도"*)
 */
const T = 'src/tests/unit/tab-warm-2026-10-15.test.ts'
export default [
  {
    name: '탭미리받기 — App 이 부르지 않는다(탭을 처음 누를 때마다 로더가 다시 뜬다)',
    file: 'src/App.tsx',
    find: 'useEffect(() => startTabWarm(location.pathname), [])',
    replace: 'useEffect(() => { void startTabWarm }, [])',
    test: T,
    why: '모듈은 남아 있는데 아무도 안 부르면 에러 없이 2026-05-27 의 빈 자리로 돌아간다.',
  },
  {
    name: '탭미리받기 — load 를 기다리지 않는다(첫 화면 사진과 회선을 나눠 쓴다)',
    file: 'src/lib/tab-warm.ts',
    find: 'const stopLoad = runAfterLoad(() => { timer = setTimeout(() => next(0), delayMs) })',
    replace: 'const stopLoad = () => {}; next(0)',
    test: T,
    why: '2026-05-27 에 idle prefetch 를 지운 이유가 바로 첫 화면과의 경합이었다.',
  },
  {
    name: '탭미리받기 — 한꺼번에 받는다',
    file: 'src/lib/tab-warm.ts',
    find: 'p.catch(() => {}).finally(() => next(i + 1))',
    replace: 'p.catch(() => {}); next(i + 1)',
    test: T,
    why: '네 화면을 동시에 받으면 지금 보는 화면의 늦은 요청이 밀린다.',
  },
  {
    name: '탭미리받기 — 로그아웃인데 로그인 화면을 받는다',
    file: 'src/lib/tab-warm.ts',
    find: 'return loggedIn ? LOGGED_IN_TABS : GUEST_TABS',
    replace: 'return LOGGED_IN_TABS',
    test: T,
    why: '로그아웃이면 이용권·마이 탭은 게스트 화면이 그려진다 — 엉뚱한 코드를 받으면 회선만 쓰고 이득 0.',
  },
  {
    name: '탭미리받기 — 데이터 절약 모드를 무시한다',
    file: 'src/lib/tab-warm.ts',
    find: 'if (c.saveData) return false',
    replace: 'if (c.saveData) return true',
    test: T,
    why: '데이터 절약을 켠 사람에게 안 누를 수도 있는 화면 코드를 받게 한다.',
  },
  {
    name: '탭미리받기 — 대시보드에서도 받는다',
    file: 'src/lib/tab-warm.ts',
    find: "const NO_TAB_PREFIX = /^\\/(seller|admin|agency|ads|wholesale|supplier)(\\/|$)/",
    replace: 'const NO_TAB_PREFIX = /^$/',
    test: T,
    why: '대시보드엔 하단 탭이 없다.',
  },
  {
    name: '탭미리받기 — 교환권 목록 보관 키가 페이지와 갈린다',
    file: 'src/pages/vouchers/tab-warm-list.ts',
    find: 'export const VOUCHERS_DEFAULT_VIEW_KEY = `vouchers:list:page:${VOUCHERS_DEFAULT_CATEGORY}||price_low`',
    replace: 'export const VOUCHERS_DEFAULT_VIEW_KEY = `vouchers:page:${VOUCHERS_DEFAULT_CATEGORY}`',
    test: T,
    why: '키가 다르면 보관만 하고 페이지는 못 읽는다 — 에러 없이 로더가 그대로 남는다.',
  },
  {
    name: '탭미리받기 — 사용자가 본 목록을 덮는다',
    file: 'src/pages/vouchers/tab-warm-list.ts',
    find: '  if (readListView(VOUCHERS_DEFAULT_VIEW_KEY) != null) return false\n  const body',
    replace: '  const body',
    test: T,
    why: '더보기로 편 목록(뒤로가기 복원용)을 1페이지로 덮으면 2026-09-13 의 "목록이 도로 짧아짐" 이 돌아온다.',
  },
  {
    name: '탭미리받기 — 센트리 세션이 다시 화면마다 열린다',
    file: 'src/lib/sentry.ts',
    find: "Sentry.browserSessionIntegration({ lifecycle: 'page' }),",
    replace: '',
    test: 'src/tests/unit/sentry-sdk-slim-2026-10-11.test.ts',
    why: '기본값(route)이면 탭을 누를 때마다 센트리로 요청 2건이 우리 요청과 같은 순간에 나간다.',
  },
  {
    name: '탭미리받기 — 쇼핑 화면에서도 교환권 목록을 받는다',
    file: 'src/lib/tab-warm.ts',
    find: 'const SELF_LISTING = /^\\/(vouchers|browse)(\\/|$)/',
    replace: 'const SELF_LISTING = /^\\/(vouchers)(\\/|$)/',
    test: T,
    why: '쇼핑은 같은 /api/products 를 스스로 부른다 — 한 화면에서 같은 경로가 두 번(CI duplicate-fetch).',
  },
]


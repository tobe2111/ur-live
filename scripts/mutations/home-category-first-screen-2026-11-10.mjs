/** 🧬 주입 — 홈 `?category=` 에서 서버가 전체 홈 첫 화면을 다시 그리면 가드가 잡는가. 가드: src/tests/unit/home-category-first-screen-2026-11-10.test.ts */
const T = 'src/tests/unit/home-category-first-screen-2026-11-10.test.ts'
export default [
  {
    name: '🏠 워커가 카테고리 쿼리를 다시 안 본다(CLS 0.83 회귀)',
    file: 'src/worker/index.ts',
    find: " && !homeCategoryOf(url.search)) {",
    replace: ") {",
    test: T,
    why: '전체 홈 첫 화면을 그린 뒤 앱이 편성을 숨긴다 — 2026-11-10 라이브 실측 CLS 0.83.',
  },
  {
    name: '🏠 판정이 전체(all)도 카테고리로 본다(홈 칩 "전체" 링크에서 첫 화면이 사라진다)',
    file: 'src/shared/home-query.ts',
    find: "return c && c !== 'all' && ",
    replace: "return c && ",
    test: T,
    why: '반대 방향 — `?category=all` 은 전체 홈과 같은 화면이라 첫 화면을 그려야 한다(안 그리면 로더로 회귀).',
  },
  {
    name: '🏠 판정이 모르는 값도 받아들인다(화면은 전체로 되돌리는데 서버는 안 그린다)',
    file: 'src/shared/home-query.ts',
    find: " && (HOME_CATEGORY_KEYS as readonly string[]).includes(c) ? ",
    replace: " ? ",
    test: T,
    why: '화면 훅은 목록 밖 값을 무시하고 전체 홈을 그린다 — 서버만 빼면 그 주소는 로더로 회귀한다.',
  },
  {
    name: '🏠 화면 훅이 자기 목록을 다시 손으로 적는다(두 벌이 갈리기 시작한다)',
    file: 'src/pages/main-home/useHomeQuerySync.ts',
    find: "export const HOME_CATEGORY_KEYS: DealCategory[] = [...SHARED_HOME_CATEGORY_KEYS]",
    replace: "export const HOME_CATEGORY_KEYS: DealCategory[] = ['all', 'meal_voucher', 'beauty_voucher', 'stay_voucher', 'home_voucher', 'etc_voucher']",
    test: T,
    why: '카테고리가 하나 늘 때 워커가 모르면 그 주소에서 다시 통째로 밀린다.',
  },
  {
    name: '🏠 폰 홈이 카테고리를 다시 한 프레임 늦게 읽는다(전체 홈을 그렸다 통째로 올라온다)',
    file: 'src/pages/mobile-home/MobileHomePage.tsx',
    find: "useState<DealCategory>(() => (typeof window !== 'undefined' ? homeCategoryOf(window.location.search) : null) ?? 'all')",
    replace: "useState<DealCategory>('all')",
    test: T,
    why: '2026-11-10 rAF 추적 — 첫 프레임에 편성 1,728px 이 그려지고 다음 프레임에 사라져 목록이 1873 → 145 로 올라온다(CLS 0.78).',
  },
]

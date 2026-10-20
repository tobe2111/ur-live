// 🧹 마이 넷 정리 — 전체 구매 이름 · 현황 바 자리 · 0 숨김 · 맨 아래 정렬 (2026-10-18)
const TEST = 'src/tests/unit/my-four-fixes-2026-10-18.test.ts'

export default [
  {
    name: "🧹 마이 넷: 걷은 이용권 현황 바가 '내가 산 것' 에 돌아온다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: '      <div>\n        {items.map((item) => (',
    replace: '      <OrderStatusBar />\n      <div>\n        {items.map((item) => (',
    test: TEST,
    why: "맨 위 숫자 줄이 `이용권 N` 을 이미 말한다 — 같은 구역에 이용권 숫자가 두 줄 선다(2026-10-19 걷음).",
  },
  {
    name: "🧹 마이 넷: '찜한 상품 0' 이 다시 적힌다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "count: counts.wish || undefined, path: '/wishlist'",
    replace: "count: counts.wish, path: '/wishlist'",
    test: TEST,
    why: '한 목록이 0 을 적는 줄과 비운 줄 두 규칙으로 갈린다.',
  },
  {
    name: '🧹 마이 넷: 버전 줄만 다시 가운데로',
    file: 'src/pages/user-profile/AccountControlsSection.tsx',
    find: '      <p className="text-[12px] text-gray-400 dark:text-white/30 tabular-nums" title={BUILD_HASH || undefined}>',
    replace: '      <p className="text-[12px] text-gray-400 dark:text-white/30 text-center tabular-nums" title={BUILD_HASH || undefined}>',
    test: TEST,
    why: '맨 아래가 왼쪽(링크) ↔ 가운데(버전) 두 정렬로 갈린다.',
  },
  {
    name: '🧹 마이 넷: 탈퇴 링크만 다시 가운데 전폭으로',
    file: 'src/pages/user-profile/AccountControlsSection.tsx',
    find: 'className="inline-block py-2 text-[12px] text-gray-500',
    replace: 'className="block w-full py-3 px-4 text-center text-[12px] text-gray-500',
    test: TEST,
    why: '맨 아래 마지막 줄만 가운데라 정렬이 다시 섞인다.',
  },
]

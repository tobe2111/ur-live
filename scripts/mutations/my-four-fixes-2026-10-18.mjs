// 🧹 마이 넷 정리 — 전체 구매 이름 · 현황 바 자리 · 0 숨김 · 맨 아래 정렬 (2026-10-18)
const TEST = 'src/tests/unit/my-four-fixes-2026-10-18.test.ts'

export default [
  {
    name: "🧹 마이 넷: 총계 칸 이름이 '구매완료' 로 돌아간다",
    file: 'src/pages/user-profile/OrderStatusBar.tsx',
    find: "defaultValue: '전체 구매' }), key: 'bought'",
    replace: "defaultValue: '구매완료' }), key: 'bought'",
    test: TEST,
    why: "총계가 상태처럼 읽혀 맨 위 '이용권 N' 과 어긋나 보인다(실측: 위 3 ↔ 여기 5).",
  },
  {
    name: '🧹 마이 넷: 한국어 번역만 옛 값으로 남는다',
    file: 'public/locales/ko/translation.json',
    find: '"bought": "전체 구매"',
    replace: '"bought": "구매완료"',
    test: TEST,
    why: '코드 기본값만 고치면 번역 값이 이겨 화면은 그대로다.',
  },
  {
    name: "🧹 마이 넷: 폰 현황 바를 '내가 산 것' 에서 뺀다",
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: '      {statusBar && <div className="pb-2"><OrderStatusBar /></div>}\n',
    replace: '',
    test: TEST,
    why: '폰에서 이용권 현황이 통째로 사라진다(페이지에서도 뺐으므로).',
  },
  {
    name: '🧹 마이 넷: PC 에서도 현황 바를 켜 두 번 선다',
    file: 'src/pages/UserProfilePage.tsx',
    find: '      <ShoppingGroup counts={counts} statusBar={!isPc} />',
    replace: '      <ShoppingGroup counts={counts} statusBar />',
    test: TEST,
    why: "PC 는 '곧 쓸 이용권' 카드 안에 이미 있다 — 같은 화면에 같은 숫자 줄이 두 번 선다.",
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

// 🔎 2026-10-12 — 진입점 없던 알림톡 채널 안내를 검색 색인에 넣었다. 빼면 다시 아무도 못 연다.
export default [
  {
    name: '[진입점] 알림톡 채널 안내를 검색 색인에서 뺀다',
    file: 'src/components/seller/seller-nav.ts',
    find: "  { path: '/seller/plus-friend-guide', labelKey: 'seller.nav.plusFriendGuide', fallback: '알림톡 채널 추가', icon: Bell, group: '설정' },\n",
    replace: '',
    test: 'src/tests/unit/seller-page-search-2026-09-03.test.ts',
    why: '그 화면의 유일한 링크(온보딩 체크리스트)는 렌더되지 않는다 — 색인에서 빠지면 알림톡 채널 안내를 여는 길이 다시 0 이 된다.',
  },
]

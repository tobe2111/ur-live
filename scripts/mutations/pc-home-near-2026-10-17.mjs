// 📍 2026-10-17 대표 신고 — PC 홈 "가까운 순"인데 위치와 먼 이용권이 맨 위 · 왼쪽 필터 버튼이 열 밖으로.
export default [
  {
    name: '📍 거리순에서도 섹션 상품을 미룬다 (가까운 것이 통째로 뒤로)',
    file: 'src/pages/main-home/GroupBuyFeed.tsx',
    find: "sort === 'near' ? NO_DEFER : sectionIds",
    replace: 'sectionIds',
    test: 'src/tests/unit/home-feed-defers-section-items.test.ts',
    why: '섹션도 같은 위치로 정렬돼 거리순에서 미루면 피드 맨 위가 30km 밖이 된다 — 에러는 안 난다.',
  },
]

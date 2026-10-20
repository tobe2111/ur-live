/**
 * 🏘️ 이용권 상세 → 동네 이용권 모음 링크(2026-10-19 ③) — 주입 매니페스트.
 * 가드: src/tests/unit/neighborhood-link-2026-10-19.test.ts
 */
const TEST = 'src/tests/unit/neighborhood-link-2026-10-19.test.ts'

export default [
  {
    name: '🏘️ thin 시군구로도 사람을 보낸다',
    file: 'src/pages/group-buy/neighborhood-link.ts',
    find: '    if (sg?.indexable) {',
    replace: '    if (sg) {',
    test: TEST,
    why: '딜 1~2개짜리 동네 페이지는 noindex 인 thin 페이지다 — 거기로 보내면 손님도 크롤러도 빈 곳에 간다.',
  },
  {
    name: '🏘️ thin 시/도로도 보낸다',
    file: 'src/pages/group-buy/neighborhood-link.ts',
    find: '  if (sido.indexable) {',
    replace: '  if (sido) {',
    test: TEST,
    why: '시/도까지 thin 이면 링크를 안 그리는 것이 맞다.',
  },
  {
    name: '🏘️ 상세 첫 화면에서 바로 지역 집계를 묻는다',
    file: 'src/pages/group-buy/NeighborhoodLink.tsx',
    find: 'enabled: seen && REGION_PAGES_ENABLED && !!address,',
    replace: 'enabled: REGION_PAGES_ENABLED && !!address,',
    test: TEST,
    why: '상세 첫 화면 요청에 끼어들면 사진·제목과 회선을 나눈다.',
  },
  {
    name: '🏘️ 매장 카드에서 동네 링크가 빠진다',
    file: 'src/pages/group-buy/StoreLocation.tsx',
    find: '      <NeighborhoodLink address={address} />\n',
    replace: '',
    test: TEST,
    why: '동네 페이지로 들어오는 내부 링크가 다시 0 이 된다.',
  },
]

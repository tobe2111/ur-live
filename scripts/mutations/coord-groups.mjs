/**
 * 🗺️ 같은 좌표 이용권 묶기 (2026-09-09) — 주입 매니페스트.
 * 가드: src/tests/unit/coord-groups.test.ts
 */
const TEST = 'src/tests/unit/coord-groups.test.ts'
const FILE = 'src/pages/restaurant-map/coord-groups.ts'

export default [
  {
    name: '🗺️ 대표가 마지막 것으로 바뀐다 (목록 순서와 핀이 어긋난다)',
    file: FILE,
    find: '    if (!first.has(key)) first.set(key, r)',
    replace: '    first.set(key, r)',
    test: TEST,
    why: '입력 순서가 곧 정렬 결과다 — 대표를 뒤엣것으로 바꾸면 목록 1위와 지도 핀이 다른 상품이 된다.',
  },
  {
    name: '🗺️ 좌표 없는 행이 핀이 된다 (0,0 서아프리카 앞바다)',
    file: FILE,
    find: '    if (!r.restaurant_lat || !r.restaurant_lng) continue',
    replace: '    if (r.restaurant_lat == null || r.restaurant_lng == null) continue',
    test: TEST,
    why: '좌표 미설정이 0 으로 저장된다 — null 만 거르면 0,0 에 핀 무더기가 생긴다.',
  },
  {
    name: '🗺️ 좌표 키 자릿수가 바뀐다 (핀 diff 가 통째로 무의미해진다)',
    file: FILE,
    find: '  return `${lat.toFixed(5)}_${lng.toFixed(5)}`',
    replace: '  return `${lat.toFixed(4)}_${lng.toFixed(4)}`',
    test: TEST,
    why: '이 문자열은 useKakaoMap 의 핀 key 다 — 형식이 바뀌면 매 렌더가 전량 재생성이 된다.',
  },
  {
    name: '🗺️ 개수와 대표가 서로 다른 순회에서 나온다',
    file: FILE,
    find: '    coordGroupSize.set(key, (coordGroupSize.get(key) || 0) + 1)',
    replace: '    if (!coordGroupSize.has(key)) coordGroupSize.set(key, 1)',
    test: TEST,
    why: '대표는 있는데 개수가 늘 1 이면 카운트 칩이 조용히 사라진다 — 에러가 안 난다.',
  },
  {
    name: '🗺️ 페이지가 자기 그룹핑을 다시 짜기 시작한다',
    file: 'src/pages/RestaurantMapPage.tsx',
    find: '  const { withCoords, coordGroupSize } = useMemo(() => groupByCoord(filtered), [filtered])',
    replace: '  const { withCoords } = useMemo(() => groupByCoord(filtered), [filtered])\n  const coordGroupSize = useMemo(() => { const m = new Map<string, number>(); for (const x of filtered) { if (!x.restaurant_lat || !x.restaurant_lng) continue; const k = `${x.restaurant_lat.toFixed(5)}_${x.restaurant_lng.toFixed(5)}`; m.set(k, (m.get(k) || 0) + 1) } return m }, [filtered])',
    test: TEST,
    why: '두 벌로 갈라져 있던 것을 합친 것이 이 변경의 요지다 — 되돌아가면 같은 조용한 어긋남이 돌아온다.',
  },
]

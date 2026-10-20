/**
 * 🏨 숙소 상세 미리 데우기 (2026-10-15) — 주입 매니페스트.
 * 가드: src/tests/unit/stay-detail-warm-2026-10-15.test.ts
 */
const TEST = 'src/tests/unit/stay-detail-warm-2026-10-15.test.ts'
export default [
  { name: '🏨 데운 요청을 공유하지 않는다', file: 'src/pages/stays/stay-detail-warm.ts',
    find: '  const cur = inflight.get(id)\n  if (cur) return cur\n', replace: '', test: TEST,
    why: '상세가 같은 것을 다시 물어 데운 효과가 없다.' },
  { name: '🏨 실패한 요청을 비우지 않는다', file: 'src/pages/stays/stay-detail-warm.ts',
    find: "    .finally(() => { inflight.delete(id) })", replace: '', test: TEST,
    why: '한 번 실패하면 그 숙소는 영원히 실패한 약속을 돌려준다.' },
  { name: '🏨 오래된 데운 값을 그대로 쓴다', file: 'src/pages/stays/stay-detail-warm.ts',
    find: '  if (!hit || Date.now() - hit.at > FRESH_MS) return null', replace: '  if (!hit) return null', test: TEST,
    why: '몇 시간 전 값을 첫 화면에 그린다.' },
  { name: '🏨 상세가 데운 값을 안 쓴다', file: 'src/pages/StayDetailPage.tsx',
    find: '  const w = peekWarmStay(productId)?.data?.product as StayDetail | undefined', replace: '  const w = undefined as StayDetail | undefined', test: TEST,
    why: '데워 놓고도 풀스크린 로더가 뜬다.' },
  { name: '🏨 상세가 따로 묻는다', file: 'src/pages/StayDetailPage.tsx',
    find: '    stayDetailRequest(productId)\n      .then((body) => {', replace: '    api.get(`/api/group-buy/stays/${productId}`).then((r) => r.data)\n      .then((body) => {', test: TEST,
    why: '날아가는 데운 요청을 못 이어받아 같은 것을 두 번 받는다.' },
  { name: '🏨 숙소 카드가 다시 이용권 상세를 데운다', file: 'src/pages/main-home/GroupBuyFeedCard.tsx',
    find: 'if (isStay) warmStay(id); else prefetchGb(id)', replace: 'prefetchGb(id)', test: TEST,
    why: '숙소 상세 청크·데이터를 누른 뒤에야 받아 로더가 뜬다.' },
  { name: '🏨 숙소 카드가 이용권 청크까지 받는다', file: 'src/pages/main-home/GroupBuyFeedCard.tsx',
    find: 'const prefetchDetailChunk = isStay ? noopChunk : prefetchPassChunk', replace: 'const prefetchDetailChunk = prefetchPassChunk', test: TEST,
    why: '안 쓰는 화면 코드를 받는다(회선 낭비).' },
]

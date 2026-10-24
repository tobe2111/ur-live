/**
 * 📊 누가 팔았나 · 이미 있는 이용권 맡기기 · 에이전시 판매 내역/알림 (2026-10-24 대표 확정) — 주입 매니페스트.
 * 가드: src/tests/unit/agency-channel-performance-2026-10-24.test.ts (+ 알림은 agency-notifications-2026-10-12)
 *
 * 전부 **에러가 안 나는 결함**이다 — 옮긴 뒤의 판매가 앞 에이전시 성과로 잡히거나, 회수된 소개비가 성과에 남거나,
 * 다른 사람이 사장님 이용권을 옮기거나, 남의 매장 판매 내역이 보인다. 화면은 멀쩡하고 숫자만 틀린다.
 */
const TEST = 'src/tests/unit/agency-channel-performance-2026-10-24.test.ts'
const MTEST = 'src/tests/unit/agency-multi-store-scope-2026-10-24.test.ts'
const NTEST = 'src/tests/unit/agency-notifications-2026-10-12.test.tsx'
const CS = 'src/features/agency-console/api/channel-sales.ts'
const PERF = 'src/features/seller/api/seller-agency-performance.routes.ts'
const SALES = 'src/features/agency-console/api/agency-store-sales.ts'
const NOTIF = 'src/features/agency-console/api/agency-store-notifications.ts'
const LINK = 'src/features/seller/api/seller-agency-link.routes.ts'
const SCOPE = 'src/worker/utils/agency-product-scope.ts'
const CARD = 'src/pages/seller-analytics/StoreChannelPerformance.tsx'

export default [
  {
    name: '[누가팔았나] 맡은 기간의 끝을 안 본다(옮긴 뒤 판매가 앞 에이전시에도 잡힌다)',
    file: CS,
    find: ' AND (${pr}.ended_at IS NULL OR ${orderAlias}.created_at < ${pr}.ended_at)`',
    replace: '`',
    test: TEST,
    why: '이용권을 옮겨도 앞 에이전시 성과가 계속 늘어난다 — 두 줄에 같은 판매가 잡혀 합이 안 맞는데 에러는 0.',
  },
  {
    name: '[누가팔았나] 회수된 소개비를 소개 성과에 남긴다',
    file: CS,
    find: " AND a.status != 'clawed_back' ${sinceA}",
    replace: ' ${sinceA}',
    test: TEST,
    why: '환불로 되돌린 소개비가 그 사람 성과로 계속 보인다.',
  },
  {
    name: '[이용권맡기기] 사장님이 아니어도 이용권을 옮길 수 있다',
    file: PERF,
    find: "max: 200, windowSec: 3600 }), async (c) => {\n    try {\n      const g = await requireOwner(c)\n      if (g instanceof Response) return g",
    replace: "max: 200, windowSec: 3600 }), async (c) => {\n    try {\n      const g = await requireOwner(c)\n      if (false) return g",
    test: TEST,
    why: '운영자·에이전시 좌석이 사장님 이용권을 남의 에이전시로 옮긴다 — 성과 귀속이 조용히 바뀐다.',
  },
  {
    name: '[이용권맡기기] 운영 중이 아닌 에이전시에도 맡긴다',
    file: PERF,
    find: "        if (!link) return c.json({ success: false, code: 'AGENCY_NOT_ACTIVE'",
    replace: "        if (false) return c.json({ success: false, code: 'AGENCY_NOT_ACTIVE'",
    test: TEST,
    why: '끝난·수락 안 한 에이전시에 이용권이 걸려 아무도 못 고치고 성과만 그쪽으로 샌다.',
  },
  {
    name: '[에이전시판매] 맡은 매장인지 확인하지 않고 판매 내역을 준다',
    file: SALES,
    find: "      if (!ok) return c.json({ success: false, error: '우리 에이전시가 맡은 매장이 아니에요.' }, 403)",
    replace: "      if (false) return c.json({ success: false, error: '우리 에이전시가 맡은 매장이 아니에요.' }, 403)",
    test: TEST,
    why: '아무 매장 id 로 남의 매장 판매 내역이 열린다.',
  },
  {
    name: '[에이전시알림] 읽음 시각이 뒤로 간다',
    file: NOTIF,
    find: 'DO UPDATE SET seen_at = MAX(agency_sales_seen.seen_at, excluded.seen_at)',
    replace: 'DO UPDATE SET seen_at = excluded.seen_at',
    test: NTEST,
    why: '옛 알림 하나를 누르면 이미 읽은 새 알림이 다시 안 읽음이 된다.',
  },
  {
    name: '[에이전시알림] 남의 매장 주문 id 로 읽음을 앞당긴다',
    file: NOTIF,
    find: " AND seller_id IN (${stores.map(() => '?').join(',')})`,\n        ).bind(...want, ...stores.map((s) => s.sellerId))",
    replace: "`,\n        ).bind(...want)",
    test: NTEST,
    why: '아무 주문 id 로 우리 알림 전부를 읽음 처리할 수 있다.',
  },
  {
    name: '[누가팔았나] 사장님이 에이전시를 끊어도 이용권이 에이전시에 남는다',
    file: LINK,
    find: '      await releaseAgencyProducts(DB, g.sellerId, Number(r.agency_id))',
    replace: '      void 0',
    test: MTEST,
    why: '끊었는데 그 에이전시가 맡던 이용권이 계속 그쪽 것으로 잡혀 사장님이 못 고친다.',
  },
  {
    name: '[누가팔았나] 에이전시가 만든 이용권에 맡은 기간을 안 연다',
    file: SCOPE,
    find: '    await startAgencyProduct(DB, productId, seat.sellerId, seat.agencyId, seat.staffId)',
    replace: '    void startAgencyProduct',
    test: TEST,
    why: '에이전시가 만든 이용권의 판매가 사장님 줄로 잡힌다.',
  },
  {
    name: '[누가팔았나] 사장님이 아닐 때(403) 카드를 0건으로 그린다',
    file: CARD,
    find: '  if (isError && !data) {\n    return null',
    replace: '  if (false) {\n    return null',
    test: TEST,
    why: '운영자에게 지어낸 0 이 보인다.',
  },
]

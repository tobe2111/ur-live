/**
 * 🤝 에이전시 몫 1단계 (2026-10-24 대표 *"응 해줘"*) — 주입 매니페스트.
 * 가드: src/tests/unit/agency-share-2026-10-24.test.ts
 * (사장님 직접 판매 제외는 주입하지 않는다 — 사장님 줄은 0 고정이고 에이전시 쿼리는 그 기간만 보므로 결함이 출력에 안 닿는다.)
 * 전부 에러가 안 나는 결함이다 — 화면은 멀쩡하고 매장이 에이전시에 보낼 금액만 틀린다.
 */
const TEST = 'src/tests/unit/agency-share-2026-10-24.test.ts'
const SHARE = 'src/features/agency-console/api/agency-share.ts'
const SALES = 'src/features/agency-console/api/channel-sales.ts'
const ROUTE = 'src/features/seller/api/seller-agency-performance.routes.ts'

export default [
  {
    name: '[에이전시몫] 환불된 판매에도 몫이 붙는다',
    file: SHARE,
    find: "  return `SUM(CASE WHEN v.status = 'refunded' THEN 0",
    replace: '  return `SUM(CASE WHEN 1 = 0 THEN 0',
    test: TEST,
    why: '환불된 판매는 매장이 돈을 못 받았는데 에이전시에 줄 금액으로 잡힌다.',
  },
  {
    name: '[에이전시몫] 판매 시각이 아니라 지금 % 로 계산한다',
    file: SHARE,
    find: '      AND t.effective_from <= ${orderAlias}.created_at ORDER BY t.effective_from DESC, t.id DESC LIMIT 1)`',
    replace: '      ORDER BY t.effective_from DESC, t.id DESC LIMIT 1)`',
    test: TEST,
    why: '% 를 올리면 지난 달 금액까지 같이 올라간다 — 이미 정산한 달이 바뀐다.',
  },
  {
    name: '[에이전시몫] 같은 시각 두 기록 중 옛것을 고른다',
    file: SHARE,
    find: '      AND t.effective_from <= ${orderAlias}.created_at ORDER BY t.effective_from DESC, t.id DESC LIMIT 1)`',
    replace: '      AND t.effective_from <= ${orderAlias}.created_at ORDER BY t.effective_from DESC, t.id ASC LIMIT 1)`',
    test: TEST,
    why: '방금 고친 % 가 무시된다.',
  },
  {
    name: '[에이전시몫] null 을 0% 로 받는다',
    file: SHARE,
    find: "  const pct = typeof raw === 'number' ? raw : typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN",
    replace: '  const pct = Number(raw)',
    test: TEST,
    why: '빈 값이 "0% 로 정함" 으로 조용히 저장된다 — 몫 미정과 0% 가 구분되지 않는다.',
  },
  {
    name: '[에이전시몫] 끊긴 에이전시에도 % 를 정할 수 있다',
    file: ROUTE,
    find: `"SELECT id FROM agency_store_links WHERE seller_id = ? AND agency_id = ? AND status IN ('pending','active') LIMIT 1",`,
    replace: '"SELECT id FROM agency_store_links WHERE seller_id = ? AND agency_id = ? LIMIT 1",',
    test: TEST,
    why: '함께하지 않는 에이전시 몫이 매장 성과표에 남는다.',
  },
  {
    name: '[에이전시몫] 에이전시 판매 내역이 몫을 0 으로 낸다',
    file: SALES,
    find: '    share: { pct: sum?.share_pct == null ? null : Number(sum.share_pct), amount: Math.round(Number(sum?.share_raw) || 0) },',
    replace: '    share: { pct: sum?.share_pct == null ? null : Number(sum.share_pct), amount: 0 },',
    test: TEST,
    why: '사장님 화면과 에이전시 화면의 금액이 갈린다 — 둘이 서로 다른 숫자로 다툰다.',
  },
  {
    name: '[에이전시몫] 사장님이 아니어도 몫을 바꿀 수 있다',
    file: ROUTE,
    find: "max: 60, windowSec: 3600 }), async (c) => {\n    try {\n      const g = await requireOwner(c)\n      if (g instanceof Response) return g",
    replace: "max: 60, windowSec: 3600 }), async (c) => {\n    try {\n      const g = await requireOwner(c)\n      if (false) return g",
    test: TEST,
    why: '운영자·에이전시 좌석이 자기 몫을 스스로 올린다.',
  },
]

/**
 * 🧬 주입 — 제휴사 입점 위젯 (2026-10-31 대표 "제휴사들이 자신들의 사이트에서 유어딜 서비스를 파는거지")
 *    가드: src/tests/unit/embed-partner-2026-10-31.test.ts
 */
const T = 'src/tests/unit/embed-partner-2026-10-31.test.ts'
const R = 'src/features/seller/api/store-agency-invite.routes.ts'
const C = 'src/pages/StoreClaimPage.tsx'
export default [
  {
    name: '제휴입점 — 공개 주소 요청이 바로 운영(active)을 연다',
    file: R,
    find: "\"INSERT OR IGNORE INTO agency_store_links (agency_id, seller_id, status, requested_by_user_id) VALUES (?, ?, 'pending', ?)\",\n    ).bind(agencyId, sellerId, userId).run()",
    replace: "\"INSERT OR IGNORE INTO agency_store_links (agency_id, seller_id, status, requested_by_user_id) VALUES (?, ?, 'active', ?)\",\n    ).bind(agencyId, sellerId, userId).run()",
    test: T,
    why: '위젯 코드는 누구나 본다. 바로 active 면 아무나 아무 매장을 남의 에이전시에 떠넘기고 직원이 그 매장에 들어간다.',
  },
  {
    name: '제휴입점 — 주인 확인을 건너뛴다',
    file: R,
    find: "    if (!agency) return c.json(PARTNER_DEAD, 404)\n    if (!(await isStoreOwner(DB, userId, sellerId))) {",
    replace: "    if (!agency) return c.json(PARTNER_DEAD, 404)\n    if (false && !(await isStoreOwner(DB, userId, sellerId))) {",
    test: T,
    why: '남의 매장을 내 마음대로 에이전시에 요청하면 그 매장 사장님 모르게 운영이 넘어갈 길이 생긴다.',
  },
  {
    name: '제휴입점 — 정지된 에이전시도 받는다',
    file: R,
    find: "\"SELECT id, name FROM agency_accounts WHERE id = ? AND status = 'active' LIMIT 1\"",
    replace: "\"SELECT id, name FROM agency_accounts WHERE id = ? LIMIT 1\"",
    test: T,
    why: '정지된 제휴사 사이트의 위젯이 계속 사장님 요청을 받으면 처리할 사람이 없는 요청이 쌓인다.',
  },
  {
    name: '제휴입점 — 매장 등록 뒤 제휴 화면으로 안 돌아온다',
    file: C,
    find: 'navigate(takePartnerReturn() ?? MY_PATH, { replace: true })',
    replace: 'navigate(MY_PATH, { replace: true })',
    test: T,
    why: '매장이 없던 사장님은 등록을 거친다. 돌아오지 않으면 어느 제휴사에서 왔는지 잃고 요청이 안 간다(에러 0).',
  },
]

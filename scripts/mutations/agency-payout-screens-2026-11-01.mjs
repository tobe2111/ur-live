/**
 * 🧬 주입 — 에이전시 지급 화면 두 개(2026-11-01 대표 "1번 다 해주고").
 * 가드: src/tests/unit/agency-payout-screens-2026-11-01.test.tsx
 */
const T = 'src/tests/unit/agency-payout-screens-2026-11-01.test.tsx'
const S = 'src/pages/agency-console/AgencySection.tsx'
const P = 'src/pages/agency-console/AgencyPayoutSheet.tsx'
const A = 'src/pages/admin/agency-accounts/AgencyPayoutsCard.tsx'
export default [
  { name: '에이전시정산화면 — 꺼져 있어도 정산 줄이 뜬다', file: S,
    find: '{payouts?.enabled && <FlatRow label="정산"', replace: '{payouts && <FlatRow label="정산"', test: T,
    why: '쓰지 않는 지급 길을 보여 주고, 눌러도 "아직 안 써요" 만 나온다.' },
  { name: '에이전시정산화면 — 최소 금액 검사를 뺀다', file: P,
    find: '&& b.available >= min && !hasOpen', replace: '&& !hasOpen', test: T,
    why: '최소 금액 미만에도 버튼이 살아 있어 누르면 서버 거절만 받는다.' },
  { name: '에이전시정산화면 — 처리 중 신청을 무시한다', file: P,
    find: '&& b.available >= min && !hasOpen', replace: '&& b.available >= min', test: T,
    why: '처리 중인 신청이 있는데 또 신청하게 한다.' },
  { name: '에이전시정산화면 — 직원에게도 신청 버튼', file: P,
    find: '              {canManage ? (', replace: '              {true ? (', test: T,
    why: '관리자만 해야 하는 회사 돈 신청을 직원이 누른다.' },
  { name: '에이전시정산화면 — 정산 조회가 직렬로 밀린다', file: S,
    find: "      agencyRequest<AgencyPayoutsResponse>('/payouts'),\n    ])",
    replace: "    ])\n    void agencyRequest<AgencyPayoutsResponse>('/payouts')", test: T,
    why: '에이전시 마이를 열 때마다 왕복 하나가 뒤에 붙는다.' },
  { name: '에이전시정산화면 — 지급 완료를 확인 없이', file: A,
    find: "    if (!(await confirmDialog({\n      message: `${who} 에",
    replace: "    if (!(await Promise.resolve({\n      message: `${who} 에", test: T,
    why: '송금 전에 실수로 눌러 장부가 지급 완료로 닫힌다(되돌릴 수 없다).' },
  { name: '에이전시정산화면 — 반려 사유 없이', file: A,
    find: "danger: true, prompt: { required: true } })", replace: "danger: true, prompt: {} })", test: T,
    why: '왜 반려됐는지 에이전시가 알 수 없다.' },
]

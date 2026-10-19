/**
 * 🧬 주입 — 회원 탈퇴: 돈·가게가 걸려 있으면 막는다 (2026-10-19 대표 결재 "권장안대로 해줘")
 *    가드: src/tests/unit/account-delete-blockers-2026-10-19.test.ts
 */
const T = 'src/tests/unit/account-delete-blockers-2026-10-19.test.ts'
const H = 'src/worker/utils/account-delete-blockers.ts'
const R = 'src/features/account/api/account.routes.ts'
const P = 'src/pages/AccountDeleteWarningPage.tsx'
export default [
  {
    name: '탈퇴차단 — 쓴 이용권까지 센다(영원히 못 나간다)',
    file: H,
    find: "   AND v.status = 'unused'\n",
    replace: "   AND v.status IN ('unused', 'used')\n",
    test: T,
    why: '이미 쓴 이용권까지 막으면 이용권을 한 번이라도 산 손님은 영원히 탈퇴하지 못한다.',
  },
  {
    name: '탈퇴차단 — 교환권도 이용권으로 센다',
    file: H,
    find: '   AND COALESCE(p.deal_only, 0) = 0\n',
    replace: '',
    test: T,
    why: '교환권은 지갑의 "사용 가능" 이용권과 다른 집합이다 — 화면과 서버 숫자가 갈린다.',
  },
  {
    name: '탈퇴차단 — 무상 딜까지 막는다(결재 위반)',
    file: H,
    find: "refundable_deal: Math.max(0, Math.floor(Number(deal.state.refundable) || 0)),",
    replace: "refundable_deal: Math.max(0, Math.floor(Number(deal.state.refundable) || 0)) + 1800,",
    test: T,
    why: '결재: 무상 딜(선물·보상)은 고지 후 소멸 — 막지 않는다. 환급할 수 없는 딜로 막으면 못 나간다.',
  },
  {
    name: '탈퇴차단 — 처리 중인 딜 환급을 놓친다',
    file: H,
    find: 'b.refundable_deal > 0 || b.deal_refund_pending ||',
    replace: 'b.refundable_deal > 0 ||',
    test: T,
    why: '환급이 반려되면 딜이 탈퇴한 계정으로 돌아간다 — 손님이 낸 돈이 사라진다.',
  },
  {
    name: '탈퇴차단 — 중개자(operator)도 가게 주인으로 센다',
    file: H,
    find: "AND o.user_id = ? AND o.role = 'owner' AND o.revoked_at IS NULL",
    replace: 'AND o.user_id = ? AND o.revoked_at IS NULL',
    test: T,
    why: '위임받아 남의 가게를 운영하는 사람이 자기 계정을 못 지우게 된다.',
  },
  {
    name: '탈퇴차단 — 가게 탈퇴로 정지된 가게도 막는다',
    file: H,
    find: "WHERE COALESCE(s.status, '') NOT IN ('suspended', 'rejected')\n   AND (s.linked_user_id",
    replace: 'WHERE 1 = 1\n   AND (s.linked_user_id',
    test: T,
    why: '가게 탈퇴를 마친 사장님이 회원 탈퇴를 영원히 못 한다(정지가 가게 탈퇴의 결과다).',
  },
  {
    name: '탈퇴차단 — 딜을 못 읽어도 연다(fail-open)',
    file: H,
    find: '    if (!deal.ok) return { ok: false }',
    replace: '    if (!deal.ok) return { ok: true, blockers: { unused_vouchers: 0, refundable_deal: 0, deal_refund_pending: false, owned_stores: 0 } }',
    test: T,
    why: '잔액을 못 읽은 순간 충전 딜이 소리 없이 사라진다 — 돈이 걸린 문은 모르면 닫는다.',
  },
  {
    name: '탈퇴차단 — 서버가 막힘을 무시하고 탈퇴를 실행한다',
    file: R,
    find: '    if (isAccountDeleteBlocked(pre.blockers)) {',
    replace: '    if (false && isAccountDeleteBlocked(pre.blockers)) {',
    test: T,
    why: '화면만 막으면 API 를 직접 부르는 순간 돈이 사라진다 — 서버가 최종 방어선이다.',
  },
  {
    name: '탈퇴차단 — 화면이 막힘 판정 없이 탈퇴 버튼을 연다',
    file: P,
    find: '!dealChecking && blockersClear && confirmText',
    replace: '!dealChecking && confirmText',
    test: T,
    why: '막을 것이 있는데 버튼이 열리면 누른 뒤에 409 를 맞는다 — 화면이 먼저 막아야 한다.',
  },
]

/**
 * 🔑 대행사 확정 플로우 — 매장 코드 · 협업 코드 · 중개사 몫 (2026-09-19) 되돌려-검증 주입.
 * 가드: src/tests/unit/agency-flow-codes-2026-09-19.test.ts
 *
 * 전부 **에러 없이 조용히 틀리는** 종류다: 자기 매장 자가 커미션 · 게이트 무시 · 이중 적립 ·
 * 유어딜 몫 잠식 · 결제수단별 비대칭 · 수락 경로 소실 · 만료 코드 통과.
 * 규약: `export default [ … ]` 하나. 이름은 전체에서 유일.
 */
const TEST = 'src/tests/unit/agency-flow-codes-2026-09-19.test.ts'

export default [
  {
    name: '🔑협업코드 자기 매장 운영자가 자기 매장 딜을 맺는다 (자가 커미션 루프)',
    file: 'src/worker/utils/influencer-code-redeem.ts',
    find: "    if (access.ok) return { ok: false, code: 'SELF', error: '내가 운영하는 매장에는 협업 코드를 쓸 수 없어요' }",
    replace: "    if (false as boolean) return { ok: false, code: 'SELF', error: '내가 운영하는 매장에는 협업 코드를 쓸 수 없어요' }",
    test: TEST,
    why: '결제 시점의 isSelfReferral 이 한 번 더 막지만, 입력 시점에 안 막으면 화면에 "활성" 이 떠서 거짓 약속이 된다.',
  },
  {
    name: '🔑협업코드 만료된 코드가 통과한다',
    file: 'src/worker/utils/store-codes.ts',
    find: "  if (row.expires_at && row.expires_at.replace(' ', 'T') < now.replace(' ', 'T')) return { ok: false, reason: 'EXPIRED' }",
    replace: "  if (false as boolean) return { ok: false, reason: 'EXPIRED' }",
    test: TEST,
    why: '기간 한정 캠페인 코드가 영원히 살아 있으면 끝난 조건으로 딜이 계속 생긴다 — 에러는 안 난다.',
  },
  {
    name: '💸중개사몫 게이트가 꺼져 있어도 적립한다 (기본 OFF 무시)',
    file: 'src/worker/utils/broker-share.ts',
    find: "  return String(row?.value) === 'true'",
    replace: '  return true',
    test: TEST,
    why: 'STAGING S-BROKER 실결제 전에 라이브 매장 몫이 잘려 나간다. 결재는 "켜는 것은 대표 판단" 이다.',
  },
  {
    name: '💸중개사몫 같은 주문에 두 번 적립한다 (딜 /join · 카드 confirm-toss 이중)',
    file: 'src/worker/utils/broker-share.ts',
    find: '    if (!ins.meta?.changes) return { credited: 0, brokerUserId: terms.brokerUserId } // 이미 적립됨(멱등)',
    replace: '    void ins',
    test: TEST,
    why: 'INSERT OR IGNORE 가 행을 안 만들어도 잔액·원장이 또 늘어난다 — 머니 룰 #3 위반. 잔액만 두 배가 되고 아무도 모른다.',
  },
  {
    name: '💸중개사몫 유어딜 몫(platform:revenue)에서 나간다',
    file: 'src/worker/utils/broker-share.ts',
    find: '      debit_account: sellerLedgerAccount(p.sellerId),',
    replace: "      debit_account: 'platform:revenue',",
    test: TEST,
    why: '결재 2026-09-16: 중개사 몫은 매장 몫에서. 유어딜 5% 를 debit 하면 중개 매장마다 유어딜이 적자다.',
  },
  {
    name: '💸중개사몫 카드 결제(confirm-toss)에서만 빠진다 (결제수단별 비대칭)',
    file: 'src/features/group-buy/api/group-buy.routes.ts',
    find: '    if (newOrderId) await creditBrokerShare(DB, { sellerId: Number(product.seller_id), orderId: newOrderId, orderNumber, productId, totalAmount: expectedAmount, refundWindowDays: rates.refund_window_days }) // 💸 중개사 몫 — /join 과 대칭',
    replace: '    void newOrderId',
    test: TEST,
    why: '딜로 사면 몫이 생기고 카드로 사면 안 생긴다. 2026-06-26 확정경로 비대칭 사고와 같은 클래스.',
  },
  {
    name: '🔑협업코드 인플루언서 수락 경로가 다시 인플 제안만 받는다 (매장 제안이 영원히 대기)',
    file: 'src/features/group-buy/api/marketing/collab-codes.ts',
    find: "        WHERE id = ? AND influencer_id = ? AND status = 'proposed' AND proposed_by IN ('seller','code')",
    replace: "        WHERE id = ? AND influencer_id = ? AND status = 'proposed' AND proposed_by = 'influencer'",
    test: TEST,
    why: '이 PR 이 메운 구멍 그 자체 — 매장이 제안한 조건 없는 딜을 수락할 엔드포인트가 0 이었다.',
  },
  {
    name: '🔑매장코드 로그인 왕복에서 ?code= 가 다시 사라진다 (사장님이 코드를 손으로 다시 친다)',
    file: 'src/utils/safe-internal-path.ts',
    find: "const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite', 'code', 'auto'] as const",
    replace: "const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite'] as const",
    test: 'src/tests/unit/safe-internal-path.test.ts',
    why: '2026-09-20 E4 판정에서 발견 — 링크로 온 사장님이 로그인 뒤 빈 입력칸을 만났다. 에러가 없어 아무도 신고하지 않는 종류.',
  },
  {
    name: '🔑매장코드 code 값 검증이 풀려 긴 OAuth 인가 코드까지 보존한다',
    file: 'src/utils/safe-internal-path.ts',
    find: '      if (v && (PRESERVED_VALUE_RE_BY_KEY[key] ?? PRESERVED_VALUE_RE).test(v)) kept.set(key, v)',
    replace: '      if (v && PRESERVED_VALUE_RE.test(v)) kept.set(key, v)',
    test: 'src/tests/unit/safe-internal-path.test.ts',
    why: '키별 모양 검사가 없으면 콜백 URL 의 인가 코드가 returnUrl 에 실려 되돌아온다 — 보존은 매장 코드 8자에만.',
  },
  {
    name: '🔑매장코드 워커 safeRedirect 가 프론트와 갈린다 (카카오 왕복만 코드 소실)',
    file: 'src/features/auth/api/kakao.routes.ts',
    find: "const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite', 'code', 'auto'] as const;",
    replace: "const PRESERVED_QUERY_PARAMS = ['ref', 'aff', 'invite'] as const;",
    test: 'src/tests/unit/kakao-safe-redirect.test.ts',
    why: '두 파일이 "양쪽 같이 갱신할 것" 주석으로만 묶여 있다 — 한쪽만 고치면 이메일 로그인은 되고 카카오 로그인만 코드를 잃는다.',
  },
  {
    name: '🥕승인게이트 좌석을 열어 놓고 정산 게이트가 빠진다 (승인 전 매장에 돈이 나간다)',
    file: 'src/worker/cron/payouts-generate.ts',
    find: "          if (!isPayoutEligibleSellerStatus(row?.status)) { logInfo(`[payouts-cron] skip unapproved seller ${id} (${row?.status ?? 'null'})`); continue }",
    replace: '          void row',
    test: 'src/tests/unit/approval-gate-2026-09-20.test.ts',
    why: '좌석 개방(대기·반려 매장도 앉는다)의 짝이 이 한 줄이다 — 빠지면 09-16 사기 방어(등록증 + 어드민 승인)가 통째로 우회된다.',
  },
  {
    name: '🥕승인게이트 정산 집합이 좌석 집합과 같아진다 (대기 매장도 payout)',
    file: 'src/shared/seller-status.ts',
    find: "export const PAYOUT_ELIGIBLE_SELLER_STATUSES = ['active', 'approved'] as const",
    replace: "export const PAYOUT_ELIGIBLE_SELLER_STATUSES = ['active', 'approved', 'pending', 'rejected'] as const",
    test: 'src/tests/unit/approval-gate-2026-09-20.test.ts',
    why: '두 집합이 다른 것이 이 설계의 전부다. 같아지면 좌석이 곧 정산 자격이 된다.',
  },
  {
    name: '🥕승인게이트 좌석 토큰이 다시 승인 매장만 연다 (준비를 승인 뒤로 되돌림)',
    file: 'src/features/seller/api/seller-operators.routes.ts',
    find: '    if (!isSeatableStoreStatus(seller.status)) {',
    replace: "    if (seller.status !== 'active' && seller.status !== 'approved') {",
    test: 'src/tests/unit/approval-gate-2026-09-20.test.ts',
    why: '대표가 푼 병목 그 자체 — 되돌아가면 중개사가 승인 전 매장에서 이용권·협업 코드를 못 만든다.',
  },
  {
    name: '🥕승인게이트 정지 매장도 좌석에 앉는다 (징계 무력화)',
    file: 'src/shared/seller-status.ts',
    find: "export const SEATABLE_STORE_STATUSES = ['active', 'approved', 'pending', 'rejected'] as const",
    replace: "export const SEATABLE_STORE_STATUSES = ['active', 'approved', 'pending', 'rejected', 'suspended'] as const",
    test: 'src/tests/unit/approval-gate-2026-09-20.test.ts',
    why: '09-16 규칙 — 반려는 "서류가 아직"이고 정지는 "내보냈다". 둘을 같이 취급하면 징계가 무의미해진다.',
  },
]

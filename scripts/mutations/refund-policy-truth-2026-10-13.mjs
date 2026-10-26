/**
 * 💸 `/refund` 가 **우리 규칙**을 말한다 — 2026-10-13 (결재 `2026-10-12-refund-policy-mismatch.md`)
 *
 * 종전: `제22조 (환불)` 절이 남의 구독 서비스 약관(`경기 결제 회원` · `300일` · `[(전체금액) x 0.8 / 30]`)
 * 이었고, 같은 서비스의 구매 버튼은 *"미사용 시 100% 자동환불"* 을 약속했다 — 소비자용 문서 둘이
 * 서로 다른 환불 규칙을 말하는 상태. 가드: `src/tests/unit/refund-policy-truth-2026-10-13.test.ts`.
 */
const PAGE = 'src/pages/RefundPolicyPage.tsx'
const T = 'src/tests/unit/refund-policy-truth-2026-10-13.test.ts'

export default [
  {
    name: '💸↩️ 남의 구독 약관을 되살린다 — 300일 일할 계산',
    why: '종전 상태가 정확히 이것이었다. 유어딜엔 300일 구독이 없는데 그 조항이 **우리가 구속되는 약속**으로 sitemap 에 제출되고 푸터에서 링크됐다.',
    file: PAGE,
    find: '          <h2 className="text-[15px] font-bold text-ink mb-4">이용권 환불</h2>',
    replace: '          <h2 className="text-[15px] font-bold text-ink mb-4">제22조 (환불)</h2>\n          <p>가. 경기 결제 회원 — 결기간은 300일로 남은 일수를 일할 계산합니다.</p>',
    test: T,
  },
  {
    name: '💸 전액 자동 환불 약속을 지운다 — 구매 버튼과 갈린다',
    why: '구매 버튼은 *"미사용 시 100% 자동환불"* 을 계속 약속한다. 환불 페이지에서 그 말이 빠지면 두 문서가 다른 규칙을 말하고, 분쟁 때 소비자가 유리한 쪽을 인용한다.',
    file: PAGE,
    find: '따로 신청하지 않아도 <span className="font-medium text-ink">결제 금액 전액</span>이 자동으로 환불됩니다.',
    replace: '회사가 정하는 정책에 따라 환불됩니다.',
    test: T,
  },
  {
    name: '💸↩️ 꺼져 있는 장 단위 일부 환불을 안내한다',
    why: '반대 방향. `voucher_partial_refund_enabled` 는 **기본 OFF**(staging P17 전제)다. 할 수 없는 것을 약속하면 그 문서가 다시 거짓이 된다 — 고치려던 바로 그 결함이다.',
    file: PAGE,
    find: '                아직 사용하지 않았다면 고객센터로 요청해 주세요. 확인 후 주문 단위로 취소·환불해 드립니다.',
    replace: '                아직 사용하지 않았다면 장 단위로 일부 환불을 신청할 수 있습니다.',
    test: T,
  },
  {
    name: '💸 미수령 차감 기본값을 켠다 — 페이지의 "전액" 이 거짓이 된다',
    why: '페이지가 "전액" 이라고 쓸 수 있는 근거는 `DEFAULT_UNCLAIMED_POLICY` 가 100% 라는 것이다. 그 기본값이 바뀌면 문서를 함께 고쳐야 한다(안 고치면 또 두 말이 된다).',
    file: 'src/shared/pickup-refund.ts',
    find: '  coldPct: 100,',
    replace: '  coldPct: 80,',
    test: T,
  },
  {
    name: '💸 딜 환급 안내에서 무상 딜 제외를 뺀다',
    why: '약관 제12조 ②가 무상(리워드) 딜을 환급 대상에서 뺀다. 안내에서 그 줄이 빠지면 리워드 딜을 현금으로 요구할 수 있다고 읽히고, 서버는 거절한다 — 또 두 말이 된다.',
    file: PAGE,
    find: '                <span>이벤트·리워드로 받은 딜은 환급 대상이 아닙니다.</span>',
    replace: '                <span>딜은 모두 환급 대상입니다.</span>',
    test: T,
  },
  {
    name: '💸↩️ 딜 환급 경로에 원천징수를 섞는다',
    why: '반대 방향. 환급은 **손님이 낸 돈을 돌려주는 것**이라 소득이 아니다. 옛 `/points/withdraw` 가 정확히 이 실수로 8.8% 를 떼고 있었고 #1750 이 그걸 닫았다.',
    file: 'src/worker/utils/deal-refund.ts',
    find: "import { recordPointTransaction } from './point-ledger'",
    replace: "import { recordPointTransaction } from './point-ledger'\nconst _rate = 0.088 // 환급에 원천징수를 섞는다",
    test: T,
  },
  {
    name: '💸 배송 반품 절의 범위 표시를 되돌린다 — 이용권과 섞인다',
    why: '종전 제목 `교환 및 반품 안내` 는 전체를 가리켜, 이용권을 산 사람이 택배 반품 절차(왕복 배송비 6,000원)를 자기 것으로 읽었다. `/faq` 가 2026-10-12 에 같은 이유로 고쳐졌다.',
    file: PAGE,
    find: '배송 상품 교환 및 반품</h2>',
    replace: '교환 및 반품 안내</h2>',
    test: T,
  },
]

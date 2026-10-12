/**
 * 🎟️ 2026-10-12 — `/faq` 가 자기 설명이 약속한 이용권 유효기간·환불 답을 준다.
 *
 * 시험: src/tests/unit/faq-voucher-refund-2026-10-12.test.ts
 * 라이브 실측(그 시험 머리말): `/faq` 본문 1,515자 · Q&A 14건 중 **유효기간 만료 답 0건**,
 *   유일한 환불 답은 배송 상품 절차 → AI 가 "이용권 환불돼?" 에 택배 반품 절차를 인용했다.
 */
const SSOT = 'src/shared/seo/concept-content.ts'
const CRON = 'src/worker/cron/auto-settlement.ts'
const QR = 'src/pages/my-vouchers/QRModal.tsx'
const BAR = 'src/pages/group-buy/DealBottomBar.tsx'
const FR = 'public/locales/fr/translation.json'
const TEST = 'src/tests/unit/faq-voucher-refund-2026-10-12.test.ts'

export default [
  {
    name: '🎟️↩️ 만료 자동환불 답을 다시 뺀다 — 설명이 약속한 것을 안 준다',
    why: '종전 상태가 정확히 이것이었다. `/faq` 메타는 *"유효기간이 지나면 어떻게 되는지"* 를 '
       + '약속하는데 답이 0건이라, 가장 많이 인용되는 페이지에 간판 상품의 환불 경로가 없었다.',
    file: SSOT,
    find: "  { key: 'faq.q15', categoryKey: 'faq.catExchange'",
    replace: "  { key: 'faq.q15_removed', categoryKey: 'faq.catExchange'",
    test: TEST,
  },
  {
    name: '🎟️↩️ 배송 환불 질문의 스코프를 되돌린다 — 이용권 환불과 섞인다',
    why: '반대 방향. q6 의 답은 **배송 상품** 절차인데 질문이 `환불은 언제 되나요?` 로 전체를 '
       + '가리키면, 이용권을 산 사람이 그 답을 자기 것으로 읽고 AI 도 그걸 인용한다.',
    file: SSOT,
    find: "question: '배송 상품 환불은 언제 되나요?'",
    replace: "question: '환불은 언제 되나요?'",
    test: TEST,
  },
  {
    name: '🎟️↩️ 이용권 환불 답에 택배 절차를 섞는다',
    why: '이용권은 배송되지 않는다. 배송 답(q5)의 "왕복 배송비" 를 베껴 오면 **없는 비용**을 '
       + '안내하는 셈이고, 그 틀린 안내가 검색·AI 답변에 박힌다.',
    file: SSOT,
    find: '접수 후 확인하여 처리해 드립니다."',
    replace: '접수 후 확인하여 처리해 드립니다. 단순 변심의 경우 왕복 배송비가 발생합니다."',
    test: TEST,
  },
  {
    name: '🎟️↩️ 확인하지 않은 레일(교환권 만료)까지 답한다',
    why: '`handleExpiredVoucherRefunds` 는 `vouchers` 를 돈다. 교환권은 `voucher_orders`(KT)라 '
       + '같은 규칙이라고 말할 근거가 없다 — 모르는 것을 답하는 것은 지어내기다.',
    file: SSOT,
    find: "answer: '유효기간 안에 쓰지 않은 이용권은 따로 신청하지 않아도 자동으로 환불되고, 알림으로 알려드립니다.",
    replace: "answer: '유효기간 안에 쓰지 않은 이용권과 교환권은 따로 신청하지 않아도 자동으로 환불되고, 알림으로 알려드립니다.",
    test: TEST,
  },
  {
    name: '🎟️↩️ 만료 환불의 딜 경로를 끊는다 — FAQ 의 "딜로 돌아갑니다" 가 거짓이 된다',
    why: '답변은 *"딜로 결제했으면 딜로"* 를 약속한다. 그 분기가 없어지면 딜로 산 이용권은 '
       + '만료돼도 아무것도 돌려받지 못하고, FAQ 는 돌려준다고 계속 말한다(머니 경로).',
    file: CRON,
    find: "voucher.payment_method === 'deal_points'",
    replace: "voucher.payment_method === 'deal_points_disabled'",
    test: TEST,
  },
  {
    name: '🎟️↩️ 사용 전 환불 요청 경로를 바꾼다 — FAQ 가 없는 버튼을 안내한다',
    why: 'FAQ 는 *"내 이용권에서 환불 요청 을 누르시면 됩니다"* 라고 안내한다. 그 요청이 다른 '
       + '주소로 가면 버튼은 있는데 접수가 안 되고, 안내만 남는다.',
    file: QR,
    find: "'/api/returns/request'",
    replace: "'/api/returns/req'",
    test: TEST,
  },
  {
    name: '🎟️↩️ 구매 화면의 자동환불 약속을 지운다 — 화면과 FAQ 가 갈린다',
    why: '비율(100%)의 SSOT 는 **화면**이다(이 배열은 수치를 적지 않는다). 화면이 약속을 '
       + '거두면 FAQ 의 "자동으로 환불" 은 근거 없는 말이 된다 — 둘은 같이 움직여야 한다.',
    file: BAR,
    find: '토스로 3초 안전결제 · 미사용 시 100% 자동환불',
    replace: '토스로 3초 안전결제',
    test: TEST,
  },
  {
    name: '🎟️↩️ 한 언어에서 새 답변이 빈다 — 그 언어 사용자는 한국어를 본다',
    why: '로케일이 비면 코드는 `defaultValue` 로 조용히 한국어를 내보낸다 — **에러 없이** 그 '
       + '언어만 섞인다. 기존 q1~q14 가 여섯 언어에 다 있었으므로 그 패턴을 지킨다.',
    file: FR,
    find: '"a16": "[TODO:fr] 사용 전이라면',
    replace: '"a16_todo": "[TODO:fr] 사용 전이라면',
    test: TEST,
  },
]

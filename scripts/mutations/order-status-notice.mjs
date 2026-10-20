/**
 * 🧬 주입 — **구매자가 받는 상태 알림 문구** (2026-10-07)
 *
 * 다섯 가지 전부 **에러 없이** 되돌아간다. 틀린 문장이 가거나 아무것도 안 갈 뿐이라
 * 셀러도 구매자도 신고할 거리가 없다. 실제로 그렇게 살아 있었다 —
 * 단건은 `주문 상태: PREPARING`(영문 enum)을 보내고, 일괄은 같은 상태에 **0건**을 보냈다.
 */
const SRC = 'src/features/seller/api/seller-orders.routes.ts'
const MAP = 'src/shared/order-status-notice.ts'
const T = 'src/tests/unit/order-status-notice-2026-10-07.test.ts'

export default [
  {
    name: '상태알림 — PREPARING 문장을 없앤다 (종전 상태)',
    file: MAP,
    find: "  PREPARING: '주문이 확인되어 상품을 준비하고 있습니다.',\n",
    replace: '',
    test: T,
    why:
      '셀러가 [주문 확인] 을 누를 때 실제로 오는 상태가 이것인데, 키가 없으면 ' +
      '단건은 조용히 넘어가고(폴백을 없앴으므로) 일괄도 0건이다 — 구매자는 자기 주문이 ' +
      '확인됐다는 사실을 **어디서도** 못 듣는다.',
  },
  {
    name: '상태알림 — 영문 enum 폴백을 되살린다',
    file: SRC,
    find: '          const msg = ORDER_STATUS_NOTICE[dbStatus];\n          if (msg) {',
    replace: '          const msg = ORDER_STATUS_NOTICE[dbStatus] || `주문 상태: ${dbStatus}`;\n          if (msg) {',
    test: T,
    why:
      '정확히 종전 코드다. `VALID_STATUSES` 에 상태가 하나 늘 때마다 그 **영문 enum 이름**이 ' +
      '한국 소비자 알림함에 그대로 찍힌다. 추가한 사람은 알림 맵을 볼 이유가 없어서 모른다.',
  },
  {
    name: '상태알림 — 도달 불가한 키를 되살린다',
    file: MAP,
    find: "export const ORDER_STATUS_NOTICE: Record<string, string> = {\n  PREPARING:",
    replace: "const ORDER_STATUS_NOTICE: Record<string, string> = {\n  CONFIRMED: '주문이 확인되었습니다',\n  PREPARING:",
    test: T,
    why:
      '`CONFIRMED` 는 `VALID_STATUSES`·`ORDER_TRANSITIONS` 어디에도 없어 **절대 안 온다**. ' +
      '그런데 맵에 있으면 다음 세션이 "확인 알림은 이미 있다" 고 읽는다 — 원래 결함이 ' +
      '그렇게 두 달 넘게 살아 있었다(쓰려고 만든 문장이 안 쓰이고 있었다).',
  },
  {
    name: '상태알림 — 일괄 경로가 자기 맵을 다시 갖는다',
    file: SRC,
    // ⚠️ 두 줄로 앵커한다 — 한 줄만 쓰면 단건 블록(들여쓰기 10칸)의 꼬리에도 걸려
    //   주입 대상이 2곳이 되고, 러너가 "유일해야 한다" 로 막는다(실제로 막혔다).
    find: '        const msg = ORDER_STATUS_NOTICE[dbStatus];\n        if (msg) {',
    replace:
      "        const statusMessages: Record<string, string> = {\n" +
      "          'SHIPPING': '\\u{1F4E6} 주문하신 상품이 발송되었습니다!',\n" +
      "          'DELIVERED': '\\u2705 배송이 완료되었습니다. 상품을 확인해주세요!',\n" +
      "          'CANCELLED': '\\u274C 주문이 취소되었습니다.',\n" +
      "        };\n" +
      '        const msg = statusMessages[dbStatus];\n        if (msg) {',
    test: T,
    why:
      '정확히 종전 코드다. 맵이 두 벌이면 **서로 다르게 틀린다** — 실제로 이 사본에만 ' +
      '`PREPARING` 이 빠져 있어서, 셀렉트 박스에는 뜨는 상태인데 알림은 한 건도 안 갔다.',
  },
  {
    name: '상태알림 — 일괄 경로가 문장 없이도 보낸다',
    file: SRC,
    find: '        const msg = ORDER_STATUS_NOTICE[dbStatus];\n        if (msg) {',
    replace: "        const msg = ORDER_STATUS_NOTICE[dbStatus] ?? '';\n        if (msg !== undefined) {",
    test: T,
    why:
      '문장이 없는 상태에 빈 문자열을 보내면 구매자 알림함에 **제목 없는 줄**이 생긴다. ' +
      '`notifyUser` 는 fire-and-forget 이라 아무 에러도 안 난다.',
  },
]

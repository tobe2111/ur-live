/**
 * 🧬 주입 — 어드민 주문 목록·활동 피드 연락처 마스킹 제거 (2026-10-14 대표 *"다 보이게 해줘"*).
 */
const TEST = 'src/tests/unit/admin-orders-feed-unmasked-2026-10-14.test.ts'

export default [
  {
    name: '👁️ 주문 목록 연락처가 다시 가려진다',
    file: 'src/pages/AdminOrdersPage.tsx',
    find: "{order.shipping_phone || '-'}",
    replace: "{(order.shipping_phone || '-').replace(/(\\d{3})\\d{4}/, '$1****')}",
    test: TEST,
    why: '대표가 다 보이게 하라고 했다. 정규식으로 가리면 함수 이름 검사로는 안 잡히므로 출력 표현식을 고정한다.',
  },
  {
    name: '👁️ 활동 피드 연락처가 다시 가려진다',
    file: 'src/pages/admin-page/AdminActivityFeed.tsx',
    find: "const phone = (o.shipping_phone || '').trim()",
    replace: "const phone = maskPhone(o.shipping_phone)",
    test: TEST,
    why: '피드와 주문 목록이 같은 번호를 다르게 보이면 CS 가 헷갈린다.',
  },
]

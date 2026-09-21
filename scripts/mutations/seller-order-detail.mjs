/**
 * 🧾 셀러 주문 상세 3건 (2026-09-21, 대표 *"이미지도 안나오고 · 주문번호 너무 복잡해 ·
 * 어떤 이용권인지도 나와야지"*) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-order-detail-2026-09-21.test.tsx
 */
const TEST = 'src/tests/unit/seller-order-detail-2026-09-21.test.tsx'
const ENRICH = 'src/worker/utils/order-list-enrich.ts'
const MODAL = 'src/pages/seller-orders/OrderDetailModal.tsx'

export default [
  {
    name: '🖼️ 서버가 화면이 안 읽는 이름으로 사진을 되돌려 보낸다',
    file: ENRICH,
    find: '    for (const it of itemRows) it.image_url = it.product_image ?? null\n',
    replace: '',
    test: TEST,
    why: '이름이 갈려도 에러가 안 난다 — 모든 주문이 조용히 "No Image" 가 됐던 그 사고다.',
  },
  {
    name: '🖼️ 스냅샷이 비었을 때 상품 사진으로 채우는 폴백이 사라진다',
    file: ENRICH,
    find: '      if (!it.image_url) it.image_url = byProduct.get(Number(it.product_id))?.image_url ?? null',
    replace: '      void it',
    test: TEST,
    why: '라이브 이용권 주문의 스냅샷은 전부 NULL 이다 — 폴백이 없으면 이름만 고쳐도 여전히 사진이 안 뜬다.',
  },
  {
    name: '🖼️ 모달이 죽은 외부 자리표시자로 되돌아간다',
    file: MODAL,
    find: 'onError={(e) => cfImageOnError(e.currentTarget, item.image_url)}',
    replace: "onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/64?text=No+Image' }}",
    test: TEST,
    why: 'via.placeholder.com 이 죽으면 결국 깨진 아이콘이 남는다 — 폴백은 레포 SSOT 하나여야 한다.',
  },
  {
    name: '🔢 짧은 주문번호가 전체 번호를 덮어 감춘다',
    file: 'src/pages/seller-orders/OrderNumber.tsx',
    find: '      {short !== value && (',
    replace: '      {false && (',
    test: TEST,
    why: '전체를 감추면 셀러↔어드민↔토스가 서로 다른 번호를 말하게 된다 — 짧은 쪽은 손잡이일 뿐이다.',
  },
  {
    name: '🎟️ 이용권을 못 찾은 주문에 빈 배열을 붙인다',
    file: ENRICH,
    find: '      const vs = byOrder.get(Number(o.id))\n      if (vs) o.vouchers = vs',
    replace: '      o.vouchers = byOrder.get(Number(o.id)) || []',
    test: TEST,
    why: '조회가 한 번 실패한 날 화면이 "발급 0장"이라고 **단언**한다 — 모르는 것과 없는 것은 다르다.',
  },
  {
    name: '🎟️ 모달이 이용권 코드 목록을 안 그린다',
    file: MODAL,
    find: '              {kind === \'voucher\' && order.vouchers && (\n                <div className="mt-3">\n                  <VoucherCodes vouchers={order.vouchers} />\n                </div>\n              )}\n',
    replace: '',
    test: TEST,
    why: '셀러가 이 화면에서 할 일은 사용처리 하나인데 그 대상(코드)이 없으면 화면이 아무 쓸모가 없다.',
  },
  {
    name: '🎟️ 모르는 이용권 상태를 "미사용"으로 둔갑시킨다',
    file: 'src/pages/seller-orders/VoucherCodes.tsx',
    find: "    return { text: v.status, cls: 'bg-white text-tone-warn border-rule' }",
    replace: "    return { text: t('seller.voucherUnused', { defaultValue: '미사용' }), cls: 'bg-white text-tone-ok border-rule' }",
    test: TEST,
    why: '환불·만료된 권을 미사용이라고 하면 셀러가 손님을 그냥 받아 버린다.',
  },
  {
    name: '💳 믿을 수 없는 결제상태 배지가 표에 되살아난다',
    file: 'src/pages/SellerOrdersPage.tsx',
    find: '{payMethodText(order.payment_method)}</td>',
    replace: '{order.payment_status}</td>',
    test: TEST,
    why: '라이브에서 결제 끝난 주문 4건·취소 57건이 전부 기본값 pending 이다 — 셀러에게 영문 pending 이 그대로 뜬다.',
  },
]

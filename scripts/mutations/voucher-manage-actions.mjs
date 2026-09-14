/**
 * 🎟️ "이용권을 만든 사람은 그것을 고치고 내릴 수도 있어야 한다" (2026-09-14).
 *
 * 라이브 실측: 셀러 소유 활성 이용권 1건(홍대돈까스)이 수정도 삭제도 못 하는 상태였다.
 * 그리고 **기존 가드가 그걸 놓치고 있었다** — 수정 링크가 파일 안에 있는지만 봐서,
 * 조건부 배너 안에 숨어 있어도 초록이었다. 아래 주입들이 그 구멍을 되살려 본다.
 *
 * 가드: src/tests/unit/voucher-manage-actions-2026-09-14.test.ts
 *       src/tests/unit/voucher-nav-reachability-2026-09-03.test.ts (④ 강화분)
 */
const MANAGE = 'src/pages/SellerGroupBuyPage.tsx'
const EDIT = 'src/pages/SellerProductEditPage.tsx'
const FIELDS = 'src/pages/seller-product-edit/PriceStockFields.tsx'
const CHARGE = 'src/worker/utils/gb-order-pricing.ts'

const ACTIONS_TEST = 'src/tests/unit/voucher-manage-actions-2026-09-14.test.ts'
const REACH_TEST = 'src/tests/unit/voucher-nav-reachability-2026-09-03.test.ts'

export default [
  {
    name: '🕳️ 이용권 삭제 버튼을 뗀다 (셀러가 자기 이용권을 내릴 방법이 사라진다)',
    file: MANAGE,
    find: 'onClick={() => deleteVoucher(p)}',
    replace: 'onClick={() => undefined}',
    test: ACTIONS_TEST,
    why:
      '`/seller/products` 목록은 SELLER_STORE_ONLY_MODE 로 nav 에서 빠져 있어 우회로가 없다. ' +
      '이 버튼이 사라지면 이용권을 내리려면 어드민에게 부탁하는 수밖에 없다.',
  },
  {
    name: '🕳️ 삭제를 확인 없이 즉시 실행한다 (오탭 한 번에 판매가 멈춘다)',
    file: MANAGE,
    find: "    if (!(await confirmDialog(`'${p.name}' 이용권을 삭제할까요?",
    replace: "    if (false && !(await confirmDialog(`'${p.name}' 이용권을 삭제할까요?",
    test: ACTIONS_TEST,
    why: '되돌릴 수 없는 동작이다. 확인 없이 도는 삭제는 사고가 아니라 시간문제다.',
  },
  {
    name: '🕳️ 서버 거절 사유를 삼킨다 (진행 중 공구 409 가 "삭제 실패" 로만 보인다)',
    file: MANAGE,
    find: "      toast.error(e?.response?.data?.error || '삭제 실패')",
    replace: "      toast.error('삭제 실패')",
    test: ACTIONS_TEST,
    why:
      '서버는 "참여자 환불 후 삭제하세요" 라고 무엇을 해야 하는지 알려 준다. ' +
      '그걸 지우면 셀러는 왜 안 되는지 모른 채 다시 누르기만 한다.',
  },
  {
    name: '🕳️ 수정 버튼을 연락처 분기 안으로 되돌린다 (연락처 있는 매장은 갇힌다)',
    file: MANAGE,
    // ⚠️ 앵커에 className 을 붙인다 — 들여쓰기만 다른 '연락처 등록 →' 링크가 **부분일치**로 걸린다
    //    (22칸 앵커가 26칸 줄의 뒷부분과 겹친다). 실제로 한 번 밟았다.
    find:
      'onClick={() => navigate(`/seller/products/${p.id}/edit`)}\n' +
      '                      className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700',
    replace:
      'onClick={() => undefined}\n' +
      '                      className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700',
    test: REACH_TEST,
    why:
      '이것이 2026-09-14 에 실제로 발견한 상태다. 라이브의 유일한 실제 매장이 정확히 그 경우였고, ' +
      '옛 가드는 파일 안에 문자열이 있다는 이유로 초록이었다.',
  },
  {
    name: '🕳️ 빈 정가를 0 으로 보낸다 ("정가 0원" → 할인율 계산이 깨진다)',
    file: EDIT,
    find: "original_price: formData.original_price === '' ? null : Number(formData.original_price),",
    replace: 'original_price: Number(formData.original_price),',
    test: ACTIONS_TEST,
    why:
      '빈 칸은 "정가 없음" 이지 "0원" 이 아니다. 0 을 저장하면 표시 규칙이 정가를 없는 것으로 보든 ' +
      '0 으로 보든 둘 중 하나로 갈리고, 그 판단이 화면마다 달라진다.',
  },
  {
    name: '🕳️ 서버가 준 정가를 폼에 안 싣는다 (저장할 때마다 정가가 지워진다)',
    file: EDIT,
    find: "      original_price: productData.original_price ? String(productData.original_price) : '',",
    replace: "      original_price: '',",
    test: ACTIONS_TEST,
    why:
      '폼이 빈 값으로 시작하면 셀러가 이름만 고쳐 저장해도 정가가 null 로 덮인다 — ' +
      '할인율 배지가 조용히 사라지고 아무 에러도 안 난다.',
  },
  {
    name: '🕳️ 할인율을 손으로 다시 계산한다 (SSOT 를 우회 — 화면마다 값이 갈린다)',
    file: FIELDS,
    find: "  const preview = priceDisplay({ price: Number(price) || 0, original_price: Number(originalPrice) || 0 })",
    replace:
      '  const _p = Number(price) || 0, _o = Number(originalPrice) || 0\n' +
      '  const preview = { discount: _o > _p ? Math.round((1 - _p / _o) * 100) : 0 }',
    test: ACTIONS_TEST,
    why:
      '2026-09-03 에 서버 정렬 정의와 클라 계산이 갈려 "인기순" 이 인기순이 아니었다. ' +
      '같은 클래스 — 에러가 안 나서 아무도 모른다.',
  },
  {
    name: '🕳️ 청구 경로에 정가를 넘긴다 (이 작업의 "머니 경로 아님" 전제가 깨진다)',
    file: CHARGE,
    find: 'resolveGbPricing(s, list, null, nowMs, viaRefLink)',
    replace: 'resolveGbPricing(s, list, list, nowMs, viaRefLink)',
    test: ACTIONS_TEST,
    why:
      '정가가 표시 전용이라는 근거가 바로 이 `null` 이다. 여기가 바뀌면 셀러가 고치는 정가가 ' +
      '청구에 닿을 수 있고, 그러면 이 작업은 단독 세션 + staging 실결제 대상이 된다.',
  },
]

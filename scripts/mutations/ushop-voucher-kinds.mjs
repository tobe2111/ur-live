/**
 * 🎟️ "셀러가 올린 이용권이 유어샵에 뜨는가" (2026-09-16 대표 지시).
 *
 * 이 결함의 성질이 고약했다 — **이용권이 사라지지 않았다.** 미용·숙소·기타 이용권은 여집합인
 * '내 상품'(쇼핑) 섹션으로 흘러들어가 섹션 제목·카운트·카드 목적지가 전부 틀린 채 떠 있었고,
 * 에러가 하나도 안 났다. 아래 주입들이 그 조용한 오분류를 다시 만들어 본다.
 *
 * 가드: src/tests/unit/ushop-voucher-kinds-2026-09-16.test.ts
 */
const PAGE = 'src/pages/SellerPublicPage.tsx'
const CURATOR = 'src/worker/routes/curator.routes.ts'
const TEST = 'src/tests/unit/ushop-voucher-kinds-2026-09-16.test.ts'

export default [
  {
    name: '🎟️ 이용권을 다시 한 종류로 본다 (실사고 원본)',
    file: PAGE,
    find: '  const vouchers = products.filter(p => isVoucherCategory(p.category))',
    replace: "  const vouchers = products.filter(p => p.category === 'meal_voucher')",
    test: TEST,
    why:
      '미용·숙소·기타 이용권이 이용권 섹션에서 빠진다. 사라지지 않고 쇼핑 섹션으로 흘러가서 ' +
      '**화면이 그럴듯해 보이는 것**이 이 결함의 핵심이다.',
  },
  {
    name: '🎟️ 상품 쪽만 옛 판정으로 되돌린다 (이용권이 두 섹션에 겹쳐 뜬다)',
    file: PAGE,
    find: '  const shopProducts = products.filter(p => !isVoucherCategory(p.category) && Number(p.deal_only) !== 1)',
    replace: "  const shopProducts = products.filter(p => p.category !== 'meal_voucher' && Number(p.deal_only) !== 1)",
    test: TEST,
    why:
      '한쪽만 SSOT 로 바꾸면 같은 이용권이 이용권 섹션과 상품 섹션에 **둘 다** 뜬다. ' +
      '두 판정은 반드시 같은 함수를 써야 한다.',
  },
  {
    name: '🎟️ 핀 SELECT 에서 deal_only 를 다시 뺀다 (담은 교환권이 추천템으로)',
    file: CURATOR,
    find: 'p.seller_id, COALESCE(p.deal_only, 0) AS deal_only,',
    replace: 'p.seller_id, 0 AS not_deal_only,',
    test: TEST,
    why:
      '클라가 `deal_only === 1` 을 보는데 값이 안 오면 그 분기는 한 번도 참이 안 된다 — ' +
      '담은 기프티콘이 "교환권 · 동네딜" 이 아니라 "추천템" 으로 간다. 에러 없이 분류만 틀린다.',
  },
]

// 💸 할인율 SSOT (2026-10-14 — 유어샵 '할인율순'이 라이브에서 아무 일도 안 하던 것)
const TEST = 'src/tests/unit/discount-ssot-2026-10-14.test.ts'
export default [
  {
    name: '💸 유어샵 할인율순이 다시 discount_rate 생값으로 돌아간다',
    file: 'src/pages/CuratorPage.tsx',
    find: "    if (sort === 'discount') copy.sort((a, b) => priceDisplay(b).discount - priceDisplay(a).discount)",
    replace: "    if (sort === 'discount') copy.sort((a, b) => (Number(b.discount_rate) || 0) - (Number(a.discount_rate) || 0))",
    test: TEST,
    why: '라이브에서 실제로 깨져 있던 자리다 — 그 컬럼은 전 상품 0 이라 정렬이 아무 일도 안 했다(브라우저로 조작해 확인).',
  },
  {
    name: '💸 쇼핑 할인순이 생값으로 돌아간다',
    file: 'src/pages/BrowsePage.tsx',
    find: "      case 'discount': result.sort((a, b) => priceDisplay(b).discount - priceDisplay(a).discount); break",
    replace: "      case 'discount': result.sort((a, b) => (Number(b.discount_rate) || 0) - (Number(a.discount_rate) || 0)); break",
    test: TEST,
    why: '유어샵과 같은 모양 — 쇼핑탭이 다시 열리는 날 같은 결함이 보인다.',
  },
  {
    name: '💸 검색이 판매가를 한 번 더 깎는다 (이중 할인)',
    file: 'src/pages/SearchPage.tsx',
    find: "  const sellingPrice = (p: { price: number; original_price?: number | null; discount_rate?: number | null }) =>\n    priceDisplay(p).price",
    replace: "  const sellingPrice = (p: { price: number; original_price?: number | null; discount_rate?: number | null }) =>\n    Math.round(p.price * (1 - (p.discount_rate || 0) / 100))",
    test: TEST,
    why: 'API 의 `price` 는 이미 파는 값이다 — 그 컬럼이 채워지는 날 필터·정렬이 이중 할인 값을 쓴다.',
  },
  {
    name: '💸 지갑 "이 매장의 다른 이용권" 이 정가를 다시 안 넘긴다',
    file: 'src/pages/my-vouchers/SameStoreDeals.tsx',
    find: "            originalPrice={d.original_price ?? undefined}\n",
    replace: '',
    test: TEST,
    why: '정가가 없으면 SSOT 도 계산할 수 없다 — 할인 중인 이용권인데 배지가 영영 안 뜬다(실제로 그랬다).',
  },
  {
    name: '💸 할인율 계산식 사본이 다시 생긴다 (교환권 카드)',
    file: 'src/pages/vouchers/shared.tsx',
    // ⚠️ 이 파일엔 같은 줄이 **두 번** 있다(카드·행). 앵커는 바로 아래 주석까지 포함해 유일하게 만든다
    //    — 첫 판은 "주입 대상이 2곳" 으로 러너가 거부했다.
    find:
      "  const { showOriginal: hasStrike, discount: discountRate } = priceDisplay(p)\n" +
      "  // 🎫 2026-06-21 (대표 요청): 교환권은 리뷰/별점 미표시 — 구매수(소셜 proof)만.",
    replace:
      "  const hasStrike = !!p.original_price && p.original_price > p.price\n" +
      "  const discountRate = hasStrike ? Math.round(((p.original_price! - p.price) / p.original_price!) * 100) : (p.discount_rate || 0)\n" +
      "  // 🎫 2026-06-21 (대표 요청): 교환권은 리뷰/별점 미표시 — 구매수(소셜 proof)만.",
    test: TEST,
    why: '사본은 매번 다시 생겼다(2026-08-19·09-03·09-09·09-29). 규칙을 한 곳에 가두는 것이 이 가드의 일이다.',
  },
  {
    name: '💸 홈 피드 정렬이 "선언>0 ? 선언 : 계산" 사본으로 돌아간다',
    file: 'src/pages/main-home/GroupBuyFeed.tsx',
    find: "  return priceDisplay({ price: p.current_price ?? p.price, original_price: p.original_price, discount_rate: p.discount_rate }).discount",
    replace:
      "  if (p.discount_rate != null && p.discount_rate > 0) return p.discount_rate\n" +
      "  const price = p.current_price ?? p.price ?? 0\n" +
      "  const orig = p.original_price ?? 0\n" +
      "  return orig > price && orig > 0 ? Math.round(((orig - price) / orig) * 100) : 0",
    test: TEST,
    why: 'SSOT 는 max 라 선언값이 계산값보다 **작을 때** 결과가 다르다 — 같은 상품이 카드와 정렬에서 다른 할인율을 갖는다.',
  },
  {
    name: '💸 SSOT 가 max 를 버리고 선언값을 우선한다',
    file: 'src/shared/price-display.ts',
    find: '  const discount = Math.max(declared, computed)',
    replace: '  const discount = declared || computed',
    test: TEST,
    why: '2026-08-19 대표 신고의 수습이 그 max 다 — 되돌리면 선언 0 인 상품의 배지가 다시 사라진다.',
  },
  {
    name: '💸 가드가 어드민까지 검사해 범위가 틀어진다',
    file: 'src/tests/unit/discount-ssot-2026-10-14.test.ts',
    find: "    .filter((p) => !/\\/(admin|seller|agency|wholesale|supplier)[-/]|\\/Admin|\\/Seller|\\/Agency|\\/Wholesale|\\/Supplier/.test(p))",
    replace: '',
    test: TEST,
    why: '`AdminKtAlphaPage` 는 그 컬럼이 실제로 채워지는 유일한 자리라 생값이 맞다 — 범위를 넓히면 거짓 빨간불로 가드를 끄게 된다.',
  },
]

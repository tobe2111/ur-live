/**
 * 🧬 주입 — **이용권 등록의 할인 [원 / %] 입력** (2026-10-07)
 *
 * 전부 에러 없이 조용히 틀린 판매가를 만든다 — 사장님은 할인 칸만 보고 넘어간다.
 */
const T = 'src/tests/unit/voucher-discount-input-2026-10-07.test.tsx'
const CALC = 'src/pages/seller-meal-voucher/discount-input.ts'

export default [
  {
    name: '할인입력 — 원 할인을 % 로 계산한다',
    file: CALC,
    find: "  if (mode === 'won') return o - Math.min(Math.floor(v), o - 1)",
    replace: "  if (mode === 'won') return Math.round(o * (1 - v / 100))",
    test: T,
    why: '3,000원 할인이 3,000% 로 읽히면 판매가가 음수·0 이 된다 — 에러 없이 저장된다.',
  },
  {
    name: '할인입력 — 0% 반올림이 정가를 넘긴다',
    file: CALC,
    find: '  return Math.min(o, Math.max(ROUND_TO,',
    replace: '  return (0, Math.max(ROUND_TO,',
    test: T,
    why: '정가 12,345원에 0% 를 넣으면 12,350원 — 판매가가 정가보다 비싸진다.',
  },
  {
    name: '할인입력 — % 표시를 손님 SSOT 대신 손으로 계산한다',
    file: CALC,
    find: ": priceDisplay({ price: p, original_price: o }).discount",
    replace: ': Math.floor(((o - p) / o) * 100)',
    test: T,
    why: '등록 화면이 29% 라고 했는데 손님 화면이 30% 라고 하면 둘 중 하나는 거짓말이다.',
  },
  {
    name: '할인입력 — 할인 칸이 판매가를 안 쓴다',
    file: 'src/pages/seller-meal-voucher/DiscountPriceFields.tsx',
    find: "    update('price', raw === '' ? originalPrice : priceFromDiscount(originalPrice, mode, Number(raw)))",
    replace: '    void raw',
    test: T,
    why: '칸은 움직이는데 저장되는 판매가는 그대로 — 사장님은 할인했다고 믿는다.',
  },
]

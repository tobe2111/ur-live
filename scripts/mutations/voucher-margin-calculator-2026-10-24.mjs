/**
 * 💰 이용권 마진 계산기 (2026-10-24 대표 확정) — 주입 매니페스트.
 * 가드: src/tests/unit/voucher-margin-calculator-2026-10-24.test.tsx
 * 전부 에러가 안 나는 결함이다 — 화면은 멀쩡하고 사장님이 보는 마진만 틀린다.
 */
const TEST = 'src/tests/unit/voucher-margin-calculator-2026-10-24.test.tsx'
const CARD = 'src/pages/seller-meal-voucher/NetProceedsCard.tsx'

export default [
  {
    name: '[마진계산기] 인플루언서 수수료를 정가 기준으로 뗀다',
    file: CARD,
    find: '  const influencerCut = Math.round((price * influencerPct) / 100)',
    replace: '  const influencerCut = Math.round((list * influencerPct) / 100)',
    test: TEST,
    why: '소개비는 판매가에 붙는다 — 정가로 떼면 할인할수록 마진이 실제보다 작게 보인다.',
  },
  {
    name: '[마진계산기] 최종 마진에서 인플루언서 수수료를 안 뺀다',
    file: CARD,
    find: '  const net = price - platformCut - influencerCut',
    replace: '  const net = price - platformCut',
    test: TEST,
    why: '소개로 팔렸을 때 받는 돈을 부풀려 보인다.',
  },
  {
    name: '[마진계산기] 저장된 소개비를 무시하고 입력값으로 계산한다',
    file: CARD,
    find: '    influencerPct: savedPromo ? Number(promoPct) : Number(influencerInput),',
    replace: '    influencerPct: Number(influencerInput),',
    test: TEST,
    why: '이용권에 저장된 소개비와 계산기 숫자가 갈린다.',
  },
  {
    name: '[마진계산기] 인플루언서 % 상한을 안 자른다',
    file: CARD,
    find: '  const influencerPct = Math.max(0, Math.min(50, Number(input.influencerPct) || 0))',
    replace: '  const influencerPct = Math.max(0, Number(input.influencerPct) || 0)',
    test: TEST,
    why: '입력칸 상한(50%)과 계산이 갈려 음수 마진이 보인다.',
  },
  {
    name: '[마진계산기] 수정 화면에서 계산기를 뺀다',
    file: 'src/pages/seller-product-edit/PriceStockFields.tsx',
    find: '      {margin && <NetProceedsCard ',
    replace: '      {false && <NetProceedsCard ',
    test: TEST,
    why: '가격을 고치는 순간에 마진을 못 본다.',
  },
]

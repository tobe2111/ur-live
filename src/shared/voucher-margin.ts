/**
 * 💸 이용권 마진 계산 — 순수 함수 하나(2026-11-03 `NetProceedsCard.tsx` 에서 옮김).
 * 왜 옮겼나: 첫 이용권 화면(`/store/first-voucher`)이 이 함수만 쓰려고 대시보드 카드 파일을 import 하자, 묶음기가 그 카드를
 * 공용 묶음으로 올려 **다른 손님 화면 세 곳의 첫 화면 무게가 예산을 넘었다**(check-surface-budgets). 함수만 떼면 화면끼리 안 엮인다.
 * 카드 파일은 이 함수를 그대로 다시 내보낸다(종전 import 경로·시험 불변).
 */
/**
 * 정가 → 할인 → 유어딜 수수료 → 인플루언서 수수료 → 에이전시 몫 → 최종 마진. 화면과 시험이 같은 함수를 쓴다.
 * 에이전시 몫(2026-11-11)은 매장을 맡은 에이전시에게 매장이 내는 % — 판매가 기준, 없으면 0.
 */
export function voucherMargin(input: { price: number; originalPrice?: number; platformFeePct: number; influencerPct: number; agencyPct?: number }) {
  const price = Number.isFinite(input.price) && input.price > 0 ? Math.floor(input.price) : 0
  const list = Number(input.originalPrice) > price ? Math.floor(Number(input.originalPrice)) : price
  const discount = list - price
  const platformCut = Math.round((price * Math.max(0, Number(input.platformFeePct) || 0)) / 100)
  const influencerPct = Math.max(0, Math.min(50, Number(input.influencerPct) || 0))
  const influencerCut = Math.round((price * influencerPct) / 100)
  const agencyPct = Math.max(0, Math.min(90, Number(input.agencyPct) || 0))
  const agencyCut = Math.round((price * agencyPct) / 100)
  const net = price - platformCut - influencerCut - agencyCut
  return {
    list, discount, price, platformCut, influencerPct, influencerCut, agencyPct, agencyCut, net,
    discountPct: list > 0 ? Math.round((discount / list) * 100) : 0,
    marginPct: list > 0 ? Math.round((net / list) * 100) : 0,
  }
}

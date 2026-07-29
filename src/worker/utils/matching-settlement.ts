/**
 * 💸 매칭 성사 수수료 정산 — 순수 계산(머니 경로 · 게이트 OFF).
 *
 * 설계: docs/design/influencer-matching-service-2026-07.md · commission-funding-restructure.md
 *
 * 원칙(대표 확정 2026-07-08 + #44 불변식):
 *   - **유어딜 순수취 == 정확히 5%** (커미션과 독립 · 신성불가침). 매칭 수수료는 **5% 밖**.
 *   - 매칭 커미션 재원 = **매장 promo(owner-funding)** — 매장이 인플루언서에게 지불, 유어딜은
 *     그 흐름을 중개할 뿐 5% 인프라비에서 한 푼도 쓰지 않는다.
 *   - 인플루언서 지급 = **기존 딜(포인트) 레일 재사용** — influencer_attributions → influencer-payout
 *     cron(T+7 성숙 · 3.3%/8.8% 원천징수 · 사업자=현금/비사업자=딜). **새 정산 레일 만들지 않음.**
 *
 * ⚠️ 이 파일은 **순수 계산만**(INSERT 없음). 실제 적립은 SSOT 아비터(order-commissions.ts
 *    creditOrderCommissions)를 경유해야 함(check-commission-budget.mjs R2 — 신규 파일 직접
 *    attribution INSERT 금지). 활성(라이브 적립) 배선은 아래 "활성 런북"의 별도 세션에서:
 *
 *   활성 런북(머니 flip — #496 규율 · staging 실결제 검증 전 금지):
 *     1. order-commissions.ts 에 owner-funded 축 'matching' 추가 — seller_influencer_deals(status='active')
 *        인 (매장, 유입귀속 인플루언서) 주문에 commission_pct 적립(promo owner 재원 → 예산에서 제외).
 *     2. owner-promo.ts debitOwnerPromoForOrder 의 owner 되갚기 합에 source='matching' 포함
 *        (환불 역전 대칭 reverseOwnerPromoDebit 자동).
 *     3. env MATCHING_SETTLEMENT_ENABLED='true' + promo_funding_source='owner'(또는 파일럿 매장).
 *     4. staging 실결제: 매칭 주문 → 인플루언서 딜 적립 + 매장 promo debit + platform:revenue==5% + 환불 역전.
 *     5. "순수취==5%" 항등식(matching-settlement.test.ts)이 flip 후에도 GREEN.
 */

/** 기본 플랫폼 인프라 수수료(%) — platform_settings.commission_rate_default 와 정합. */
export const DEFAULT_PLATFORM_FEE_PCT = 5

export interface MatchingSettlement {
  /** 인플루언서 적립액(원) — 매장 promo(owner) 재원, 5% 밖. */
  influencerKrw: number
  /** 매장 promo 되갚기(원) = influencerKrw — platform:revenue 로 회수(부호 대칭 → 환불 역전). */
  ownerDebitKrw: number
  /** 유어딜 순수취(원) = 정확히 platformFeePct% — 커미션과 **독립**(불변). */
  platformNetKrw: number
}

/**
 * 매칭 성사 주문의 정산 분배(순수). 커미션이 아무리 커도 platformNetKrw 는 정확히 platformFeePct%.
 * @param grossKrw       주문 총액(원)
 * @param commissionPct  매칭 협상 수수료율(seller_influencer_deals.commission_pct)
 * @param platformFeePct 플랫폼 인프라 수수료율(기본 5) — 순수취의 기준
 * @param maxCommissionPct 상한(max_influencer_commission_pct) — 있으면 clamp
 */
export function computeMatchingSettlement(input: {
  grossKrw: number
  commissionPct: number
  platformFeePct?: number
  maxCommissionPct?: number
}): MatchingSettlement {
  const gross = Math.max(0, Math.floor(Number(input.grossKrw) || 0))
  const feePct = Number.isFinite(Number(input.platformFeePct)) ? Number(input.platformFeePct) : DEFAULT_PLATFORM_FEE_PCT
  let pct = Math.max(0, Number(input.commissionPct) || 0)
  if (input.maxCommissionPct != null && Number.isFinite(input.maxCommissionPct)) {
    pct = Math.min(pct, Math.max(0, input.maxCommissionPct))
  }
  const influencerKrw = Math.floor((gross * pct) / 100)
  // 순수취는 커미션과 **독립** — 항상 총액의 feePct%. (커미션은 매장 promo 에서만 나감.)
  const platformNetKrw = Math.round((gross * feePct) / 100)
  return { influencerKrw, ownerDebitKrw: influencerKrw, platformNetKrw }
}

/**
 * 불변식 강제(순수) — owner-funding 이면 유어딜 순수취는 커미션과 무관하게 정확히 feePct%.
 * 위반 시 throw(fail-closed). 활성 배선에서 적립 직전 호출 권장.
 */
export function assertPlatformNetIsFee(settlement: MatchingSettlement, grossKrw: number, platformFeePct = DEFAULT_PLATFORM_FEE_PCT): void {
  const expected = Math.round((Math.max(0, Math.floor(grossKrw)) * platformFeePct) / 100)
  if (settlement.platformNetKrw !== expected) {
    throw new Error(`[matching-settlement] 순수취 불변식 위반: platformNet=${settlement.platformNetKrw} != ${expected}(=${platformFeePct}%)`)
  }
  if (settlement.ownerDebitKrw !== settlement.influencerKrw) {
    throw new Error(`[matching-settlement] owner 되갚기 비대칭: debit=${settlement.ownerDebitKrw} != credit=${settlement.influencerKrw}`)
  }
}

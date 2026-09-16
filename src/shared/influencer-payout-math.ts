/**
 * 💰 인플루언서 현금 정산액 계산 SSOT.
 *
 * 배경 (2026-08-31 대표 확정): 마진을 **상품에서 걷지 않고 현금 출구에서 걷는다.**
 *   - 교환권 마크업 20% → 0 (원가 판매). 딜 보너스 20% → 0. ⇒ **1딜 = 1원 고정.**
 *   - 대신 **현금 수령에만 정산 수수료**. 딜 수령은 수수료 없음.
 *
 *   왜 이 방향인가: 보너스를 딜 쪽에 얹으면 딜의 구매력이 **상품 마진에 의존**한다.
 *   교환권 마크업이 20% 라서 보너스 20% 가 성립했고, 마진이 5~10% 인 이용권에 같은 딜을
 *   쓰는 순간 유어딜이 건당 8~14원 적자였다(2026-08-31 실측). 수수료를 현금 쪽에 두면
 *   딜은 언제나 액면 그대로라 **어떤 상품에 써도 안 깨진다.**
 *
 * 🔴 **기본값 0 — 이 파일을 머지해도 현행 동작은 1원도 안 바뀐다.**
 *   `platform_settings.influencer_payout_cash_fee_pct` 를 대표가 설정해야 비로소 걷힌다.
 *
 * ⚠️ **원천징수 대상액 = 총액 − 수수료.**
 *   지급되는 금액이 곧 소득이라고 보는 해석이다("2%를 딜로 드립니다. 현금을 원하시면
 *   정산 수수료를 제하고 보내드립니다"). 대안은 **총액을 소득으로 보고 원천징수한 뒤
 *   수수료를 따로 떼는 것**이고, 100만원·수수료 10%·사업소득이면 실지급이
 *   **870,300원(현재) vs 867,000원(대안)** 으로 갈린다. **세무 확인 대상** —
 *   확정되면 이 주석과 함께 바꿀 것. 수수료가 0 인 동안은 두 해석의 결과가 같다.
 *
 *   ⚠️ 순서를 "수수료 먼저냐 원천징수 먼저냐"로 생각하면 틀린다 — 둘 다 곱셈이라
 *   교환법칙이 성립해 **순서 자체는 결과를 안 바꾼다.** 갈리는 것은 *과세표준에서
 *   수수료를 빼느냐* 다. (이 함정을 테스트가 잡았다.)
 *
 * ⚠️ 이 파일이 없던 시절 원천징수가 **세 곳**에서 따로 계산됐다
 *   (`cron/influencer-payout.ts` · `marketing.routes.ts` · `AdminInfluencerPayoutsPage.tsx`).
 *   수수료를 얹으면 네 번째가 된다 — 그래서 셋을 여기로 모은다. 갈리면 화면·알림·실지급이
 *   서로 다른 숫자를 말하게 되고, 그건 돈 문제다.
 */

import { WITHHOLDING_RATES } from './constants/policy'

/** 현금 정산 수수료 기본값(%). 0 = 안 걷음 = 2026-08-31 이전과 동일. */
export const CASH_PAYOUT_FEE_DEFAULT_PCT = 0
/** 수수료 허용 범위(%). */
export const CASH_PAYOUT_FEE_MAX_PCT = 50

export interface CashPayoutBreakdown {
  /** 적립된 총액 (influencer_balances.available_amount). */
  gross: number
  /** 정산 수수료율 (%). */
  feePct: number
  /** 정산 수수료 (유어딜 수취). */
  fee: number
  /** 원천징수 대상액 = gross - fee. */
  taxableBase: number
  /** 원천징수율 (%). */
  withholdingPct: number
  /** 원천징수액 (국가 납부). */
  withholding: number
  /** 실제 계좌로 보낼 금액. */
  net: number
}

/**
 * 저장된 수수료 설정값을 해석한다.
 *
 * **`0` 은 유효한 값이다** — `Number(x) || N` 으로 쓰면 0 이 falsy 라 기본값으로 튕긴다
 * (2026-08-31 교환권 마진에서 실제로 그 사고가 났다).
 */
export function resolveCashFeePct(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return CASH_PAYOUT_FEE_DEFAULT_PCT
  const n = Number(raw)
  if (!Number.isFinite(n)) return CASH_PAYOUT_FEE_DEFAULT_PCT
  return Math.min(CASH_PAYOUT_FEE_MAX_PCT, Math.max(0, n))
}

/**
 * 원천징수율(%) 판정 — 사업자번호 있거나 사업소득이면 3.3%, 기타소득이면 8.8%, 무신고 0.
 * 세 호출부가 각자 갖고 있던 분기를 그대로 옮긴 것(동작 동일).
 */
export function resolveWithholdingRate(taxType: string | null | undefined, businessNumber: string | null | undefined): number {
  if (businessNumber || taxType === 'business_income') return WITHHOLDING_RATES.business_income
  if (taxType === 'other_income') return WITHHOLDING_RATES.other_income
  return 0
}

/** 표시용 % (= 분수 × 100). 계산에는 쓰지 말 것 — 아래 주석 참조. */
export function resolveWithholdingPct(taxType: string | null | undefined, businessNumber: string | null | undefined): number {
  return resolveWithholdingRate(taxType, businessNumber) * 100
}

/** 현금 정산 한 건의 전체 내역. 화면·알림·지급이 **반드시 이 함수 하나**를 쓴다. */
export function computeCashPayout(input: {
  gross: number
  taxType?: string | null
  businessNumber?: string | null
  feePct?: number
}): CashPayoutBreakdown {
  const gross = Math.max(0, Math.floor(input.gross || 0))
  const feePct = resolveCashFeePct(input.feePct)
  const fee = Math.floor((gross * feePct) / 100)
  const taxableBase = gross - fee
  // ⚠️ **분수(0.088)로 곱한다.** 옛 코드는 `rate * 100` 한 %로 곱하고 100 으로 나눴는데,
  //   `0.088 * 100 = 8.799999999999999` 이라 100만원 기타소득에서 원천징수가 **87,999원**이 됐다
  //   (분수로 곱하면 88,000원). 1원이지만 그건 국가에 낼 세금이고, 매 건마다 난다.
  const withholdingRate = resolveWithholdingRate(input.taxType, input.businessNumber)
  const withholdingPct = withholdingRate * 100
  const withholding = Math.floor(taxableBase * withholdingRate)
  return { gross, feePct, fee, taxableBase, withholdingPct, withholding, net: taxableBase - withholding }
}

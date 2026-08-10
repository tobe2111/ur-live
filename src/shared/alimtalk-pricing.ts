/**
 * 💰 2026-08-10 알림톡 원가·마진 SSOT (대표 지시 — "카카오 발송에서 나는 비용 마진을 남기고 싶어").
 *
 * ## 왜 이 파일이 필요했나
 * 마진을 남기는 것 자체는 원래도 가능했다(패키지 판매가를 어드민이 자유롭게 정한다).
 * 문제는 **얼마 남았는지 볼 수가 없었다**는 것이다 — 원가가 DB 에 단 하나도 없고 주석에만
 * 흩어져 있었는데, 그 숫자마저 서로 달랐다:
 *   원가   `6.5`(aligo.ts) · `8`(system-alimtalk.ts · 죽은 CREDIT_UNIT_PRICE) · `19.9`(친구톡)
 *   판매가 `9`(패키지) · `15`(레거시 하드코딩) · `25`(가이드 문서)
 * 게다가 어드민의 "수익" 표시는 `발송건수 × 하드코딩 9원` 이라 **원가를 빼지 않은 매출**이었다.
 * ⇒ 숫자를 한 곳에 모으고, 마진 계산을 순수함수로 고정한다.
 *
 * ## 값은 어디에 사는가
 * - **원가**(우리가 알리고에 내는 돈): `platform_settings` — `alimtalk_unit_cost_krw` /
 *   `friendtalk_unit_cost_krw`. 어드민이 조정한다(CLAUDE.md: 수치는 platform_settings 조정 대상).
 *   미설정이면 아래 기본값. 요금제가 바뀌면 **코드 배포 없이** 어드민에서 고친다.
 * - **판매가**(셀러에게 받는 돈): `alimtalk_packages.price` — 이미 어드민에서 설정 중. 여기선 안 건드린다.
 *
 * ⚠️ 원가는 **소수점이 있다**(6.5원). 정수로 반올림하면 1만 건에 5,000원이 틀어진다 — 실수로 다룬다.
 */

/** 알리고 알림톡 원가/건(원). 요금제 변경 시 어드민에서 조정 — 이 값은 미설정 시 폴백일 뿐이다. */
export const DEFAULT_ALIMTALK_UNIT_COST_KRW = 6.5
/** 알리고 브랜드메시지(친구톡) 원가/건(원). 알림톡보다 비싸다. */
export const DEFAULT_FRIENDTALK_UNIT_COST_KRW = 19.9

/** platform_settings 키 — 문자열 오타로 조용히 폴백되는 걸 막으려고 상수로 고정. */
export const ALIMTALK_COST_SETTING_KEYS = {
  alimtalk: 'alimtalk_unit_cost_krw',
  friendtalk: 'friendtalk_unit_cost_krw',
} as const

/**
 * 저장값(문자열) → 원가. 빈값·문자·0 이하·비상식적 큰 값은 폴백으로 되돌린다.
 * - 상한 1,000원: 오타(예: 6.5 대신 6500)로 마진이 음수로 뒤집혀 보이는 걸 막는다.
 * - 🔴 **빈 문자열을 먼저 걸러야 한다** — `Number('')` 은 `0` 이고 그건 유한수라 범위검사를 통과한다.
 *   그러면 원가가 0 으로 잡혀 **마진이 100% 로 표시된다**(이 파일이 막으려는 바로 그 거짓말).
 *   2026-08-10 CI 가 실제로 이 케이스를 잡았다.
 * - 0 도 폴백이다: 알림톡이 공짜일 수 없고, 0 원가는 마진율을 항상 100% 로 만든다.
 */
export function parseUnitCost(raw: unknown, fallback: number): number {
  const s = String(raw ?? '').trim()
  if (!s) return fallback
  const n = Number(s)
  if (!Number.isFinite(n) || n <= 0 || n > 1000) return fallback
  return n
}

export interface MarginSummary {
  /** 실매출(원) — 셀러가 실제 결제한 금액 합계 */
  revenue: number
  /** 실원가(원) — 발송 성공 건수 × 원가 */
  cost: number
  /** 마진(원) = 매출 − 원가. 음수 가능(그게 사실이면 그대로 보여준다) */
  margin: number
  /** 마진율(%) — 매출 대비. 매출 0 이면 0(0으로 나누지 않는다) */
  marginPct: number
}

/**
 * 마진 집계 — **매출은 원장에서, 원가는 발송 건수에서** 온다.
 * ⚠️ 둘의 기간이 다를 수 있다(선불 충전 모델이라 이번 달 매출이 다음 달에 소진된다).
 *   즉 이 값은 "누적 손익"이지 "이번 달 손익"이 아니다 — 호출부가 그렇게 표시해야 한다.
 */
export function computeAlimtalkMargin(revenueKrw: number, sentCount: number, unitCostKrw: number): MarginSummary {
  const revenue = Number.isFinite(revenueKrw) && revenueKrw > 0 ? Math.round(revenueKrw) : 0
  const sent = Number.isFinite(sentCount) && sentCount > 0 ? Math.floor(sentCount) : 0
  const unit = Number.isFinite(unitCostKrw) && unitCostKrw > 0 ? unitCostKrw : 0
  const cost = Math.round(sent * unit)
  const margin = revenue - cost
  return { revenue, cost, margin, marginPct: revenue > 0 ? Math.round((margin / revenue) * 1000) / 10 : 0 }
}

/** 패키지 건당 판매가(원). credits 0/음수는 0(표시용 — 나누기 사고 방지). */
export function packageUnitPrice(price: number, credits: number): number {
  const p = Number(price); const c = Number(credits)
  if (!Number.isFinite(p) || !Number.isFinite(c) || c <= 0) return 0
  return Math.round((p / c) * 100) / 100
}

/**
 * 패키지 건당 마진율(%) — `(판매단가 − 원가) / 판매단가`.
 * 판매단가가 0 이면 0. **원가보다 싸게 팔면 음수**가 그대로 나온다(경고는 호출부 UI 가).
 */
export function packageMarginPct(price: number, credits: number, unitCostKrw: number): number {
  const unitPrice = packageUnitPrice(price, credits)
  if (unitPrice <= 0) return 0
  const cost = Number.isFinite(unitCostKrw) && unitCostKrw > 0 ? unitCostKrw : 0
  return Math.round(((unitPrice - cost) / unitPrice) * 1000) / 10
}

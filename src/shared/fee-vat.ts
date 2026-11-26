/**
 * 🧾 플랫폼 수수료 **부가세 별도** (2026-11-25 대표 *"1번 부가세 별도로 하자. 그렇게 구현도 해줘"*)
 *
 * 결재 `docs/decisions/archive/2026-11-25-fee-vat-exclusive.md`.
 *
 * ## 규칙
 * - 수수료 10%(직접)·5%(중개)는 **공급가액**이다. 매장은 그 위에 **부가세 10%** 를 더 낸다
 *   (= 수수료 × 1.1). 업계 표준(오픈마켓 수수료는 부가세 별도)과 같다.
 * - 일반과세 매장은 유어딜이 발행하는 수수료 세금계산서로 이 부가세를 **매입세액 공제**받는다 → 실부담 그대로.
 * - 부가세는 유어딜 수익이 아니다 — 원장에서 `platform:vat_payable`(부가세 예수금)로 따로 쌓아 신고 때 낸다.
 *
 * ## 언제부터
 * 기존 매장에 30일 넘게 알리고 **2027-01-01(KST) 이후 사용(정산)분부터**. 날짜는 어드민 조정값
 * (`platform_settings.fee_vat_exclusive_from`). 비우면 기본값, `off` 면 적용 안 함(되돌리기).
 *
 * ⚠️ 이 파일은 순수 함수뿐이다(DB·시간 직접 의존 0) — 클라이언트(실수령 카드)와 워커(원장)가 같이 쓴다.
 */

export const FEE_VAT_RATE = 0.1
export const FEE_VAT_FROM_KEY = 'fee_vat_exclusive_from'
export const DEFAULT_FEE_VAT_FROM = '2027-01-01'
/** 원장 계정 — 수수료 부가세 예수금. 지급 대상 아님(`platform:` 접두어). */
export const FEE_VAT_ACCOUNT = 'platform:vat_payable'

const KST_MS = 9 * 60 * 60 * 1000

/** 설정값 → 시작일(YYYY-MM-DD) 또는 null(끔). 비었거나 형식이 틀리면 기본값. 순수. */
export function resolveFeeVatFrom(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (s === 'off' || s === 'false' || s === 'none') return null
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : DEFAULT_FEE_VAT_FROM
}

/** 그 시각(UTC ms)의 KST 날짜가 시작일 이상인가. 시작일 null 이면 false. 순수. */
export function feeVatApplies(nowMs: number, from: string | null): boolean {
  if (!from || !Number.isFinite(nowMs)) return false
  const kstDate = new Date(nowMs + KST_MS).toISOString().slice(0, 10)
  return kstDate >= from
}

/** 수수료(공급가액, 원) → 부가세(원). 음수·이상값은 0. 순수. */
export function feeVatAmount(fee: number): number {
  const f = Number(fee)
  if (!Number.isFinite(f) || f <= 0) return 0
  return Math.round(f * FEE_VAT_RATE)
}

/** 매장이 실제로 떼이는 %(수수료 + 그 부가세) — 실수령 카드 표시용. 순수. */
export function feePctWithVat(pct: number, vatOn: boolean): number {
  const p = Number(pct)
  if (!Number.isFinite(p) || p <= 0) return 0
  return vatOn ? Math.round(p * (1 + FEE_VAT_RATE) * 100) / 100 : p
}

/** 사람이 읽는 문구 — "10%(부가세 별도)". 순수. */
export function feePctLabel(pct: number): string {
  return `${pct}%(부가세 별도)`
}

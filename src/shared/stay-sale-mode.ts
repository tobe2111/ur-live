/**
 * 🏨 숙박 이용권 판매 방식 — 화면(등록 위저드)과 서버(`POST /api/seller/stays/:id/info`)가 같이 쓰는 SSOT.
 *
 * 결재 `docs/decisions/archive/2026-11-24-stay-voucher-buy-first.md` (대표 "추천대로 진행"):
 *   Q1 사장님이 등록할 때 고른다 — 기본은 **먼저 판매**(손님이 먼저 사고 날짜는 매장과 따로 잡는다).
 *   Q3 먼저 판매를 켜면 유효기간은 3·6·12개월 중 **반드시** 고른다(기한 없는 판매는 막는다).
 *   Q5 쓸 수 없는 날(연휴·성수기)은 안내 문구로 적는다 — 구매 전 화면에 보인다.
 *
 * 저장 값은 `product_stay_info.sale_mode` 의 기존 값 그대로다(`voucher` · `date` · `both`) — 손님 화면·결제·사용 처리는
 * 2026-05 부터 세 값을 모두 처리해 왔다. 바뀐 것은 "등록 화면이 `date` 로 고정해 저장하던 것" 하나다.
 */
export type StaySaleMode = 'voucher' | 'date' | 'both'

export const STAY_SALE_MODES: ReadonlyArray<{ value: StaySaleMode; label: string; hint: string }> = [
  { value: 'voucher', label: '먼저 판매', hint: '손님이 먼저 사고, 날짜는 매장에 연락해 잡아요. 달력 관리가 필요 없어요' },
  { value: 'date', label: '날짜 지정', hint: '손님이 살 때 날짜를 골라요. 달력(남은 객실)을 직접 관리해야 해요' },
  { value: 'both', label: '둘 다', hint: '두 방식을 함께 팔아요' },
]

/** 유효기간 선택지(일). 상한 12개월은 `shared/voucher-validity` 와 같다. */
export const STAY_VALIDITY_OPTIONS: ReadonlyArray<{ days: number; label: string }> = [
  { days: 90, label: '3개월' }, { days: 180, label: '6개월' }, { days: 365, label: '12개월' },
]

export const STAY_USE_NOTE_MAX = 200

export function isStaySaleMode(v: unknown): v is StaySaleMode {
  return v === 'voucher' || v === 'date' || v === 'both'
}

/** 먼저 판매가 켜져 있는가(`voucher`·`both`). */
export function sellsStayVoucher(mode: StaySaleMode): boolean {
  return mode !== 'date'
}

/**
 * 판매 방식 + 유효기간 판정. 화면과 서버가 같은 판정을 쓴다.
 *   - 방식이 없거나 모르는 값이면 `date`(옛 화면이 보내던 모양 — 종전 동작 유지).
 *   - 먼저 판매를 켰는데 유효기간이 선택지 밖이면 오류.
 */
export function resolveStaySale(input: { sale_mode?: unknown; voucher_validity_days?: unknown }):
  { ok: true; sale_mode: StaySaleMode; voucher_validity_days: number } | { ok: false; error: string } {
  const mode: StaySaleMode = isStaySaleMode(input.sale_mode) ? input.sale_mode : 'date'
  const days = Math.floor(Number(input.voucher_validity_days) || 0)
  if (!sellsStayVoucher(mode)) return { ok: true, sale_mode: mode, voucher_validity_days: 180 } // 날짜 지정만 — 유효기간은 쓰이지 않는다(열 기본값)
  if (!STAY_VALIDITY_OPTIONS.some((o) => o.days === days)) return { ok: false, error: '유효기간을 3·6·12개월 중에서 골라 주세요' }
  return { ok: true, sale_mode: mode, voucher_validity_days: days }
}

/** 이용 안내(쓸 수 없는 날 등) — 앞뒤 공백을 떼고 길이를 자른다. 비면 null. */
export function cleanStayUseNote(raw: unknown): string | null {
  const s = typeof raw === 'string' ? raw.trim().slice(0, STAY_USE_NOTE_MAX) : ''
  return s || null
}

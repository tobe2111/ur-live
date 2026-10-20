/**
 * 🎟️ 2026-07-06 (대표 "사용 조건도 사장님이 선택하게 — 자유입력 말고"): 이용권 매장별 사용조건 프리셋 SSOT.
 *   사장님은 흔한 조건을 **체크로 선택**(타이핑 최소) → 소비자 이용권 '이용 안내'에 표준 문구로 표시.
 *   셀러 UI(SellerVoucherScanPage)와 소비자 표시(worker redemption-info)가 공유하는 단일 목록.
 */
export interface UsageConditionPreset { key: string; label: string }

export const VOUCHER_USAGE_PRESETS: readonly UsageConditionPreset[] = [
  { key: 'weekday', label: '평일만 사용 가능' },
  { key: 'weekend', label: '주말·공휴일 사용 가능' },
  { key: 'lunch', label: '점심시간(11~15시)에만 사용' },
  { key: 'dinner', label: '저녁시간에만 사용' },
  { key: 'one_per_person', label: '1인 1매만 사용 가능' },
  { key: 'reservation', label: '방문 전 예약 필수' },
  { key: 'no_alcohol', label: '주류 메뉴는 제외' },
  { key: 'dine_in_only', label: '매장 이용만 가능 (포장 불가)' },
  { key: 'no_combine', label: '다른 할인·쿠폰과 중복 사용 불가' },
  { key: 'min_two', label: '2인 이상 방문 시 사용 가능' },
] as const

const _byKey = new Map(VOUCHER_USAGE_PRESETS.map((p) => [p.key, p.label]))

/** 선택된 key 배열 + 커스텀 텍스트 → 표시용 라벨 배열(순서 보존, 알 수 없는 key 무시). */
export function resolveUsageConditions(keys: string[] | null | undefined, custom?: string | null): string[] {
  const out: string[] = []
  for (const k of (keys || [])) { const l = _byKey.get(k); if (l && !out.includes(l)) out.push(l) }
  const c = (custom || '').trim()
  if (c) out.push(c)
  return out
}

/** 저장/입력값 정규화 — 유효 key 만, 최대 10개, 커스텀 120자. */
export function sanitizeUsageConditions(keys: unknown, custom: unknown): { keys: string[]; custom: string } {
  const arr = Array.isArray(keys) ? keys.filter((k): k is string => typeof k === 'string' && _byKey.has(k)).slice(0, 10) : []
  const uniq = Array.from(new Set(arr))
  const c = typeof custom === 'string' ? custom.trim().slice(0, 120) : ''
  return { keys: uniq, custom: c }
}

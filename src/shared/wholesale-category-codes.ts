/**
 * 🏭 2026-06-29 (대표 #8) — 도매 카테고리별 상품코드 접두 SSOT.
 *   식품 → FD · 리빙 → LV · 건강 → HT. 제조사가 상품 등록 시 입력하는 상품코드는 카테고리 접두로 시작해야 한다.
 *   카테고리 확장 시: 어드민이 platform_settings 키 `wholesale_category_prefixes`(JSON: { "<category>": "XX" })로
 *   접두를 추가하면 서버가 기본값 위에 머지한다(코드 수정 없이 확장). 프론트는 기본 3종으로 표시.
 *
 *   프론트(AddProductModal)·워커(supplier-dashboard.routes) 양쪽에서 import — src/shared 위치.
 */
export const WHOLESALE_CATEGORY_PREFIX: Record<string, string> = {
  food: 'FD',
  living: 'LV',
  health: 'HT',
}

/** 카테고리 → 접두(대문자). overrides(어드민 platform_settings) 우선, 없으면 기본. 미설정이면 빈 문자열. */
export function categoryCodePrefix(category?: string | null, overrides?: Record<string, string> | null): string {
  const key = String(category || '').trim()
  if (!key) return ''
  const ov = overrides && typeof overrides === 'object' ? overrides[key] : undefined
  return String(ov || WHOLESALE_CATEGORY_PREFIX[key] || '').toUpperCase()
}

/**
 * 입력 코드를 카테고리 접두 규칙으로 정규화.
 *   - 공백 제거 + 대문자. 이미 접두로 시작하면 그대로, 아니면 접두를 prepend.
 *   - 접두 미설정 카테고리(어드민 확장 전)면 입력값만 대문자/공백제거 후 반환.
 *   - 빈 입력이면 빈 문자열(상품코드 선택).
 */
export function normalizeProductCode(rawCode: string, category?: string | null, overrides?: Record<string, string> | null): string {
  const code = String(rawCode || '').trim().toUpperCase().replace(/\s+/g, '')
  if (!code) return ''
  const prefix = categoryCodePrefix(category, overrides)
  if (!prefix) return code.slice(0, 80)
  if (code.startsWith(prefix)) return code.slice(0, 80)
  return (prefix + code).slice(0, 80)
}

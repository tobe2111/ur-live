/**
 * 🏷️ 2026-07-19 (대표 UI v2 P2 — 카드 제목 중복 제거): 제목이 매장명 프리픽스로 시작하면
 * 메뉴명만 남긴다(매장명은 카드 아랫줄 한 곳에만). 제거 결과가 비면(제목=매장명) 원제목 유지.
 * 표시 전용 — 데이터/DB 무변경.
 */
export function stripStorePrefix(title?: string | null, store?: string | null): string {
  const t = (title || '').trim()
  const s = (store || '').trim()
  if (!t || !s || s.length < 2) return t
  if (!t.toLowerCase().startsWith(s.toLowerCase())) return t
  const rest = t.slice(s.length).replace(/^[\s\-–—·:|,]+/, '').trim()
  return rest || t
}

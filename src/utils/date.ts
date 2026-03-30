/**
 * DB에 저장된 UTC datetime 문자열을 한국시간(KST)으로 변환하여 표시
 *
 * SQLite datetime('now')는 UTC를 반환하지만 'Z' 접미사가 없어서
 * JavaScript Date가 로컬 시간으로 오해함. 이 유틸리티가 이를 보정.
 */

/**
 * UTC datetime 문자열을 Date 객체로 변환 (timezone 보정)
 * - '2026-03-30 12:00:00' → UTC 12:00으로 올바르게 해석
 * - '2026-03-30T12:00:00Z' → 그대로 UTC
 * - ISO 8601 형식도 지원
 */
export function parseUTCDate(dateStr: string | null | undefined): Date {
  if (!dateStr) return new Date()
  // 이미 'Z'나 '+' offset이 있으면 그대로 파싱
  if (dateStr.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
    return new Date(dateStr)
  }
  // SQLite datetime('now') 형식: '2026-03-30 12:00:00' → UTC로 해석
  return new Date(dateStr.replace(' ', 'T') + 'Z')
}

/**
 * UTC datetime → 한국시간 문자열 (날짜 + 시간)
 * 예: '2026. 3. 30. 오후 9:00:00'
 */
export function formatKST(dateStr: string | null | undefined): string {
  const date = parseUTCDate(dateStr)
  return date.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
}

/**
 * UTC datetime → 한국시간 날짜만
 * 예: '2026. 3. 30.'
 */
export function formatKSTDate(dateStr: string | null | undefined): string {
  const date = parseUTCDate(dateStr)
  return date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })
}

/**
 * UTC datetime → 한국시간 시간만
 * 예: '오후 9:00'
 */
export function formatKSTTime(dateStr: string | null | undefined): string {
  const date = parseUTCDate(dateStr)
  return date.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })
}

/**
 * UTC datetime → 한국시간 간결한 형식
 * 예: '03/30 21:00'
 */
export function formatKSTShort(dateStr: string | null | undefined): string {
  const date = parseUTCDate(dateStr)
  const m = String(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul', month: '2-digit' }))
  const d = String(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul', day: '2-digit' }))
  const t = date.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
  return `${m}/${d} ${t}`
}

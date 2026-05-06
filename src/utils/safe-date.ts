/**
 * 🛡️ 2026-05-06: Safari-safe 날짜 파싱.
 *
 * 문제: SQLite `datetime('now')` / `CURRENT_TIMESTAMP` 는 'YYYY-MM-DD HH:MM:SS' 형식 (공백, T 없음) 반환.
 *   - Chrome / Firefox: 로컬 타임존으로 파싱 (관대함, 단 KST 유저는 9시간 차이 hidden bug)
 *   - Safari (iOS / macOS): **Invalid Date** 반환 → toLocaleString() = "Invalid Date" 표시
 *
 * 처리: 공백 형식을 ISO 8601 (T + Z) 로 변환 후 Date 생성.
 *   - SQLite UTC 저장이라 Z 추가 → 정확한 UTC 인식 → toLocaleString 시 사용자 로컬 TZ 자동 변환.
 *   - 이미 ISO 8601 (T 또는 Z 포함) 인 입력은 그대로 통과.
 *   - null/undefined 입력은 null 반환 (호출자 가드 책임).
 *
 * 사용 예:
 *   safeDate(order.created_at)?.toLocaleString('ko-KR')
 *   safeDate(stream.scheduled_at)?.getTime()
 */
export function safeDate(input: string | number | Date | null | undefined): Date | null {
  if (input === null || input === undefined || input === '') return null
  if (input instanceof Date) return isNaN(input.getTime()) ? null : input
  if (typeof input === 'number') return new Date(input)

  // 'YYYY-MM-DD HH:MM:SS' (공백) 또는 'YYYY-MM-DD HH:MM:SS.sss' → ISO 8601 (T + Z)
  // 단, 이미 timezone (Z, +HH:MM, -HH:MM) 이 있으면 추가하지 않음.
  let s = input
  if (/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(s)) {
    s = s.replace(' ', 'T')
    if (!/Z$|[+-]\d{2}:?\d{2}$/.test(s)) {
      s = s + 'Z'
    }
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/**
 * Safari-safe `getTime()` — 파싱 실패 시 0 반환 (NaN 회피).
 * 정렬/계산용. 표시용은 safeDate 직접 사용.
 */
export function safeTime(input: string | number | Date | null | undefined): number {
  return safeDate(input)?.getTime() ?? 0
}

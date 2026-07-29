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
 * 🛡️ 2026-07-27: Intl timeZone 미지원 런타임 대비 폴백.
 *   Cloudflare Workers(workerd)는 full-ICU 라 `timeZone: 'Asia/Seoul'` 이 동작하지만,
 *   이 모듈이 워커/프리렌더/테스트 등 어디서 평가될지 모르므로 실패 시 수동 +9h 로 계산한다.
 *   (폴백은 KST 가 DST 없는 고정 UTC+9 이라 정확하다.)
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000
function kstSafe(date: Date, fn: (d: Date) => string, fallback: (shifted: Date) => string): string {
  try {
    return fn(date)
  } catch {
    return fallback(new Date(date.getTime() + KST_OFFSET_MS))
  }
}

/**
 * UTC datetime → 한국시간 문자열 (날짜 + 시간)
 * 예: '2026. 3. 30. 오후 9:00:00'
 */
export function formatKST(dateStr: string | null | undefined): string {
  const date = parseUTCDate(dateStr)
  return kstSafe(
    date,
    d => d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    d => d.toISOString().replace('T', ' ').slice(0, 19),
  )
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
  return kstSafe(
    date,
    d => {
      const m = String(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul', month: '2-digit' }))
      const day = String(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul', day: '2-digit' }))
      const t = d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })
      return `${m}/${day} ${t}`
    },
    d => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`,
  )
}

/**
 * 사용자가 고른 'YYYY-MM-DD'(한국 날짜)를 그날 **KST 00:00** 의 epoch(ms)로.
 * ⚠️ `new Date('2026-07-27')` 는 스펙상 **UTC 자정**이라 KST 기준 필터에 쓰면 9시간 어긋난다.
 *   서버 필터가 `DATE(created_at, '+9 hours')` 로 KST 기준인 것과 맞추기 위한 SSOT.
 */
export function kstDayStartMs(ymd: string | null | undefined): number {
  if (!ymd) return NaN
  return Date.parse(`${ymd}T00:00:00+09:00`)
}

/** 같은 날 **KST 23:59:59.999** 의 epoch(ms). */
export function kstDayEndMs(ymd: string | null | undefined): number {
  if (!ymd) return NaN
  return Date.parse(`${ymd}T23:59:59.999+09:00`)
}

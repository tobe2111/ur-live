/**
 * 📮 2026-10-18 — 사장님·손님에게 가는 자동 안내 셋의 공용 조각 (대표 "4,5,6번 하자").
 *
 *  ④ 사장님 일일 리포트(`cron/seller-daily-report.ts`) — 게이트 `seller_daily_report_enabled`
 *  ⑤ 이용권 사용 다음 날 후기 요청(`cron/review-request.ts`) — 게이트 `review_request_enabled`
 *  ⑥ 서류가 빠진 사장님 보완 안내(`cron/seller-docs-nudge.ts`) — 게이트 `seller_docs_nudge_enabled`
 *
 * 셋 다 **밖으로 메시지가 나가는 일**이라 기본 OFF 다(등급 C — 켜는 것은 대표가 어드민에서).
 * 게이트 판정은 `=== 'true'` 한 가지뿐이고 오타값은 꺼진 쪽으로 떨어진다(check-gate-registry 와 같은 규약).
 */

export const SELLER_DAILY_REPORT_GATE = 'seller_daily_report_enabled'
export const REVIEW_REQUEST_GATE = 'review_request_enabled'
export const SELLER_DOCS_NUDGE_GATE = 'seller_docs_nudge_enabled'

/** platform_settings 의 불리언 게이트 — 행이 없거나 조회 실패면 꺼짐. */
export async function settingOn(DB: D1Database, key: string): Promise<boolean> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(key).first<{ value: string | null }>().catch(() => null)
  return row?.value === 'true'
}

/**
 * 어제(한국시간) 하루를 D1 저장 형식(`YYYY-MM-DD HH:MM:SS`, UTC)으로.
 * ⚠️ ISO 문자열(`…T…Z`)로 비교하면 안 된다 — D1 의 `datetime('now')` 는 공백 구분이라
 *   `'T' > ' '` 때문에 문자열 비교가 하루 경계에서 어긋난다(종전 리포트가 그랬다).
 */
export function yesterdayKstRange(now: Date = new Date()): { date: string; start: string; end: string } {
  const KST = 9 * 3600_000
  const kstNow = new Date(now.getTime() + KST)
  const kstTodayMidnightUtcMs = Date.UTC(kstNow.getUTCFullYear(), kstNow.getUTCMonth(), kstNow.getUTCDate()) - KST
  const startMs = kstTodayMidnightUtcMs - 86400_000
  const fmt = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
  const d = new Date(startMs + KST)
  const date = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
  return { date, start: fmt(startMs), end: fmt(kstTodayMidnightUtcMs) }
}

/** HTML 본문에 넣을 글자 탈출. */
export function escHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch] as string))
}

export type DocsMissing = { business_number: boolean; representative_name: boolean; business_start_date: boolean; certificate: boolean }

/** 사업자 검증에 필요한데 빠진 서류. 국세청 진위 확인은 번호·대표자명·개업일 셋이 다 있어야 돈다. */
export function missingDocs(s: {
  business_number?: string | null; representative_name?: string | null
  business_start_date?: string | null; business_registration_image_url?: string | null
}): DocsMissing {
  const blank = (v: unknown) => !String(v ?? '').trim()
  return {
    business_number: blank(s.business_number),
    representative_name: blank(s.representative_name),
    business_start_date: blank(s.business_start_date),
    certificate: blank(s.business_registration_image_url),
  }
}

export const DOCS_LABEL: Record<keyof DocsMissing, string> = {
  business_number: '사업자등록번호',
  representative_name: '대표자 이름',
  business_start_date: '개업일',
  certificate: '사업자등록증 사진',
}

/**
 * 보완 안내를 보낼 차례인가 — 가입 3일째 1회, 7일째(그리고 1회차에서 4일 뒤) 1회, 그 뒤 없음.
 * `sentCount`·`lastSentAt` 은 seller_meta 에 남긴 값.
 */
export function docsNudgeDue(ageDays: number, sentCount: number, daysSinceLast: number | null): boolean {
  if (sentCount <= 0) return ageDays >= 3
  if (sentCount === 1) return ageDays >= 7 && (daysSinceLast ?? 0) >= 4
  return false
}

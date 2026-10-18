/**
 * 🧹 2026-10-18 — 쌓인 cron 실패 알림을 **조건으로 묶어** 해결 처리한다.
 *
 * 왜: 미해결 `cron_failures` 가 1,339건 쌓였는데 해결 도구는 한 건씩(`PATCH /:id/resolve`)뿐이었다.
 * 대부분은 이미 고친 문제의 흔적이다 — 2026-10-15 이전의 거짓 `blocked:*` 경보(값을 안 보고
 * 키만 보던 감시 · 10-15 수리 후 0건), 10-07 이후 멎은 `ads:enrich-company` CPU 초과,
 * 10-13 이전 배포 실패. 그 소음이 진짜 경보(`stale:*` 등)를 가린다.
 *
 * 규칙(조용히 너무 많이 지우지 않게):
 *  - `job_prefix` **필수**(3자 이상, 이름에 쓰는 글자만) — "전부 해결" 은 만들 수 없다.
 *  - `before` **필수** — 그 시각 이전 행만. 지금 울리는 경보를 같이 지우지 못한다.
 *  - `severity` 는 선택(화이트리스트 밖이면 거부 — 빈 필터로 넓어지지 않게).
 *  - 기본은 **세기만**(dry_run). 실제 반영은 `dry_run: false` 를 명시할 때만.
 */
export interface BulkResolveInput {
  job_prefix?: unknown
  before?: unknown
  severity?: unknown
  dry_run?: unknown
}

export type BulkResolvePlan =
  | { ok: true; where: string; binds: (string | number)[]; dryRun: boolean }
  | { ok: false; error: string }

const PREFIX_RE = /^[A-Za-z0-9_:.\-]{3,80}$/
const BEFORE_RE = /^\d{4}-\d{2}-\d{2}( \d{2}:\d{2}:\d{2})?$/
const SEVERITIES = ['critical', 'error', 'warning'] as const

export function planBulkResolve(input: BulkResolveInput): BulkResolvePlan {
  const prefix = typeof input.job_prefix === 'string' ? input.job_prefix.trim() : ''
  if (!PREFIX_RE.test(prefix)) {
    return { ok: false, error: 'job_prefix 가 필요합니다(3~80자, 영문·숫자·_:.- 만)' }
  }
  const before = typeof input.before === 'string' ? input.before.trim() : ''
  if (!BEFORE_RE.test(before)) {
    return { ok: false, error: "before 가 필요합니다('YYYY-MM-DD' 또는 'YYYY-MM-DD HH:MM:SS', UTC)" }
  }
  let severity: string | null = null
  if (input.severity !== undefined && input.severity !== null && input.severity !== '') {
    const s = String(input.severity).trim().toLowerCase()
    if (!(SEVERITIES as readonly string[]).includes(s)) {
      return { ok: false, error: 'severity 는 critical·error·warning 중 하나여야 합니다' }
    }
    severity = s
  }
  // LIKE 의 와일드카드 글자는 PREFIX_RE 가 이미 막는다(% 없음). `_` 만 이스케이프한다.
  const like = prefix.replace(/_/g, '\\_') + '%'
  const where = `resolved = 0 AND job_name LIKE ? ESCAPE '\\' AND created_at < ?${severity ? ' AND severity = ?' : ''}`
  const binds: (string | number)[] = severity ? [like, before, severity] : [like, before]
  return { ok: true, where, binds, dryRun: input.dry_run !== false }
}

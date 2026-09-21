/**
 * 🔔 서버 5xx 자동 알림 (2026-09-21, 대표 *"자동 알림 켜줘"*).
 *
 * ## 왜 생겼나 — 대표가 콘솔 로그를 복사해 와야 했다
 * 대표가 매장 등록에서 **500** 을 만났는데 그 흔적이 **어디에도 없었다.** `safeError` 는 5xx 를
 * Sentry 로만 보내는데(2026-06-12 배선), 그 Sentry 가 라이브에서 **429 Too Many Requests**
 * (할당량 초과)라 보고가 통째로 버려지고 있었다. D1 에도 남는 자리가 없었다 — `cron_failures` 는
 * **cron 전용**이고 `frontend_errors` 는 브라우저 JS 오류다. ⇒ API 5xx 는 관측 밖이었다.
 *
 * ## 무엇을 하나
 * 5xx 가 나면 **`cron_failures` 에 `api:{태그}` 로 적는다.** 그 표는 어드민 모니터링
 * (`GET /api/admin/cron-failures` → `/admin/system-monitoring`)이 **이미 읽고 있다** — 새 화면을
 * 만들지 않는 이유다. 그리고 같은 종류의 첫 건은 **어드민 벨**로도 알린다(대표에게 실제로 닿는 경로).
 *
 * ## ⚠️ 이 파일의 절반은 폭주 방지다
 * 5xx 는 한 번 나기 시작하면 초당 수십 건이 난다. 그때 알림이 D1 을 같이 죽이면 **장애를 알리려다
 * 장애를 키운다.** 그래서 isolate 안 메모로 태그별 창을 두고, 창 안이면 **D1 을 아예 안 건드린다**
 * (조회조차 안 한다 — 조회도 비용이다). isolate 가 여럿이라 창당 몇 건은 중복될 수 있는데,
 * 그건 받아들인다: 중복 몇 줄보다 놓친 장애가 훨씬 비싸다.
 *
 * ## 이 파일이 **하지 않는** 것
 * - 테이블을 만들지 않는다(DDL 0). 표가 없는 환경에선 조용히 no-op 이다.
 * - 응답을 절대 막지 않는다. 모든 실패는 삼킨다 — 알림이 요청을 깨뜨리면 주객이 전도된다.
 * - 4xx 는 안 적는다. 그건 사용자 입력이지 장애가 아니다.
 */

/** 같은 태그를 다시 적기까지의 창. 짧으면 폭주, 길면 두 번째 장애를 놓친다. */
export const ERROR_ALERT_WINDOW_MS = 10 * 60_000
/** 벨은 더 드물게 — 어드민 알림함이 같은 줄로 덮이면 아무도 안 본다. */
export const ERROR_BELL_WINDOW_MS = 60 * 60_000
/** 메모가 무한히 자라지 않게 — 태그는 유한하지만 상한은 둔다. */
const MEMO_CAP = 200

const lastLogged = new Map<string, number>()
const lastBelled = new Map<string, number>()

/** 창이 지났으면 true 를 돌려주고 시각을 갱신한다(=이번엔 적는다). */
function due(memo: Map<string, number>, key: string, windowMs: number, now: number): boolean {
  const prev = memo.get(key)
  if (prev != null && now - prev < windowMs) return false
  memo.set(key, now)
  if (memo.size > MEMO_CAP) {
    // 오래된 것부터 버린다 — Map 은 삽입 순서를 지킨다
    for (const k of memo.keys()) {
      memo.delete(k)
      if (memo.size <= MEMO_CAP / 2) break
    }
  }
  return true
}

/** 시험이 창을 넘기지 않고도 두 번째 호출을 볼 수 있게 — 이 함수 말고는 쓰지 말 것. */
export function __resetServerErrorAlertMemo(): void {
  lastLogged.clear()
  lastBelled.clear()
}

export interface ServerErrorContext {
  method?: string
  path?: string
}

/**
 * 5xx 한 건을 기록한다. **절대 throw 하지 않는다.**
 *
 * @param tag `safeError` 의 로그 태그(`[seller-stores]` 등) — 알림의 묶음 단위다.
 */
export async function recordServerError(
  DB: D1Database | undefined,
  tag: string,
  message: string,
  ctx: ServerErrorContext = {},
  now = Date.now(),
): Promise<void> {
  if (!DB || !tag) return
  const jobName = `api:${tag}`.slice(0, 120)
  if (!due(lastLogged, jobName, ERROR_ALERT_WINDOW_MS, now)) return

  const where = [ctx.method, ctx.path].filter(Boolean).join(' ')
  try {
    await DB.prepare(`
      INSERT INTO cron_failures (job_name, error_message, stack, context, severity)
      VALUES (?, ?, NULL, ?, 'error')
    `).bind(
      jobName,
      String(message || '알 수 없는 오류').slice(0, 1000),
      where ? JSON.stringify({ request: where }).slice(0, 2000) : null,
    ).run()
  } catch {
    return // 표가 없거나 D1 이 아플 때 — 벨까지 시도하면 같은 이유로 또 실패한다
  }

  if (!due(lastBelled, jobName, ERROR_BELL_WINDOW_MS, now)) return
  try {
    const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
    await createDashboardNotification(
      DB, 'admin', null, 'server_error',
      '⚠️ 서버 오류가 났어요',
      `${where || tag} — ${String(message || '').slice(0, 120)}`,
      '/admin/system-monitoring',
    )
  } catch { /* 벨 실패가 기록을 무르지 않는다 */ }
}

/**
 * 🧰 2026-07-19 운영 자동화 공용 헬퍼 (운영 자동화 백로그 ①④ — "판단은 내가, 수집은 기계가").
 *
 * 어드민 대상 read-only 리포트(일일 다이제스트·주간 코호트)의 공통 배달 경로:
 *   어드민 벨(항상) + Discord(webhook 설정 시) + 이메일(platform_settings `ops_digest_email` 설정 시).
 *
 * ⚠️ 어드민 연락처는 코드에 없다 — platform_settings 키가 SSOT:
 *   - `ops_digest_email`  : 다이제스트/리포트 수신 이메일 (미설정 = 이메일 미발송)
 *   - `ops_digest_phone`  : 다이제스트 알림톡 수신 번호 (미설정 = 알림톡 미발송; 발송 자체는
 *                           env `OPS_DIGEST_ALIMTALK_ENABLED==='true'` 게이트 뒤 — 기본 OFF)
 * 전부 fail-soft — 어떤 채널 실패도 다른 채널/크론을 막지 않는다.
 */
import type { Env } from '../types/env'

/** platform_settings 단일 키 조회 (없으면 null, 실패 fail-soft). */
export async function getOpsSetting(DB: D1Database, key: string): Promise<string | null> {
  const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(key).first<{ value: string }>().catch(() => null)
  const v = row?.value
  return v === undefined || v === null || v === '' ? null : String(v)
}

/** Date → D1 datetime('now') 과 사전순 비교 가능한 'YYYY-MM-DD HH:MM:SS' (UTC). */
export function toSqlUtc(d: Date): string {
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

/**
 * KST 기준 "n일 전 하루" 의 UTC 경계. offsetDays=1 → KST 어제 [00:00, 24:00) 을 UTC 로.
 * (created_at 은 datetime('now') = UTC 저장 — KST 자정 = UTC 15:00 전날.)
 */
export function kstDayWindow(offsetDays: number): { start: string; end: string; kstDate: string } {
  const KST = 9 * 3600_000
  const nowKst = new Date(Date.now() + KST)
  const kstMidnightUtcMs = Date.UTC(nowKst.getUTCFullYear(), nowKst.getUTCMonth(), nowKst.getUTCDate()) - KST
  const startMs = kstMidnightUtcMs - offsetDays * 86400_000
  const endMs = startMs + 86400_000
  return {
    start: toSqlUtc(new Date(startMs)),
    end: toSqlUtc(new Date(endMs)),
    kstDate: new Date(startMs + KST).toISOString().slice(0, 10),
  }
}

/** COUNT/SUM 단건 스칼라 쿼리 — 실패/테이블 부재 시 0 (weekly-metrics-summary 패턴). */
export async function scalar(DB: D1Database, sql: string, ...binds: unknown[]): Promise<number> {
  const stmt = DB.prepare(sql)
  const r = await (binds.length ? stmt.bind(...binds) : stmt).first<{ n: number }>().catch(() => null)
  return Number(r?.n) || 0
}

/**
 * 어드민 리포트 배달 — 벨 + Discord + (설정 시) 이메일. 전 채널 fail-soft.
 * 반환: 채널별 시도 결과 (로그용).
 */
export async function deliverAdminOpsReport(
  env: Env,
  opts: { type: string; title: string; body: string; link?: string },
): Promise<{ bell: boolean; discord: boolean; email: boolean }> {
  const DB = env.DB
  const out = { bell: false, discord: false, email: false }

  try {
    const { createDashboardNotification } = await import('../../features/notifications/api/dashboard-notifications.routes')
    await createDashboardNotification(DB, 'admin', null, opts.type, opts.title, opts.body, opts.link || '/admin')
    out.bell = true
  } catch { /* fail-soft */ }

  const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
  if (webhook) {
    try {
      const { sendDiscordAlert } = await import('./discord-alert')
      await sendDiscordAlert(webhook, opts.title, opts.body, 'info')
      out.discord = true
    } catch { /* fail-soft */ }
  }

  try {
    const email = await getOpsSetting(DB, 'ops_digest_email')
    if (email) {
      const { sendSystemEmail } = await import('../../lib/system-email')
      const html = `<pre style="font-family:inherit;white-space:pre-wrap;margin:0">${
        opts.body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      }</pre>`
      const r = await sendSystemEmail(env, email, { subject: opts.title, html })
      out.email = !!r?.success
    }
  } catch { /* fail-soft */ }

  return out
}

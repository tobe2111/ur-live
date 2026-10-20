/**
 * 🛡️ 2026-06-09: 어드민 단체메일(bulk email) cron drainer.
 *
 * 배경 (코드리뷰 지적 — HARDEN):
 *   기존 `POST /api/admin/bulk-email` 는 수천 명 수신자를 **요청 안에서** 배치 발송했음.
 *   → (1) Workers CPU/wall(50ms~30s) + subrequest(~50개) 한도 초과 위험
 *   → (2) 요청 재시도 시 per-recipient 멱등성 부재로 **중복 발송** 위험.
 *
 * 해결 (enqueue + cron drain):
 *   - 엔드포인트는 수신자만 즉시 해석해서 `bulk_email_jobs` + `bulk_email_job_recipients`
 *     (row 당 status='pending') 에 적재하고 즉시 반환 (요청 안에서 발송 X).
 *   - 이 cron 이 1~2분마다 호출되어 job 을 조금씩 drain.
 *
 * 멱등성 가드 (중복 발송 차단 — 핵심 수정):
 *   - 수신자 row 는 UNIQUE(job_id, email).
 *   - 발송 직전 `UPDATE ... SET status='sent' WHERE id=? AND status='pending'` (CAS) 로
 *     **선점(claim)** 한다. meta.changes===0 이면 다른 tick 이 이미 처리 → skip.
 *   - 즉, cron 이 재실행되거나 tick 이 중간에 죽어도 같은 수신자에게 두 번 보내지 않는다.
 *   - 발송 자체가 실패하면 'failed' 로 되돌려 표시 (재시도는 하지 않음 — 중복 방지 우선).
 *
 * 배치 사이징 근거:
 *   - tick 당 `RECIPIENTS_PER_TICK`(50) 만 처리 → Workers subrequest(~50) 한도 안에 유지.
 *   - 발송 사이 `SEND_DELAY_MS`(250ms) 로 Resend rate limit 보호하되 tick 은 짧게 유지
 *     (50 * 250ms ≈ 12.5s < 30s wall). 큰 job 은 여러 tick 에 걸쳐 자연 분할 drain.
 *
 * Schedule: scheduled.ts 의 *\/2 * * * * (2분) tick 에서 호출.
 */

import type { Env } from '../types/env'
import { logInfo } from '../utils/logger'
import { swallow } from '../utils/swallow'
import { reportCronFailure } from '../utils/cron-reporter'
import { sendEmail } from '../../services/email'

const RECIPIENTS_PER_TICK = 50 // Workers subrequest 한도(~50) 안에 유지
const SEND_DELAY_MS = 250      // Resend rate limit 보호 (50*250ms ≈ 12.5s < 30s wall)
const MAX_JOBS_PER_TICK = 3    // 한 tick 에서 너무 많은 job 을 건드리지 않음

interface JobRow {
  id: number
  subject: string
  body_html: string
  status: string
  total: number
  sent: number
  failed: number
}

interface RecipientRow {
  id: number
  email: string
}

/**
 * bulk_email_jobs drainer.
 * pending/sending job 을 골라 그 수신자(pending) 를 tick 단위로 발송.
 */
export async function handleBulkEmailDrain(env: Env) {
  if (!env.DB) return
  const DB = env.DB
  try {
    // ── fast-path: 처리할 job 이 없으면 즉시 종료 ──────────────────────────────
    let pendingJobs: { results?: JobRow[] }
    try {
      pendingJobs = await DB.prepare(`
        SELECT id, subject, body_html, status, total, sent, failed
        FROM bulk_email_jobs
        WHERE status IN ('pending','sending')
        ORDER BY id ASC
        LIMIT ?
      `).bind(MAX_JOBS_PER_TICK).all<JobRow>()
    } catch {
      // 테이블 미존재 (repair-schema 미실행) — no-op.
      return
    }
    const jobs = pendingJobs.results ?? []
    if (jobs.length === 0) return

    const apiKey = (env as Env & { RESEND_API_KEY?: string }).RESEND_API_KEY
    const resendFrom = (env as Env & { RESEND_FROM?: string }).RESEND_FROM || '유어딜 <onboarding@resend.dev>'
    if (!apiKey) {
      // 키 없으면 발송 불가 — job 은 그대로 두고(다음에 키 설정되면 drain) 종료.
      if (env.ENVIRONMENT !== 'production') logInfo('[cron:bulk-email-drain] RESEND_API_KEY 미설정 — skip')
      return
    }

    let totalSent = 0
    let totalFailed = 0
    let budget = RECIPIENTS_PER_TICK // tick 전체 subrequest 예산 (job 들이 공유)

    for (const job of jobs) {
      if (budget <= 0) break

      // job 을 'sending' 으로 마킹 (idempotent — 이미 sending 이어도 무해).
      await DB.prepare(
        `UPDATE bulk_email_jobs SET status='sending', updated_at=datetime('now') WHERE id=? AND status IN ('pending','sending')`,
      ).bind(job.id).run().catch(swallow('cron:bulk-email-drain:mark-sending'))

      // 이 job 의 pending 수신자를 예산만큼 가져온다.
      const take = Math.min(budget, RECIPIENTS_PER_TICK)
      const { results: recips } = await DB.prepare(`
        SELECT id, email
        FROM bulk_email_job_recipients
        WHERE job_id = ? AND status = 'pending'
        ORDER BY id ASC
        LIMIT ?
      `).bind(job.id, take).all<RecipientRow>().catch(() => ({ results: [] as RecipientRow[] }))

      if (!recips || recips.length === 0) {
        // pending 이 더 없으면 job 완료 처리.
        await finalizeJobIfDone(DB, job.id)
        continue
      }

      let jobSent = 0
      let jobFailed = 0

      for (let i = 0; i < recips.length; i++) {
        if (budget <= 0) break
        budget--
        const r = recips[i]

        // ── 멱등 선점 (CAS pending→sent) ────────────────────────────────────
        // 발송 *전에* 'sent' 로 claim 한다. 두 tick 이 동시에 같은 row 를 골라도
        // 한쪽만 changes=1 → 한쪽만 실제 발송. tick 이 발송 도중 죽어도
        // 이미 'sent' 라 재실행이 중복 발송하지 않음 (at-most-once).
        const claim = await DB.prepare(
          `UPDATE bulk_email_job_recipients SET status='sent', sent_at=datetime('now') WHERE id=? AND status='pending'`,
        ).bind(r.id).run().catch(() => null)
        if (!claim || claim.meta.changes === 0) {
          // 다른 tick 이 이미 처리 — skip (예산 환급).
          budget++
          continue
        }

        // claim 성공 → 실제 발송. 실패하면 'failed' 로 되돌려 표시.
        try {
          const result = await sendEmail({ to: r.email, subject: job.subject, html: job.body_html }, apiKey, resendFrom, DB)
          if (result.success) {
            jobSent++
            totalSent++
          } else if (result.error === 'suppressed') {
            // 바운스/스팸 목록 — 발송 안 함. 'skipped' 로 표시 (중복 방지엔 무관).
            await DB.prepare(
              `UPDATE bulk_email_job_recipients SET status='skipped', error='suppressed' WHERE id=?`,
            ).bind(r.id).run().catch(swallow('cron:bulk-email-drain:mark-skipped'))
          } else {
            jobFailed++
            totalFailed++
            await DB.prepare(
              `UPDATE bulk_email_job_recipients SET status='failed', error=? WHERE id=?`,
            ).bind((result.error || 'send failed').slice(0, 500), r.id).run().catch(swallow('cron:bulk-email-drain:mark-failed'))
          }
        } catch (sendErr) {
          jobFailed++
          totalFailed++
          await DB.prepare(
            `UPDATE bulk_email_job_recipients SET status='failed', error=? WHERE id=?`,
          ).bind(((sendErr as Error)?.message || 'exception').slice(0, 500), r.id).run().catch(swallow('cron:bulk-email-drain:mark-exc'))
        }

        if (i + 1 < recips.length && SEND_DELAY_MS > 0) {
          await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS))
        }
      }

      // job 카운터 누적 갱신.
      if (jobSent > 0 || jobFailed > 0) {
        await DB.prepare(
          `UPDATE bulk_email_jobs SET sent = sent + ?, failed = failed + ?, updated_at=datetime('now') WHERE id=?`,
        ).bind(jobSent, jobFailed, job.id).run().catch(swallow('cron:bulk-email-drain:update-counts'))
      }

      // 이 job 의 pending 이 모두 소진됐으면 완료 처리.
      await finalizeJobIfDone(DB, job.id)
    }

    if (env.ENVIRONMENT !== 'production' || totalSent > 0 || totalFailed > 0) {
      logInfo(`[cron:bulk-email-drain] sent=${totalSent} failed=${totalFailed} jobs=${jobs.length}`)
    }
  } catch (err) {
    await reportCronFailure(env, 'bulk-email-drain', err, undefined, 'warning')
  }
}

/**
 * job 에 pending 수신자가 더 없으면 'done'(또는 전부 실패면 'failed') 으로 마무리하고
 * 요약을 bulk_email_log 에 1회 기록한다 (멱등 — done/failed 인 job 은 skip).
 */
async function finalizeJobIfDone(DB: D1Database, jobId: number): Promise<void> {
  const remaining = await DB.prepare(
    `SELECT COUNT(*) AS c FROM bulk_email_job_recipients WHERE job_id=? AND status='pending'`,
  ).bind(jobId).first<{ c: number }>().catch(() => null)
  if (!remaining || (remaining.c ?? 0) > 0) return // 아직 남음

  // job 행 로드 (이미 done 이면 멱등 종료).
  const job = await DB.prepare(
    `SELECT id, admin_id, admin_email, filter_json, subject, status, total, sent, failed FROM bulk_email_jobs WHERE id=?`,
  ).bind(jobId).first<{
    id: number; admin_id: string | null; admin_email: string | null; filter_json: string | null
    subject: string; status: string; total: number; sent: number; failed: number
  }>().catch(() => null)
  if (!job) return
  if (job.status === 'done' || job.status === 'failed') return

  // 발송분/실패분 집계 (counts 누락 대비 row 에서 직접 재계산).
  const agg = await DB.prepare(`
    SELECT
      SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent,
      SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
      SUM(CASE WHEN status='skipped' THEN 1 ELSE 0 END) AS skipped
    FROM bulk_email_job_recipients WHERE job_id=?
  `).bind(jobId).first<{ sent: number; failed: number; skipped: number }>().catch(() => null)
  const sent = agg?.sent ?? job.sent
  const failed = agg?.failed ?? job.failed
  const skipped = agg?.skipped ?? 0

  // 전부 실패하고 성공이 0 이면 'failed', 아니면 'done'.
  const finalStatus = sent === 0 && failed > 0 ? 'failed' : 'done'
  const claimed = await DB.prepare(
    `UPDATE bulk_email_jobs SET status=?, sent=?, failed=?, updated_at=datetime('now') WHERE id=? AND status NOT IN ('done','failed')`,
  ).bind(finalStatus, sent, failed, jobId).run().catch(() => null)
  // claim 못 했으면(다른 tick 이 이미 finalize) 로그 중복 방지로 종료.
  if (!claimed || claimed.meta.changes === 0) return

  // 요약 로그 1회 기록 (기존 bulk_email_log 소비자 호환 — 완료 시점에만).
  await DB.prepare(`
    INSERT INTO bulk_email_log
      (admin_id, admin_email, filter_json, subject, recipient_count, sent_count, failed_count, skipped_count, is_test)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).bind(
    job.admin_id,
    job.admin_email,
    (job.filter_json || '').slice(0, 1000),
    (job.subject || '').slice(0, 200),
    job.total,
    sent,
    failed,
    skipped,
  ).run().catch(swallow('cron:bulk-email-drain:summary-log'))
}

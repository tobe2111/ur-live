import { logInfo, logError } from '../utils/logger'
import { swallow } from '../utils/swallow'
/**
 * 🛡️ 2026-05-07: 알림톡 발송 실패 자동 재시도 cron.
 *
 * 5분 주기로 alimtalk_failures 테이블에서 미해결 항목 재시도 (max 3회).
 * 정산/주문/선물 등 critical 알림이 silent fail 되어 사용자에게 안 가는 사고 방지.
 *
 * Schedule: 5분마다 (Star/5 Star Star Star Star)
 */
import type { Env } from '../types/env'
import { reportCronFailure } from '../utils/cron-reporter'
import { sendSensAlimtalk, sensConfigured, type SensEnv } from '../../lib/ncp-sens'

interface FailureRow {
  id: number
  phone: string
  template_code: string
  message: string
  retry_count: number
  max_retries: number
}

export async function handleRetryAlimtalk(env: Env) {
  if (!env.DB) return
  try {
    // ✅ PERF: 빈 테이블 fast-path — COUNT 한 번만 (대부분 0)
    try {
      // 📉 2026-09-02: COUNT(*) 는 답이 0 이어도 테이블을 끝까지 읽는다(5분마다 = 288회/일). 존재 여부만 물으면
      //   첫 매치에서 멈춘다(+ `idx_alimtalk_failures_retry` 가 그 첫 매치를 인덱스로 찾는다).
      const any = await env.DB.prepare(`
        SELECT 1 AS c FROM alimtalk_failures
        WHERE resolved = 0 AND retry_count < max_retries AND next_retry_at <= datetime('now') LIMIT 1
      `).first<{ c: number }>()
      if (!any) return
    } catch {
      // 테이블 없거나 COUNT 실패 — 기존 SELECT 로 진행
    }

    // 재시도 가능한 실패만 (next_retry_at 이미 지났고 max 미달)
    const { results } = await env.DB.prepare(`
      SELECT id, phone, template_code, message, retry_count, max_retries
      FROM alimtalk_failures
      WHERE resolved = 0
        AND retry_count < max_retries
        AND next_retry_at <= datetime('now')
      ORDER BY id ASC LIMIT 50
    `).all<FailureRow>().catch(() => ({ results: [] as FailureRow[] }))

    if (!results || results.length === 0) return

    // 📨 2026-10-12 — 재발송도 네이버 클라우드 SENS. 키가 없으면 재시도 횟수를 태우지 않고 다음으로 미룬다.
    if (!sensConfigured(env as unknown as Record<string, unknown>)) return

    let retried = 0
    let succeeded = 0
    for (const row of results) {
      retried++
      try {
        // 기록 코드가 `alimtalk:<이름>` 형태면 이름만 — SENS 템플릿 코드 = 우리 이름.
        const templateCode = row.template_code.replace(/^(alimtalk|pending):/, '')
        const result = await sendSensAlimtalk(env as unknown as SensEnv, { templateCode, to: row.phone, content: row.message })
        if (result.success) {
          succeeded++
          await env.DB.prepare(`
            UPDATE alimtalk_failures
            SET resolved = 1, retry_count = retry_count + 1, updated_at = datetime('now')
            WHERE id = ?
          `).bind(row.id).run()
        } else {
          // 재시도 실패 — 다음 시도 시간 exponential backoff (5분 → 30분 → 2시간)
          const nextDelayMin = Math.pow(6, row.retry_count + 1) * 5 // 30/180/1080
          await env.DB.prepare(`
            UPDATE alimtalk_failures
            SET retry_count = retry_count + 1,
                next_retry_at = datetime('now', '+' || ? || ' minutes'),
                error = ?,
                updated_at = datetime('now')
            WHERE id = ?
          `).bind(nextDelayMin, result.error?.slice(0, 500) || 'retry failed', row.id).run()
        }
      } catch (sendErr) {
        await env.DB.prepare(`
          UPDATE alimtalk_failures
          SET retry_count = retry_count + 1,
              error = ?,
              updated_at = datetime('now')
          WHERE id = ?
        `).bind((sendErr as Error).message?.slice(0, 500) || 'exception', row.id).run().catch(swallow('cron:retry-alimtalk:mark-error'))
      }
    }

    if (env.ENVIRONMENT !== 'production' || retried > 0) {
      logInfo(`[cron:retry-alimtalk] retried=${retried} succeeded=${succeeded}`)
    }
  } catch (err) {
    await reportCronFailure(env, 'retry-alimtalk', err, undefined, 'warning')
  }
}

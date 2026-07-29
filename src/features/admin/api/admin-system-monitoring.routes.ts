/**
 * 🛡️ 2026-05-07: 시스템 운영 모니터링 (admin 전용).
 *
 * - GET /api/admin/cron-heartbeats    — cron 마지막 실행 시각(오래된 순) — '안 돌았다' 탐지
 * - GET /api/admin/cron-failures      — Cron job 실패 목록 + 미해결 카운트
 * - PATCH /api/admin/cron-failures/:id/resolve  — 실패 해결 처리
 * - GET /api/admin/alimtalk-failures  — 알림톡 발송 실패 목록 + retry 상태
 * - POST /api/admin/alimtalk-failures/:id/retry — 즉시 재시도
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { getCronHealth, listCronHeartbeats } from '@/worker/utils/cron-heartbeat'
import type { Env } from '@/worker/types/env'
import { isDocumentedRegistered } from '@/lib/alimtalk-templates'

export const adminSystemMonitoringRoutes = new Hono<{ Bindings: Env }>()

// ── GET /cron-failures ──────────────────────────────────────────
adminSystemMonitoringRoutes.get('/cron-failures', async (c) => {
  const { DB } = c.env
  const resolved = c.req.query('resolved') === '1'
  try {
    const { results } = await DB.prepare(`
      SELECT id, job_name, error_message, severity, resolved, created_at
      FROM cron_failures
      WHERE resolved = ?
      ORDER BY created_at DESC LIMIT 100
    `).bind(resolved ? 1 : 0).all()

    const counts = await DB.prepare(`
      SELECT severity, COUNT(*) as cnt FROM cron_failures
      WHERE resolved = 0 GROUP BY severity
    `).all<{ severity: string; cnt: number }>().catch(() => ({ results: [] }))

    return c.json({
      success: true,
      data: {
        items: results || [],
        unresolved_counts: counts.results || [],
      },
    })
  } catch {
    // 테이블 없으면 빈 결과
    return c.json({ success: true, data: { items: [], unresolved_counts: [] } })
  }
})

// ── GET /cron-heartbeats ────────────────────────────────────────
// 💓 2026-07-28: cron_failures 는 **예외가 났을 때만** 남는다. 예외 없이 멈춘 경우
//   (미발화 / 게이트 OFF / 내부 .catch 로 삼킴)는 여기서만 보인다 — 오래된 순 정렬이라
//   맨 위가 곧 '멈췄을 가능성이 가장 높은 작업'이다. 상세 배경: worker/utils/cron-heartbeat.ts
adminSystemMonitoringRoutes.get('/cron-heartbeats', async (c) => {
  const items = await listCronHeartbeats(c.env.DB)
  // 하루 넘게 기록이 없으면 눈에 띄게(대부분 cron 이 일 1회 이상이다 — 주간/월간 작업은 오탐이므로
  // 화면에서 사람이 판단하도록 표시만 하고 서버는 단정하지 않는다).
  const stale = items.filter(i => (i.age_minutes ?? 0) > 60 * 24).map(i => i.name)
  return c.json({ success: true, data: { items, stale, count: items.length } })
})

adminSystemMonitoringRoutes.patch('/cron-failures/:id/resolve', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  try {
    await DB.prepare(`UPDATE cron_failures SET resolved = 1 WHERE id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

// ── GET /alimtalk-failures ──────────────────────────────────────
adminSystemMonitoringRoutes.get('/alimtalk-failures', async (c) => {
  const { DB } = c.env
  const resolved = c.req.query('resolved') === '1'
  try {
    const { results } = await DB.prepare(`
      SELECT id, phone, template_code, message, error, retry_count, max_retries,
             next_retry_at, resolved, created_at, updated_at
      FROM alimtalk_failures
      WHERE resolved = ?
      ORDER BY created_at DESC LIMIT 100
    `).bind(resolved ? 1 : 0).all()

    const stats = await DB.prepare(`
      SELECT
        COUNT(*) FILTER (WHERE resolved = 0 AND retry_count >= max_retries) AS abandoned,
        COUNT(*) FILTER (WHERE resolved = 0 AND retry_count < max_retries) AS pending,
        COUNT(*) FILTER (WHERE resolved = 1) AS succeeded
      FROM alimtalk_failures
      WHERE created_at >= datetime('now', '-7 days')
    `).first<{ abandoned: number; pending: number; succeeded: number }>().catch(() => null)

    // 🔔 2026-07-01: 진단 — 미해결 실패를 template_code 별로 그룹핑 + 저장소 등록 여부 주석.
    //   registered:false 가 반복 실패하면 = Aligo 콘솔에 미등록/불일치 템플릿(운영자가 등록해야 함).
    //   (SMS 폴백이 없어 그동안 해당 알림톡은 전달 0 — 인앱/푸시로만 도달.)
    let byTemplate: Array<{ template_code: string; unresolved: number; abandoned: number; registered: boolean; last_error: string | null }> = []
    try {
      const { results: grp } = await DB.prepare(`
        SELECT template_code,
               COUNT(*) AS unresolved,
               SUM(CASE WHEN retry_count >= max_retries THEN 1 ELSE 0 END) AS abandoned,
               MAX(error) AS last_error
        FROM alimtalk_failures
        WHERE resolved = 0
        GROUP BY template_code
        ORDER BY unresolved DESC
      `).all<{ template_code: string; unresolved: number; abandoned: number; last_error: string | null }>()
      byTemplate = (grp || []).map(r => ({
        template_code: r.template_code,
        unresolved: Number(r.unresolved || 0),
        abandoned: Number(r.abandoned || 0),
        registered: isDocumentedRegistered(r.template_code),
        last_error: r.last_error ?? null,
      }))
    } catch { /* 그룹 쿼리 실패 — by_template 생략 */ }

    return c.json({
      success: true,
      data: {
        items: results || [],
        stats: stats ?? { abandoned: 0, pending: 0, succeeded: 0 },
        by_template: byTemplate,
      },
    })
  } catch {
    return c.json({ success: true, data: { items: [], stats: { abandoned: 0, pending: 0, succeeded: 0 } } })
  }
})

// ── GET /delivery-failures ──────────────────────────────────────
// 🔔 2026-07-01: push_failures / email_failures dead-letter 가시성.
//   재시도 크론(retry-notifications, 5분)은 있었지만 어드민이 볼 UI/API 가 0 이라
//   웹푸시·이메일 실패 누적이 아무 데도 안 보였음. 알림톡 진단과 동형으로 노출.
adminSystemMonitoringRoutes.get('/delivery-failures', async (c) => {
  const { DB } = c.env
  const resolved = c.req.query('resolved') === '1'
  const empty = { items: [], stats: { abandoned: 0, pending: 0, succeeded: 0 } }
  const statsSql = (table: string) => `
    SELECT
      COUNT(*) FILTER (WHERE resolved = 0 AND retry_count >= max_retries) AS abandoned,
      COUNT(*) FILTER (WHERE resolved = 0 AND retry_count < max_retries) AS pending,
      COUNT(*) FILTER (WHERE resolved = 1) AS succeeded
    FROM ${table}
    WHERE created_at >= datetime('now', '-7 days')
  `
  try {
    const push = await (async () => {
      try {
        const { results } = await DB.prepare(`
          SELECT id, user_type, user_id, title, body, url, subscription_count,
                 retry_count, max_retries, next_retry_at, resolved, created_at
          FROM push_failures WHERE resolved = ?
          ORDER BY created_at DESC LIMIT 100
        `).bind(resolved ? 1 : 0).all()
        const stats = await DB.prepare(statsSql('push_failures'))
          .first<{ abandoned: number; pending: number; succeeded: number }>().catch(() => null)
        return { items: results || [], stats: stats ?? empty.stats }
      } catch { return empty } // 테이블 미존재 — 빈 결과
    })()
    const email = await (async () => {
      try {
        const { results } = await DB.prepare(`
          SELECT id, recipient, subject, error, retry_count, max_retries,
                 next_retry_at, resolved, created_at
          FROM email_failures WHERE resolved = ?
          ORDER BY created_at DESC LIMIT 100
        `).bind(resolved ? 1 : 0).all()
        const stats = await DB.prepare(statsSql('email_failures'))
          .first<{ abandoned: number; pending: number; succeeded: number }>().catch(() => null)
        return { items: results || [], stats: stats ?? empty.stats }
      } catch { return empty }
    })()
    return c.json({ success: true, data: { push, email } })
  } catch {
    return c.json({ success: true, data: { push: empty, email: empty } })
  }
})

// 즉시 재시도 — next_retry_at 을 지금으로 당겨 다음 5분 크론이 집어가게 (알림톡 retry 와 동형)
adminSystemMonitoringRoutes.post('/delivery-failures/:kind/:id/retry', async (c) => {
  const { DB } = c.env
  const kind = c.req.param('kind')
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  if (kind !== 'push' && kind !== 'email') return c.json({ success: false, error: 'invalid kind' }, 400)
  const table = kind === 'push' ? 'push_failures' : 'email_failures'
  try {
    await DB.prepare(`
      UPDATE ${table}
      SET next_retry_at = datetime('now'), retry_count = MIN(retry_count, max_retries - 1)
      WHERE id = ? AND resolved = 0
    `).bind(id).run()
    return c.json({ success: true, message: '5분 이내 자동 재시도됩니다' })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

adminSystemMonitoringRoutes.post('/alimtalk-failures/:id/retry', async (c) => {
  const { DB } = c.env
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'invalid id' }, 400)
  try {
    // next_retry_at 을 즉시로 변경 → 다음 cron tick (5분 이내) 에서 자동 retry
    await DB.prepare(`
      UPDATE alimtalk_failures
      SET next_retry_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ? AND resolved = 0
    `).bind(id).run()
    return c.json({ success: true, message: '5분 이내 자동 재시도됩니다' })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

// ── 🚦 2026-07-05: 운영 게이트 플래그 현황판 + cron heartbeat ──────────────
//   배경(1인 운영 관측 보강): 검증 대기 게이트(커미션 예산/쇼핑 원장/fee-resolver 등)가
//   env·platform_settings 에 흩어져 있어 "뭐가 켜져 있고 뭐가 staging 미검증인지" 볼 곳이 없었음.
//   staging 검증 전 실수 활성화 방지 + cron 침묵을 어드민에서 한눈에.
//   게이트 자체의 SSOT 는 각 소비처(코드) — 여기는 *열람 전용 레지스트리* (값 변경 없음).
//   staging 시나리오 상세: docs/STAGING_CHECKLIST.md

interface OpsGate {
  key: string
  kind: 'env' | 'setting'
  label: string
  default_value: string
  /** docs/STAGING_CHECKLIST.md 의 항목 ID — null 이면 staging 실결제 검증 불필요 */
  staging_ref: string | null
}

const OPS_GATES: OpsGate[] = [
  { key: 'commission_budget_enabled', kind: 'setting', label: '커미션 예산 아비터 [INV-CB]', default_value: 'false', staging_ref: 'S1' },
  { key: 'promo_funding_source', kind: 'setting', label: '프로모 owner-펀딩', default_value: 'platform', staging_ref: 'S2' },
  { key: 'SHOPPING_LEDGER_ENABLED', kind: 'env', label: '쇼핑 주문 원장 크레딧', default_value: 'false', staging_ref: 'S3' },
  { key: 'FEE_RESOLVER_ENABLED', kind: 'env', label: 'fee-resolver 그림자 기록', default_value: 'false', staging_ref: 'S4' },
  { key: 'BLOG_AI_DRAFTS_ENABLED', kind: 'env', label: '블로그 AI 초안 주간 cron', default_value: 'false', staging_ref: null },
  { key: 'ADS_AUTOBID_ENABLED', kind: 'env', label: '유어애즈 자동입찰', default_value: 'false', staging_ref: null },
  { key: 'wholesale_auto_grade_enabled', kind: 'setting', label: '도매 등급 자동평가', default_value: '0', staging_ref: null },
]

adminSystemMonitoringRoutes.get('/ops-status', async (c) => {
  const { DB } = c.env
  try {
    // platform_settings 게이트 값
    const settingKeys = OPS_GATES.filter(g => g.kind === 'setting').map(g => g.key)
    const settingRows = await DB.prepare(
      `SELECT key, value FROM platform_settings WHERE key IN (${settingKeys.map(() => '?').join(',')})`,
    ).bind(...settingKeys).all<{ key: string; value: string }>().catch(() => ({ results: [] as Array<{ key: string; value: string }> }))
    const settingMap = new Map((settingRows.results || []).map(r => [r.key, r.value]))

    const envRecord = c.env as unknown as Record<string, unknown>
    const gates = OPS_GATES.map(g => {
      const raw = g.kind === 'env' ? envRecord[g.key] : settingMap.get(g.key)
      const value = raw === undefined || raw === null ? null : String(raw)
      return {
        ...g,
        value,
        // 미설정(null)은 기본값과 동일 취급 — "기본값에서 벗어남" = 활성 배지 대상
        is_default: value === null || value === g.default_value,
      }
    })

    // cron heartbeat 전체 + 핵심 stale 판정
    const health = await getCronHealth(DB)
    // 🫀 하트비트 저장소는 `platform_settings.cron_hb:*` 다(별도 테이블 아님 —
    //   이 레포는 D1 마이그레이션이 CI 에서 안 돌아 새 테이블은 생성 보장이 없다).
    //   OpsStatusTab 이 기대하는 모양으로만 변환한다. run_count 는 저장하지 않으므로 null.
    const beats = await listCronHeartbeats(DB)
    const hb = {
      results: beats.map(b => ({
        cron_name: b.name,
        last_status: b.ok === null ? 'unknown' : b.ok ? 'ok' : 'fail',
        last_finished_at: b.at,
        last_duration_ms: b.ms,
        last_error: null as string | null,
        run_count: null as number | null,
      })),
    }

    return c.json({
      success: true,
      data: {
        gates,
        cron_health: health,
        heartbeats: hb.results || [],
        checklist_doc: 'docs/STAGING_CHECKLIST.md',
      },
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

/**
 * 🛡️ 2026-05-23 Frontend 에러 수집 endpoint.
 *
 * POST /api/_errors/log  — sendBeacon 또는 fetch
 *   body: { message, stack?, url, type, user_id?, user_agent }
 *   응답: 204 (No Content) — telemetry 자체가 에러내면 안 됨, 모두 silent OK
 *
 * GET /api/_errors/recent?hours=1  — 어드민만 (최근 에러 목록)
 *
 * D1 테이블: frontend_errors (repair-schema 에서 ensure)
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { rateLimit } from '../middleware/rate-limit'
import { requireAdmin } from '../middleware/auth'
import { intParam } from '@/shared/pagination'

export const errorTelemetryRoutes = new Hono<{ Bindings: Env }>()

// 🔒 2026-06-12 (4차 감사 D6): intake rate limit 60회/60초/IP — 에러 루프/봇이 D1 에
//   무한 INSERT 하는 것 차단. fail-open(비인증 action) — rate-limit 저장소 장애가 telemetry 를 안 막음.
//   429 응답은 sendBeacon/fire-and-forget 클라이언트에 무해 (응답 미사용).
errorTelemetryRoutes.use('/api/_errors/log', rateLimit({ action: 'error-telemetry', max: 60, windowSec: 60 }))

interface ErrorPayload {
  message?: string
  stack?: string
  url?: string
  type?: string
  user_id?: string | null
  user_agent?: string
}

errorTelemetryRoutes.post('/api/_errors/log', async (c) => {
  try {
    const body = await c.req.json<ErrorPayload>().catch(() => ({} as ErrorPayload))
    const message = String(body.message || '').slice(0, 500)
    if (!message) return c.body(null, 204)

    const stack = body.stack ? String(body.stack).slice(0, 2000) : null
    const url = String(body.url || '').slice(0, 300)
    const type = String(body.type || 'unknown').slice(0, 30)
    const userId = body.user_id ? String(body.user_id).slice(0, 50) : null
    const ua = String(body.user_agent || c.req.header('user-agent') || '').slice(0, 200)
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || ''

    // best-effort INSERT — 테이블 없으면 silent ignore.
    try {
      await c.env.DB.prepare(
        `INSERT INTO frontend_errors (message, stack, url, type, user_id, user_agent, ip, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      ).bind(message, stack, url, type, userId, ua, ip.slice(0, 64)).run()
    } catch (e) {
      // 테이블 없으면 console.log 만 (Cloudflare logs 에서 보임)
      console.error('[frontend_errors] INSERT failed:', (e as Error).message, '| msg:', message)
    }

    return c.body(null, 204)
  } catch {
    // 절대 throw 안 함 — telemetry 가 클라이언트에 에러 주면 안 됨.
    return c.body(null, 204)
  }
})

// 어드민만 — 표준 미들웨어 사용. (이전 수제 JWT 검증은 `payload.role==='admin'`/`user_type==='admin'`
// 클레임을 기대했는데, 실제 어드민 토큰은 `type:'admin'` + `role:'super'|'super_admin'|…`(서브롤)이라
// 정상 어드민도 항상 403 — /admin/errors 대시보드가 로드 불가였음.)
errorTelemetryRoutes.get('/api/_errors/recent', requireAdmin(), async (c) => {
  const hours = Math.min(Math.max(1, Number(c.req.query('hours') || '1')), 168)
  const limit = Math.min(Math.max(1, intParam(c.req.query('limit'), 100)), 1000)

  // 🔎 2026-08-01 (대표 "/admin/errors 에러들 직접 보고 자가 수리"): `user_agent` 를 **저장은 하는데
  //   여기서 안 돌려주고 있었다**(POST 는 200자까지 저장 중). 그래서 어떤 브라우저/인앱웹뷰에서 나는
  //   에러인지 화면에서 알 수 없었고, boot-stuck 같은 부팅 실패는 UA 없이는 사실상 분류가 불가능하다.
  //   `stack` 도 같은 이유로 추가(있으면 원인 파일이 바로 보인다).
  //   ⚠️ `ip` 는 일부러 뺀다 — 트리아지에 필요 없고 PII 노출만 늘린다.
  try {
    const rows = await c.env.DB.prepare(
      `SELECT id, message, type, url, user_id, user_agent, stack, created_at
       FROM frontend_errors
       WHERE created_at > datetime('now', '-${hours} hours')
       ORDER BY created_at DESC
       LIMIT ?`,
    ).bind(limit).all<{
      id: number; message: string; type: string; url: string
      user_id: string; user_agent: string | null; stack: string | null; created_at: string
    }>()
    return c.json({ success: true, data: rows.results || [] })
  } catch (e) {
    // 컬럼/테이블이 없는 옛 환경 폴백 — 진단 화면이 통째로 죽는 것보다 낫다.
    try {
      const rows = await c.env.DB.prepare(
        `SELECT id, message, type, url, user_id, created_at
         FROM frontend_errors
         WHERE created_at > datetime('now', '-${hours} hours')
         ORDER BY created_at DESC
         LIMIT ?`,
      ).bind(limit).all()
      return c.json({ success: true, data: rows.results || [], degraded: 'user_agent/stack 컬럼 없음' })
    } catch {
      // ⚠️ 원문 메시지를 클라이언트로 돌려주지 않는다(CLAUDE.md 안전 에러 룰).
      console.error('[frontend_errors] recent 조회 실패:', (e as Error).message)
      return c.json({ success: false, error: '에러 목록을 불러오지 못했습니다', code: 'TABLE_MISSING_PROBABLY' }, 500)
    }
  }
})

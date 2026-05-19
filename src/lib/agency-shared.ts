/**
 * 🛡️ 2026-04-28: Agency 공통 helper — 분할된 5개 라우터 (kakao-link, stats, settlements, ops, sellers)
 *   에서 자체 정의했던 verifyAgencyToken / getToken / requireAgency / ensureAgencyTables 통합.
 *
 * 이 파일을 import 하면 코드 중복 ~70줄/파일 제거 가능.
 *
 * NOTE: agency.routes.ts (메인) 와 동일한 토큰 spec 유지 — payload.type === 'agency' + sub.
 */
import { verify } from 'hono/jwt'
import type { Context, Next } from 'hono'
import type { Env } from '@/worker/types/env'
import { swallow } from '@/worker/utils/swallow'

export type AgencyPayload = { id: number; email: string }
export type AgencyVars = { agency: AgencyPayload }
export type AgencyCtx = Context<{ Bindings: Env; Variables: AgencyVars }>

export async function verifyAgencyToken(secret: string, token: string): Promise<AgencyPayload | null> {
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>
    if (payload.type !== 'agency' || !payload.sub) return null
    return { id: Number(payload.sub), email: String(payload.email) }
  } catch {
    return null
  }
}

export function getBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

/**
 * Agency 인증 미들웨어. Bearer 우선, agency 세션 쿠키 fallback.
 * 인증 실패 시 401 응답. 성공 시 c.set('agency', payload) 후 next().
 */
export const requireAgency = async (c: AgencyCtx, next: Next) => {
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getBearerToken(c.req.header('Authorization')) ?? '')
  if (!payload) {
    try {
      const { parseSessionCookie } = await import('../worker/utils/session')
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency'])
      if (sess && sess.userId) payload = { id: Number(sess.userId), email: sess.email || '' }
    } catch { /* fall-through */ }
  }
  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  c.set('agency', payload)
  return next()
}

let _agencyTablesEnsured = false
export async function ensureAgencyTables(DB: D1Database): Promise<void> {
  if (_done_ensureAgencyTables) return
  _done_ensureAgencyTables = true
  if (_agencyTablesEnsured) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agencies (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, email TEXT)`).run().catch(swallow('agency-shared'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS agency_sellers (id INTEGER PRIMARY KEY AUTOINCREMENT, agency_id INTEGER NOT NULL, seller_id INTEGER NOT NULL, UNIQUE(agency_id, seller_id))`).run().catch(swallow('agency-shared'))
  _agencyTablesEnsured = true
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureAgencyTables = false

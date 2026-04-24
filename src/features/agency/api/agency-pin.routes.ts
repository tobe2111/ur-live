/**
 * Agency PIN — 에이전시 민감 액션 추가 인증 (셀러 PIN 과 동일 패턴)
 *
 * 엔드포인트:
 *   POST /set-pin
 *   POST /verify-pin   → ur_agency_pin_verified cookie (15min)
 *   POST /request-kakao-stepup → ur_agency_pin_verified cookie (15min, 카카오 재인증 경로)
 *   GET  /pin-status
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify as verifyJwt, sign as signJwt } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import { hashPassword, verifyPassword } from '@/lib/password'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { ALLOWED_ORIGINS } from '@/shared/constants'

type Bindings = { DB: D1Database; JWT_SECRET: string }

export const agencyPinRoutes = new Hono<{ Bindings: Bindings }>()
agencyPinRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

async function getAgencyId(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const payload = await verifyJwt(authorization.substring(7), jwtSecret, 'HS256') as JWTPayload
    if ((payload as Record<string, unknown>).type !== 'agency') return null
    const raw = (payload as Record<string, unknown>).agency_id ?? (payload as Record<string, unknown>).sub
    const id = Number(raw)
    return Number.isFinite(id) ? id : null
  } catch { return null }
}

let _agencyPinColumnEnsured = false
async function ensurePinColumn(DB: D1Database) {
  if (_agencyPinColumnEnsured) return
  try { await DB.prepare('ALTER TABLE agencies ADD COLUMN pin_hash TEXT').run() } catch { /* exists */ }
  _agencyPinColumnEnsured = true
}

agencyPinRoutes.post('/set-pin', rateLimit({ action: 'agency_set_pin', max: 5, windowSec: 300 }), async (c) => {
  const agencyId = await getAgencyId(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!agencyId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensurePinColumn(c.env.DB)

  const { current_password, pin } = await c.req.json<{ current_password?: string; pin: string }>()
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return c.json({ success: false, error: 'PIN은 4~6자리 숫자여야 합니다' }, 400)
  }

  const agency = await c.env.DB.prepare(
    'SELECT password_hash, linked_user_id FROM agencies WHERE id = ?'
  ).bind(agencyId).first<{ password_hash: string; linked_user_id: number | null }>()
  if (!agency) return c.json({ success: false, error: '에이전시를 찾을 수 없습니다' }, 404)

  if (!agency.linked_user_id) {
    if (!current_password) return c.json({ success: false, error: '현재 비밀번호를 입력해주세요' }, 400)
    const ok = await verifyPassword(current_password, agency.password_hash)
    if (!ok) return c.json({ success: false, error: '현재 비밀번호가 틀렸습니다' }, 401)
  }

  const pinHash = await hashPassword(pin)
  await c.env.DB.prepare(
    "UPDATE agencies SET pin_hash = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(pinHash, agencyId).run()

  return c.json({ success: true, message: 'PIN이 설정되었습니다' })
})

agencyPinRoutes.post('/verify-pin', rateLimit({ action: 'agency_verify_pin', max: 10, windowSec: 300 }), async (c) => {
  const agencyId = await getAgencyId(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!agencyId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensurePinColumn(c.env.DB)

  const { pin } = await c.req.json<{ pin: string }>()
  if (!pin) return c.json({ success: false, error: 'PIN을 입력해주세요' }, 400)

  const row = await c.env.DB.prepare(
    'SELECT pin_hash FROM agencies WHERE id = ?'
  ).bind(agencyId).first<{ pin_hash: string | null }>()
  if (!row?.pin_hash) {
    return c.json({ success: false, error: 'PIN이 설정되지 않았습니다', code: 'PIN_NOT_SET' }, 412)
  }

  const ok = await verifyPassword(pin, row.pin_hash)
  if (!ok) return c.json({ success: false, error: 'PIN이 틀렸습니다' }, 401)

  const token = await signJwt({
    sub: String(agencyId),
    agency_id: agencyId,
    purpose: 'agency_pin_verified',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  }, c.env.JWT_SECRET)

  c.header('Set-Cookie', `ur_agency_pin_verified=${token}; Path=/; Max-Age=900; SameSite=Lax; Secure; HttpOnly`)
  return c.json({ success: true, message: 'PIN 확인 완료. 15분간 사용 가능.' })
})

// ── POST /request-kakao-stepup — 카카오 세션 기반 재인증 ──
agencyPinRoutes.post('/request-kakao-stepup', rateLimit({ action: 'agency_kakao_stepup', max: 10, windowSec: 300 }), async (c) => {
  const agencyId = await getAgencyId(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!agencyId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  const { parseSessionCookie } = await import('../../../worker/utils/session')
  const sessionUser = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET)
  if (!sessionUser) {
    return c.json({ success: false, error: '카카오 로그인이 필요합니다.' }, 401)
  }

  const agency = await c.env.DB.prepare(
    'SELECT linked_user_id FROM agencies WHERE id = ?'
  ).bind(agencyId).first<{ linked_user_id: number | null }>()
  if (!agency?.linked_user_id) {
    return c.json({ success: false, error: '이 에이전시는 카카오 연동이 되어있지 않습니다.', code: 'NOT_LINKED' }, 412)
  }
  if (Number(agency.linked_user_id) !== Number(sessionUser.userId)) {
    return c.json({ success: false, error: '연결된 카카오 계정과 현재 세션이 일치하지 않습니다.' }, 403)
  }

  const token = await signJwt({
    sub: String(agencyId),
    agency_id: agencyId,
    purpose: 'agency_pin_verified', // 에이전시 전용 stepup 은 pin_verified 와 동일 쿠키 경로로
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900,
  }, c.env.JWT_SECRET)

  c.header('Set-Cookie', `ur_agency_pin_verified=${token}; Path=/; Max-Age=900; SameSite=Lax; Secure; HttpOnly`)
  return c.json({ success: true, message: '카카오 재인증 완료. 15분간 민감 액션 사용 가능.' })
})

agencyPinRoutes.get('/pin-status', async (c) => {
  const agencyId = await getAgencyId(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!agencyId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensurePinColumn(c.env.DB)
  const row = await c.env.DB.prepare('SELECT pin_hash FROM agencies WHERE id = ?').bind(agencyId).first<{ pin_hash: string | null }>()
  return c.json({ success: true, data: { pin_set: !!row?.pin_hash } })
})

export async function isAgencyPinVerified(cookieHeader: string | undefined, agencyId: number, jwtSecret: string): Promise<boolean> {
  if (!cookieHeader) return false
  const match = /(?:^|;\s*)ur_agency_pin_verified=([^;]+)/.exec(cookieHeader)
  if (!match) return false
  try {
    const payload = await verifyJwt(match[1], jwtSecret, 'HS256') as JWTPayload
    const p = payload as Record<string, unknown>
    return p.purpose === 'agency_pin_verified' && Number(p.agency_id) === agencyId
  } catch { return false }
}

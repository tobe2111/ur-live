/**
 * Seller PIN (보안 PIN) — 민감 액션 추가 인증
 *
 * 용도:
 *   - 정산 요청 (/api/seller/settlements POST)
 *   - 계좌 정보 변경
 *   - 대량 상품 삭제
 *
 * 구조:
 *   - sellers.pin_hash: 4~6자리 숫자 PIN 의 bcrypt 해시
 *   - 한 번 인증하면 15분 유효한 "pin_verified" 쿠키 발급 (http-only)
 *   - 민감 엔드포인트는 cookie 유무 체크
 *
 * 보안:
 *   - PIN 은 해시 저장 (bcrypt)
 *   - 실패 5회면 15분 잠금 (rate limit 로 대체)
 *   - PIN 설정 시 기존 비밀번호 or 카카오 재인증 필요 (나중에 강화)
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verify as verifyJwt, sign as signJwt } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import { hashPassword, verifyPassword } from '@/lib/password'
import { rateLimit } from '@/worker/middleware/rate-limit'

type Bindings = { DB: D1Database; JWT_SECRET: string }

export const sellerPinRoutes = new Hono<{ Bindings: Bindings }>()
sellerPinRoutes.use('*', cors({ origin: '*', credentials: true }))

async function getSellerId(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const payload = await verifyJwt(authorization.substring(7), jwtSecret, 'HS256') as JWTPayload
    if ((payload as Record<string, unknown>).type !== 'seller') return null
    const raw = (payload as Record<string, unknown>).seller_id ?? (payload as Record<string, unknown>).sub
    const id = Number(raw)
    return Number.isFinite(id) ? id : null
  } catch { return null }
}

async function ensurePinColumn(DB: D1Database) {
  try { await DB.prepare('ALTER TABLE sellers ADD COLUMN pin_hash TEXT').run() } catch { /* exists */ }
}

// ── POST /set-pin — PIN 설정 (기존 비밀번호 확인) ──
sellerPinRoutes.post('/set-pin', rateLimit({ action: 'seller_set_pin', max: 5, windowSec: 300 }), async (c) => {
  const sellerId = await getSellerId(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  await ensurePinColumn(c.env.DB)

  const { current_password, pin } = await c.req.json<{ current_password?: string; pin: string }>()
  if (!pin || !/^\d{4,6}$/.test(pin)) {
    return c.json({ success: false, error: 'PIN은 4~6자리 숫자여야 합니다' }, 400)
  }

  // 기존 비밀번호 확인 (카카오 전용 셀러는 skip — linked_user_id 있으면)
  const seller = await c.env.DB.prepare(
    'SELECT password_hash, linked_user_id FROM sellers WHERE id = ?'
  ).bind(sellerId).first<{ password_hash: string; linked_user_id: number | null }>()
  if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404)

  // 비밀번호 있는 셀러는 current_password 필수
  if (!seller.linked_user_id) {
    if (!current_password) {
      return c.json({ success: false, error: '현재 비밀번호를 입력해주세요' }, 400)
    }
    const ok = await verifyPassword(current_password, seller.password_hash)
    if (!ok) return c.json({ success: false, error: '현재 비밀번호가 틀렸습니다' }, 401)
  }

  const pinHash = await hashPassword(pin)
  await c.env.DB.prepare(
    "UPDATE sellers SET pin_hash = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(pinHash, sellerId).run()

  return c.json({ success: true, message: 'PIN이 설정되었습니다' })
})

// ── POST /verify-pin — PIN 검증 + 15분 세션 쿠키 발급 ──
sellerPinRoutes.post('/verify-pin', rateLimit({ action: 'seller_verify_pin', max: 10, windowSec: 300 }), async (c) => {
  const sellerId = await getSellerId(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

  await ensurePinColumn(c.env.DB)

  const { pin } = await c.req.json<{ pin: string }>()
  if (!pin) return c.json({ success: false, error: 'PIN을 입력해주세요' }, 400)

  const seller = await c.env.DB.prepare(
    'SELECT pin_hash FROM sellers WHERE id = ?'
  ).bind(sellerId).first<{ pin_hash: string | null }>()
  if (!seller?.pin_hash) {
    return c.json({ success: false, error: 'PIN이 설정되지 않았습니다. 먼저 PIN을 설정해주세요.', code: 'PIN_NOT_SET' }, 412)
  }

  const ok = await verifyPassword(pin, seller.pin_hash)
  if (!ok) return c.json({ success: false, error: 'PIN이 틀렸습니다' }, 401)

  // 15분 유효 토큰 발급 (JWT with short exp)
  const token = await signJwt({
    sub: String(sellerId),
    seller_id: sellerId,
    purpose: 'pin_verified',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 900, // 15분
  }, c.env.JWT_SECRET)

  c.header('Set-Cookie', `ur_pin_verified=${token}; Path=/; Max-Age=900; SameSite=Lax; Secure; HttpOnly`)
  return c.json({ success: true, message: 'PIN 확인 완료. 15분간 민감 액션 사용 가능합니다.' })
})

// ── GET /pin-status — PIN 설정 여부 확인 ──
sellerPinRoutes.get('/pin-status', async (c) => {
  const sellerId = await getSellerId(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensurePinColumn(c.env.DB)
  const seller = await c.env.DB.prepare('SELECT pin_hash FROM sellers WHERE id = ?').bind(sellerId).first<{ pin_hash: string | null }>()
  return c.json({ success: true, data: { pin_set: !!seller?.pin_hash } })
})

/**
 * Helper: 최근 15분 내 PIN 인증 OR 카카오 재인증(step-up) 을 받았는지 확인.
 * 두 경로 중 하나라도 유효하면 통과.
 */
export async function isPinVerified(cookieHeader: string | undefined, sellerId: number, jwtSecret: string): Promise<boolean> {
  if (!cookieHeader) return false

  // 1) PIN 쿠키
  const pinMatch = /(?:^|;\s*)ur_pin_verified=([^;]+)/.exec(cookieHeader)
  if (pinMatch) {
    try {
      const payload = await verifyJwt(pinMatch[1], jwtSecret, 'HS256') as JWTPayload
      const p = payload as Record<string, unknown>
      if (p.purpose === 'pin_verified' && Number(p.seller_id) === sellerId) return true
    } catch { /* fall through */ }
  }

  // 2) 카카오 step-up 쿠키 (카카오로 방금 재인증한 경우)
  const kakaoMatch = /(?:^|;\s*)ur_kakao_stepup=([^;]+)/.exec(cookieHeader)
  if (kakaoMatch) {
    try {
      const payload = await verifyJwt(kakaoMatch[1], jwtSecret, 'HS256') as JWTPayload
      const p = payload as Record<string, unknown>
      if (p.purpose === 'kakao_stepup' && p.role === 'seller' && Number(p.seller_id) === sellerId) return true
    } catch { /* invalid */ }
  }

  return false
}

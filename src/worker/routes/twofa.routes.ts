/**
 * 🛡️ 2026-05-15: 2FA (TOTP) 셀러/어드민 보안 강화.
 *
 * - POST /api/2fa/setup       (auth) → secret 발급 + otpauth:// URL (QR 용)
 * - POST /api/2fa/verify      (auth, body: code) → 첫 활성화 (secret 저장)
 * - POST /api/2fa/disable     (auth, body: code) → 비활성화
 * - POST /api/2fa/check       (auth, body: code) → 로그인 시 검증 (server-side)
 *
 * Cloudflare Workers: subtle.crypto 로 HMAC-SHA1 (TOTP 표준).
 * Secret: D1 sellers/admins 테이블에 totp_secret 컬럼 (base32, 16 char).
 *
 * 0원: D1 + crypto.subtle 만 사용. 외부 라이브러리 X.
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { auditLog } from '../middleware/audit-log'

const twofaRoutes = new Hono<{ Bindings: Env }>()

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function generateBase32Secret(length: number = 16): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  let result = ''
  for (let i = 0; i < length; i++) {
    result += BASE32_ALPHABET[bytes[i] % 32]
  }
  return result
}

function base32Decode(input: string): Uint8Array {
  const cleaned = input.toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '')
  let bits = ''
  for (const c of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(c)
    if (idx === -1) continue
    bits += idx.toString(2).padStart(5, '0')
  }
  const bytes = new Uint8Array(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  }
  return bytes
}

async function generateTOTP(secretBase32: string, timestamp: number = Math.floor(Date.now() / 1000)): Promise<string> {
  const counter = Math.floor(timestamp / 30)
  const counterBytes = new ArrayBuffer(8)
  const view = new DataView(counterBytes)
  view.setUint32(4, counter, false)

  const keyBytes = base32Decode(secretBase32)
  const cryptoKey = await crypto.subtle.importKey(
    'raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, counterBytes)
  const sigBytes = new Uint8Array(signature)
  const offset = sigBytes[sigBytes.length - 1] & 0x0f
  const code = (
    ((sigBytes[offset] & 0x7f) << 24) |
    ((sigBytes[offset + 1] & 0xff) << 16) |
    ((sigBytes[offset + 2] & 0xff) << 8) |
    (sigBytes[offset + 3] & 0xff)
  ) % 1_000_000
  return code.toString().padStart(6, '0')
}

async function verifyTOTP(secretBase32: string, code: string): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false
  const now = Math.floor(Date.now() / 1000)
  // ±30초 허용 (시간 차이 보정)
  for (const offset of [-30, 0, 30]) {
    const expected = await generateTOTP(secretBase32, now + offset)
    if (expected === code) return true
  }
  return false
}

async function ensureTotpColumn(DB: D1Database, table: 'sellers' | 'users'): Promise<void> {
  if (_done_ensureTotpColumn) return
  _done_ensureTotpColumn = true
  try { await DB.prepare(`ALTER TABLE ${table} ADD COLUMN totp_secret TEXT`).run() } catch { /* exists */ }
  try { await DB.prepare(`ALTER TABLE ${table} ADD COLUMN totp_enabled INTEGER DEFAULT 0`).run() } catch { /* exists */ }
}

twofaRoutes.post('/setup', rateLimit({ action: '2fa_setup', max: 5, windowSec: 600 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const userAsAny = user as unknown as { id?: number | string; type?: string; email?: string }
  const table = userAsAny.type === 'seller' ? 'sellers' : 'users'

  const { DB } = c.env
  await ensureTotpColumn(DB, table)

  const secret = generateBase32Secret(16)
  const issuer = 'UR-DEAL'
  const account = userAsAny.email || `user-${userAsAny.id}`
  const otpauthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`

  // secret 임시 저장 (verify 호출 전까지는 enabled=0)
  await DB.prepare(`UPDATE ${table} SET totp_secret = ?, totp_enabled = 0 WHERE id = ?`)
    .bind(secret, userAsAny.id).run()

  return c.json({
    success: true,
    data: { secret, otpauth_url: otpauthUrl },
    message: 'Authenticator 앱에 추가 후 6자리 코드로 verify 호출',
  })
})

twofaRoutes.post('/verify', rateLimit({ action: '2fa_verify', max: 10, windowSec: 600 }), requireAuth(), auditLog('2fa.enable'), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  const table = userAsAny.type === 'seller' ? 'sellers' : 'users'

  let body: { code?: string }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'JSON 오류' }, 400) }
  const code = (body.code || '').toString()
  if (!/^\d{6}$/.test(code)) return c.json({ success: false, error: '6자리 숫자 코드' }, 400)

  const { DB } = c.env
  const row = await DB.prepare(`SELECT totp_secret, totp_enabled FROM ${table} WHERE id = ?`)
    .bind(userAsAny.id).first<{ totp_secret: string | null; totp_enabled: number }>()
  if (!row?.totp_secret) return c.json({ success: false, error: 'setup 먼저 호출' }, 400)

  const ok = await verifyTOTP(row.totp_secret, code)
  if (!ok) return c.json({ success: false, error: '코드 불일치 (시계 동기화 확인)' }, 400)

  await DB.prepare(`UPDATE ${table} SET totp_enabled = 1 WHERE id = ?`).bind(userAsAny.id).run()
  return c.json({ success: true, message: '2FA 활성화 완료' })
})

twofaRoutes.post('/disable', rateLimit({ action: '2fa_disable', max: 5, windowSec: 600 }), requireAuth(), auditLog('2fa.disable'), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  const table = userAsAny.type === 'seller' ? 'sellers' : 'users'

  let body: { code?: string }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'JSON 오류' }, 400) }
  const code = (body.code || '').toString()

  const { DB } = c.env
  const row = await DB.prepare(`SELECT totp_secret, totp_enabled FROM ${table} WHERE id = ?`)
    .bind(userAsAny.id).first<{ totp_secret: string | null; totp_enabled: number }>()
  if (!row?.totp_enabled || !row.totp_secret) return c.json({ success: false, error: '활성화되지 않음' }, 400)

  const ok = await verifyTOTP(row.totp_secret, code)
  if (!ok) return c.json({ success: false, error: '코드 불일치' }, 400)

  await DB.prepare(`UPDATE ${table} SET totp_secret = NULL, totp_enabled = 0 WHERE id = ?`).bind(userAsAny.id).run()
  return c.json({ success: true, message: '2FA 비활성화' })
})

twofaRoutes.post('/check', rateLimit({ action: '2fa_check', max: 20, windowSec: 60 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  const table = userAsAny.type === 'seller' ? 'sellers' : 'users'

  let body: { code?: string }
  try { body = await c.req.json() } catch { return c.json({ success: false, error: 'JSON 오류' }, 400) }
  const code = (body.code || '').toString()

  const { DB } = c.env
  const row = await DB.prepare(`SELECT totp_secret, totp_enabled FROM ${table} WHERE id = ?`)
    .bind(userAsAny.id).first<{ totp_secret: string | null; totp_enabled: number }>()
  if (!row?.totp_enabled || !row.totp_secret) return c.json({ success: true, data: { enabled: false } })

  const ok = await verifyTOTP(row.totp_secret, code)
  return c.json({ success: ok, data: { enabled: true, valid: ok } }, ok ? 200 : 401)
})

// 상태 조회 (활성화 여부만)
twofaRoutes.get('/status', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  const table = userAsAny.type === 'seller' ? 'sellers' : 'users'

  const { DB } = c.env
  await ensureTotpColumn(DB, table)
  const row = await DB.prepare(`SELECT totp_enabled FROM ${table} WHERE id = ?`)
    .bind(userAsAny.id).first<{ totp_enabled: number }>().catch(() => null)
  return c.json({ success: true, data: { enabled: !!row?.totp_enabled } })
})

export { twofaRoutes }


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
let _done_ensureTotpColumn = false

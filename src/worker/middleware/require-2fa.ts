/**
 * 🛡️ 2026-05-15 (TD-G06): require2FA() — sensitive endpoint 2FA 검증.
 *
 * 동작:
 *   1. 유저가 2FA 활성화 안 했으면 통과 (옵트인 — 강제 X)
 *   2. 활성화한 경우 X-2FA-Code 헤더에 6자리 코드 필수
 *   3. 코드 검증 실패 시 403 반환
 *
 * 사용:
 *   app.post('/api/disputes/admin/:id/approve',
 *     requireAuth(), require2FA(), auditLog('dispute.approve'), handler)
 */

import type { Context, Next, MiddlewareHandler } from 'hono'
import type { Env } from '../types/env'
import { getCurrentUser } from './auth'

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

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

async function generateTOTP(secretBase32: string, timestamp: number): Promise<string> {
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
  for (const offset of [-30, 0, 30]) {
    const expected = await generateTOTP(secretBase32, now + offset)
    if (expected === code) return true
  }
  return false
}

export function require2FA(): MiddlewareHandler<{ Bindings: Env }> {
  return async (c, next) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const userAsAny = user as unknown as { id?: number | string; type?: string }
    const table = userAsAny.type === 'seller' ? 'sellers' : 'users'

    const { DB } = c.env
    const row = await DB.prepare(`SELECT totp_secret, totp_enabled FROM ${table} WHERE id = ?`)
      .bind(userAsAny.id).first<{ totp_secret: string | null; totp_enabled: number }>().catch(() => null)

    // 2FA 비활성화 시 통과 (옵트인)
    if (!row?.totp_enabled || !row.totp_secret) return await next()

    const code = c.req.header('X-2FA-Code')
    if (!code || !/^\d{6}$/.test(code)) {
      return c.json({
        success: false,
        error: '2FA 코드 필요 (X-2FA-Code 헤더)',
        code: '2FA_REQUIRED',
      }, 403)
    }

    const ok = await verifyTOTP(row.totp_secret, code)
    if (!ok) {
      return c.json({
        success: false,
        error: '2FA 코드 불일치',
        code: '2FA_INVALID',
      }, 403)
    }

    return await next()
  }
}

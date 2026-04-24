/**
 * Agency shared types, helpers, and middleware
 * Imported by all agency sub-route files.
 */

import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import type { Context, Next } from 'hono'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { parseSessionCookie } from '@/worker/utils/session'

export type AgencyVars = { agency: { id: number; email: string } }
export type AgencyCtx = Context<{ Bindings: Env; Variables: AgencyVars }>

// ── 테이블 자동 생성 ──────────────────────────────────────────
let _agencyTablesEnsured = false
export async function ensureAgencyTables(DB: D1Database) {
  if (_agencyTablesEnsured) return
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      phone TEXT,
      commission_rate REAL DEFAULT 2.0,
      status TEXT DEFAULT 'active',
      linked_user_id INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {})

  await DB.prepare("ALTER TABLE agencies ADD COLUMN commission_rate REAL DEFAULT 2.0").run().catch(() => {})
  await DB.prepare("ALTER TABLE agencies ADD COLUMN linked_user_id INTEGER").run().catch(() => {})
  await DB.prepare("CREATE INDEX IF NOT EXISTS idx_agencies_linked_user ON agencies(linked_user_id)").run().catch(() => {})

  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS agency_sellers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agency_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(agency_id, seller_id)
    )
  `).run().catch(() => {})
  _agencyTablesEnsured = true
}

// ── 비밀번호 재설정 토큰 테이블 ─────────────────────────────
export async function ensurePasswordResetTable(DB: D1Database) {
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(() => {})
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token)'
  ).run().catch(() => {})
}

/** 32자 hex 토큰 생성 (Web Crypto) */
export function generateResetToken(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/** 비밀번호 재설정 이메일 HTML */
export function getPasswordResetEmailHTML(resetUrl: string): string {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1d1d1f;">
      <h2 style="font-size:20px;margin:0 0 16px;">유어딜 비밀번호 재설정</h2>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">
        아래 링크를 클릭하여 새 비밀번호를 설정하세요. (1시간 유효)
      </p>
      <p style="margin:24px 0;">
        <a href="${resetUrl}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;">
          비밀번호 재설정하기
        </a>
      </p>
      <p style="font-size:13px;color:#666;line-height:1.6;margin-top:24px;">
        요청하지 않았다면 이 이메일을 무시하세요.<br>
        링크가 동작하지 않을 경우 아래 URL을 복사해 주소창에 붙여넣으세요:<br>
        <span style="word-break:break-all;color:#2563eb;">${resetUrl}</span>
      </p>
      <hr style="border:none;border-top:1px solid #e5e5e7;margin:32px 0 16px;">
      <p style="font-size:11px;color:#999;line-height:1.5;text-align:center;">
        본 메일은 비밀번호 재설정 요청에 의한 발송입니다.<br>
        <strong>리스터코퍼레이션</strong> | 사업자등록번호: 783-87-03224<br>
        문의: <a href="mailto:contact@ur-team.com" style="color:#666;">contact@ur-team.com</a><br>
        <a href="https://live.ur-team.com/account/notifications" style="color:#666;">알림 설정 변경</a>
      </p>
    </div>
  `
}

// ── JWT 헬퍼 ─────────────────────────────────────────────────
export async function signAgencyToken(secret: string, agencyId: number, email: string) {
  return sign(
    { sub: String(agencyId), email, type: 'agency', exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 },
    secret
  )
}

export async function verifyAgencyToken(secret: string, token: string): Promise<{ id: number; email: string } | null> {
  try {
    const payload = await verify(token, secret, 'HS256') as Record<string, unknown>
    if (payload.type !== 'agency' || !payload.sub) return null
    return { id: Number(payload.sub), email: String(payload.email) }
  } catch {
    return null
  }
}

export function getToken(authHeader: string | undefined) {
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice(7)
}

// ── 미들웨어: agency 인증 ──────────────────────────────────────
// 🛡️ 2026-04-22 배치 147: Phase 2A cookie fallback 추가 (이전: Bearer 전용).
//   Admin/Seller 와 일관성 확보 — Bearer 토큰 없어도 ur_agency_session 쿠키로 인증 가능.
export const requireAgency = async (c: AgencyCtx, next: Next) => {
  // 1) Bearer 토큰 우선
  let payload = await verifyAgencyToken(c.env.JWT_SECRET, getToken(c.req.header('Authorization')) ?? '')

  // 2) Bearer 실패 시 cookie fallback
  if (!payload) {
    try {
      const sess = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['agency'])
      if (sess && sess.userId) {
        payload = { id: Number(sess.userId), email: sess.email || '' }
      }
    } catch { /* cookie parse failure — fall through to 401 */ }
  }

  if (!payload) return c.json({ success: false, error: '인증이 필요합니다.' }, 401)
  c.set('agency', payload)
  return next()
}

// ── 공통 Hono app factory ─────────────────────────────────────
export function createAgencyApp() {
  const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
  app.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))
  return app
}

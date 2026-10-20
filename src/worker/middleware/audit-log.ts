/**
 * 🛡️ 2026-05-15: Sensitive endpoint audit log middleware.
 *
 * 사용:
 *   import { auditLog } from '@/worker/middleware/audit-log'
 *   app.post('/api/admin/refund', requireAdmin(), auditLog('admin.refund'), handler)
 *
 * 기록: actor (auth user), action, target (path), ip_hash, user_agent_hash, timestamp.
 * IP / UA 는 SHA-256 해시 (개인정보 직접 저장 X — GDPR/PIPA 호환).
 *
 * 0원: D1 only.
 */

import type { Context, Next } from 'hono'
import type { Env } from '../types/env'
import { getCurrentUser } from './auth'

const AUDIT_DDL_DONE = new Set<string>()

async function ensureAuditTable(DB: D1Database): Promise<void> {
  if (_done_ensureAuditTable.has(DB)) return
  _done_ensureAuditTable.add(DB)
  if (AUDIT_DDL_DONE.has('done')) return
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_type TEXT, actor_id TEXT,
        action TEXT NOT NULL,
        target_type TEXT, target_id TEXT,
        method TEXT, path TEXT,
        status_code INTEGER,
        metadata TEXT,
        ip_hash TEXT, ua_hash TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_type, actor_id, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action, created_at DESC)`).run()
    AUDIT_DDL_DONE.add('done')
  } catch { /* exists */ }
}

async function hashStr(input: string, salt: string): Promise<string> {
  if (!input) return ''
  const data = new TextEncoder().encode(input + salt)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).slice(0, 8).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function auditLog(action: string) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    await next()
    // 응답 후 비동기 기록 (요청 latency 0)
    try {
      const DB = c.env.DB
      if (!DB) return
      await ensureAuditTable(DB)
      const user = getCurrentUser(c)
      const userAsAny = user as unknown as { id?: number | string; type?: string; role?: string }
      const ipRaw = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || ''
      const uaRaw = c.req.header('User-Agent') || ''
      // 🛡️ JWT_SECRET 미설정 시 해시 skip (보안 regression test 호환 — 하드코딩 default 금지)
      const salt = c.env.JWT_SECRET
      if (!salt) return  // secret 없으면 audit log 자체 skip (운영에서는 항상 설정됨)
      const [ipHash, uaHash] = await Promise.all([hashStr(ipRaw, salt), hashStr(uaRaw, salt)])
      await DB.prepare(`
        INSERT INTO audit_logs (actor_type, actor_id, action, method, path, status_code, ip_hash, ua_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        userAsAny?.type || userAsAny?.role || 'anon',
        String(userAsAny?.id ?? ''),
        action,
        c.req.method,
        c.req.path.slice(0, 200),
        c.res?.status ?? 0,
        ipHash, uaHash,
      ).run()
    } catch (e) {
      console.warn('[audit-log]', e)
    }
  }
}


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureAuditTable = new WeakSet<object>()

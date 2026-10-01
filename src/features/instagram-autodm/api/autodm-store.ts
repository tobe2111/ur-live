/**
 * 💬 인스타 자동 DM — DB 저장소.
 *
 * 테이블
 *   ig_autodm_account — 연결 계정 1행(id=1). 토큰·앱 시크릿은 at-rest 암호화(DATA_ENCRYPTION_KEY).
 *   ig_autodm_rules   — 키워드 규칙.
 *   ig_autodm_sends   — 발송 기록. **comment_id UNIQUE** — 같은 댓글에 두 번 보내지 않는다
 *                       (메타 웹훅은 재전송될 수 있다. INSERT OR IGNORE 로 먼저 선점한 쪽만 보낸다).
 *
 * ensure 는 WeakSet 메모이즈(요청마다 DDL 금지).
 */
import { encryptAtRest, decryptAtRest } from '../../../worker/utils/data-crypto'
import type { AutoDmRule } from './autodm-core'

const _ensured = new WeakSet<D1Database>()

export async function ensureAutoDmTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS ig_autodm_account (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      ig_user_id TEXT,
      username TEXT,
      access_token_enc TEXT,
      app_secret_enc TEXT,
      verify_token TEXT,
      token_expires_at DATETIME,
      token_refreshed_at DATETIME,
      enabled INTEGER NOT NULL DEFAULT 0,
      daily_cap INTEGER NOT NULL DEFAULT 500,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS ig_autodm_rules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      keywords TEXT NOT NULL,
      match_mode TEXT NOT NULL DEFAULT 'contains',
      media_id TEXT,
      dm_text TEXT NOT NULL,
      link_url TEXT,
      public_reply TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS ig_autodm_sends (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comment_id TEXT NOT NULL,
      rule_id INTEGER,
      media_id TEXT,
      from_id TEXT,
      from_username TEXT,
      comment_text TEXT,
      status TEXT NOT NULL DEFAULT 'claimed',
      error TEXT,
      public_reply_status TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME
    )`),
    DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_autodm_sends_comment ON ig_autodm_sends(comment_id)`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ig_autodm_sends_created ON ig_autodm_sends(created_at)`),
  ]).catch(() => { _ensured.delete(DB) })
}

// ── 계정 ──────────────────────────────────────────────────────────

export interface AutoDmAccount {
  ig_user_id: string | null
  username: string | null
  access_token: string
  app_secret: string
  verify_token: string | null
  token_expires_at: string | null
  token_refreshed_at: string | null
  enabled: boolean
  daily_cap: number
}

interface AccountRow {
  ig_user_id: string | null; username: string | null
  access_token_enc: string | null; app_secret_enc: string | null; verify_token: string | null
  token_expires_at: string | null; token_refreshed_at: string | null
  enabled: number; daily_cap: number
}

export async function getAccount(DB: D1Database, kek: string | undefined): Promise<AutoDmAccount | null> {
  await ensureAutoDmTables(DB)
  const row = await DB.prepare(`SELECT ig_user_id, username, access_token_enc, app_secret_enc, verify_token,
      token_expires_at, token_refreshed_at, enabled, daily_cap FROM ig_autodm_account WHERE id = 1`)
    .first<AccountRow>().catch(() => null)
  if (!row) return null
  return {
    ig_user_id: row.ig_user_id,
    username: row.username,
    access_token: await decryptAtRest(row.access_token_enc, kek).catch(() => ''),
    app_secret: await decryptAtRest(row.app_secret_enc, kek).catch(() => ''),
    verify_token: row.verify_token,
    token_expires_at: row.token_expires_at,
    token_refreshed_at: row.token_refreshed_at,
    enabled: row.enabled === 1,
    daily_cap: Number(row.daily_cap) || 500,
  }
}

/** 웹훅 확인용 토큰을 없으면 만든다(관리자가 메타 앱 설정에 그대로 붙여 넣는 값). */
export async function ensureVerifyToken(DB: D1Database): Promise<string> {
  await ensureAutoDmTables(DB)
  const existing = await DB.prepare(`SELECT verify_token FROM ig_autodm_account WHERE id = 1`)
    .first<{ verify_token: string | null }>().catch(() => null)
  if (existing?.verify_token) return existing.verify_token
  const bytes = crypto.getRandomValues(new Uint8Array(18))
  const token = 'urdeal_' + [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  await DB.prepare(`INSERT INTO ig_autodm_account (id, verify_token) VALUES (1, ?)
      ON CONFLICT(id) DO UPDATE SET verify_token = COALESCE(ig_autodm_account.verify_token, excluded.verify_token)`)
    .bind(token).run()
  const row = await DB.prepare(`SELECT verify_token FROM ig_autodm_account WHERE id = 1`).first<{ verify_token: string }>()
  return row?.verify_token || token
}

export async function saveConnection(DB: D1Database, kek: string | undefined, input: {
  ig_user_id: string; username: string | null; access_token?: string; app_secret?: string; token_expires_at?: string | null
}): Promise<void> {
  await ensureAutoDmTables(DB)
  const tokenEnc = input.access_token ? await encryptAtRest(input.access_token, kek) : null
  const secretEnc = input.app_secret ? await encryptAtRest(input.app_secret, kek) : null
  await DB.prepare(`INSERT INTO ig_autodm_account (id, ig_user_id, username, access_token_enc, app_secret_enc, token_expires_at, token_refreshed_at, updated_at)
      VALUES (1, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        ig_user_id = excluded.ig_user_id,
        username = excluded.username,
        access_token_enc = COALESCE(excluded.access_token_enc, ig_autodm_account.access_token_enc),
        app_secret_enc = COALESCE(excluded.app_secret_enc, ig_autodm_account.app_secret_enc),
        token_expires_at = COALESCE(excluded.token_expires_at, ig_autodm_account.token_expires_at),
        token_refreshed_at = COALESCE(excluded.token_refreshed_at, ig_autodm_account.token_refreshed_at),
        updated_at = CURRENT_TIMESTAMP`)
    .bind(input.ig_user_id, input.username, tokenEnc, secretEnc, input.token_expires_at ?? null, tokenEnc)
    .run()
}

export async function updateToken(DB: D1Database, kek: string | undefined, token: string, expiresAt: string | null): Promise<void> {
  const enc = await encryptAtRest(token, kek)
  await DB.prepare(`UPDATE ig_autodm_account SET access_token_enc = ?, token_expires_at = ?, token_refreshed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE id = 1`).bind(enc, expiresAt).run()
}

export async function setEnabled(DB: D1Database, enabled: boolean, dailyCap?: number): Promise<void> {
  await ensureAutoDmTables(DB)
  const cap = Number.isFinite(dailyCap) ? Math.min(5000, Math.max(1, Math.floor(dailyCap as number))) : null
  await DB.prepare(`UPDATE ig_autodm_account SET enabled = ?, daily_cap = COALESCE(?, daily_cap), updated_at = CURRENT_TIMESTAMP WHERE id = 1`)
    .bind(enabled ? 1 : 0, cap).run()
}

export async function disconnect(DB: D1Database): Promise<void> {
  await ensureAutoDmTables(DB)
  await DB.prepare(`UPDATE ig_autodm_account SET ig_user_id = NULL, username = NULL, access_token_enc = NULL,
      token_expires_at = NULL, token_refreshed_at = NULL, enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = 1`).run()
}

// ── 규칙 ──────────────────────────────────────────────────────────

export interface RuleRow extends AutoDmRule {
  name: string | null
  created_at: string
  updated_at: string
}

export async function listRules(DB: D1Database, activeOnly = false): Promise<RuleRow[]> {
  await ensureAutoDmTables(DB)
  const r = await DB.prepare(`SELECT id, name, keywords, match_mode, media_id, dm_text, link_url, public_reply, is_active, created_at, updated_at
      FROM ig_autodm_rules ${activeOnly ? 'WHERE is_active = 1' : ''} ORDER BY id ASC LIMIT 200`)
    .all<RuleRow>().catch(() => ({ results: [] as RuleRow[] }))
  return r.results || []
}

export interface RuleInput {
  name: string | null; keywords: string; match_mode: 'contains' | 'exact'; media_id: string | null
  dm_text: string; link_url: string | null; public_reply: string | null; is_active: boolean
}

export async function createRule(DB: D1Database, r: RuleInput): Promise<number | null> {
  await ensureAutoDmTables(DB)
  const res = await DB.prepare(`INSERT INTO ig_autodm_rules (name, keywords, match_mode, media_id, dm_text, link_url, public_reply, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(r.name, r.keywords, r.match_mode, r.media_id, r.dm_text, r.link_url, r.public_reply, r.is_active ? 1 : 0).run()
  return Number(res.meta?.last_row_id) || null
}

export async function updateRule(DB: D1Database, id: number, r: RuleInput): Promise<boolean> {
  await ensureAutoDmTables(DB)
  const res = await DB.prepare(`UPDATE ig_autodm_rules SET name = ?, keywords = ?, match_mode = ?, media_id = ?, dm_text = ?,
      link_url = ?, public_reply = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(r.name, r.keywords, r.match_mode, r.media_id, r.dm_text, r.link_url, r.public_reply, r.is_active ? 1 : 0, id).run()
  return (res.meta?.changes || 0) > 0
}

export async function deleteRule(DB: D1Database, id: number): Promise<void> {
  await ensureAutoDmTables(DB)
  await DB.prepare(`DELETE FROM ig_autodm_rules WHERE id = ?`).bind(id).run()
}

// ── 발송 기록 ─────────────────────────────────────────────────────

/**
 * 댓글 선점. true 면 이 요청이 처음 — 보내도 된다. false 면 이미 다른 요청이 처리했다.
 * (사전 SELECT 로 확인하면 동시에 온 재전송 두 건이 둘 다 보낸다 — 그래서 UNIQUE + INSERT OR IGNORE.)
 */
export async function claimComment(DB: D1Database, c: {
  comment_id: string; rule_id: number | null; media_id: string | null; from_id: string | null
  from_username: string | null; comment_text: string; status?: 'claimed' | 'skipped'; error?: string | null
}): Promise<boolean> {
  await ensureAutoDmTables(DB)
  const res = await DB.prepare(`INSERT OR IGNORE INTO ig_autodm_sends (comment_id, rule_id, media_id, from_id, from_username, comment_text, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(c.comment_id, c.rule_id, c.media_id, c.from_id, c.from_username, c.comment_text.slice(0, 200), c.status || 'claimed', c.error ?? null).run()
  return (res.meta?.changes || 0) > 0
}

export async function markSend(DB: D1Database, commentId: string, status: 'sent' | 'failed', error: string | null, publicReplyStatus: string | null): Promise<void> {
  await DB.prepare(`UPDATE ig_autodm_sends SET status = ?, error = ?, public_reply_status = ?,
      sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE comment_id = ?`)
    .bind(status, error, publicReplyStatus, status, commentId).run()
}

/** 최근 24시간 실제 발송 수(일일 상한용). */
export async function sentLast24h(DB: D1Database): Promise<number> {
  const r = await DB.prepare(`SELECT COUNT(*) AS n FROM ig_autodm_sends WHERE status = 'sent' AND created_at >= datetime('now', '-1 day')`)
    .first<{ n: number }>().catch(() => null)
  return Number(r?.n) || 0
}

export interface SendRow {
  id: number; comment_id: string; rule_id: number | null; media_id: string | null; from_username: string | null
  comment_text: string | null; status: string; error: string | null; public_reply_status: string | null
  created_at: string; sent_at: string | null
}

export async function listSends(DB: D1Database, limit = 100): Promise<SendRow[]> {
  await ensureAutoDmTables(DB)
  const r = await DB.prepare(`SELECT id, comment_id, rule_id, media_id, from_username, comment_text, status, error, public_reply_status, created_at, sent_at
      FROM ig_autodm_sends ORDER BY id DESC LIMIT ?`).bind(Math.min(500, Math.max(1, limit)))
    .all<SendRow>().catch(() => ({ results: [] as SendRow[] }))
  return r.results || []
}

export async function sendStats(DB: D1Database): Promise<{ sent24h: number; failed24h: number; sentTotal: number }> {
  await ensureAutoDmTables(DB)
  const r = await DB.prepare(`SELECT
      SUM(CASE WHEN status = 'sent' AND created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS sent24h,
      SUM(CASE WHEN status = 'failed' AND created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS failed24h,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sentTotal
      FROM ig_autodm_sends`).first<{ sent24h: number | null; failed24h: number | null; sentTotal: number | null }>().catch(() => null)
  return { sent24h: Number(r?.sent24h) || 0, failed24h: Number(r?.failed24h) || 0, sentTotal: Number(r?.sentTotal) || 0 }
}

/**
 * 💬 인스타 자동 DM — DB 저장소 (2026-10-01 다중 계정).
 *
 * 테이블
 *   ig_autodm_account  — **앱 설정 1행(id=1)**: 메타 앱 ID · 앱 시크릿(암호화) · 웹훅 확인 토큰 ·
 *                        매장 계정 전체 스위치(sellers_enabled). 이름은 첫 판(계정 1개) 시절 그대로다.
 *   ig_autodm_accounts — 연결된 인스타 계정. owner_key 로 주인을 가른다:
 *                        'platform'(유어딜 공식 — 어드민) · 'seller:{id}'(매장 — 사장님·중개사가 마이에서).
 *                        같은 인스타 계정을 두 곳에 연결할 수 없다(웹훅이 누구 것인지 갈 곳을 잃는다).
 *   ig_autodm_rules    — 키워드 규칙(account_id 로 계정별).
 *   ig_autodm_sends    — 발송 기록. **comment_id UNIQUE** — 같은 댓글에 두 번 보내지 않는다.
 *
 * ensure 는 WeakSet 메모이즈(요청마다 DDL 금지). 컬럼 추가는 문장마다 따로(이미 있으면 그 문장만 실패).
 */
import { encryptAtRest, decryptAtRest } from '../../../worker/utils/data-crypto'
import type { AutoDmRule } from './autodm-core'

const _ensured = new WeakSet<D1Database>()

export async function ensureAutoDmTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
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
      DB.prepare(`CREATE TABLE IF NOT EXISTS ig_autodm_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner_key TEXT NOT NULL,
        seller_id INTEGER,
        ig_user_id TEXT,
        username TEXT,
        access_token_enc TEXT,
        token_expires_at DATETIME,
        token_refreshed_at DATETIME,
        enabled INTEGER NOT NULL DEFAULT 0,
        daily_cap INTEGER NOT NULL DEFAULT 200,
        connected_by_user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`),
      DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_autodm_accounts_owner ON ig_autodm_accounts(owner_key)`),
      DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_ig_autodm_accounts_ig ON ig_autodm_accounts(ig_user_id) WHERE ig_user_id IS NOT NULL`),
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
    ])
    // 첫 판(계정 1개)에서 다중 계정으로 — 이미 있으면 그 문장만 실패한다.
    for (const sql of [
      `ALTER TABLE ig_autodm_account ADD COLUMN app_id TEXT`,
      `ALTER TABLE ig_autodm_account ADD COLUMN sellers_enabled INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE ig_autodm_rules ADD COLUMN account_id INTEGER`,
      `ALTER TABLE ig_autodm_sends ADD COLUMN account_id INTEGER`,
    ]) await DB.prepare(sql).run().catch(() => null)
    await DB.batch([
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ig_autodm_rules_account ON ig_autodm_rules(account_id)`),
      DB.prepare(`CREATE INDEX IF NOT EXISTS idx_ig_autodm_sends_account ON ig_autodm_sends(account_id, created_at)`),
      // 첫 판에서 1행에 저장했던 공식 계정이 있으면 새 표로 옮기고, 주인 없는 규칙·기록을 공식 계정에 붙인다.
      DB.prepare(`INSERT OR IGNORE INTO ig_autodm_accounts (owner_key, ig_user_id, username, access_token_enc, token_expires_at, token_refreshed_at, enabled, daily_cap)
        SELECT 'platform', ig_user_id, username, access_token_enc, token_expires_at, token_refreshed_at, enabled, daily_cap
        FROM ig_autodm_account WHERE id = 1 AND ig_user_id IS NOT NULL`),
      DB.prepare(`UPDATE ig_autodm_rules SET account_id = (SELECT id FROM ig_autodm_accounts WHERE owner_key = 'platform')
        WHERE account_id IS NULL AND EXISTS (SELECT 1 FROM ig_autodm_accounts WHERE owner_key = 'platform')`),
      DB.prepare(`UPDATE ig_autodm_sends SET account_id = (SELECT id FROM ig_autodm_accounts WHERE owner_key = 'platform')
        WHERE account_id IS NULL AND EXISTS (SELECT 1 FROM ig_autodm_accounts WHERE owner_key = 'platform')`),
    ]).catch(() => null)
  } catch {
    _ensured.delete(DB)
  }
}

// ── 앱 설정 (메타 앱 1개) ─────────────────────────────────────────

export interface AutoDmAppConfig {
  app_id: string | null
  app_secret: string
  verify_token: string | null
  /** 매장 계정 전체 스위치 — 메타 앱 심사 전엔 꺼 둔다. 꺼져 있으면 매장 계정은 켜져 있어도 0통. */
  sellers_enabled: boolean
}

export async function getAppConfig(DB: D1Database, kek: string | undefined): Promise<AutoDmAppConfig> {
  await ensureAutoDmTables(DB)
  const row = await DB.prepare(`SELECT app_id, app_secret_enc, verify_token, sellers_enabled FROM ig_autodm_account WHERE id = 1`)
    .first<{ app_id: string | null; app_secret_enc: string | null; verify_token: string | null; sellers_enabled: number | null }>()
    .catch(() => null)
  return {
    app_id: row?.app_id || null,
    app_secret: await decryptAtRest(row?.app_secret_enc, kek).catch(() => ''),
    verify_token: row?.verify_token || null,
    sellers_enabled: row?.sellers_enabled === 1,
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

export async function saveAppConfig(DB: D1Database, kek: string | undefined, input: {
  app_id?: string; app_secret?: string; sellers_enabled?: boolean
}): Promise<void> {
  await ensureVerifyToken(DB)
  const secretEnc = input.app_secret ? await encryptAtRest(input.app_secret, kek) : null
  await DB.prepare(`UPDATE ig_autodm_account SET
      app_id = COALESCE(?, app_id),
      app_secret_enc = COALESCE(?, app_secret_enc),
      sellers_enabled = COALESCE(?, sellers_enabled),
      updated_at = CURRENT_TIMESTAMP WHERE id = 1`)
    .bind(input.app_id || null, secretEnc, input.sellers_enabled === undefined ? null : (input.sellers_enabled ? 1 : 0)).run()
}

// ── 연결 계정 ─────────────────────────────────────────────────────

export const PLATFORM_OWNER = 'platform'
export const sellerOwnerKey = (sellerId: number) => `seller:${sellerId}`

export interface AutoDmAccount {
  id: number
  owner_key: string
  seller_id: number | null
  ig_user_id: string | null
  username: string | null
  access_token: string
  token_expires_at: string | null
  token_refreshed_at: string | null
  enabled: boolean
  daily_cap: number
}

interface AccountRow {
  id: number; owner_key: string; seller_id: number | null; ig_user_id: string | null; username: string | null
  access_token_enc: string | null; token_expires_at: string | null; token_refreshed_at: string | null
  enabled: number; daily_cap: number
}

const ACCOUNT_COLS = `id, owner_key, seller_id, ig_user_id, username, access_token_enc, token_expires_at, token_refreshed_at, enabled, daily_cap`

async function toAccount(row: AccountRow | null, kek: string | undefined): Promise<AutoDmAccount | null> {
  if (!row) return null
  return {
    id: row.id,
    owner_key: row.owner_key,
    seller_id: row.seller_id,
    ig_user_id: row.ig_user_id,
    username: row.username,
    access_token: await decryptAtRest(row.access_token_enc, kek).catch(() => ''),
    token_expires_at: row.token_expires_at,
    token_refreshed_at: row.token_refreshed_at,
    enabled: row.enabled === 1,
    daily_cap: Number(row.daily_cap) || 200,
  }
}

export async function getAccountByOwner(DB: D1Database, kek: string | undefined, ownerKey: string): Promise<AutoDmAccount | null> {
  await ensureAutoDmTables(DB)
  const row = await DB.prepare(`SELECT ${ACCOUNT_COLS} FROM ig_autodm_accounts WHERE owner_key = ?`).bind(ownerKey)
    .first<AccountRow>().catch(() => null)
  return toAccount(row, kek)
}

export async function getAccountByIgUserId(DB: D1Database, kek: string | undefined, igUserId: string): Promise<AutoDmAccount | null> {
  await ensureAutoDmTables(DB)
  const row = await DB.prepare(`SELECT ${ACCOUNT_COLS} FROM ig_autodm_accounts WHERE ig_user_id = ?`).bind(igUserId)
    .first<AccountRow>().catch(() => null)
  return toAccount(row, kek)
}

export type SaveConnectionResult = { ok: true; id: number } | { ok: false; error: 'taken' }

/**
 * 계정 연결(또는 토큰 교체). 같은 인스타 계정이 **다른 주인**에게 이미 연결돼 있으면 거절한다.
 * 주인이 다른 인스타 계정으로 바꿔 연결하면 규칙은 남고 계정만 바뀐다.
 */
export async function saveConnection(DB: D1Database, kek: string | undefined, input: {
  owner_key: string; seller_id: number | null; ig_user_id: string; username: string | null
  access_token?: string; token_expires_at?: string | null; connected_by_user_id?: number | null
}): Promise<SaveConnectionResult> {
  await ensureAutoDmTables(DB)
  const holder = await DB.prepare(`SELECT owner_key FROM ig_autodm_accounts WHERE ig_user_id = ?`).bind(input.ig_user_id)
    .first<{ owner_key: string }>().catch(() => null)
  if (holder && holder.owner_key !== input.owner_key) return { ok: false, error: 'taken' }
  const tokenEnc = input.access_token ? await encryptAtRest(input.access_token, kek) : null
  await DB.prepare(`INSERT INTO ig_autodm_accounts (owner_key, seller_id, ig_user_id, username, access_token_enc, token_expires_at,
        token_refreshed_at, connected_by_user_id, daily_cap, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? IS NULL THEN NULL ELSE CURRENT_TIMESTAMP END, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(owner_key) DO UPDATE SET
        ig_user_id = excluded.ig_user_id,
        username = excluded.username,
        access_token_enc = COALESCE(excluded.access_token_enc, ig_autodm_accounts.access_token_enc),
        token_expires_at = COALESCE(excluded.token_expires_at, ig_autodm_accounts.token_expires_at),
        token_refreshed_at = COALESCE(excluded.token_refreshed_at, ig_autodm_accounts.token_refreshed_at),
        connected_by_user_id = COALESCE(excluded.connected_by_user_id, ig_autodm_accounts.connected_by_user_id),
        updated_at = CURRENT_TIMESTAMP`)
    .bind(input.owner_key, input.seller_id, input.ig_user_id, input.username, tokenEnc, input.token_expires_at ?? null, tokenEnc,
      input.connected_by_user_id ?? null, input.owner_key === PLATFORM_OWNER ? 500 : 200)
    .run()
  const row = await DB.prepare(`SELECT id FROM ig_autodm_accounts WHERE owner_key = ?`).bind(input.owner_key).first<{ id: number }>()
  return { ok: true, id: Number(row?.id) }
}

export async function updateToken(DB: D1Database, kek: string | undefined, accountId: number, token: string, expiresAt: string | null): Promise<void> {
  const enc = await encryptAtRest(token, kek)
  await DB.prepare(`UPDATE ig_autodm_accounts SET access_token_enc = ?, token_expires_at = ?, token_refreshed_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(enc, expiresAt, accountId).run()
}

/** 매장 계정이 고를 수 있는 하루 상한의 최대치 — 인스타 스팸 판정을 피하는 보수적인 값. */
export const SELLER_DAILY_CAP_MAX = 500

export async function setEnabled(DB: D1Database, accountId: number, enabled: boolean, dailyCap?: number, capMax = 5000): Promise<void> {
  const cap = Number.isFinite(dailyCap) ? Math.min(capMax, Math.max(1, Math.floor(dailyCap as number))) : null
  await DB.prepare(`UPDATE ig_autodm_accounts SET enabled = ?, daily_cap = COALESCE(?, daily_cap), updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(enabled ? 1 : 0, cap, accountId).run()
}

/** 연결 해제 — 토큰과 인스타 계정을 지우고 끈다. 규칙·기록은 남긴다(다시 연결하면 그대로 쓴다). */
export async function disconnect(DB: D1Database, accountId: number): Promise<void> {
  await DB.prepare(`UPDATE ig_autodm_accounts SET ig_user_id = NULL, username = NULL, access_token_enc = NULL,
      token_expires_at = NULL, token_refreshed_at = NULL, enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(accountId).run()
}

/**
 * 메타의 "데이터 삭제 요청" — 그 인스타 계정으로 연결된 주인의 규칙·발송 기록·계정 행을 지운다.
 * 지운 게 없어도 true 가 아니라 실제로 지운 계정 수를 돌려준다(확인 코드용).
 */
export async function purgeByIgUserId(DB: D1Database, igUserId: string): Promise<number> {
  await ensureAutoDmTables(DB)
  const row = await DB.prepare(`SELECT id FROM ig_autodm_accounts WHERE ig_user_id = ?`).bind(igUserId).first<{ id: number }>().catch(() => null)
  if (!row) return 0
  await DB.batch([
    DB.prepare(`DELETE FROM ig_autodm_sends WHERE account_id = ?`).bind(row.id),
    DB.prepare(`DELETE FROM ig_autodm_rules WHERE account_id = ?`).bind(row.id),
    DB.prepare(`DELETE FROM ig_autodm_accounts WHERE id = ?`).bind(row.id),
  ])
  return 1
}

/** 메타의 "연결 해제" 알림 — 사용자가 인스타 설정에서 우리 앱 권한을 뺐다. 토큰을 지우고 끈다. */
export async function disconnectByIgUserId(DB: D1Database, igUserId: string): Promise<void> {
  await ensureAutoDmTables(DB)
  await DB.prepare(`UPDATE ig_autodm_accounts SET ig_user_id = NULL, username = NULL, access_token_enc = NULL,
      token_expires_at = NULL, token_refreshed_at = NULL, enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE ig_user_id = ?`).bind(igUserId).run()
}

/** 계정 행만 있고 연결은 아직인 상태를 만든다(규칙을 먼저 써 둘 수 있게). */
export async function ensureAccountRow(DB: D1Database, ownerKey: string, sellerId: number | null): Promise<number> {
  await ensureAutoDmTables(DB)
  await DB.prepare(`INSERT OR IGNORE INTO ig_autodm_accounts (owner_key, seller_id, daily_cap) VALUES (?, ?, ?)`)
    .bind(ownerKey, sellerId, ownerKey === PLATFORM_OWNER ? 500 : 200).run()
  const row = await DB.prepare(`SELECT id FROM ig_autodm_accounts WHERE owner_key = ?`).bind(ownerKey).first<{ id: number }>()
  return Number(row?.id)
}

export interface AccountSummary {
  id: number; owner_key: string; seller_id: number | null; store_name: string | null; username: string | null
  enabled: number; daily_cap: number; sent24h: number; failed24h: number
}

/** 어드민 감독용 — 연결된 매장 계정 전부와 최근 24시간 성적. */
export async function listSellerAccounts(DB: D1Database): Promise<AccountSummary[]> {
  await ensureAutoDmTables(DB)
  const r = await DB.prepare(`SELECT a.id, a.owner_key, a.seller_id, s.name AS store_name, a.username, a.enabled, a.daily_cap,
        (SELECT COUNT(*) FROM ig_autodm_sends x WHERE x.account_id = a.id AND x.status = 'sent' AND x.created_at >= datetime('now', '-1 day')) AS sent24h,
        (SELECT COUNT(*) FROM ig_autodm_sends x WHERE x.account_id = a.id AND x.status = 'failed' AND x.created_at >= datetime('now', '-1 day')) AS failed24h
      FROM ig_autodm_accounts a LEFT JOIN sellers s ON s.id = a.seller_id
      WHERE a.owner_key != ? AND a.ig_user_id IS NOT NULL ORDER BY a.id DESC LIMIT 200`)
    .bind(PLATFORM_OWNER).all<AccountSummary>().catch(() => ({ results: [] as AccountSummary[] }))
  return r.results || []
}

// ── 규칙 ──────────────────────────────────────────────────────────

export interface RuleRow extends AutoDmRule {
  name: string | null
  created_at: string
  updated_at: string
}

export async function listRules(DB: D1Database, accountId: number, activeOnly = false): Promise<RuleRow[]> {
  await ensureAutoDmTables(DB)
  const r = await DB.prepare(`SELECT id, name, keywords, match_mode, media_id, dm_text, link_url, public_reply, is_active, created_at, updated_at
      FROM ig_autodm_rules WHERE account_id = ? ${activeOnly ? 'AND is_active = 1' : ''} ORDER BY id ASC LIMIT 200`)
    .bind(accountId).all<RuleRow>().catch(() => ({ results: [] as RuleRow[] }))
  return r.results || []
}

export interface RuleInput {
  name: string | null; keywords: string; match_mode: 'contains' | 'exact'; media_id: string | null
  dm_text: string; link_url: string | null; public_reply: string | null; is_active: boolean
}

/** 계정 하나가 가질 수 있는 규칙 수 — 무한히 쌓아 매칭을 느리게 만들지 않게. */
export const MAX_RULES_PER_ACCOUNT = 50

export async function countRules(DB: D1Database, accountId: number): Promise<number> {
  const r = await DB.prepare(`SELECT COUNT(*) AS n FROM ig_autodm_rules WHERE account_id = ?`).bind(accountId).first<{ n: number }>().catch(() => null)
  return Number(r?.n) || 0
}

export async function createRule(DB: D1Database, accountId: number, r: RuleInput): Promise<number | null> {
  await ensureAutoDmTables(DB)
  const res = await DB.prepare(`INSERT INTO ig_autodm_rules (account_id, name, keywords, match_mode, media_id, dm_text, link_url, public_reply, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(accountId, r.name, r.keywords, r.match_mode, r.media_id, r.dm_text, r.link_url, r.public_reply, r.is_active ? 1 : 0).run()
  return Number(res.meta?.last_row_id) || null
}

/** 수정·삭제는 **그 계정의 규칙일 때만** — 다른 매장 규칙 id 를 넣어도 changes 0(IDOR 차단). */
export async function updateRule(DB: D1Database, accountId: number, id: number, r: RuleInput): Promise<boolean> {
  await ensureAutoDmTables(DB)
  const res = await DB.prepare(`UPDATE ig_autodm_rules SET name = ?, keywords = ?, match_mode = ?, media_id = ?, dm_text = ?,
      link_url = ?, public_reply = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND account_id = ?`)
    .bind(r.name, r.keywords, r.match_mode, r.media_id, r.dm_text, r.link_url, r.public_reply, r.is_active ? 1 : 0, id, accountId).run()
  return (res.meta?.changes || 0) > 0
}

export async function deleteRule(DB: D1Database, accountId: number, id: number): Promise<boolean> {
  await ensureAutoDmTables(DB)
  const res = await DB.prepare(`DELETE FROM ig_autodm_rules WHERE id = ? AND account_id = ?`).bind(id, accountId).run()
  return (res.meta?.changes || 0) > 0
}

// ── 발송 기록 ─────────────────────────────────────────────────────

/**
 * 댓글 선점. true 면 이 요청이 처음 — 보내도 된다. false 면 이미 다른 요청이 처리했다.
 * (사전 SELECT 로 확인하면 동시에 온 재전송 두 건이 둘 다 보낸다 — 그래서 UNIQUE + INSERT OR IGNORE.)
 */
export async function claimComment(DB: D1Database, c: {
  account_id: number; comment_id: string; rule_id: number | null; media_id: string | null; from_id: string | null
  from_username: string | null; comment_text: string; status?: 'claimed' | 'skipped'; error?: string | null
}): Promise<boolean> {
  await ensureAutoDmTables(DB)
  const res = await DB.prepare(`INSERT OR IGNORE INTO ig_autodm_sends (account_id, comment_id, rule_id, media_id, from_id, from_username, comment_text, status, error)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(c.account_id, c.comment_id, c.rule_id, c.media_id, c.from_id, c.from_username, c.comment_text.slice(0, 200), c.status || 'claimed', c.error ?? null).run()
  return (res.meta?.changes || 0) > 0
}

export async function markSend(DB: D1Database, commentId: string, status: 'sent' | 'failed', error: string | null, publicReplyStatus: string | null): Promise<void> {
  await DB.prepare(`UPDATE ig_autodm_sends SET status = ?, error = ?, public_reply_status = ?,
      sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE sent_at END WHERE comment_id = ?`)
    .bind(status, error, publicReplyStatus, status, commentId).run()
}

/** 최근 24시간 실제 발송 수(계정별 일일 상한용). */
export async function sentLast24h(DB: D1Database, accountId: number): Promise<number> {
  const r = await DB.prepare(`SELECT COUNT(*) AS n FROM ig_autodm_sends WHERE account_id = ? AND status = 'sent' AND created_at >= datetime('now', '-1 day')`)
    .bind(accountId).first<{ n: number }>().catch(() => null)
  return Number(r?.n) || 0
}

export interface SendRow {
  id: number; comment_id: string; rule_id: number | null; media_id: string | null; from_username: string | null
  comment_text: string | null; status: string; error: string | null; public_reply_status: string | null
  created_at: string; sent_at: string | null
}

export async function listSends(DB: D1Database, accountId: number, limit = 100): Promise<SendRow[]> {
  await ensureAutoDmTables(DB)
  const r = await DB.prepare(`SELECT id, comment_id, rule_id, media_id, from_username, comment_text, status, error, public_reply_status, created_at, sent_at
      FROM ig_autodm_sends WHERE account_id = ? ORDER BY id DESC LIMIT ?`).bind(accountId, Math.min(500, Math.max(1, limit)))
    .all<SendRow>().catch(() => ({ results: [] as SendRow[] }))
  return r.results || []
}

export async function sendStats(DB: D1Database, accountId: number): Promise<{ sent24h: number; failed24h: number; sentTotal: number }> {
  await ensureAutoDmTables(DB)
  const r = await DB.prepare(`SELECT
      SUM(CASE WHEN status = 'sent' AND created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS sent24h,
      SUM(CASE WHEN status = 'failed' AND created_at >= datetime('now', '-1 day') THEN 1 ELSE 0 END) AS failed24h,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sentTotal
      FROM ig_autodm_sends WHERE account_id = ?`).bind(accountId)
    .first<{ sent24h: number | null; failed24h: number | null; sentTotal: number | null }>().catch(() => null)
  return { sent24h: Number(r?.sent24h) || 0, failed24h: Number(r?.failed24h) || 0, sentTotal: Number(r?.sentTotal) || 0 }
}

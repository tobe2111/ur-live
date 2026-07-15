/**
 * 🆕 2026-07-15 소셜 자동화 — DB 저장소(계정 + 초안/포스트).
 *
 * 테이블: social_accounts(연결 계정, 토큰 암호화) · social_posts(초안→발행 상태머신).
 * ensure 는 WeakSet 메모이즈(per-request DDL 방지 — 머니룰 부수룰). repair-schema 에도 등록(내구성).
 */
import { encryptAtRest, decryptAtRest } from '../../../worker/utils/data-crypto'
import type { SocialPlatform } from './social-brief'

const _ensured = new WeakSet<D1Database>()
const swallow = () => () => ({ results: [] } as unknown)

export async function ensureSocialTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS social_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      account_ref TEXT,
      display_name TEXT,
      access_token_enc TEXT,
      refresh_token_enc TEXT,
      token_expires_at DATETIME,
      extra TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow())
  await DB.prepare(`CREATE UNIQUE INDEX IF NOT EXISTS idx_social_accounts_platform ON social_accounts(platform)`).run().catch(swallow())
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS social_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      topic_slug TEXT,
      title TEXT,
      body TEXT NOT NULL,
      hashtags TEXT DEFAULT '[]',
      media_url TEXT,
      media_kind TEXT DEFAULT 'none',
      status TEXT DEFAULT 'draft',
      external_id TEXT,
      external_url TEXT,
      error TEXT,
      scheduled_at DATETIME,
      published_at DATETIME,
      ai_generated INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `).run().catch(swallow())
  await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_social_posts_status ON social_posts(platform, status)`).run().catch(swallow())
}

// ── 계정 ──────────────────────────────────────────────────────────────
export interface SocialAccountRow {
  id: number; platform: string; account_ref: string | null; display_name: string | null
  token_expires_at: string | null; extra: string | null; status: string
  created_at: string; updated_at: string
}

/** 토큰 비노출 목록(어드민 UI 용). */
export async function listAccounts(DB: D1Database): Promise<SocialAccountRow[]> {
  await ensureSocialTables(DB)
  const r = await DB.prepare(
    `SELECT id, platform, account_ref, display_name, token_expires_at, extra, status, created_at, updated_at
     FROM social_accounts ORDER BY platform`
  ).all<SocialAccountRow>().catch(() => ({ results: [] as SocialAccountRow[] }))
  return r.results || []
}

export interface UpsertAccountInput {
  platform: SocialPlatform; account_ref?: string; display_name?: string
  access_token?: string; refresh_token?: string; token_expires_at?: string; extra?: Record<string, unknown>
}

/** 계정 등록/갱신(platform UNIQUE). 토큰은 at-rest 암호화. */
export async function upsertAccount(DB: D1Database, kek: string | undefined, input: UpsertAccountInput): Promise<{ ok: boolean; error?: string }> {
  await ensureSocialTables(DB)
  const accessEnc = input.access_token ? await encryptAtRest(input.access_token, kek) : null
  const refreshEnc = input.refresh_token ? await encryptAtRest(input.refresh_token, kek) : null
  const extraStr = JSON.stringify(input.extra || {})
  await DB.prepare(
    `INSERT INTO social_accounts (platform, account_ref, display_name, access_token_enc, refresh_token_enc, token_expires_at, extra, status, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP)
     ON CONFLICT(platform) DO UPDATE SET
       account_ref = COALESCE(excluded.account_ref, social_accounts.account_ref),
       display_name = COALESCE(excluded.display_name, social_accounts.display_name),
       access_token_enc = COALESCE(excluded.access_token_enc, social_accounts.access_token_enc),
       refresh_token_enc = COALESCE(excluded.refresh_token_enc, social_accounts.refresh_token_enc),
       token_expires_at = COALESCE(excluded.token_expires_at, social_accounts.token_expires_at),
       extra = excluded.extra,
       status = 'active',
       updated_at = CURRENT_TIMESTAMP`
  ).bind(
    input.platform, input.account_ref || null, input.display_name || null,
    accessEnc, refreshEnc, input.token_expires_at || null, extraStr,
  ).run().catch(() => null)
  return { ok: true }
}

export async function deleteAccount(DB: D1Database, id: number): Promise<void> {
  await ensureSocialTables(DB)
  await DB.prepare(`DELETE FROM social_accounts WHERE id = ?`).bind(id).run().catch(() => null)
}

/** 발행용 — 복호화된 토큰 포함. 내부 전용(라우트에서 클라로 반환 금지). */
export interface DecryptedAccount {
  id: number; platform: string; account_ref: string | null; display_name: string | null
  access_token: string | null; refresh_token: string | null; token_expires_at: string | null
  extra: Record<string, unknown>; status: string
}

export async function getAccountForPublish(DB: D1Database, kek: string | undefined, platform: SocialPlatform): Promise<DecryptedAccount | null> {
  await ensureSocialTables(DB)
  const row = await DB.prepare(
    `SELECT id, platform, account_ref, display_name, access_token_enc, refresh_token_enc, token_expires_at, extra, status
     FROM social_accounts WHERE platform = ? AND status = 'active' LIMIT 1`
  ).bind(platform).first<{
    id: number; platform: string; account_ref: string | null; display_name: string | null
    access_token_enc: string | null; refresh_token_enc: string | null; token_expires_at: string | null
    extra: string | null; status: string
  }>().catch(() => null)
  if (!row) return null
  let extra: Record<string, unknown> = {}
  try { extra = row.extra ? JSON.parse(row.extra) : {} } catch { extra = {} }
  return {
    id: row.id, platform: row.platform, account_ref: row.account_ref, display_name: row.display_name,
    access_token: await decryptAtRest(row.access_token_enc, kek).catch(() => ''),
    refresh_token: row.refresh_token_enc ? await decryptAtRest(row.refresh_token_enc, kek).catch(() => '') : null,
    token_expires_at: row.token_expires_at, extra, status: row.status,
  }
}

/** 리프레시된 액세스 토큰 갱신(YouTube 등). */
export async function updateAccountToken(DB: D1Database, kek: string | undefined, id: number, accessToken: string, expiresAt?: string): Promise<void> {
  await ensureSocialTables(DB)
  const enc = await encryptAtRest(accessToken, kek)
  await DB.prepare(
    `UPDATE social_accounts SET access_token_enc = ?, token_expires_at = COALESCE(?, token_expires_at), updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(enc, expiresAt || null, id).run().catch(() => null)
}

// ── 포스트(초안) ──────────────────────────────────────────────────────
export interface SocialPostRow {
  id: number; platform: string; topic_slug: string | null; title: string | null; body: string
  hashtags: string | null; media_url: string | null; media_kind: string; status: string
  external_id: string | null; external_url: string | null; error: string | null
  scheduled_at: string | null; published_at: string | null; ai_generated: number
  created_at: string; updated_at: string
}

export interface CreatePostInput {
  platform: SocialPlatform; topic_slug?: string; title?: string; body: string
  hashtags?: string[]; media_url?: string; media_kind?: 'none' | 'image' | 'video'; ai_generated?: boolean
}

export async function createPost(DB: D1Database, input: CreatePostInput): Promise<{ ok: boolean; id?: number; error?: string }> {
  await ensureSocialTables(DB)
  if (!input.body || !input.body.trim()) return { ok: false, error: '본문이 비어 있습니다' }
  const r = await DB.prepare(
    `INSERT INTO social_posts (platform, topic_slug, title, body, hashtags, media_url, media_kind, status, ai_generated)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?)`
  ).bind(
    input.platform, input.topic_slug || null, input.title || null, input.body,
    JSON.stringify(input.hashtags || []), input.media_url || null, input.media_kind || 'none',
    input.ai_generated ? 1 : 0,
  ).run().catch(() => null)
  const id = r?.meta?.last_row_id
  return id ? { ok: true, id: Number(id) } : { ok: false, error: '초안 저장 실패' }
}

export async function listPosts(DB: D1Database, opts: { platform?: string; status?: string } = {}): Promise<SocialPostRow[]> {
  await ensureSocialTables(DB)
  const conds: string[] = []
  const binds: unknown[] = []
  if (opts.platform) { conds.push('platform = ?'); binds.push(opts.platform) }
  if (opts.status) { conds.push('status = ?'); binds.push(opts.status) }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : ''
  const r = await DB.prepare(
    `SELECT * FROM social_posts ${where} ORDER BY created_at DESC LIMIT 200`
  ).bind(...binds).all<SocialPostRow>().catch(() => ({ results: [] as SocialPostRow[] }))
  return r.results || []
}

export async function getPost(DB: D1Database, id: number): Promise<SocialPostRow | null> {
  await ensureSocialTables(DB)
  return DB.prepare(`SELECT * FROM social_posts WHERE id = ?`).bind(id).first<SocialPostRow>().catch(() => null)
}

export async function updatePost(DB: D1Database, id: number, patch: Partial<{ title: string; body: string; hashtags: string[]; media_url: string; media_kind: string; scheduled_at: string | null }>): Promise<void> {
  await ensureSocialTables(DB)
  const sets: string[] = []
  const binds: unknown[] = []
  if (patch.title !== undefined) { sets.push('title = ?'); binds.push(patch.title) }
  if (patch.body !== undefined) { sets.push('body = ?'); binds.push(patch.body) }
  if (patch.hashtags !== undefined) { sets.push('hashtags = ?'); binds.push(JSON.stringify(patch.hashtags)) }
  if (patch.media_url !== undefined) { sets.push('media_url = ?'); binds.push(patch.media_url) }
  if (patch.media_kind !== undefined) { sets.push('media_kind = ?'); binds.push(patch.media_kind) }
  if (patch.scheduled_at !== undefined) { sets.push('scheduled_at = ?'); binds.push(patch.scheduled_at) }
  if (!sets.length) return
  sets.push('updated_at = CURRENT_TIMESTAMP')
  binds.push(id)
  await DB.prepare(`UPDATE social_posts SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run().catch(() => null)
}

/** draft → approved (관리자 검토 통과). */
export async function approvePost(DB: D1Database, id: number): Promise<boolean> {
  await ensureSocialTables(DB)
  const r = await DB.prepare(
    `UPDATE social_posts SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'`
  ).bind(id).run().catch(() => null)
  return !!(r?.meta?.changes)
}

export async function archivePost(DB: D1Database, id: number): Promise<void> {
  await ensureSocialTables(DB)
  await DB.prepare(
    `UPDATE social_posts SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status != 'published'`
  ).bind(id).run().catch(() => null)
}

/** 발행 side-effect 전 CAS 선점: approved & external_id IS NULL → 'publishing'(단일 실행 보장). */
export async function claimForPublish(DB: D1Database, id: number): Promise<boolean> {
  await ensureSocialTables(DB)
  const r = await DB.prepare(
    `UPDATE social_posts SET status = 'publishing', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'approved' AND external_id IS NULL`
  ).bind(id).run().catch(() => null)
  return !!(r?.meta?.changes)
}

export async function markPublished(DB: D1Database, id: number, externalId: string, externalUrl: string | null): Promise<void> {
  await ensureSocialTables(DB)
  await DB.prepare(
    `UPDATE social_posts SET status = 'published', external_id = ?, external_url = ?, error = NULL, published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
  ).bind(externalId, externalUrl, id).run().catch(() => null)
}

/** 발행 실패: publishing → approved 로 되돌림(재시도 가능) + 에러 기록. */
export async function markFailed(DB: D1Database, id: number, error: string): Promise<void> {
  await ensureSocialTables(DB)
  await DB.prepare(
    `UPDATE social_posts SET status = 'approved', error = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'publishing'`
  ).bind(error.slice(0, 300), id).run().catch(() => null)
}

/** 특정 플랫폼의 미검토(draft) 초안 수 — cron 과다생성 방지 캡. */
export async function countDrafts(DB: D1Database, platform: SocialPlatform): Promise<number> {
  await ensureSocialTables(DB)
  const r = await DB.prepare(
    `SELECT COUNT(*) as n FROM social_posts WHERE platform = ? AND status = 'draft'`
  ).bind(platform).first<{ n: number }>().catch(() => null)
  return r?.n || 0
}

/** 이미 생성된 topic_slug 목록(중복 주제 방지). */
export async function usedTopicSlugs(DB: D1Database, platform: SocialPlatform): Promise<string[]> {
  await ensureSocialTables(DB)
  const r = await DB.prepare(
    `SELECT DISTINCT topic_slug FROM social_posts WHERE platform = ? AND topic_slug IS NOT NULL`
  ).bind(platform).all<{ topic_slug: string }>().catch(() => ({ results: [] as { topic_slug: string }[] }))
  return (r.results || []).map((x) => x.topic_slug).filter(Boolean)
}

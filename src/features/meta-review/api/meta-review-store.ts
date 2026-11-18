/**
 * 🎬 2026-11-18 메타 앱 검수 시연 — 연결 저장소.
 *
 * 메타 앱 검수는 권한마다 "실제 로그인 → 실제 기능 사용" 녹화를 요구한다. 이 표는 그 시연 화면
 * (/admin/meta-review)이 쓰는 연결 두 개(스레드 로그인 · 페이스북 로그인)를 담는다.
 * 앱 시크릿·토큰은 전부 암호화해 둔다(data-crypto). 마케팅 봇(GitHub Actions)의 토큰과는 별개다.
 */
import { encryptAtRest, decryptAtRest } from '../../../worker/utils/data-crypto'

export type MetaProvider = 'threads' | 'facebook'
export const META_PROVIDERS: readonly MetaProvider[] = ['threads', 'facebook']
export const isProvider = (p: unknown): p is MetaProvider => p === 'threads' || p === 'facebook'

export interface MetaConn {
  provider: MetaProvider
  app_id: string | null
  app_secret: string
  access_token: string
  /** threads: 스레드 user id · facebook: 인스타 비즈니스 계정 id */
  account_id: string | null
  username: string | null
  /** facebook 만 — 인스타에 연결된 페이스북 페이지 */
  page_id: string | null
  page_token: string
  expires_at: string | null
}

const _ensured = new WeakSet<D1Database>()
export async function ensureMetaReviewTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS meta_review_conn (
    provider TEXT PRIMARY KEY,
    app_id TEXT,
    app_secret_enc TEXT,
    access_token_enc TEXT,
    account_id TEXT,
    username TEXT,
    page_id TEXT,
    page_token_enc TEXT,
    expires_at DATETIME,
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => { _ensured.delete(DB) })
}

type Row = {
  provider: string; app_id: string | null; app_secret_enc: string | null; access_token_enc: string | null
  account_id: string | null; username: string | null; page_id: string | null; page_token_enc: string | null; expires_at: string | null
}

export async function getConn(DB: D1Database, kek: string | undefined, provider: MetaProvider): Promise<MetaConn> {
  await ensureMetaReviewTable(DB)
  const r = await DB.prepare(`SELECT * FROM meta_review_conn WHERE provider = ?`).bind(provider).first<Row>().catch(() => null)
  return {
    provider,
    app_id: r?.app_id || null,
    app_secret: await decryptAtRest(r?.app_secret_enc, kek).catch(() => ''),
    access_token: await decryptAtRest(r?.access_token_enc, kek).catch(() => ''),
    account_id: r?.account_id || null,
    username: r?.username || null,
    page_id: r?.page_id || null,
    page_token: await decryptAtRest(r?.page_token_enc, kek).catch(() => ''),
    expires_at: r?.expires_at || null,
  }
}

export async function saveApp(DB: D1Database, kek: string | undefined, provider: MetaProvider, appId: string, appSecret?: string): Promise<void> {
  await ensureMetaReviewTable(DB)
  const secretEnc = appSecret ? await encryptAtRest(appSecret, kek) : null
  await DB.prepare(`INSERT INTO meta_review_conn (provider, app_id, app_secret_enc) VALUES (?, ?, ?)
      ON CONFLICT(provider) DO UPDATE SET app_id = excluded.app_id,
        app_secret_enc = COALESCE(excluded.app_secret_enc, meta_review_conn.app_secret_enc), updated_at = datetime('now')`)
    .bind(provider, appId, secretEnc).run()
}

export async function saveToken(DB: D1Database, kek: string | undefined, provider: MetaProvider, input: {
  access_token: string; account_id: string | null; username: string | null; page_id?: string | null; page_token?: string | null; expires_at: string | null
}): Promise<void> {
  await ensureMetaReviewTable(DB)
  const tok = await encryptAtRest(input.access_token, kek)
  const pageTok = input.page_token ? await encryptAtRest(input.page_token, kek) : null
  await DB.prepare(`UPDATE meta_review_conn SET access_token_enc = ?, account_id = ?, username = ?, page_id = ?, page_token_enc = ?,
      expires_at = ?, updated_at = datetime('now') WHERE provider = ?`)
    .bind(tok, input.account_id, input.username, input.page_id ?? null, pageTok, input.expires_at, provider).run()
}

export async function clearToken(DB: D1Database, provider: MetaProvider): Promise<void> {
  await ensureMetaReviewTable(DB)
  await DB.prepare(`UPDATE meta_review_conn SET access_token_enc = NULL, account_id = NULL, username = NULL, page_id = NULL,
      page_token_enc = NULL, expires_at = NULL, updated_at = datetime('now') WHERE provider = ?`).bind(provider).run()
}

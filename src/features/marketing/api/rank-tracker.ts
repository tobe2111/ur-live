/**
 * 🆕 2026-06-28 유어애즈 — 네이버 쇼핑 순위 추적(오가닉/쇼핑, 광고 순위와 별개).
 *
 *   특정 키워드의 쇼핑검색 결과에서 내 몰(또는 도메인)이 몇 위인지 매일 추적 → 시계열·변동.
 *   네이버 쇼핑검색 오픈API(/v1/search/shop.json) 재사용(고정IP 불필요). 읽기·돈 0.
 *   추적 범위: 상위 300위(display 100 × 3페이지). 밖이면 rank=null('300위 밖').
 */
import type { Env } from '@/worker/types/env'

const OPENAPI = 'https://openapi.naver.com'
const hdr = (id: string, secret: string) => ({ 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret })
const stripTags = (s: string) => s.replace(/<[^>]+>/g, '').trim()
const naverOpenId = (env: Env) => env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
const naverOpenSecret = (env: Env) => env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET

const MAX_PAGES = 3 // 상위 300위까지 탐색
const RANK_CAP = 100 // 계정당 추적 키워드 상한

const _schemaDone = new WeakSet<object>()
export async function ensureRankTrackerSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_rank_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    keyword TEXT NOT NULL,
    mall_match TEXT NOT NULL,
    last_rank INTEGER,
    last_total INTEGER,
    last_title TEXT,
    last_checked_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(account_id, keyword, mall_match)
  )`).run().catch(() => null)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_shop_rank_snapshots (
    target_id INTEGER NOT NULL,
    account_id INTEGER NOT NULL,
    rank INTEGER,
    snap_date TEXT NOT NULL,
    UNIQUE(target_id, snap_date)
  )`).run().catch(() => null)
}

/** 쇼핑검색에서 내 몰(mallName) 또는 도메인(link)이 처음 등장하는 순위. 못 찾으면 rank=null. */
export async function findShopRank(clientId: string | undefined, clientSecret: string | undefined, keyword: string, mallMatch: string): Promise<{ ok: boolean; rank?: number | null; total?: number; title?: string | null; error?: string }> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const q = keyword.trim()
  const m = mallMatch.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!q || !m) return { ok: false, error: '키워드와 내 몰/도메인을 입력해주세요' }
  let total = 0
  for (let page = 0; page < MAX_PAGES; page++) {
    const start = page * 100 + 1
    const res = await fetch(`${OPENAPI}/v1/search/shop.json?query=${encodeURIComponent(q)}&display=100&start=${start}&sort=sim`, { headers: hdr(clientId, clientSecret) }).catch(() => null)
    if (!res || !res.ok) { if (page === 0) return { ok: false, error: '쇼핑검색 호출 실패' }; break }
    const data = (await res.json().catch(() => null)) as { total?: number; items?: Array<{ title?: string; link?: string; mallName?: string }> } | null
    total = Number(data?.total) || total
    const items = data?.items || []
    for (let i = 0; i < items.length; i++) {
      const mall = String(items[i].mallName || '').toLowerCase()
      const link = String(items[i].link || '').toLowerCase()
      if (mall.includes(m) || link.includes(m)) {
        return { ok: true, rank: start + i, total, title: stripTags(String(items[i].title || '')) }
      }
    }
    if (items.length < 100) break
  }
  return { ok: true, rank: null, total }
}

export interface RankTarget { id: number; keyword: string; mall_match: string; last_rank: number | null; last_total: number | null; last_title: string | null; last_checked_at: string | null; prev_rank: number | null }

export async function listRankTargets(DB: D1Database, accountId: number): Promise<RankTarget[]> {
  await ensureRankTrackerSchema(DB)
  const r = await DB.prepare(`SELECT t.id, t.keyword, t.mall_match, t.last_rank, t.last_total, t.last_title, t.last_checked_at,
      (SELECT s.rank FROM ad_shop_rank_snapshots s WHERE s.target_id = t.id AND s.snap_date < date('now') ORDER BY s.snap_date DESC LIMIT 1) AS prev_rank
    FROM ad_rank_targets t WHERE t.account_id = ? ORDER BY t.id DESC`)
    .bind(accountId).all<RankTarget>().catch(() => null)
  return r?.results || []
}

export async function addRankTarget(env: Env, accountId: number, keyword: string, mallMatch: string): Promise<{ ok: boolean; error?: string }> {
  await ensureRankTrackerSchema(env.DB)
  const kw = keyword.trim(), mm = mallMatch.trim()
  if (kw.length < 1 || mm.length < 2) return { ok: false, error: '키워드와 내 몰/도메인을 입력해주세요' }
  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM ad_rank_targets WHERE account_id = ?').bind(accountId).first<{ c: number }>().catch(() => null)
  if ((count?.c || 0) >= RANK_CAP) return { ok: false, error: `추적 키워드는 최대 ${RANK_CAP}개까지입니다` }
  const ins = await env.DB.prepare('INSERT OR IGNORE INTO ad_rank_targets (account_id, keyword, mall_match) VALUES (?, ?, ?)').bind(accountId, kw, mm).run().catch(() => null)
  if (!ins || ins.meta?.changes === 0) return { ok: false, error: '이미 추적 중인 키워드입니다' }
  const id = Number(ins.meta?.last_row_id)
  await refreshRankTarget(env, accountId, id, kw, mm).catch(() => null)
  return { ok: true }
}

export async function deleteRankTarget(DB: D1Database, accountId: number, id: number): Promise<void> {
  await ensureRankTrackerSchema(DB)
  await DB.prepare('DELETE FROM ad_rank_targets WHERE id = ? AND account_id = ?').bind(id, accountId).run().catch(() => null)
  await DB.prepare('DELETE FROM ad_shop_rank_snapshots WHERE target_id = ?').bind(id).run().catch(() => null)
}

/** 한 타겟 순위 갱신 + 오늘 스냅샷 기록(멱등). */
export async function refreshRankTarget(env: Env, accountId: number, id: number, keyword: string, mallMatch: string): Promise<void> {
  const r = await findShopRank(naverOpenId(env), naverOpenSecret(env), keyword, mallMatch)
  if (!r.ok) return
  const today = new Date().toISOString().slice(0, 10)
  await env.DB.prepare("UPDATE ad_rank_targets SET last_rank = ?, last_total = ?, last_title = ?, last_checked_at = datetime('now') WHERE id = ?")
    .bind(r.rank ?? null, r.total ?? null, r.title ?? null, id).run().catch(() => null)
  await env.DB.prepare(`INSERT INTO ad_shop_rank_snapshots (target_id, account_id, rank, snap_date) VALUES (?, ?, ?, ?)
    ON CONFLICT(target_id, snap_date) DO UPDATE SET rank = excluded.rank`)
    .bind(id, accountId, r.rank ?? null, today).run().catch(() => null)
}

/** cron — 모든 타겟 일일 갱신(쿼터 보호 cap). */
export async function refreshAllRankTargets(env: Env, cap = 300): Promise<{ targets: number }> {
  await ensureRankTrackerSchema(env.DB)
  // SQLite: ASC 는 NULL 을 가장 먼저 정렬 → 미검사(신규) 타겟 우선.
  const rows = (await env.DB.prepare('SELECT id, account_id, keyword, mall_match FROM ad_rank_targets ORDER BY last_checked_at ASC LIMIT ?')
    .bind(cap).all<{ id: number; account_id: number; keyword: string; mall_match: string }>().catch(() => null))?.results || []
  for (const t of rows) {
    await refreshRankTarget(env, t.account_id, t.id, t.keyword, t.mall_match).catch(() => null)
  }
  return { targets: rows.length }
}

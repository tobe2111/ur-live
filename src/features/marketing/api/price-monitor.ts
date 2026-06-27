/**
 * 🆕 2026-06-27 유어애즈 — 가격 모니터링(쇼핑검색 최저가 추적).
 *   고객사가 자기 상품(검색어)을 등록 → 네이버쇼핑 최저가/최저몰 추적 + 내 판매가 비교.
 *   읽기 위주(쇼핑검색 read + DB write). 고정IP 불필요(오픈API). 일일 cron 자동 갱신.
 */
import { swallow } from '@/worker/utils/swallow'
import type { Env } from '@/worker/types/env'
import { lowestPrice } from './keyword-tools'

const MAX_WATCHES_PER_SELLER = 50
const MAX_CHECK_PER_RUN = 300

const _schemaDone = new WeakSet<object>()
export async function ensurePriceSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_price_watches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    query TEXT NOT NULL,
    my_price INTEGER,
    last_lowest INTEGER,
    last_mall TEXT,
    last_total INTEGER,
    last_checked_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(seller_id, query)
  )`).run().catch(swallow('price:watches'))
}

export interface PriceWatch { id: number; query: string; my_price: number | null; last_lowest: number | null; last_mall: string | null; last_total: number | null; last_checked_at: string | null }

const openId = (env: Env) => env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
const openSecret = (env: Env) => env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET

export async function listWatches(DB: D1Database, sellerId: number): Promise<PriceWatch[]> {
  await ensurePriceSchema(DB)
  const r = await DB.prepare('SELECT id, query, my_price, last_lowest, last_mall, last_total, last_checked_at FROM ad_price_watches WHERE seller_id = ? ORDER BY id DESC')
    .bind(sellerId).all<PriceWatch>().catch(() => null)
  return r?.results || []
}

/** 워치 1건의 최저가 즉시 조회 후 DB 갱신. */
export async function refreshWatch(env: Env, watchId: number, query: string): Promise<{ lowest: number; mall: string; total: number } | null> {
  const r = await lowestPrice(openId(env), openSecret(env), query)
  if (!r.ok || !r.data) return null
  await env.DB.prepare("UPDATE ad_price_watches SET last_lowest = ?, last_mall = ?, last_total = ?, last_checked_at = datetime('now') WHERE id = ?")
    .bind(r.data.lowest, r.data.mall, r.data.total, watchId).run().catch(() => null)
  return { lowest: r.data.lowest, mall: r.data.mall, total: r.data.total }
}

export async function addWatch(env: Env, sellerId: number, query: string, myPrice: number | null): Promise<{ ok: boolean; error?: string }> {
  await ensurePriceSchema(env.DB)
  const q = query.trim()
  if (q.length < 2) return { ok: false, error: '검색어를 2자 이상 입력해주세요' }
  const count = await env.DB.prepare('SELECT COUNT(*) AS c FROM ad_price_watches WHERE seller_id = ?').bind(sellerId).first<{ c: number }>().catch(() => null)
  if ((Number(count?.c) || 0) >= MAX_WATCHES_PER_SELLER) return { ok: false, error: `최대 ${MAX_WATCHES_PER_SELLER}개까지 등록할 수 있습니다` }
  const price = myPrice != null && Number.isFinite(myPrice) ? Math.max(0, Math.round(myPrice)) : null
  const res = await env.DB.prepare('INSERT INTO ad_price_watches (seller_id, query, my_price) VALUES (?, ?, ?) ON CONFLICT(seller_id, query) DO UPDATE SET my_price = excluded.my_price')
    .bind(sellerId, q, price).run().catch(() => null)
  if (!res) return { ok: false, error: '등록 실패' }
  // 등록 즉시 1회 조회.
  const row = await env.DB.prepare('SELECT id FROM ad_price_watches WHERE seller_id = ? AND query = ?').bind(sellerId, q).first<{ id: number }>().catch(() => null)
  if (row) await refreshWatch(env, row.id, q).catch(() => null)
  return { ok: true }
}

export async function deleteWatch(DB: D1Database, sellerId: number, id: number): Promise<void> {
  await ensurePriceSchema(DB)
  await DB.prepare('DELETE FROM ad_price_watches WHERE seller_id = ? AND id = ?').bind(sellerId, id).run()
}

/** cron — 모든 워치 최저가 갱신(오래된 것 우선, 1회 상한). 일 1회 권장. */
export async function refreshAllWatches(env: Env): Promise<{ checked: number }> {
  await ensurePriceSchema(env.DB)
  if (!openId(env) || !openSecret(env)) return { checked: 0 }
  const rows = (await env.DB.prepare(`SELECT id, query FROM ad_price_watches
    ORDER BY (last_checked_at IS NULL) DESC, last_checked_at ASC LIMIT ${MAX_CHECK_PER_RUN}`)
    .all<{ id: number; query: string }>().catch(() => null))?.results || []
  let checked = 0
  for (const w of rows) {
    const r = await refreshWatch(env, w.id, w.query).catch(() => null)
    if (r) checked++
  }
  return { checked }
}

/**
 * 🎬 "다녀온 사람들" 저장소 (2026-11-04) — 규칙·정렬 SSOT 는 `src/shared/creator-content.ts`.
 *
 * 표 둘:
 *   `store_creator_content` — 가게마다의 콘텐츠 한 줄(자동 후보 · 사장님이 주소로 넣은 것 · 유어딜 사람 숨김 기록)
 *   `store_content_crawl`   — 가게마다 언제 마지막으로 찾았나(자동 수집 커서)
 *
 * 🔑 **가게 = `seller_id` + 가게 이름**(`storeKeyFor`). 이용권마다가 아니라 가게마다다 — 같은 가게 이용권 열 개가
 *    같은 영상·블로그를 함께 쓴다(검색도 가게 단위로 한 번). 사장님이 한 이용권 화면에서 숨기면 그 가게 전체에서 숨는다.
 * 🔴 유어딜 사람(체험단·유어쇼츠·담은 사람)은 원본이 각자의 표에 있다. 여기엔 **숨김 기록만** 남긴다
 *    (`platform` 이 아니라 `ref_type` 으로 구분) — 원본을 지우면 그 사람의 체험단·유어샵 기록이 같이 사라진다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { normStoreName } from '../../../shared/creator-content'

const _ensured = new WeakSet<D1Database>()

export async function ensureCreatorContentTables(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS store_creator_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      store_key TEXT NOT NULL,
      seller_id INTEGER NOT NULL,
      platform TEXT NOT NULL,
      ext_id TEXT NOT NULL,
      url TEXT NOT NULL,
      title TEXT,
      thumb_url TEXT,
      author_name TEXT,
      author_meta TEXT,
      summary TEXT,
      published_at TEXT,
      sponsored INTEGER NOT NULL DEFAULT 0,
      embeddable INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'candidate',
      source TEXT NOT NULL DEFAULT 'auto',
      pinned INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(store_key, platform, ext_id)
    )`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_scc_store_status ON store_creator_content(store_key, status, pinned, position)`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS store_content_crawl (
      store_key TEXT PRIMARY KEY,
      seller_id INTEGER NOT NULL,
      store_name TEXT NOT NULL,
      address TEXT,
      naver_at TEXT,
      yt_at TEXT,
      seen_at TEXT
    )`),
    DB.prepare(`CREATE INDEX IF NOT EXISTS idx_scrawl_naver ON store_content_crawl(naver_at)`),
  ]).catch(() => null)
}

/** 가게 키. 가게 이름이 없으면 셀러 하나가 한 가게다. */
export function storeKeyFor(sellerId: number, storeName: string | null | undefined): string {
  return `${sellerId}:${normStoreName(storeName)}`
}

export interface ProductStore { product_id: number; seller_id: number; store_name: string | null; address: string | null; store_key: string }

export async function loadProductStore(DB: D1Database, productId: number): Promise<ProductStore | null> {
  const r = await DB.prepare(`SELECT id, seller_id, restaurant_name, restaurant_address FROM products WHERE id = ? LIMIT 1`)
    .bind(productId).first<{ id: number; seller_id: number | null; restaurant_name: string | null; restaurant_address: string | null }>()
    .catch(() => null)
  if (!r || !r.seller_id) return null
  return { product_id: r.id, seller_id: r.seller_id, store_name: r.restaurant_name, address: r.restaurant_address, store_key: storeKeyFor(r.seller_id, r.restaurant_name) }
}

/** 유어딜 사람 숨김 기록의 `platform` 값. 실제 SNS 플랫폼과 섞이지 않게 접두어를 붙인다. */
export const HIDE_REF = { seeding: 'urdeal_seeding', urshorts: 'urdeal_urshorts', pin: 'urdeal_pin' } as const

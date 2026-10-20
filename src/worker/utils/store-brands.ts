/**
 * 🏷️ 브랜드 묶음 — 여러 지점을 하나의 브랜드로 보여 준다 (2026-10-17 대표 "응응 다 해줘")
 *
 * ## 대표 확정 규칙 — "모든 건 지점 단위이고, 그 지점의 주인이 정한다"
 * 브랜드는 **보여 주기용 묶음**이다. 정산·수수료·권한·이용권 어느 것도 브랜드에 붙지 않는다
 * (전부 지점 = `sellers` 행에 그대로 있다). 그래서:
 *
 * - 브랜드를 만든 사람(본사)만 지점을 넣을 수 있고, 넣을 지점은 **그 사람이 운영할 수 있는 지점**이어야 한다
 *   (`canOperateStore` — 좌석 토큰 발급과 같은 근거). 가맹점은 점주가 본사를 운영자로 들인 경우에만 들어간다.
 * - 지점을 **빼는 것**은 브랜드를 만든 사람 또는 **그 지점 주인**이 할 수 있다(주인이 늘 이긴다).
 * - 한 지점은 브랜드 하나에만 속한다(`store_brand_members.seller_id` 가 기본키).
 *
 * 💰 돈 안 움직임. 테이블 두 개와 조회뿐이다.
 */
import { canOperateStore, isStoreOwner } from './seller-operators'

const ensured = new WeakSet<D1Database>()

export async function ensureStoreBrands(DB: D1Database): Promise<void> {
  if (ensured.has(DB)) return
  await DB.batch([
    DB.prepare(`CREATE TABLE IF NOT EXISTS store_brands (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      created_by_user_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      deleted_at DATETIME
    )`),
    DB.prepare(`CREATE TABLE IF NOT EXISTS store_brand_members (
      seller_id INTEGER PRIMARY KEY,
      brand_id INTEGER NOT NULL,
      added_by_user_id INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`),
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_store_brand_members_brand ON store_brand_members(brand_id)'),
    DB.prepare('CREATE INDEX IF NOT EXISTS idx_store_brands_creator ON store_brands(created_by_user_id)'),
  ])
  ensured.add(DB)
}

/** 주소에 쓰는 이름 — 영문 소문자·숫자·하이픈 3~30자. 앞뒤 하이픈 금지. */
export const BRAND_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/

/** 남의 화면처럼 보이는 이름은 막는다(주소가 `/brand/admin` 이면 운영 화면으로 오인한다). */
const RESERVED = new Set(['admin', 'urdeal', 'official', 'support', 'help', 'new', 'edit', 'api', 'brand', 'seller', 'store'])

export function normalizeBrandSlug(raw: unknown): string | null {
  const s = String(raw ?? '').trim().toLowerCase()
  if (!BRAND_SLUG_RE.test(s) || s.includes('--') || RESERVED.has(s)) return null
  return s
}

export function normalizeBrandName(raw: unknown): string | null {
  const s = String(raw ?? '').replace(/\s+/g, ' ').trim()
  return s.length >= 1 && s.length <= 40 ? s : null
}

/** 주소를 정하지 않았을 때의 기본값 — 사람이 읽을 필요 없는 고유값. */
export function randomBrandSlug(): string {
  const a = 'abcdefghijkmnpqrstuvwxyz23456789'
  const bytes = crypto.getRandomValues(new Uint8Array(8))
  return 'b-' + [...bytes].map((b) => a[b % a.length]).join('')
}

export interface BrandRow { id: number; slug: string; name: string; created_by_user_id: number }

export async function getBrand(DB: D1Database, id: number): Promise<BrandRow | null> {
  await ensureStoreBrands(DB)
  return DB.prepare('SELECT id, slug, name, created_by_user_id FROM store_brands WHERE id = ? AND deleted_at IS NULL LIMIT 1')
    .bind(id).first<BrandRow>()
}

export async function createBrand(DB: D1Database, userId: number, name: string, slug: string): Promise<{ ok: true; brand: BrandRow } | { ok: false; code: 'SLUG_TAKEN' }> {
  await ensureStoreBrands(DB)
  const r = await DB.prepare('INSERT OR IGNORE INTO store_brands (slug, name, created_by_user_id) VALUES (?, ?, ?)')
    .bind(slug, name, userId).run()
  if (!r.meta?.changes) return { ok: false, code: 'SLUG_TAKEN' }
  return { ok: true, brand: { id: Number(r.meta.last_row_id), slug, name, created_by_user_id: userId } }
}

export type AddResult =
  | { ok: true }
  | { ok: false; code: 'NOT_BRAND_OWNER' | 'NOT_OPERATOR' | 'IN_OTHER_BRAND' | 'NO_BRAND' }

/**
 * 지점을 브랜드에 넣는다. 이미 **이 브랜드**에 있으면 멱등 성공.
 * 다른 브랜드에 있으면 옮기지 않는다 — 그 지점 주인이 먼저 빼야 한다(남의 묶음을 빼앗지 않게).
 */
export async function addStoreToBrand(DB: D1Database, userId: number, brandId: number, sellerId: number): Promise<AddResult> {
  const brand = await getBrand(DB, brandId)
  if (!brand) return { ok: false, code: 'NO_BRAND' }
  if (Number(brand.created_by_user_id) !== userId) return { ok: false, code: 'NOT_BRAND_OWNER' }
  const access = await canOperateStore(DB, userId, sellerId)
  if (!access.ok) return { ok: false, code: 'NOT_OPERATOR' }
  const ins = await DB.prepare('INSERT OR IGNORE INTO store_brand_members (seller_id, brand_id, added_by_user_id) VALUES (?, ?, ?)')
    .bind(sellerId, brandId, userId).run()
  if (ins.meta?.changes) return { ok: true }
  const cur = await DB.prepare('SELECT brand_id FROM store_brand_members WHERE seller_id = ? LIMIT 1')
    .bind(sellerId).first<{ brand_id: number }>()
  return cur && Number(cur.brand_id) === brandId ? { ok: true } : { ok: false, code: 'IN_OTHER_BRAND' }
}

/** 지점을 뺀다 — 브랜드를 만든 사람이거나 그 **지점 주인**이면 된다. */
export async function removeStoreFromBrand(DB: D1Database, userId: number, sellerId: number): Promise<{ ok: boolean; code?: 'NOT_MEMBER' | 'FORBIDDEN' }> {
  await ensureStoreBrands(DB)
  const m = await DB.prepare(
    `SELECT m.brand_id, b.created_by_user_id FROM store_brand_members m JOIN store_brands b ON b.id = m.brand_id
      WHERE m.seller_id = ? LIMIT 1`,
  ).bind(sellerId).first<{ brand_id: number; created_by_user_id: number }>()
  if (!m) return { ok: false, code: 'NOT_MEMBER' }
  const allowed = Number(m.created_by_user_id) === userId || await isStoreOwner(DB, userId, sellerId)
  if (!allowed) return { ok: false, code: 'FORBIDDEN' }
  await DB.prepare('DELETE FROM store_brand_members WHERE seller_id = ? AND brand_id = ?').bind(sellerId, m.brand_id).run()
  return { ok: true }
}

/** 내가 만든 브랜드 + 각 브랜드의 지점 id. */
export async function listMyBrands(DB: D1Database, userId: number): Promise<Array<BrandRow & { seller_ids: number[] }>> {
  await ensureStoreBrands(DB)
  const { results: brands } = await DB.prepare(
    'SELECT id, slug, name, created_by_user_id FROM store_brands WHERE created_by_user_id = ? AND deleted_at IS NULL ORDER BY id LIMIT 20',
  ).bind(userId).all<BrandRow>()
  if (!brands?.length) return []
  const ids = brands.map((b) => b.id)
  const { results: members } = await DB.prepare(
    `SELECT seller_id, brand_id FROM store_brand_members WHERE brand_id IN (${ids.map(() => '?').join(',')}) LIMIT 2000`,
  ).bind(...ids).all<{ seller_id: number; brand_id: number }>()
  return brands.map((b) => ({ ...b, seller_ids: (members || []).filter((m) => Number(m.brand_id) === b.id).map((m) => Number(m.seller_id)) }))
}

/** 지점이 속한 브랜드(손님 화면 — 이용권 상세에서 "이 브랜드의 다른 지점" 링크). */
export async function brandOfStore(DB: D1Database, sellerId: number): Promise<{ slug: string; name: string; branch_count: number } | null> {
  await ensureStoreBrands(DB)
  return DB.prepare(
    `SELECT b.slug, b.name, (SELECT COUNT(*) FROM store_brand_members m2 WHERE m2.brand_id = b.id) AS branch_count
       FROM store_brand_members m JOIN store_brands b ON b.id = m.brand_id
      WHERE m.seller_id = ? AND b.deleted_at IS NULL LIMIT 1`,
  ).bind(sellerId).first<{ slug: string; name: string; branch_count: number }>()
}

/**
 * 🎬 "다녀온 사람들" API (2026-11-04 대표 확정 — 손님 2 + 사장님 2)
 *
 * 공개:
 *   GET    /api/creator-content/:productId                손님 화면 — 보이는 것만, 정렬은 `sortForCustomer`
 * 사장님(자기 이용권만 — products.seller_id 대조) · 어드민(전부):
 *   GET    /api/seller/creator-content/:productId         후보·보이는 중·숨김 + 유어딜 사람
 *   POST   /api/seller/creator-content/:productId         { url } 주소로 추가(바로 보임)
 *   PATCH  /api/seller/creator-content/:productId/items/:id   { status?: 'visible'|'hidden', pinned?: boolean }
 *   DELETE /api/seller/creator-content/:productId/items/:id   삭제(다음 자동 검색에서 다시 안 올라온다)
 *   PUT    /api/seller/creator-content/:productId/order   { ids: number[] } 보이는 순서
 *   PATCH  /api/seller/creator-content/:productId/refs    { ref: 'seeding'|'urshorts'|'pin', id, hidden } 유어딜 사람 숨기기
 *   (어드민은 같은 모양으로 `/api/admin/creator-content/...`)
 *
 * 🔴 유어딜 사람은 **숨기기만** 된다(삭제 없음 — 2026-11-04 시안 규칙). 소개로 파는 사람을 가게가 지울 수 있으면
 *    그 사람은 다시 안 판다. 원본(체험단·유어쇼츠·담기)은 각자의 표에 그대로 있다.
 */
import { Hono, type Context } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import type { Env } from '../../../worker/types/env'
import { requireAdmin, requireSeller, getCurrentUser } from '../../../worker/middleware/auth'
import { publicCache } from '../../../worker/middleware/edge-cache'
import { safeError } from '../../../worker/utils/safe-error'
import {
  parseContentUrl, kindOf, sortForCustomer, youtubeThumb, isStoreOwnPost, MAX_POSTS_PER_AUTHOR,
  type ContentItem, type ContentPlatform, type PinPerson,
} from '../../../shared/creator-content'
import { ensureCreatorContentTables, loadProductStore, HIDE_REF, type ProductStore } from './content-db'
import { fetchContentMeta } from './content-meta'

type C = Context<{ Bindings: Env }>

interface Row {
  id: number; platform: string; ext_id: string; url: string; title: string | null; thumb_url: string | null
  author_name: string | null; author_meta: string | null; summary: string | null; published_at: string | null
  sponsored: number; embeddable: number; status: string; source: string; pinned: number; position: number
}

const ROW_COLS = `id, platform, ext_id, url, title, thumb_url, author_name, author_meta, summary, published_at,
  sponsored, embeddable, status, source, pinned, position`

function toItem(r: Row): ContentItem {
  const p = r.platform as ContentPlatform
  return {
    id: `c:${r.id}`, platform: p, kind: kindOf(p), ext_id: r.ext_id, url: r.url, title: r.title, thumb_url: r.thumb_url,
    author_name: r.author_name, author_meta: r.author_meta, summary: r.summary, published_at: r.published_at,
    sponsored: r.sponsored === 1, embeddable: r.embeddable === 1, urdeal: null, pinned: r.pinned === 1, position: r.position,
  }
}

function followers(n: number | null | undefined): string | null {
  const v = Number(n)
  if (!Number.isFinite(v) || v <= 0) return null
  return v >= 10000 ? `팔로워 ${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}만` : `팔로워 ${v.toLocaleString('ko-KR')}`
}

/** 유어딜 사람 — 체험단 게시물 · 유어쇼츠 · 담은 사람. 표가 없는 환경이면 조용히 빈다(손님 화면이 깨지지 않게). */
async function loadUrdealPeople(DB: D1Database, s: ProductStore) {
  const seeding = await DB.prepare(`
    SELECT a.id, a.platform, a.sns_username, a.follower_count, a.post_url, a.updated_at
      FROM seeding_applications a JOIN products p ON p.id = a.product_id
     WHERE (a.product_id = ? OR (p.restaurant_name = ? AND COALESCE(p.restaurant_address, '') = COALESCE(?, '')))
       AND a.status IN ('posted', 'completed') AND a.post_url IS NOT NULL
     ORDER BY a.updated_at DESC LIMIT 10`).bind(s.product_id, s.store_name, s.address)
    .all<{ id: number; platform: string; sns_username: string | null; follower_count: number | null; post_url: string; updated_at: string | null }>()
    .then((r) => r.results ?? []).catch(() => [])
  const shorts = await DB.prepare(`
    SELECT id, video_id, title, channel, thumb_url FROM home_shorts
     WHERE product_id = ? AND is_active = 1 ORDER BY sort_order, id DESC LIMIT 6`).bind(s.product_id)
    .all<{ id: number; video_id: string; title: string | null; channel: string | null; thumb_url: string | null }>()
    .then((r) => r.results ?? []).catch(() => [])
  const pins = await DB.prepare(`
    SELECT u.id AS user_id, u.handle, u.name, u.profile_image AS avatar
      FROM product_pins pp JOIN users u ON u.id = pp.user_id
     WHERE pp.product_id = ? AND u.handle IS NOT NULL
     ORDER BY pp.click_count DESC, pp.created_at DESC LIMIT 12`).bind(s.product_id)
    .all<PinPerson>().then((r) => r.results ?? []).catch(() => [])

  const items: ContentItem[] = []
  for (const a of seeding) {
    const parsed = parseContentUrl(a.post_url)
    if (!parsed) continue
    items.push({
      id: `s:${a.id}`, platform: parsed.platform, kind: kindOf(parsed.platform), ext_id: parsed.extId, url: parsed.url,
      title: null, thumb_url: parsed.platform === 'youtube' ? youtubeThumb(parsed.extId) : null,
      author_name: a.sns_username ? `@${a.sns_username}` : null, author_meta: followers(a.follower_count), summary: null,
      published_at: a.updated_at, sponsored: true, embeddable: false, urdeal: 'seeding', pinned: false, position: 0,
    })
  }
  for (const v of shorts) {
    items.push({
      id: `u:${v.id}`, platform: 'youtube', kind: 'video', ext_id: v.video_id, url: `https://www.youtube.com/shorts/${v.video_id}`,
      title: v.title, thumb_url: v.thumb_url ?? youtubeThumb(v.video_id), author_name: v.channel, author_meta: null, summary: null,
      published_at: null, sponsored: false, embeddable: true, urdeal: 'urshorts', pinned: false, position: 0,
    })
  }
  return { items, pins }
}

async function hiddenRefs(DB: D1Database, storeKey: string): Promise<Set<string>> {
  const { results } = await DB.prepare(
    `SELECT platform, ext_id FROM store_creator_content WHERE store_key = ? AND platform LIKE 'urdeal_%' AND status = 'hidden'`)
    .bind(storeKey).all<{ platform: string; ext_id: string }>().catch(() => ({ results: [] as { platform: string; ext_id: string }[] }))
  return new Set((results ?? []).map((r) => `${r.platform}:${r.ext_id}`))
}

function refKeyOf(item: ContentItem): string | null {
  const [t, id] = item.id.split(':')
  if (t === 's') return `${HIDE_REF.seeding}:${id}`
  if (t === 'u') return `${HIDE_REF.urshorts}:${id}`
  return null
}

/* ─────────────────────────── 공개 ─────────────────────────── */

export const creatorContentPublicRoutes = new Hono<{ Bindings: Env }>()

creatorContentPublicRoutes.get('/:productId', publicCache(600), async (c) => {
  try {
    const productId = Number(c.req.param('productId'))
    if (!Number.isFinite(productId) || productId <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
    const DB = c.env.DB
    await ensureCreatorContentTables(DB)
    const s = await loadProductStore(DB, productId)
    if (!s) return c.json({ success: true, data: { items: [], pinners: [] } })
    const [rows, people, hidden] = await Promise.all([
      DB.prepare(`SELECT ${ROW_COLS} FROM store_creator_content
                   WHERE store_key = ? AND status = 'visible' AND platform NOT LIKE 'urdeal_%'
                   ORDER BY pinned DESC, position ASC, id DESC LIMIT 40`).bind(s.store_key).all<Row>()
        .then((r) => r.results ?? []).catch(() => [] as Row[]),
      loadUrdealPeople(DB, s),
      hiddenRefs(DB, s.store_key),
    ])
    // 🏪 자동으로 들어온 글은 손님에게 가기 전에 한 번 더 거른다 — 가게 자기 글 제외 · 한 사람 2개까지.
    //   사장님·어드민이 직접 넣은 글(source owner/admin)은 그 사람이 고른 것이라 그대로 둔다.
    const perAuthor = new Map<string, number>()
    const curated = rows.filter((r) => {
      if (r.source !== 'auto') return true
      if (isStoreOwnPost(r.author_name, s.store_name ?? '')) return false
      const k = `${r.platform}:${(r.author_name || '').trim()}`
      const n = (perAuthor.get(k) ?? 0) + 1
      perAuthor.set(k, n)
      return n <= MAX_POSTS_PER_AUTHOR
    })
    const items = sortForCustomer([
      ...people.items.filter((i) => !hidden.has(refKeyOf(i) ?? '')),
      ...curated.map(toItem),
    ])
    const pinners = people.pins.filter((p) => !hidden.has(`${HIDE_REF.pin}:${p.user_id}`))
    return c.json({ success: true, data: { items, pinners } })
  } catch (err) {
    return safeError(c, err, '콘텐츠를 불러오지 못했습니다', '[creator-content]')
  }
})

/* ─────────────────────────── 사장님 · 어드민 ─────────────────────────── */

/** 이 요청자가 이 이용권의 가게를 관리할 수 있나. 어드민이면 누구 것이든. */
async function ownedStore(c: C, admin: boolean): Promise<ProductStore | null> {
  const productId = Number(c.req.param('productId'))
  if (!Number.isFinite(productId) || productId <= 0) return null
  const s = await loadProductStore(c.env.DB, productId)
  if (!s) return null
  if (admin) return s
  const me = Number(getCurrentUser(c)?.id)
  // 🔴 소유권. 이 비교가 빠지면 아무 셀러나 남의 가게에 영상을 걸거나 지운다(IDOR).
  return Number.isFinite(me) && s.seller_id != null && me === s.seller_id ? s : null
}

function manageRoutes(admin: boolean) {
  const r = new Hono<{ Bindings: Env }>()
  r.use('*', admin ? requireAdmin() : requireSeller())

  r.get('/:productId', async (c) => {
    try {
      const DB = c.env.DB
      await ensureCreatorContentTables(DB)
      const s = await ownedStore(c, admin)
      if (!s) return c.json({ success: false, error: '내 이용권이 아닙니다' }, 403)
      const [{ results }, people, hidden] = await Promise.all([
        DB.prepare(`SELECT ${ROW_COLS} FROM store_creator_content
                     WHERE store_key = ? AND status != 'deleted' AND platform NOT LIKE 'urdeal_%'
                     ORDER BY pinned DESC, position ASC, id DESC LIMIT 200`).bind(s.store_key).all<Row>(),
        loadUrdealPeople(DB, s),
        hiddenRefs(DB, s.store_key),
      ])
      const rows = (results ?? []).map((row) => ({ ...toItem(row), status: row.status, source: row.source }))
      const urdeal = people.items.map((i) => ({ ...i, hidden: hidden.has(refKeyOf(i) ?? '') }))
      const pinners = people.pins.map((p) => ({ ...p, hidden: hidden.has(`${HIDE_REF.pin}:${p.user_id}`) }))
      return c.json({ success: true, data: { store_name: s.store_name, items: rows, urdeal, pinners } })
    } catch (err) {
      return safeError(c, err, '콘텐츠를 불러오지 못했습니다', '[creator-content:manage]')
    }
  })

  r.post('/:productId', async (c) => {
    try {
      const DB = c.env.DB
      await ensureCreatorContentTables(DB)
      const s = await ownedStore(c, admin)
      if (!s) return c.json({ success: false, error: '내 이용권이 아닙니다' }, 403)
      const body = await c.req.json<{ url?: string }>().catch(() => ({} as { url?: string }))
      const parsed = parseContentUrl(body.url)
      if (!parsed) return c.json({ success: false, error: '유튜브 · 인스타그램 · 틱톡 · 네이버 클립 · 네이버 블로그 주소를 붙여 넣어 주세요' }, 400)
      const meta = await fetchContentMeta(parsed.platform, parsed.extId, parsed.url).catch(() => null)
      const source = admin ? 'admin' : 'owner'
      // 이미 있으면(자동 후보·숨김·삭제) 보이게 되돌린다 — 사장님이 직접 고른 것이다.
      await DB.prepare(`
        INSERT INTO store_creator_content (store_key, seller_id, platform, ext_id, url, title, thumb_url, author_name, summary, embeddable, status, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'visible', ?)
        ON CONFLICT(store_key, platform, ext_id) DO UPDATE SET status = 'visible', updated_at = CURRENT_TIMESTAMP,
          title = COALESCE(store_creator_content.title, excluded.title), thumb_url = COALESCE(store_creator_content.thumb_url, excluded.thumb_url)`)
        .bind(s.store_key, s.seller_id ?? 0, parsed.platform, parsed.extId, parsed.url, meta?.title ?? null, meta?.thumb_url ?? null,
          meta?.author_name ?? null, meta?.summary ?? null, meta?.embeddable ? 1 : 0, source).run()
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '콘텐츠를 추가하지 못했습니다', '[creator-content:add]')
    }
  })

  r.patch('/:productId/items/:id', async (c) => {
    try {
      const DB = c.env.DB
      const s = await ownedStore(c, admin)
      if (!s) return c.json({ success: false, error: '내 이용권이 아닙니다' }, 403)
      const id = Number(c.req.param('id'))
      const body = await c.req.json<{ status?: string; pinned?: boolean }>().catch(() => ({} as { status?: string; pinned?: boolean }))
      const status = body.status === 'visible' || body.status === 'hidden' ? body.status : null
      if (!Number.isFinite(id) || (status === null && typeof body.pinned !== 'boolean')) return c.json({ success: false, error: '잘못된 요청' }, 400)
      // 🔴 store_key 를 WHERE 에 — 남의 가게 줄 id 를 넣어도 안 바뀐다.
      const res = await DB.prepare(`UPDATE store_creator_content
          SET status = COALESCE(?, status), pinned = COALESCE(?, pinned), updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND store_key = ? AND status != 'deleted' AND platform NOT LIKE 'urdeal_%'`)
        .bind(status, typeof body.pinned === 'boolean' ? (body.pinned ? 1 : 0) : null, id, s.store_key).run()
      if (!res.meta.changes) return c.json({ success: false, error: '찾을 수 없습니다' }, 404)
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '바꾸지 못했습니다', '[creator-content:patch]')
    }
  })

  r.delete('/:productId/items/:id', async (c) => {
    try {
      const s = await ownedStore(c, admin)
      if (!s) return c.json({ success: false, error: '내 이용권이 아닙니다' }, 403)
      const id = Number(c.req.param('id'))
      // 지우지 않고 'deleted' 로 둔다 — 그래야 다음 자동 검색이 같은 글을 후보로 다시 올리지 않는다.
      const res = await c.env.DB.prepare(`UPDATE store_creator_content SET status = 'deleted', pinned = 0, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND store_key = ? AND platform NOT LIKE 'urdeal_%'`).bind(id, s.store_key).run()
      if (!res.meta.changes) return c.json({ success: false, error: '찾을 수 없습니다' }, 404)
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '삭제하지 못했습니다', '[creator-content:delete]')
    }
  })

  r.put('/:productId/order', async (c) => {
    try {
      const DB = c.env.DB
      const s = await ownedStore(c, admin)
      if (!s) return c.json({ success: false, error: '내 이용권이 아닙니다' }, 403)
      const body = await c.req.json<{ ids?: unknown }>().catch(() => ({} as { ids?: unknown }))
      const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter((n) => Number.isFinite(n) && n > 0).slice(0, 100) : []
      if (!ids.length) return c.json({ success: false, error: '잘못된 요청' }, 400)
      await DB.batch(ids.map((id, i) => DB.prepare(
        `UPDATE store_creator_content SET position = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND store_key = ?`).bind(i + 1, id, s.store_key)))
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '순서를 바꾸지 못했습니다', '[creator-content:order]')
    }
  })

  r.patch('/:productId/refs', async (c) => {
    try {
      const DB = c.env.DB
      await ensureCreatorContentTables(DB)
      const s = await ownedStore(c, admin)
      if (!s) return c.json({ success: false, error: '내 이용권이 아닙니다' }, 403)
      const body = await c.req.json<{ ref?: string; id?: number; hidden?: boolean }>().catch(() => ({} as { ref?: string; id?: number; hidden?: boolean }))
      const platform = body.ref === 'seeding' ? HIDE_REF.seeding : body.ref === 'urshorts' ? HIDE_REF.urshorts : body.ref === 'pin' ? HIDE_REF.pin : null
      const id = Number(body.id)
      if (!platform || !Number.isFinite(id) || id <= 0 || typeof body.hidden !== 'boolean') return c.json({ success: false, error: '잘못된 요청' }, 400)
      await DB.prepare(`
        INSERT INTO store_creator_content (store_key, seller_id, platform, ext_id, url, status, source)
        VALUES (?, ?, ?, ?, '', ?, ?)
        ON CONFLICT(store_key, platform, ext_id) DO UPDATE SET status = excluded.status, updated_at = CURRENT_TIMESTAMP`)
        .bind(s.store_key, s.seller_id ?? 0, platform, String(id), body.hidden ? 'hidden' : 'visible', admin ? 'admin' : 'owner').run()
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '바꾸지 못했습니다', '[creator-content:refs]')
    }
  })

  return r
}

export const creatorContentSellerRoutes = manageRoutes(false)
export const creatorContentAdminRoutes = manageRoutes(true)

/**
 * 🗂️ 어드민 — 가게 목록(후보 많은 순) (2026-11-09 대표 *"전부 해줘"* — 데모 매장은 사장님이 없어 후보를 고를 사람이 없었다).
 *   GET /api/admin/creator-content-stores → [{ store_key, store_name, address, candidates, visible, product_id }]
 *   product_id 는 그 가게 이용권 하나 — 관리 API(`/api/admin/creator-content/:productId`)가 상품 기준이라 그 입구로 쓴다.
 */
export const creatorContentAdminStoresRoutes = new Hono<{ Bindings: Env }>()
creatorContentAdminStoresRoutes.use('*', requireAdmin())
creatorContentAdminStoresRoutes.get('/', async (c) => {
  try {
    const DB = c.env.DB
    await ensureCreatorContentTables(DB)
    const { results } = await DB.prepare(`
      SELECT k.store_key, k.store_name, k.address,
             COALESCE(SUM(s.status = 'candidate'), 0) AS candidates,
             COALESCE(SUM(s.status = 'visible'), 0) AS visible,
             (SELECT p.id FROM products p WHERE p.restaurant_name = k.store_name AND COALESCE(p.restaurant_address, '') = COALESCE(k.address, '')
                ORDER BY p.is_active DESC, p.id DESC LIMIT 1) AS product_id
        FROM store_content_crawl k
        LEFT JOIN store_creator_content s ON s.store_key = k.store_key AND s.platform NOT LIKE 'urdeal_%'
       GROUP BY k.store_key
       ORDER BY candidates DESC, visible DESC LIMIT 400`).all()
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    return safeError(c, err, '가게 목록을 불러오지 못했습니다', '[creator-content:admin-stores]')
  }
})

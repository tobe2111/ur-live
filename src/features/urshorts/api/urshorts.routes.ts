/**
 * 🎬 유어쇼츠 API (2026-09-07 대표 확정)
 *
 * 공개:
 *   GET  /api/urshorts            홈 레일용 최신 12편 · `?all=1` 이면 뷰어(`/videos`)용 전부
 *
 * 어드민:
 *   GET    /api/admin/urshorts        전체 목록(미연결·꺼진 것 포함) + 채널 주소
 *   POST   /api/admin/urshorts        주소로 추가
 *   PATCH  /api/admin/urshorts/:id    이용권 연결 · 켜기/끄기 · 순서
 *   DELETE /api/admin/urshorts/:id    삭제
 *   PUT    /api/admin/urshorts/channel 채널 주소 저장
 *
 * 🔴 **이 파일의 불변식**: 공개 GET 은 `products` 와 **INNER JOIN** 이라
 *    이용권이 안 붙은 영상은 홈에도 뷰어에도 안 나간다. LEFT JOIN 으로 바꾸면
 *    홈이 "살 수 없는 영상"을 보여 주고, 그건 매출 장치가 아니라 이탈 장치가 된다.
 *    상품이 내려가면(`is_active=0`) 그 영상도 같이 사라진다 — 없는 딜을 파는 영상이 남지 않는다.
 */
import { Hono } from 'hono'
import { edgeCache } from '@/worker/middleware/edge-cache'
import { requireAdmin } from '@/worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error'
import { intParam } from '@/shared/pagination'
import {
  parseYouTubeUrl, youTubeThumbUrl, parseIsoDurationSec,
  URSHORTS_RAIL_LIMIT, URSHORTS_MAX_DURATION_SEC,
} from '@/shared/urshorts'
import type { Env } from '@/worker/types/env'

const urshortsRoutes = new Hono<{ Bindings: Env }>()
const adminUrshortsRoutes = new Hono<{ Bindings: Env }>()

const _ensured = new WeakSet<D1Database>()
/** per-request DDL 금지 룰(CLAUDE.md 머니/정합성 §부수) 을 지키려 DB 당 1회만. */
async function ensureTable(DB: D1Database) {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS home_shorts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id TEXT NOT NULL UNIQUE,
      title TEXT,
      channel TEXT,
      thumb_url TEXT,
      product_id INTEGER,
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'manual',
      duration_sec INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(() => {})
  // 기존 테이블에도 붙인다(이미 있으면 무해).
  await DB.prepare(`ALTER TABLE home_shorts ADD COLUMN duration_sec INTEGER`).run().catch(() => {})
  await DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_home_shorts_live ON home_shorts(is_active, sort_order, id)`
  ).run().catch(() => {})
}

/**
 * 공개 목록 SELECT.
 * 🔴 `JOIN products` 는 INNER 다 — 이용권이 안 붙었거나 그 상품이 내려갔으면 행 자체가 없다.
 */
const PUBLIC_SQL = `
  SELECT s.id, s.video_id, s.title, s.channel, s.thumb_url,
         s.duration_sec AS duration_sec,
         s.product_id AS product_id,
         p.name  AS product_name,
         p.restaurant_name AS store_name,
         p.image_url AS product_image,
         p.price AS price,
         p.original_price AS original_price,
         p.discount_rate AS discount_rate
    FROM home_shorts s
    JOIN products p ON p.id = s.product_id
   WHERE s.is_active = 1
     AND p.is_active = 1
   ORDER BY s.sort_order ASC, s.id DESC
   LIMIT ?`

// ── 공개 ──────────────────────────────────────────────────────────────────────
urshortsRoutes.get('/', edgeCache(300), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    // `?all=1` 은 뷰어용. 그래도 상한은 둔다 — 레일 끝을 아무도 못 보는 길이는 의미가 없다.
    const all = c.req.query('all') === '1'
    const limit = all ? intParam(c.req.query('limit'), 60) : URSHORTS_RAIL_LIMIT
    const { results } = await DB.prepare(PUBLIC_SQL)
      .bind(Math.max(1, Math.min(100, limit)))
      .all()
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    // fail-soft: 유어쇼츠가 죽어도 홈은 열려야 한다. 레일은 빈 배열이면 스스로 숨는다.
    if (c.env.ENVIRONMENT === 'development') console.error('[urshorts]', err)
    return c.json({ success: true, data: [] })
  }
})

// ── 어드민 ────────────────────────────────────────────────────────────────────
adminUrshortsRoutes.get('/', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const { results } = await DB.prepare(`
      SELECT s.*, p.name AS product_name, p.restaurant_name AS store_name, p.price AS price
        FROM home_shorts s
        LEFT JOIN products p ON p.id = s.product_id
       ORDER BY s.sort_order ASC, s.id DESC
       LIMIT 200`).all()
    const ch = await DB.prepare(
      `SELECT value FROM platform_settings WHERE key = 'urshorts_channel_url'`
    ).first<{ value: string }>().catch(() => null)
    return c.json({ success: true, data: results ?? [], channel_url: ch?.value ?? '' })
  } catch (err) {
    return safeError(c, err, '유어쇼츠 목록을 불러오지 못했습니다', '[urshorts:admin]')
  }
})

/**
 * 🔴 **쇼츠만 받는다** (2026-09-07 대표 — "유튜브 쇼츠만 들고와야 하는거기도 한 것도 인지해줘").
 *
 * 가로 영상을 9:16 카드에 넣으면 위아래 검은 띠가 생기고, 10분짜리에 구매 바를 붙이는 건
 * 쇼츠가 아니라 그냥 유튜브다. 두 단계로 거른다.
 *
 * ① **주소 모양** — `/shorts/ID` 는 그 자체로 증명이다(비용 0).
 * ② **길이 확인** — `watch?v=` 는 쇼츠일 수도 아닐 수도 있어 `videos.list` 로 재생시간을 본다.
 *    이 호출은 **1 unit** 이다(검색이 100 units 인 것과 다르다) — 12편이면 12 units 라 무시해도 된다.
 *
 * ⚠️ **키가 없거나 확인이 실패하면 통과시키지 않는다.** 모르는 것을 "아마 쇼츠겠지"로 넣으면
 *    홈에 가로 영상이 섞이고, 그건 에러가 아니라 그냥 못생긴 화면으로만 드러난다.
 *    그때 어드민은 `/shorts/` 주소를 붙이면 된다 — 그 길은 키 없이도 항상 열려 있다.
 */
async function verifyIsShort(
  env: Env, videoId: string, form: string,
): Promise<{ ok: true; duration: number | null } | { ok: false; reason: string }> {
  if (form === 'shorts') return { ok: true, duration: null }
  const key = env.YOUTUBE_API_KEY
  if (!key) {
    return { ok: false, reason: '쇼츠 주소(youtube.com/shorts/...)를 붙여 주세요' }
  }
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails&id=${videoId}&key=${key}`,
    )
    if (!r.ok) return { ok: false, reason: '쇼츠 주소(youtube.com/shorts/...)를 붙여 주세요' }
    const j = await r.json() as { items?: Array<{ contentDetails?: { duration?: string } }> }
    const sec = parseIsoDurationSec(j?.items?.[0]?.contentDetails?.duration)
    if (sec == null) return { ok: false, reason: '영상을 찾지 못했습니다' }
    if (sec > URSHORTS_MAX_DURATION_SEC) {
      return { ok: false, reason: `쇼츠가 아닙니다 (${Math.round(sec / 60)}분 영상)` }
    }
    return { ok: true, duration: sec }
  } catch {
    return { ok: false, reason: '쇼츠 주소(youtube.com/shorts/...)를 붙여 주세요' }
  }
}

adminUrshortsRoutes.post('/', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const body = await c.req.json<{ url?: string; title?: string; channel?: string; product_id?: number }>()
    const parsed = parseYouTubeUrl(body?.url)
    // 추측해서 저장하지 않는다 — 틀린 id 는 죽은 썸네일로만 드러난다.
    if (!parsed) return c.json({ success: false, error: '유튜브 주소에서 영상을 찾지 못했습니다' }, 400)
    const verdict = await verifyIsShort(c.env, parsed.id, parsed.form)
    if (!verdict.ok) return c.json({ success: false, error: verdict.reason }, 400)
    const pid = Number(body?.product_id)
    const r = await DB.prepare(`
      INSERT OR IGNORE INTO home_shorts
        (video_id, title, channel, thumb_url, product_id, sort_order, source, duration_sec)
      VALUES (?, ?, ?, ?, ?, 0, 'manual', ?)`)
      .bind(parsed.id, (body?.title ?? '').slice(0, 200) || null, (body?.channel ?? '').slice(0, 100) || null,
            youTubeThumbUrl(parsed.id), Number.isFinite(pid) && pid > 0 ? pid : null,
            verdict.duration)
      .run()
    if (!r.meta.changes) return c.json({ success: false, error: '이미 등록된 영상입니다' }, 409)
    return c.json({ success: true, video_id: parsed.id })
  } catch (err) {
    return safeError(c, err, '유어쇼츠를 추가하지 못했습니다', '[urshorts:admin]')
  }
})

adminUrshortsRoutes.patch('/:id', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
    const b = await c.req.json<{ product_id?: number | null; is_active?: boolean; sort_order?: number }>()
    const sets: string[] = []
    const binds: unknown[] = []
    if ('product_id' in b) {
      const pid = Number(b.product_id)
      sets.push('product_id = ?'); binds.push(Number.isFinite(pid) && pid > 0 ? pid : null)
    }
    if ('is_active' in b) { sets.push('is_active = ?'); binds.push(b.is_active ? 1 : 0) }
    if ('sort_order' in b) { sets.push('sort_order = ?'); binds.push(intParam(b.sort_order, 0)) }
    if (!sets.length) return c.json({ success: false, error: '바꿀 것이 없습니다' }, 400)
    binds.push(id)
    await DB.prepare(`UPDATE home_shorts SET ${sets.join(', ')} WHERE id = ?`).bind(...binds).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '유어쇼츠를 수정하지 못했습니다', '[urshorts:admin]')
  }
})

adminUrshortsRoutes.delete('/:id', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
    await DB.prepare(`DELETE FROM home_shorts WHERE id = ?`).bind(id).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '유어쇼츠를 삭제하지 못했습니다', '[urshorts:admin]')
  }
})

adminUrshortsRoutes.put('/channel', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    const b = await c.req.json<{ url?: string }>()
    const url = (b?.url ?? '').trim().slice(0, 300)
    // UPSERT — UPDATE 만 쓰면 행이 없을 때 조용히 아무 일도 안 한다(2026-05-21 실사고).
    await DB.prepare(`
      INSERT INTO platform_settings (key, value, updated_at)
      VALUES ('urshorts_channel_url', ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`).bind(url).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '채널 주소를 저장하지 못했습니다', '[urshorts:admin]')
  }
})

export { urshortsRoutes, adminUrshortsRoutes }

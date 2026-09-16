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
import { requireAdmin, requireSeller, getCurrentUser } from '@/worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error'
import { intParam } from '@/shared/pagination'
import {
  parseYouTubeUrl, youTubeThumbUrl, parseIsoDurationSec,
  URSHORTS_RAIL_LIMIT, URSHORTS_MAX_DURATION_SEC,
} from '@/shared/urshorts'
import type { Env } from '@/worker/types/env'

const urshortsRoutes = new Hono<{ Bindings: Env }>()
const adminUrshortsRoutes = new Hono<{ Bindings: Env }>()
const sellerUrshortsRoutes = new Hono<{ Bindings: Env }>()

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
      consent INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `).run().catch(() => {})
  // 기존 테이블에도 붙인다(이미 있으면 무해).
  await DB.prepare(`ALTER TABLE home_shorts ADD COLUMN duration_sec INTEGER`).run().catch(() => {})
  await DB.prepare(`ALTER TABLE home_shorts ADD COLUMN consent INTEGER NOT NULL DEFAULT 0`).run().catch(() => {})
  await DB.prepare(
    `CREATE INDEX IF NOT EXISTS idx_home_shorts_live ON home_shorts(is_active, sort_order, id)`
  ).run().catch(() => {})
}

/**
 * 공개 목록 SELECT.
 *
 * 🔴 `LEFT JOIN products` — **이용권이 안 붙은 영상도 홈에 나간다**
 *    (2026-09-08 대표 *"이용권 정보를 입력하지 않으면 그냥 정보 없이 두는걸로"*).
 *    원래 INNER 였는데, 그러면 영상을 넣어 놓고 이용권을 못 고른 순간 **레일이 통째로 빈다** —
 *    대표가 영상 3편을 넣고도 홈에 아무것도 안 뜨는 걸 보고 물어서 드러났다. 카드는 이미
 *    "모르는 것은 그리지 않는다"(안 라, 2026-09-08)라 상품이 없으면 글자 띠 없이 썸네일만 그린다.
 *
 * 🔴 그래서 `p.is_active` 는 **상품이 있을 때만** 건다 — `AND p.is_active = 1` 을 그대로 두면
 *    NULL 비교가 거짓이라 **LEFT JOIN 이 조용히 INNER 로 되돌아간다**(에러 없이 다시 빈 레일).
 *
 * 🔁 **허락(consent) 은 더 이상 노출을 막지 않는다** (2026-09-08 대표
 *    *"어드민 대시보드에서 올렸던 영상은 메인에서 보여지도록 해줘 허락 받은 유무 상관없이"*).
 *    2026-09-07 의 `AND s.consent = 1` 게이트를 **이 지시가 대체한다.**
 *
 *    ⚠️ 그 게이트가 있던 이유는 남아 있다 — 남의 영상을 구매 버튼 옆에 두면 그 창작자가 이 딜을
 *    보증한 것으로 읽히고, 유어애즈가 그 채널들에게 제휴 제안을 보낼 때 불리해진다. 대표가 그
 *    위험을 알고 내린 판단이라 여기서 되살리지 않는다. **되돌리려면 아래 WHERE 에
 *    `AND s.consent = 1` 한 줄을 복원하면 된다**(컬럼·어드민 토글은 그대로 살아 있다).
 *
 *    🔒 켜고 끄는 것은 이제 `s.is_active` 하나다. `consent` 는 **기록**으로 남는다 —
 *    어떤 영상에 허락을 받아 뒀는지 어드민이 알아야 제휴 제안을 보낼 수 있다.
 *    셀러 투고 경로는 여전히 등록 시 consent 를 요구한다(자기 영상임을 스스로 확인하는 자리).
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
    LEFT JOIN products p ON p.id = s.product_id
   WHERE s.is_active = 1
     AND (p.id IS NULL OR p.is_active = 1)
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
/**
 * 유튜브에서 이 영상의 **길이·제목·채널**을 한 번에 받아 온다.
 *
 * 💰 `videos.list` 는 **파트를 몇 개 붙이든 1 unit** 이다. 그래서 `snippet` 을 얹어도
 *    쿼터가 안 늘고 제목·채널이 공짜로 따라온다(`search` 는 100 unit — 그건 안 쓴다).
 */
async function fetchVideoMeta(env: Env, videoId: string): Promise<
  { ok: true; duration: number | null; title: string | null; channel: string | null }
  | { ok: false; reason: string }
> {
  const key = env.YOUTUBE_API_KEY
  if (!key) return { ok: false, reason: 'no-key' }
  try {
    const r = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${videoId}&key=${key}`,
    )
    if (!r.ok) return { ok: false, reason: 'fetch-failed' }
    const j = await r.json() as {
      items?: Array<{
        contentDetails?: { duration?: string }
        snippet?: { title?: string; channelTitle?: string }
      }>
    }
    const item = j?.items?.[0]
    if (!item) return { ok: false, reason: 'not-found' }
    return {
      ok: true,
      duration: parseIsoDurationSec(item.contentDetails?.duration),
      title: item.snippet?.title?.slice(0, 200) || null,
      channel: item.snippet?.channelTitle?.slice(0, 100) || null,
    }
  } catch {
    return { ok: false, reason: 'fetch-failed' }
  }
}

/**
 * 🔴 **쇼츠만 받는다** — 그리고 제목·채널을 대신 채워 준다.
 *
 * 판정 규칙(불변): `/shorts/ID` 주소는 **스스로 증명한다**(유튜브가 그 주소를 쇼츠에만 준다).
 * `watch?v=` 는 길이를 재야 하므로 키가 없거나 조회가 실패하면 **통과시키지 않는다** —
 * 모르는 것을 통과시키면 가로 10분짜리가 9:16 카드에 들어가 위아래 검은 띠가 생긴다.
 *
 * 📝 2026-09-08 (대표 *"채널 정보, 영상 제목 이런거 자동으로 못가져오나?"*): 이전엔 `/shorts/`
 * 형태가 **조회를 아예 건너뛰어** 제목·채널이 비었다(화면에 "채널 미상"). 이제 쇼츠 형태도
 * 메타를 받아 채우되 **fail-soft** 다 — 키가 없거나 조회가 실패해도 저장은 그대로 된다.
 * 그래야 오늘의 동작(키 없이도 `/shorts/` 추가 가능)이 안 깨진다.
 */
async function verifyIsShort(
  env: Env, videoId: string, form: string,
): Promise<
  { ok: true; duration: number | null; title: string | null; channel: string | null }
  | { ok: false; reason: string }
> {
  const meta = await fetchVideoMeta(env, videoId)

  if (form === 'shorts') {
    // 주소가 이미 증명했다. 메타는 있으면 쓰고 없으면 그만 — 저장을 막지 않는다.
    return meta.ok
      ? { ok: true, duration: meta.duration, title: meta.title, channel: meta.channel }
      : { ok: true, duration: null, title: null, channel: null }
  }

  // watch?v= — 길이를 못 재면 통과시키지 않는다.
  if (!meta.ok) {
    return {
      ok: false,
      reason: meta.reason === 'not-found'
        ? '영상을 찾지 못했습니다'
        : '쇼츠 주소(youtube.com/shorts/...)를 붙여 주세요',
    }
  }
  if (meta.duration == null) return { ok: false, reason: '영상을 찾지 못했습니다' }
  if (meta.duration > URSHORTS_MAX_DURATION_SEC) {
    return { ok: false, reason: `쇼츠가 아닙니다 (${Math.round(meta.duration / 60)}분 영상)` }
  }
  return { ok: true, duration: meta.duration, title: meta.title, channel: meta.channel }
}

adminUrshortsRoutes.post('/', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const body = await c.req.json<{ url?: string; title?: string; channel?: string; product_id?: number; consent?: boolean }>()
    const parsed = parseYouTubeUrl(body?.url)
    // 추측해서 저장하지 않는다 — 틀린 id 는 죽은 썸네일로만 드러난다.
    if (!parsed) return c.json({ success: false, error: '유튜브 주소에서 영상을 찾지 못했습니다' }, 400)
    const verdict = await verifyIsShort(c.env, parsed.id, parsed.form)
    if (!verdict.ok) return c.json({ success: false, error: verdict.reason }, 400)
    const pid = Number(body?.product_id)
    const r = await DB.prepare(`
      INSERT OR IGNORE INTO home_shorts
        (video_id, title, channel, thumb_url, product_id, sort_order, source, duration_sec, consent)
      VALUES (?, ?, ?, ?, ?, 0, 'manual', ?, ?)`)
      // 📝 사람이 적어 넣은 값이 있으면 그게 이긴다(고쳐 쓴 제목을 유튜브 값으로 덮지 않는다).
      //    비어 있을 때만 조회해 온 제목·채널로 채운다 — 화면의 "채널 미상"이 여기서 사라진다.
      .bind(parsed.id,
            (body?.title ?? '').slice(0, 200) || verdict.title,
            (body?.channel ?? '').slice(0, 100) || verdict.channel,
            youTubeThumbUrl(parsed.id), Number.isFinite(pid) && pid > 0 ? pid : null,
            verdict.duration, body?.consent ? 1 : 0)
      .run()
    if (!r.meta.changes) return c.json({ success: false, error: '이미 등록된 영상입니다' }, 409)
    return c.json({ success: true, video_id: parsed.id })
  } catch (err) {
    return safeError(c, err, '유어쇼츠를 추가하지 못했습니다', '[urshorts:admin]')
  }
})

/**
 * 📝 제목·채널 다시 가져오기 — **이 기능이 생기기 전에 넣은 영상**을 위한 것.
 *
 * 2026-09-08 이전에 `/shorts/` 주소로 넣은 행은 조회를 건너뛰어 제목·채널이 비어 있다
 * (화면에 "채널 미상"). 지우고 다시 넣게 하는 대신 한 번 눌러 채운다.
 * 사람이 고쳐 쓴 값을 덮지 않도록 **비어 있는 칸만** 채운다.
 */
adminUrshortsRoutes.post('/:id/refresh-meta', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
    const row = await DB.prepare('SELECT video_id, title, channel FROM home_shorts WHERE id = ?')
      .bind(id).first<{ video_id: string; title: string | null; channel: string | null }>()
    if (!row) return c.json({ success: false, error: '영상을 찾지 못했습니다' }, 404)
    const meta = await fetchVideoMeta(c.env, row.video_id)
    if (!meta.ok) {
      return c.json({
        success: false,
        error: meta.reason === 'no-key'
          ? 'YouTube API 키가 설정되어 있지 않습니다'
          : '유튜브에서 정보를 가져오지 못했습니다',
      }, 400)
    }
    // 이미 채워진 칸은 건드리지 않는다.
    const title = row.title || meta.title
    const channel = row.channel || meta.channel
    await DB.prepare('UPDATE home_shorts SET title = ?, channel = ?, duration_sec = COALESCE(duration_sec, ?) WHERE id = ?')
      .bind(title, channel, meta.duration, id).run()
    return c.json({ success: true, title, channel })
  } catch (err) {
    return safeError(c, err, '영상 정보를 가져오지 못했습니다', '[urshorts:admin]')
  }
})

adminUrshortsRoutes.patch('/:id', requireAdmin(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
    const b = await c.req.json<{ product_id?: number | null; is_active?: boolean; sort_order?: number; consent?: boolean }>()
    const sets: string[] = []
    const binds: unknown[] = []
    if ('product_id' in b) {
      const pid = Number(b.product_id)
      sets.push('product_id = ?'); binds.push(Number.isFinite(pid) && pid > 0 ? pid : null)
    }
    if ('is_active' in b) { sets.push('is_active = ?'); binds.push(b.is_active ? 1 : 0) }
    if ('consent' in b) { sets.push('consent = ?'); binds.push(b.consent ? 1 : 0) }
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

// ── 셀러 ──────────────────────────────────────────────────────────────────────
/**
 * 🏪 사업자 유저가 **자기 이용권에** 쇼츠를 붙인다 (2026-09-07).
 *
 * 가장 확실한 수급 경로다 — 매장 자신이 자기 영상을 갖고 있고, 연결이 **원천적으로 정확**하다.
 * 자동 수집이 남의 영상에서 우리 매장을 찾아내는 어려운 일인 데 비해 이건 그 반대다.
 *
 * 🔴 **소유권 검사가 이 블록의 전부다.** `products.seller_id` 가 요청자와 같을 때만 붙인다.
 *    안 보면 아무 셀러나 **남의 상품**에 영상을 걸 수 있다(IDOR) — 그러면 A 매장 이용권 옆에
 *    B 매장 영상이 붙고, 홈에서 그게 그대로 팔린다. 에러가 안 나서 신고가 와야 안다.
 */
sellerUrshortsRoutes.get('/', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const sellerId = getCurrentUser(c)?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const { results } = await DB.prepare(`
      SELECT s.id, s.video_id, s.title, s.thumb_url, s.is_active, s.duration_sec, s.consent,
             s.product_id, p.name AS product_name
        FROM home_shorts s
        JOIN products p ON p.id = s.product_id
       WHERE p.seller_id = ?
       ORDER BY s.id DESC
       LIMIT 100`).bind(sellerId).all()
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    return safeError(c, err, '내 쇼츠를 불러오지 못했습니다', '[urshorts:seller]')
  }
})

sellerUrshortsRoutes.post('/', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const sellerId = getCurrentUser(c)?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const body = await c.req.json<{ url?: string; product_id?: number; consent?: boolean }>()
    const productId = Number(body?.product_id)
    if (!Number.isFinite(productId) || productId <= 0) {
      return c.json({ success: false, error: '어느 이용권인지 골라 주세요' }, 400)
    }
    // 🔴 소유권. 이 한 줄이 빠지면 남의 상품에 영상을 걸 수 있다.
    const owned = await DB.prepare(`SELECT id, name FROM products WHERE id = ? AND seller_id = ?`)
      .bind(productId, sellerId).first<{ id: number; name: string }>()
    if (!owned) return c.json({ success: false, error: '내 이용권이 아닙니다' }, 403)

    const parsed = parseYouTubeUrl(body?.url)
    if (!parsed) return c.json({ success: false, error: '유튜브 주소에서 영상을 찾지 못했습니다' }, 400)
    const verdict = await verifyIsShort(c.env, parsed.id, parsed.form)
    if (!verdict.ok) return c.json({ success: false, error: verdict.reason }, 400)
    // 🔴 허락 확인란. 안 체크하면 저장은 되지만 홈에는 안 나간다(공개 쿼리가 consent=1 을 요구).
    if (!body?.consent) {
      return c.json({ success: false, error: '내 영상이거나 창작자에게 허락받았는지 확인해 주세요' }, 400)
    }

    const r = await DB.prepare(`
      INSERT OR IGNORE INTO home_shorts
        (video_id, title, thumb_url, product_id, sort_order, source, duration_sec, consent)
      VALUES (?, ?, ?, ?, 0, 'seller', ?, ?)`)
      .bind(parsed.id, owned.name?.slice(0, 200) ?? null, youTubeThumbUrl(parsed.id),
            productId, verdict.duration, body?.consent ? 1 : 0)
      .run()
    if (!r.meta.changes) return c.json({ success: false, error: '이미 등록된 영상입니다' }, 409)
    return c.json({ success: true, video_id: parsed.id })
  } catch (err) {
    return safeError(c, err, '쇼츠를 추가하지 못했습니다', '[urshorts:seller]')
  }
})

sellerUrshortsRoutes.delete('/:id', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureTable(DB)
    const sellerId = getCurrentUser(c)?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
    // 🔴 여기도 소유권. 삭제는 자기 상품에 붙은 것만.
    const r = await DB.prepare(`
      DELETE FROM home_shorts
       WHERE id = ?
         AND product_id IN (SELECT id FROM products WHERE seller_id = ?)`)
      .bind(id, sellerId).run()
    if (!r.meta.changes) return c.json({ success: false, error: '내 쇼츠가 아닙니다' }, 403)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '쇼츠를 삭제하지 못했습니다', '[urshorts:seller]')
  }
})

export { urshortsRoutes, adminUrshortsRoutes, sellerUrshortsRoutes }

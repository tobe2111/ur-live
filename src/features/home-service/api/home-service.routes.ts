/**
 * 🏠 생활 견적 — 손님 쪽 API (2026-10-24 대표 확정, 결재 `docs/decisions/2026-10-24-home-service-quotes.md`)
 *
 *   GET  /api/home-service/config              카테고리·요청서 칸·켜짐 여부(공개)
 *   POST /api/home-service/requests            요청서 접수 → 맞는 사장님에게 알림톡
 *   GET  /api/home-service/requests/mine       내 요청 목록
 *   GET  /api/home-service/requests/:id        받은 견적 비교(처음 열면 '열어 봄' 기록 — 반환 판정에 쓴다)
 *   POST /api/home-service/requests/:id/choose 사장님 고르기 → 서로 연락처 공개
 *   POST /api/home-service/requests/:id/cancel 요청 취소 → 보낸 견적의 참여권 반환
 *   POST /api/home-service/requests/:id/review 고른 업체에 후기(별점·글·사진) — 요청 하나에 한 번
 *   GET  /api/home-service/pros/:id            업체 소개 페이지(공개 — 연락처 없음)
 *   GET/POST /api/home-service/requests/:id/quotes/:qid/messages  고르기 전 질문(연락처 금지)
 *
 * 🔒 본인 확인 = 카카오 로그인 + 카카오가 준 휴대폰 번호(`users.phone`). 번호가 없으면 접수하지 않는다.
 * 🔒 연락처는 손님이 고른 **한 곳**에만 넘어간다. 고르기 전 사장님은 동 단위 지역·요약만 본다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { parseRegionFromAddress } from '@/shared/constants/region-slugs'
import { kstYmd } from '@/shared/stays-early'
import {
  HOME_SERVICE_CATEGORIES, HOME_TPL, MAX_OPEN_REQUESTS_PER_USER, MAX_QUOTES_PER_REQUEST,
  PRO_OPEN_STATUS_SQL, categoryDef, msgQuoteChosen, photosOwnedBy, proVerified, requestSummary, validateRequest, type HomeServiceCategory,
} from '@/shared/home-service'
import { sendSystemAlimtalk } from '../../../lib/system-alimtalk'
import { chooseQuoteAtomic, ensureHomeServiceTables, ensureShareToken, proCountsByCategory, refundAllQuotes, reviewSummaries, withPrivateDetails } from './home-service-db'
import { REVIEW_PREVIEW_COUNT, parseReview, readProLinks, readReviewPhotos } from '@/shared/home-service-review'
import { isShareToken, publicShareView } from '@/shared/home-service-share'
import { dispatchRequest } from './home-service-notify'
import { customerListMessages, customerSendMessage } from './home-service-chat'

export const homeServiceRoutes = new Hono<{ Bindings: Env }>()

/** 운영 중지 스위치(기본 꺼짐 = 운영). 문제가 생기면 어드민이 'true' 로. */
export async function homeServiceStopped(DB: D1Database): Promise<boolean> {
  const r = await DB.prepare(`SELECT value FROM platform_settings WHERE key = 'home_service_quotes_disabled'`)
    .first<{ value: string }>().catch(() => null)
  return String(r?.value ?? '').trim() === 'true'
}

function waitUntil(c: { executionCtx?: { waitUntil(p: Promise<unknown>): void } }, p: Promise<unknown>) {
  try { c.executionCtx?.waitUntil(p) } catch { void p }
}

function idParam(raw: string | undefined): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}

/** 고른 뒤 — 사장님에게 손님 연락처 알림톡. 손님 화면과 운영팀 대리 선택이 같이 쓴다. */
export async function notifyChosen(
  env: unknown, DB: D1Database, requestId: number, defer: (p: Promise<unknown>) => void,
): Promise<{ pro_phone: string | null } | null> {
  const row = await DB.prepare(
    `SELECT r.category, r.summary, r.contact_name, r.contact_phone,
            COALESCE(NULLIF(p.phone, ''), s.phone) AS pro_phone, q.seller_id
       FROM home_service_requests r
       JOIN home_service_quotes q ON q.id = r.chosen_quote_id
       JOIN sellers s ON s.id = q.seller_id
       LEFT JOIN home_service_pros p ON p.seller_id = q.seller_id
      WHERE r.id = ?`,
  ).bind(requestId).first<{ category: HomeServiceCategory; summary: string; contact_name: string | null; contact_phone: string; pro_phone: string | null }>()
  if (row?.pro_phone) {
    const label = categoryDef(row.category)?.label || '생활'
    defer(sendSystemAlimtalk(
      env, row.pro_phone, HOME_TPL.quoteChosen,
      msgQuoteChosen(label, row.summary, row.contact_name || '손님', row.contact_phone),
      { dedupKey: `chosen:${requestId}` },
    ).catch(() => null))
  }
  return row ? { pro_phone: row.pro_phone } : null
}

homeServiceRoutes.get('/config', async (c) => {
  const stopped = await homeServiceStopped(c.env.DB)
  // 카테고리별 업체 수 — 못 읽으면 null(화면은 "모집 중" 을 안 띄운다. 모르는 것과 0 은 다르다).
  let proCounts: Record<string, number> | null = null
  try { await ensureHomeServiceTables(c.env.DB); proCounts = await proCountsByCategory(c.env.DB) } catch { proCounts = null }
  return c.json({ success: true, data: { open: !stopped, maxQuotes: MAX_QUOTES_PER_REQUEST, categories: HOME_SERVICE_CATEGORIES, proCounts } })
})

/**
 * 🔗 공유 페이지 — 로그인 없이 누구나(업체 영입용). 🔒 공개 칸만(`publicShareView`): 이름 첫 글자 · 동 단위 지역 ·
 * 고르는 칸. 메모·사진·연락처·상세 주소는 SQL 에서부터 안 꺼낸다. 번호(id)도 안 내보낸다(요청 수가 드러난다).
 */
/**
 * 🏪 업체 소개 페이지(2026-10-26 대표 "1,2,3 모두") — 사장님이 블로그·인스타에 거는 유어딜 업체 링크.
 * 공개라서 연락처는 절대 안 싣는다(연락처는 손님이 고른 뒤에만 — 견적 규칙 그대로). 정지·반려·꺼 둔 업체는 404.
 */
homeServiceRoutes.get('/pros/:id', async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const id = idParam(c.req.param('id'))
    if (!id) return c.json({ success: false, error: '업체를 찾을 수 없습니다' }, 404)
    const pro = await DB.prepare(
      `SELECT p.intro, p.links, s.status, COALESCE(NULLIF(s.business_name, ''), s.name) AS name
         FROM home_service_pros p JOIN sellers s ON s.id = p.seller_id
        WHERE p.seller_id = ? AND p.active = 1 AND s.status IN ${PRO_OPEN_STATUS_SQL}`,
    ).bind(id).first<{ intro: string | null; links: string | null; status: string; name: string }>()
    if (!pro) return c.json({ success: false, error: '업체를 찾을 수 없습니다' }, 404)
    const [cats, areas, vouchers, reviews, done] = await Promise.all([
      DB.prepare(`SELECT category FROM home_service_pro_categories WHERE seller_id = ?`).bind(id).all<{ category: string }>(),
      DB.prepare(`SELECT sido, sigungu FROM home_service_pro_areas WHERE seller_id = ? ORDER BY sido, sigungu LIMIT 40`).bind(id).all(),
      DB.prepare(
        `SELECT id, name, price, original_price, image_url FROM products
          WHERE seller_id = ? AND category = 'home_voucher' AND is_active = 1 ORDER BY id DESC LIMIT 12`,
      ).bind(id).all().catch(() => ({ results: [] })),
      reviewSummaries(DB, [id], 20),
      DB.prepare(`SELECT COUNT(*) AS n FROM home_service_quotes WHERE seller_id = ? AND status = 'chosen'`).bind(id).first<{ n: number }>(),
    ])
    c.header('Cache-Control', 'public, max-age=60')
    return c.json({
      success: true,
      data: {
        id, name: pro.name, verified: proVerified(pro.status), intro: pro.intro || '', links: readProLinks(pro.links),
        categories: (cats.results ?? []).map((r) => r.category).filter((k) => categoryDef(k as HomeServiceCategory)),
        areas: areas.results ?? [], vouchers: vouchers.results ?? [], reviews: reviews[id] ?? null,
        chosen_count: Number(done?.n ?? 0),
      },
    })
  } catch (err) {
    return safeError(c, err, '업체 정보를 불러오지 못했습니다', '[home-service:pro-public]')
  }
})

homeServiceRoutes.get('/share/:token', async (c) => {
  try {
    const token = c.req.param('token')
    if (!isShareToken(token)) return c.json({ success: false, error: '요청을 찾을 수 없습니다' }, 404)
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const r = await DB.prepare(
      `SELECT category, details, status, quote_count, max_quotes, created_at, SUBSTR(contact_name, 1, 1) AS name_initial
         FROM home_service_requests WHERE share_token = ?`,
    ).bind(token).first<{ category: string; details: string; status: string; quote_count: number; max_quotes: number; created_at: string; name_initial: string | null }>()
    let details: Record<string, string> = {}
    try { details = JSON.parse(String(r?.details || '{}')) } catch { /* */ }
    const view = r ? publicShareView({ ...r, details }) : null
    if (!view) return c.json({ success: false, error: '요청을 찾을 수 없습니다' }, 404)
    c.header('Cache-Control', 'public, max-age=30')
    c.header('CDN-Cache-Control', 'public, max-age=60')
    return c.json({ success: true, data: view })
  } catch (err) {
    return safeError(c, err, '요청을 불러오지 못했습니다', '[home-service:share]')
  }
})

/** 🏠 홈 '생활' 탭 업종 칩 — `{ 상품 id: 업종 }` (2026-10-25). 공개·로그인 불필요, 짧게 캐시. */
homeServiceRoutes.get('/deal-subcats', async (c) => {
  try {
    const { lifeSubcatMap } = await import('./life-deal-subcat-store')
    const data = await lifeSubcatMap(c.env.DB)
    c.header('Cache-Control', 'public, max-age=60')
    c.header('CDN-Cache-Control', 'public, max-age=300')
    return c.json({ success: true, data })
  } catch (err) {
    return safeError(c, err, '업종을 불러오지 못했습니다', '[home-service:deal-subcats]')
  }
})

homeServiceRoutes.post('/requests', requireAuth(), rateLimit({ action: 'home_service_request', max: 5, windowSec: 3600 }), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    if (await homeServiceStopped(DB)) return c.json({ success: false, error: '지금은 요청을 받지 않습니다' }, 503)
    const userId = Number(getCurrentUser(c)?.id)
    if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const body = await c.req.json<{ category?: string; fields?: Record<string, unknown>; consent?: boolean }>().catch(() => ({}))
    if ((body as { consent?: boolean }).consent !== true) {
      return c.json({ success: false, error: '연락처 전달에 동의해 주세요', code: 'CONSENT_REQUIRED' }, 400)
    }
    const v = validateRequest(
      (body as { category?: string }).category, (body as { fields?: Record<string, unknown> }).fields || {},
      (s) => { const r = parseRegionFromAddress(s); return r ? { sido: r.sido, sigungu: r.sigungu } : null }, kstYmd(0),
    )
    if (!v.ok) return c.json({ success: false, error: v.error }, 400)
    // 📷 사진은 이 손님이 올린 것만(남의 업로드 주소를 끼워 업체 화면에 띄우지 못하게).
    if (!photosOwnedBy(v.value.details, userId)) return c.json({ success: false, error: '사진을 다시 올려 주세요' }, 400)

    const user = await DB.prepare(`SELECT name, phone FROM users WHERE id = ?`).bind(userId)
      .first<{ name: string | null; phone: string | null }>()
    const phone = String(user?.phone || '').replace(/\D/g, '')
    if (!/^01\d{8,9}$/.test(phone)) {
      return c.json({ success: false, error: '카카오 계정에 휴대폰 번호가 없어 요청을 받을 수 없습니다. 카카오로 다시 로그인해 번호 제공에 동의해 주세요', code: 'PHONE_REQUIRED' }, 400)
    }
    const open = await DB.prepare(`SELECT COUNT(*) AS n FROM home_service_requests WHERE user_id = ? AND status = 'open'`)
      .bind(userId).first<{ n: number }>()
    if (Number(open?.n ?? 0) >= MAX_OPEN_REQUESTS_PER_USER) {
      return c.json({ success: false, error: `진행 중인 요청이 ${MAX_OPEN_REQUESTS_PER_USER}건 있어요. 끝난 요청을 먼저 정리해 주세요` }, 409)
    }
    const { category, details, privateDetails, regions, desiredDate } = v.value
    const [r1, r2] = regions
    const ins = await DB.prepare(
      `INSERT INTO home_service_requests
         (user_id, category, details, summary, sido, sigungu, sido2, sigungu2, desired_date, contact_name, contact_phone, max_quotes, private_details)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      userId, category, JSON.stringify(details), requestSummary(category, details),
      r1.sido, r1.sigungu, r2?.sido ?? null, r2?.sigungu ?? null, desiredDate,
      user?.name || null, phone, MAX_QUOTES_PER_REQUEST,
      Object.keys(privateDetails).length ? JSON.stringify(privateDetails) : null,
    ).run()
    const id = Number(ins.meta?.last_row_id)
    // 🔗 공유 토큰은 접수할 때 만든다 — 열린 요청이 검색·커뮤니티 공유에 바로 쓰인다(대표 "노출해줘").
    const share_token = await ensureShareToken(DB, id).catch(() => null)
    waitUntil(c, dispatchRequest(c.env, DB, id).catch(() => 0))
    return c.json({ success: true, data: { id, share_token } })
  } catch (err) {
    return safeError(c, err, '요청을 접수하지 못했습니다', '[home-service:create]')
  }
})

homeServiceRoutes.get('/requests/mine', requireAuth(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const userId = Number(getCurrentUser(c)?.id)
    const { results } = await DB.prepare(
      `SELECT id, category, summary, desired_date, status, quote_count, max_quotes, created_at,
              CASE WHEN status = 'open' THEN share_token END AS share_token
         FROM home_service_requests WHERE user_id = ? ORDER BY id DESC LIMIT 30`,
    ).bind(userId).all()
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    return safeError(c, err, '요청 목록을 불러오지 못했습니다', '[home-service:mine]')
  }
})

homeServiceRoutes.get('/requests/:id', requireAuth(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const userId = Number(getCurrentUser(c)?.id)
    const id = idParam(c.req.param('id'))
    if (!id) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const req = await DB.prepare(
      `SELECT id, user_id, category, details, summary, desired_date, status, quote_count, max_quotes,
              chosen_quote_id, customer_viewed_at, created_at, private_details
         FROM home_service_requests WHERE id = ?`,
    ).bind(id).first<Record<string, unknown>>()
    if (!req || Number(req.user_id) !== userId) return c.json({ success: false, error: '요청을 찾을 수 없습니다' }, 404)

    // 견적이 하나라도 있는데 처음 연 것이면 '열어 봄' — 48시간 미열람 반환 판정이 이 값을 본다.
    if (Number(req.quote_count) > 0 && !req.customer_viewed_at) {
      await DB.prepare(`UPDATE home_service_requests SET customer_viewed_at = datetime('now') WHERE id = ? AND customer_viewed_at IS NULL`)
        .bind(id).run().catch(() => null)
    }
    const { results: quotes } = await DB.prepare(
      `SELECT q.id, q.seller_id, q.price, q.message, q.status, q.created_at,
              COALESCE(NULLIF(s.business_name, ''), s.name) AS pro_name, q.is_house, q.partner,
              CASE WHEN s.status IN ('approved', 'active') THEN 1 ELSE 0 END AS verified, -- 사업자 인증 표시(proVerified 와 같은 값)
              CASE WHEN q.status = 'chosen' THEN COALESCE(NULLIF(p.phone, ''), s.phone) END AS pro_phone,
              p.intro AS pro_intro, p.links AS pro_links_raw,
              (SELECT COUNT(*) FROM home_service_messages m WHERE m.quote_id = q.id) AS msg_count
         FROM home_service_quotes q
         JOIN sellers s ON s.id = q.seller_id
         LEFT JOIN home_service_pros p ON p.seller_id = q.seller_id
        WHERE q.request_id = ?
        ORDER BY (q.price IS NULL), q.created_at ASC`,
    ).bind(id).all<{ id: number; seller_id: number; pro_links_raw?: unknown }>()

    // 그 사장님이 정찰가로 파는 생활 이용권(있으면 견적 카드 옆에 같이 보인다 — 대표 "자신들의 이용권도 팔고").
    const sellerIds = [...new Set((quotes ?? []).map((q) => Number(q.seller_id)))].slice(0, MAX_QUOTES_PER_REQUEST)
    const vouchers: Record<number, unknown[]> = {}
    if (sellerIds.length) {
      const { results: vs } = await DB.prepare(
        `SELECT id, seller_id, name, price, original_price, image_url FROM products
          WHERE seller_id IN (${sellerIds.map(() => '?').join(',')}) AND category = 'home_voucher' AND is_active = 1
          ORDER BY id DESC LIMIT 20`,
      ).bind(...sellerIds).all<{ seller_id: number }>().catch(() => ({ results: [] as { seller_id: number }[] }))
      for (const v of vs ?? []) (vouchers[Number(v.seller_id)] ||= []).push(v)
    }
    let details: unknown = {}
    try { details = JSON.parse(String(req.details || '{}')) } catch { /* */ }
    details = withPrivateDetails(details, req.private_details)   // 내 요청이라 상세 주소까지 보인다
    const { user_id: _u, details: _d, private_details: _p, ...rest } = req
    // 🔗 열려 있으면 공유 링크 — 손님이 아는 업체·카톡방에 보내면 그 링크로 업체가 바로 가입해 견적을 낸다(2026-10-25).
    const share_token = req.status === 'open' ? await ensureShareToken(DB, id).catch(() => null) : null
    // ⭐ 업체별 유어딜 후기 요약 + 내가 쓴 후기(고른 뒤 한 번 쓸 수 있다).
    const reviews = await reviewSummaries(DB, sellerIds, REVIEW_PREVIEW_COUNT).catch(() => ({} as Awaited<ReturnType<typeof reviewSummaries>>))
    const myReview = req.status === 'chosen'
      ? await DB.prepare(`SELECT rating, body, photos, created_at FROM home_service_reviews WHERE request_id = ?`).bind(id).first<{ photos: string | null }>().catch(() => null)
      : null
    return c.json({ success: true, data: { ...rest, details, share_token, my_review: myReview ? { ...myReview, photos: readReviewPhotos(myReview.photos) } : null, quotes: (quotes ?? []).map(({ pro_links_raw, ...q }) => ({
      ...q, pro_links: readProLinks(pro_links_raw), reviews: reviews[Number(q.seller_id)] ?? null, vouchers: vouchers[Number(q.seller_id)] || [],
    })) } })
  } catch (err) {
    return safeError(c, err, '견적을 불러오지 못했습니다', '[home-service:detail]')
  }
})

/** ⭐ 후기 — 고른 업체에 한 번(요청 하나에 하나). 고르기 전·남의 요청·두 번째는 막는다. */
homeServiceRoutes.post('/requests/:id/review', requireAuth(), rateLimit({ action: 'home_service_review', max: 10, windowSec: 600 }), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const userId = Number(getCurrentUser(c)?.id)
    const id = idParam(c.req.param('id'))
    if (!id) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const parsed = parseReview(await c.req.json<{ rating?: unknown; body?: unknown; photos?: unknown }>().catch(() => ({})), userId)
    if (!parsed.ok) return c.json({ success: false, error: parsed.error }, 400)
    const ins = await DB.prepare(
      `INSERT OR IGNORE INTO home_service_reviews (request_id, quote_id, seller_id, user_id, rating, body, photos)
       SELECT r.id, q.id, q.seller_id, r.user_id, ?, ?, ?
         FROM home_service_requests r JOIN home_service_quotes q ON q.id = r.chosen_quote_id
        WHERE r.id = ? AND r.user_id = ? AND r.status = 'chosen' AND q.status = 'chosen'`,
    ).bind(parsed.rating, parsed.text, parsed.photos.join(',') || null, id, userId).run()
    if (!ins.meta?.changes) {
      const had = await DB.prepare(`SELECT 1 AS x FROM home_service_reviews WHERE request_id = ?`).bind(id).first()
      return c.json({ success: false, error: had ? '이미 후기를 남겼어요' : '고른 업체에만 후기를 남길 수 있어요' }, 409)
    }
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '후기를 저장하지 못했습니다', '[home-service:review]')
  }
})

// 💬 고르기 전 질문 — `home-service-chat.ts`.
homeServiceRoutes.get('/requests/:id/quotes/:qid/messages', requireAuth(), customerListMessages)
homeServiceRoutes.post('/requests/:id/quotes/:qid/messages', requireAuth(), rateLimit({ action: 'home_service_chat', max: 30, windowSec: 600 }), customerSendMessage)

homeServiceRoutes.post('/requests/:id/choose', requireAuth(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const userId = Number(getCurrentUser(c)?.id)
    const id = idParam(c.req.param('id'))
    const body = await c.req.json<{ quote_id?: number }>().catch(() => ({} as { quote_id?: number }))
    const quoteId = Number(body.quote_id)
    if (!id || !Number.isInteger(quoteId) || quoteId <= 0) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)

    // 🔒 CAS — 열린 내 요청이고 그 요청의 보낸 견적일 때만, 한 번만.
    const chosen = await chooseQuoteAtomic(DB, id, quoteId, userId, false)
    if (!chosen) return c.json({ success: false, error: '이미 고른 요청이거나 고를 수 없는 견적입니다' }, 409)

    const row = await notifyChosen(c.env, DB, id, (p) => waitUntil(c, p))
    return c.json({ success: true, data: { pro_phone: row?.pro_phone ?? null } })
  } catch (err) {
    return safeError(c, err, '선택을 처리하지 못했습니다', '[home-service:choose]')
  }
})

homeServiceRoutes.post('/requests/:id/cancel', requireAuth(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const userId = Number(getCurrentUser(c)?.id)
    const id = idParam(c.req.param('id'))
    if (!id) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const upd = await DB.prepare(
      `UPDATE home_service_requests SET status = 'cancelled', updated_at = datetime('now')
        WHERE id = ? AND user_id = ? AND status = 'open'`,
    ).bind(id, userId).run()
    if (!upd.meta?.changes) return c.json({ success: false, error: '취소할 수 없는 요청입니다' }, 409)
    // 손님이 취소했으니 견적을 보낸 사장님의 참여권은 돌려준다(대표 확정).
    const refunded = await refundAllQuotes(DB, id, '손님이 요청 취소')
    return c.json({ success: true, data: { refunded } })
  } catch (err) {
    return safeError(c, err, '취소하지 못했습니다', '[home-service:cancel]')
  }
})

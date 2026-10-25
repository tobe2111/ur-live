/**
 * 🏠 생활 견적 — 손님 쪽 API (2026-10-24 대표 확정, 결재 `docs/decisions/2026-10-24-home-service-quotes.md`)
 *
 *   GET  /api/home-service/config              카테고리·요청서 칸·켜짐 여부(공개)
 *   POST /api/home-service/requests            요청서 접수 → 맞는 사장님에게 알림톡
 *   GET  /api/home-service/requests/mine       내 요청 목록
 *   GET  /api/home-service/requests/:id        받은 견적 비교(처음 열면 '열어 봄' 기록 — 반환 판정에 쓴다)
 *   POST /api/home-service/requests/:id/choose 사장님 고르기 → 서로 연락처 공개
 *   POST /api/home-service/requests/:id/cancel 요청 취소 → 보낸 견적의 참여권 반환
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
  categoryDef, msgQuoteChosen, requestSummary, validateRequest, type HomeServiceCategory,
} from '@/shared/home-service'
import { sendSystemAlimtalk } from '../../../lib/system-alimtalk'
import { chooseQuoteAtomic, ensureHomeServiceTables, refundAllQuotes, withPrivateDetails } from './home-service-db'
import { dispatchRequest } from './home-service-notify'

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
  return c.json({ success: true, data: { open: !stopped, maxQuotes: MAX_QUOTES_PER_REQUEST, categories: HOME_SERVICE_CATEGORIES } })
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
    waitUntil(c, dispatchRequest(c.env, DB, id).catch(() => 0))
    return c.json({ success: true, data: { id } })
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
      `SELECT id, category, summary, desired_date, status, quote_count, max_quotes, created_at
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
              COALESCE(NULLIF(s.business_name, ''), s.name) AS pro_name, q.is_house,
              CASE WHEN q.status = 'chosen' THEN COALESCE(NULLIF(p.phone, ''), s.phone) END AS pro_phone
         FROM home_service_quotes q
         JOIN sellers s ON s.id = q.seller_id
         LEFT JOIN home_service_pros p ON p.seller_id = q.seller_id
        WHERE q.request_id = ?
        ORDER BY (q.price IS NULL), q.created_at ASC`,
    ).bind(id).all<{ id: number; seller_id: number }>()

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
    return c.json({ success: true, data: { ...rest, details, quotes: (quotes ?? []).map((q) => ({ ...q, vouchers: vouchers[Number(q.seller_id)] || [] })) } })
  } catch (err) {
    return safeError(c, err, '견적을 불러오지 못했습니다', '[home-service:detail]')
  }
})

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

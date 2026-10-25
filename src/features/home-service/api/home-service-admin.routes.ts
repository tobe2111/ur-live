/**
 * 🧾 생활 견적 — 운영팀 화면 (2026-10-24 대표 "실제 손님 있어. 두 기능 모두 만들어줘")
 *
 *   GET  /api/admin/home-service/requests             최근 요청(대리 접수 포함) — 견적 수·상태
 *   POST /api/admin/home-service/requests             ① 운영팀 대리 접수 — 영업으로 찾은 **실제 손님**의 요청서
 *   GET  /api/admin/home-service/requests/:id         요청 + 받은 견적 전부(금액·업체) — 대리 접수 건은 열면 '열어 봄'
 *   POST /api/admin/home-service/requests/:id/house-quote  ② 유어딜 직영 견적
 *   POST /api/admin/home-service/requests/:id/choose  대리 접수 건만 — 손님이 전화로 고른 견적을 대신 누른다
 *   POST /api/admin/home-service/requests/:id/cancel  대리 접수 건만 — 손님이 취소하면 참여권 반환
 *   GET/PUT /api/admin/home-service/house             직영 견적을 낼 매장(sellers.id)
 *
 * 🔒 대리 접수는 손님 동의를 받았다는 기록(consent_note)이 있어야 한다 — 연락처가 고른 업체에 넘어간다.
 * 🔒 직영 견적은 손님 화면에 "유어딜 직영" 으로 표시된다(다른 업체 견적과 구분).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin, getCurrentUser } from '@/worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error'
import { parseRegionFromAddress } from '@/shared/constants/region-slugs'
import { kstYmd } from '@/shared/stays-early'
import {
  CREDIT_COST_KEY, HOME_PARTNERS_KEY, HOME_SERVICE_CATEGORIES, HOME_TPL, MAX_CREDIT_COST, MAX_QUOTES_PER_REQUEST, categoryDef, msgQuoteArrived, quotePriceText,
  requestSummary, validateRequest, type HomeServiceCategory,
} from '@/shared/home-service'
import { sendSystemAlimtalk } from '../../../lib/system-alimtalk'
import { chooseQuoteAtomic, ensureHomeServiceTables, ensureShareToken, loadCreditCosts, loadPartners, refundAllQuotes, sendHouseQuoteAtomic } from './home-service-db'
import { dispatchRequest } from './home-service-notify'
import { notifyChosen } from './home-service.routes'

export const homeServiceAdminRoutes = new Hono<{ Bindings: Env }>()
homeServiceAdminRoutes.use('*', requireAdmin())

const HOUSE_KEY = 'home_service_house_seller_id'

function idParam(raw: string | undefined): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}
function defer(c: { executionCtx?: { waitUntil(p: Promise<unknown>): void } }) {
  return (p: Promise<unknown>) => { try { c.executionCtx?.waitUntil(p) } catch { void p } }
}
async function houseSellerId(DB: D1Database): Promise<number | null> {
  const r = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`).bind(HOUSE_KEY)
    .first<{ value: string }>().catch(() => null)
  const n = Number(r?.value)
  return Number.isInteger(n) && n > 0 ? n : null
}

homeServiceAdminRoutes.get('/house', async (c) => {
  try {
    const DB = c.env.DB
    const sid = await houseSellerId(DB)
    const s = sid
      ? await DB.prepare(`SELECT id, COALESCE(NULLIF(business_name, ''), name) AS name, status FROM sellers WHERE id = ?`).bind(sid).first()
      : null
    return c.json({ success: true, data: { seller: s } })
  } catch (err) {
    return safeError(c, err, '설정을 불러오지 못했습니다', '[home-service:house]')
  }
})

homeServiceAdminRoutes.put('/house', async (c) => {
  try {
    const DB = c.env.DB
    const b = await c.req.json<{ seller_id?: unknown }>().catch(() => ({} as { seller_id?: unknown }))
    const sid = Number(b.seller_id)
    if (!Number.isInteger(sid) || sid <= 0) return c.json({ success: false, error: '매장 번호를 확인해 주세요' }, 400)
    const s = await DB.prepare(`SELECT 1 AS x FROM sellers WHERE id = ?`).bind(sid).first()
    if (!s) return c.json({ success: false, error: '그 매장이 없습니다' }, 404)
    await DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ).bind(HOUSE_KEY, String(sid)).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '저장하지 못했습니다', '[home-service:house-save]')
  }
})

/**
 * 🤝 제휴 업체(2026-10-25 대표 — 간판 제휴사). 카테고리마다 한 매장. seller_id 가 null 이면 해제.
 * 제휴 업체는 그 카테고리 요청을 지역과 무관하게 받고 참여권 없이 견적을 낸다(손님 화면 "유어딜 제휴").
 */
homeServiceAdminRoutes.get('/partners', async (c) => {
  try {
    const DB = c.env.DB
    const partners = await loadPartners(DB)
    const ids = [...new Set(Object.values(partners))]
    const names: Record<number, { name: string; status: string }> = {}
    if (ids.length) {
      const { results } = await DB.prepare(
        `SELECT id, COALESCE(NULLIF(business_name, ''), name) AS name, status FROM sellers WHERE id IN (${ids.map(() => '?').join(',')})`,
      ).bind(...ids).all<{ id: number; name: string; status: string }>()
      for (const r of results ?? []) names[r.id] = { name: r.name, status: r.status }
    }
    const data = Object.entries(partners).map(([category, seller_id]) => ({ category, seller_id, ...names[seller_id as number] }))
    return c.json({ success: true, data })
  } catch (err) {
    return safeError(c, err, '설정을 불러오지 못했습니다', '[home-service:partners]')
  }
})

homeServiceAdminRoutes.put('/partners', async (c) => {
  try {
    const DB = c.env.DB
    const b = await c.req.json<{ category?: unknown; seller_id?: unknown }>().catch(() => ({} as { category?: unknown; seller_id?: unknown }))
    const def = categoryDef(b.category)
    if (!def) return c.json({ success: false, error: '카테고리를 골라 주세요' }, 400)
    const partners = await loadPartners(DB)
    if (b.seller_id == null || b.seller_id === '') {
      delete partners[def.key]
    } else {
      const sid = Number(b.seller_id)
      if (!Number.isInteger(sid) || sid <= 0) return c.json({ success: false, error: '매장 번호를 확인해 주세요' }, 400)
      const s = await DB.prepare(`SELECT status FROM sellers WHERE id = ?`).bind(sid).first<{ status: string }>()
      if (!s) return c.json({ success: false, error: '그 매장이 없습니다' }, 404)
      if (!['approved', 'active'].includes(String(s.status))) return c.json({ success: false, error: '판매 승인된 매장만 제휴로 지정할 수 있어요' }, 400)
      partners[def.key] = sid
    }
    await DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ).bind(HOME_PARTNERS_KEY, JSON.stringify(partners)).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '저장하지 못했습니다', '[home-service:partners-save]')
  }
})

/**
 * 🎟️ 카테고리별 참여권 장수(2026-10-25 — 결재 `docs/decisions/2026-10-25-home-service-credit-cost.md`).
 * 업체가 내는 돈이라 **대표 결재 뒤에만** 값을 넣는다. 비워 두면 1장. count 가 null/1 이면 그 카테고리를 기본으로.
 */
homeServiceAdminRoutes.get('/credit-costs', async (c) => {
  try {
    return c.json({ success: true, data: await loadCreditCosts(c.env.DB) })
  } catch (err) {
    return safeError(c, err, '설정을 불러오지 못했습니다', '[home-service:credit-costs]')
  }
})

homeServiceAdminRoutes.put('/credit-costs', async (c) => {
  try {
    const DB = c.env.DB
    const b = await c.req.json<{ category?: unknown; count?: unknown }>().catch(() => ({} as { category?: unknown; count?: unknown }))
    const def = categoryDef(b.category)
    if (!def) return c.json({ success: false, error: '카테고리를 골라 주세요' }, 400)
    const costs = await loadCreditCosts(DB)
    const n = b.count == null || b.count === '' ? 1 : Number(b.count)
    if (!Number.isInteger(n) || n < 1 || n > MAX_CREDIT_COST) return c.json({ success: false, error: `1~${MAX_CREDIT_COST}장 사이로 적어 주세요` }, 400)
    if (n === 1) delete costs[def.key]; else costs[def.key] = n
    await DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ).bind(CREDIT_COST_KEY, JSON.stringify(costs)).run()
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '저장하지 못했습니다', '[home-service:credit-costs-save]')
  }
})

homeServiceAdminRoutes.get('/requests', async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const { results } = await DB.prepare(
      `SELECT id, category, summary, desired_date, status, quote_count, max_quotes, source, contact_name, created_at, share_token
         FROM home_service_requests ORDER BY id DESC LIMIT 100`,
    ).all<Record<string, unknown> & { id: number; status: string; share_token: string | null }>()
    // 🔗 옛 요청은 토큰이 없다 — 열린 것만 이 자리에서 만든다(공유 버튼이 바로 쓴다).
    for (const r of results ?? []) {
      if (!r.share_token && r.status === 'open') r.share_token = await ensureShareToken(DB, r.id).catch(() => null)
    }
    return c.json({
      success: true,
      data: {
        requests: results ?? [],
        categories: HOME_SERVICE_CATEGORIES.map((d) => ({ key: d.key, label: d.label, fields: d.fields })),
      },
    })
  } catch (err) {
    return safeError(c, err, '요청을 불러오지 못했습니다', '[home-service:admin-list]')
  }
})

homeServiceAdminRoutes.post('/requests', async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const b = await c.req.json<{
      category?: string; fields?: Record<string, unknown>; contact_name?: string; contact_phone?: string; consent_note?: string
    }>().catch(() => ({} as Record<string, never>))
    const consent = String(b.consent_note ?? '').trim()
    if (consent.length < 4) {
      return c.json({ success: false, error: '손님에게 연락처 전달 동의를 받았는지 적어 주세요(예: 10/24 통화로 동의)' }, 400)
    }
    const phone = String(b.contact_phone ?? '').replace(/\D/g, '')
    if (!/^01\d{8,9}$/.test(phone)) return c.json({ success: false, error: '손님 휴대폰 번호를 확인해 주세요' }, 400)
    const name = String(b.contact_name ?? '').trim().slice(0, 30)
    if (!name) return c.json({ success: false, error: '손님 이름을 적어 주세요' }, 400)
    const v = validateRequest(
      b.category, b.fields || {},
      (s) => { const r = parseRegionFromAddress(s); return r ? { sido: r.sido, sigungu: r.sigungu } : null }, kstYmd(0),
    )
    if (!v.ok) return c.json({ success: false, error: v.error }, 400)
    // 같은 번호로 가입한 유저가 있으면 그 사람 요청으로 — 앱에서도 견적을 볼 수 있다.
    const u = await DB.prepare(`SELECT id FROM users WHERE REPLACE(REPLACE(phone, '-', ''), ' ', '') = ? LIMIT 1`)
      .bind(phone).first<{ id: number }>().catch(() => null)
    const adminId = Number(getCurrentUser(c)?.id) || null
    const { category, details, regions, desiredDate } = v.value
    const [r1, r2] = regions
    const ins = await DB.prepare(
      `INSERT INTO home_service_requests
         (user_id, category, details, summary, sido, sigungu, sido2, sigungu2, desired_date, contact_name, contact_phone,
          max_quotes, source, created_by_admin, consent_note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'admin', ?, ?)`,
    ).bind(
      Number(u?.id ?? 0), category, JSON.stringify(details), requestSummary(category, details),
      r1.sido, r1.sigungu, r2?.sido ?? null, r2?.sigungu ?? null, desiredDate, name, phone,
      MAX_QUOTES_PER_REQUEST, adminId, consent.slice(0, 200),
    ).run()
    const id = Number(ins.meta?.last_row_id)
    const share_token = await ensureShareToken(DB, id).catch(() => null)
    const sent = await dispatchRequest(c.env, DB, id).catch(() => 0)
    return c.json({ success: true, data: { id, dispatched: sent, linked_user: !!u, share_token } })
  } catch (err) {
    return safeError(c, err, '요청을 접수하지 못했습니다', '[home-service:admin-create]')
  }
})

homeServiceAdminRoutes.get('/requests/:id', async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const id = idParam(c.req.param('id'))
    if (!id) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const req = await DB.prepare(
      `SELECT id, user_id, category, details, summary, desired_date, status, quote_count, max_quotes, source,
              contact_name, contact_phone, consent_note, customer_viewed_at, created_at
         FROM home_service_requests WHERE id = ?`,
    ).bind(id).first<Record<string, unknown>>()
    if (!req) return c.json({ success: false, error: '요청을 찾을 수 없습니다' }, 404)
    // 대리 접수 건은 운영팀이 손님에게 견적을 전한다 — 운영팀이 열면 '열어 봄'(48시간 미열람 반환 판정).
    if (req.source === 'admin' && Number(req.quote_count) > 0 && !req.customer_viewed_at) {
      await DB.prepare(`UPDATE home_service_requests SET customer_viewed_at = datetime('now') WHERE id = ? AND customer_viewed_at IS NULL`)
        .bind(id).run().catch(() => null)
    }
    const { results: quotes } = await DB.prepare(
      `SELECT q.id, q.seller_id, q.price, q.message, q.status, q.is_house, q.partner, q.created_at,
              COALESCE(NULLIF(s.business_name, ''), s.name) AS pro_name,
              COALESCE(NULLIF(p.phone, ''), s.phone) AS pro_phone
         FROM home_service_quotes q
         JOIN sellers s ON s.id = q.seller_id
         LEFT JOIN home_service_pros p ON p.seller_id = q.seller_id
        WHERE q.request_id = ? ORDER BY q.created_at ASC`,
    ).bind(id).all()
    let details: unknown = {}
    try { details = JSON.parse(String(req.details || '{}')) } catch { /* */ }
    return c.json({ success: true, data: { ...req, details, quotes: quotes ?? [], houseSellerId: await houseSellerId(DB) } })
  } catch (err) {
    return safeError(c, err, '요청을 불러오지 못했습니다', '[home-service:admin-detail]')
  }
})

homeServiceAdminRoutes.post('/requests/:id/house-quote', async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const id = idParam(c.req.param('id'))
    if (!id) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const sid = await houseSellerId(DB)
    if (!sid) return c.json({ success: false, error: '직영 견적을 낼 매장을 먼저 정해 주세요' }, 400)
    const b = await c.req.json<{ price?: unknown; message?: unknown }>().catch(() => ({} as Record<string, unknown>))
    const rawPrice = b.price === '' || b.price == null ? null : Number(b.price)
    if (rawPrice != null && (!Number.isFinite(rawPrice) || rawPrice < 1000 || rawPrice > 100_000_000)) {
      return c.json({ success: false, error: '금액을 확인해 주세요(비워 두면 방문 후 견적)' }, 400)
    }
    const message = String(b.message ?? '').trim().slice(0, 500)
    if (message.length < 5) return c.json({ success: false, error: '손님에게 보낼 한마디를 적어 주세요(5자 이상)' }, 400)
    const price = rawPrice == null ? null : Math.round(rawPrice)
    const res = await sendHouseQuoteAtomic(DB, id, sid, price, message)
    if (!res.ok) {
      const map = { closed: '이미 마감된 요청입니다', full: '선착순 자리가 다 찼어요', already: '이미 직영 견적을 냈어요' } as const
      return c.json({ success: false, error: map[res.reason] }, 409)
    }
    const req = await DB.prepare(`SELECT category, contact_phone FROM home_service_requests WHERE id = ?`)
      .bind(id).first<{ category: HomeServiceCategory; contact_phone: string }>()
    if (req?.contact_phone) {
      const label = categoryDef(req.category)?.label || '생활'
      defer(c)(sendSystemAlimtalk(
        c.env, req.contact_phone, HOME_TPL.quoteArrived, msgQuoteArrived('유어딜 직영', label, quotePriceText(price)),
        { dedupKey: `quote:${res.quoteId}` },
      ).catch(() => null))
    }
    return c.json({ success: true, data: { quote_id: res.quoteId } })
  } catch (err) {
    return safeError(c, err, '견적을 보내지 못했습니다', '[home-service:house-quote]')
  }
})

homeServiceAdminRoutes.post('/requests/:id/choose', async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const id = idParam(c.req.param('id'))
    const b = await c.req.json<{ quote_id?: unknown }>().catch(() => ({} as { quote_id?: unknown }))
    const quoteId = Number(b.quote_id)
    if (!id || !Number.isInteger(quoteId) || quoteId <= 0) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    // 🔒 byAdmin — 대리 접수(source='admin') 건에서만 통한다(손님이 앱에서 올린 요청은 손님만 고른다).
    if (!(await chooseQuoteAtomic(DB, id, quoteId, 0, true))) {
      return c.json({ success: false, error: '이미 고른 요청이거나, 운영팀이 대신 고를 수 없는 요청입니다' }, 409)
    }
    const row = await notifyChosen(c.env, DB, id, defer(c))
    return c.json({ success: true, data: { pro_phone: row?.pro_phone ?? null } })
  } catch (err) {
    return safeError(c, err, '선택을 처리하지 못했습니다', '[home-service:admin-choose]')
  }
})

homeServiceAdminRoutes.post('/requests/:id/cancel', async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const id = idParam(c.req.param('id'))
    if (!id) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const upd = await DB.prepare(
      `UPDATE home_service_requests SET status = 'cancelled', updated_at = datetime('now')
        WHERE id = ? AND status = 'open' AND source = 'admin'`,
    ).bind(id).run()
    if (!upd.meta?.changes) return c.json({ success: false, error: '취소할 수 없는 요청입니다(대리 접수 건만)' }, 409)
    const refunded = await refundAllQuotes(DB, id, '손님이 요청 취소(운영팀 대리)')
    return c.json({ success: true, data: { refunded } })
  } catch (err) {
    return safeError(c, err, '취소하지 못했습니다', '[home-service:admin-cancel]')
  }
})

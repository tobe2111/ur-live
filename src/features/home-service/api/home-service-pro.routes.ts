/**
 * 🏠 생활 견적 — 사장님 쪽 API (2026-10-24, 결재 `docs/decisions/2026-10-24-home-service-quotes.md`)
 *
 *   GET  /api/home-service/pro/me                 내 등록(카테고리·지역)·참여권 잔액·묶음
 *   PUT  /api/home-service/pro/me                 등록/수정 — 처음이면 무료 참여권 3장 + 보관된 요청 보내기
 *   GET  /api/home-service/pro/requests           내 지역·카테고리의 열린 요청 + 내가 보낸 견적
 *   GET  /api/home-service/pro/requests/:id       요청 상세(손님이 나를 고르면 손님 연락처)
 *   POST /api/home-service/pro/requests/:id/quote 참여권 1장으로 견적 보내기(금액 선택 — 대표 확정)
 *   POST /api/home-service/pro/credits/charge     참여권 묶음 카드 충전 시작(토스)
 *   POST /api/home-service/pro/credits/confirm    결제 승인 → 참여권 지급
 *
 * 💳 충전은 `confirmTossPayment`(Toss V2 SSOT)만 부른다 — 직접 fetch 금지(CLAUDE.md).
 *   지급은 원장 UNIQUE(`charge:pay:<paymentKey>`) 를 먼저 잡고 잡혔을 때만 잔액을 올린다 → 같은 결제가
 *   두 번 들어와도(브라우저 새로고침·재시도) 참여권은 한 번만 늘어난다.
 * 🚦 충전은 `home_service_charge_enabled = 'true'` 일 때만 — staging 실결제 확인 전엔 꺼 둔다.
 *   그동안 사장님은 무료 참여권 3장으로 견적을 보낼 수 있다(돈이 오가지 않는다).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { requireSeller, getCurrentUser } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { SIDO_LIST } from '@/shared/constants/region-slugs'
import { kstYmd } from '@/shared/stays-early'
import {
  HOME_SERVICE_CATEGORIES, HOME_TPL, SIGNUP_FREE_CREDITS, categoryDef, msgQuoteArrived, partnerCategoriesCsv,
  parseCreditPackages, quotePriceText, type HomeServiceCategory,
} from '@/shared/home-service'
import { sendSystemAlimtalk } from '../../../lib/system-alimtalk'
import { confirmTossPayment, decideTossFlow } from '../../../worker/utils/toss-gateway'
import {
  OPEN_REQUESTS_FOR_PRO_SQL, creditAdd, creditBalance, ensureHomeServiceTables, loadPartners, sendHouseQuoteAtomic,
  sendQuoteAtomic, withPrivateDetails,
} from './home-service-db'
import { dispatchBacklogToPro } from './home-service-notify'
import { homeServiceStopped } from './home-service.routes'

export const homeServiceProRoutes = new Hono<{ Bindings: Env }>()

const SIGUNGU_RE = /^[가-힣]{1,10}(시|군|구)$/

function waitUntil(c: { executionCtx?: { waitUntil(p: Promise<unknown>): void } }, p: Promise<unknown>) {
  try { c.executionCtx?.waitUntil(p) } catch { void p }
}

async function setting(DB: D1Database, key: string): Promise<string> {
  const r = await DB.prepare(`SELECT value FROM platform_settings WHERE key = ?`).bind(key)
    .first<{ value: string }>().catch(() => null)
  return String(r?.value ?? '').trim()
}

async function packages(DB: D1Database) {
  return parseCreditPackages(await setting(DB, 'home_service_packages') || null)
}

function sellerIdOf(c: Parameters<typeof getCurrentUser>[0]): number {
  return Number(getCurrentUser(c)?.id) || 0
}

homeServiceProRoutes.get('/me', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const sid = sellerIdOf(c)
    const [pro, cats, areas, seller, tx] = await Promise.all([
      DB.prepare(`SELECT phone, active, created_at FROM home_service_pros WHERE seller_id = ?`).bind(sid).first(),
      DB.prepare(`SELECT category FROM home_service_pro_categories WHERE seller_id = ?`).bind(sid).all<{ category: string }>(),
      DB.prepare(`SELECT sido, sigungu FROM home_service_pro_areas WHERE seller_id = ? ORDER BY sido, sigungu`).bind(sid).all(),
      DB.prepare(`SELECT status, phone, COALESCE(NULLIF(business_name, ''), name) AS name FROM sellers WHERE id = ?`).bind(sid)
        .first<{ status: string; phone: string | null; name: string }>(),
      DB.prepare(`SELECT kind, amount, price_paid, note, created_at FROM home_service_credit_tx WHERE seller_id = ? ORDER BY id DESC LIMIT 20`)
        .bind(sid).all(),
    ])
    return c.json({
      success: true,
      data: {
        registered: !!pro,
        pro,
        categories: (cats.results ?? []).map((r) => r.category),
        areas: areas.results ?? [],
        seller: { name: seller?.name ?? '', approved: ['approved', 'active'].includes(String(seller?.status)), phone: seller?.phone ?? null },
        balance: await creditBalance(DB, sid),
        packages: await packages(DB),
        chargeEnabled: (await setting(DB, 'home_service_charge_enabled')) === 'true',
        history: tx.results ?? [],
        allCategories: HOME_SERVICE_CATEGORIES.map((d) => ({ key: d.key, label: d.label })),
        sidoList: SIDO_LIST,
      },
    })
  } catch (err) {
    return safeError(c, err, '정보를 불러오지 못했습니다', '[home-service:pro-me]')
  }
})

homeServiceProRoutes.put('/me', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const sid = sellerIdOf(c)
    const body = await c.req.json<{ categories?: unknown; areas?: unknown; phone?: unknown; active?: unknown }>()
      .catch(() => ({} as Record<string, unknown>))
    const cats = Array.isArray(body.categories) ? [...new Set(body.categories.map(String))].filter((k) => categoryDef(k)) : []
    if (!cats.length) return c.json({ success: false, error: '하는 일을 하나 이상 골라 주세요' }, 400)
    const areasIn = Array.isArray(body.areas) ? body.areas.slice(0, 40) : []
    const areas: { sido: string; sigungu: string }[] = []
    for (const a of areasIn) {
      const sido = String((a as { sido?: unknown })?.sido ?? '').trim()
      const sigungu = String((a as { sigungu?: unknown })?.sigungu ?? '').trim()
      if (!SIDO_LIST.includes(sido)) continue
      if (sigungu && !SIGUNGU_RE.test(sigungu)) continue
      if (!areas.some((x) => x.sido === sido && x.sigungu === sigungu)) areas.push({ sido, sigungu })
    }
    if (!areas.length) return c.json({ success: false, error: '일할 지역을 하나 이상 골라 주세요' }, 400)
    const phoneRaw = String(body.phone ?? '').replace(/\D/g, '')
    if (phoneRaw && !/^01\d{8,9}$/.test(phoneRaw)) return c.json({ success: false, error: '휴대폰 번호 형식을 확인해 주세요' }, 400)
    const active = body.active === false ? 0 : 1

    const existed = await DB.prepare(`SELECT 1 AS x FROM home_service_pros WHERE seller_id = ?`).bind(sid).first()
    await DB.batch([
      DB.prepare(
        `INSERT INTO home_service_pros (seller_id, phone, active) VALUES (?, ?, ?)
         ON CONFLICT(seller_id) DO UPDATE SET phone = excluded.phone, active = excluded.active, updated_at = datetime('now')`,
      ).bind(sid, phoneRaw || null, active),
      DB.prepare(`DELETE FROM home_service_pro_categories WHERE seller_id = ?`).bind(sid),
      ...cats.map((k) => DB.prepare(`INSERT INTO home_service_pro_categories (seller_id, category) VALUES (?, ?)`).bind(sid, k)),
      DB.prepare(`DELETE FROM home_service_pro_areas WHERE seller_id = ?`).bind(sid),
      ...areas.map((a) => DB.prepare(`INSERT INTO home_service_pro_areas (seller_id, sido, sigungu) VALUES (?, ?, ?)`).bind(sid, a.sido, a.sigungu)),
    ])
    // 처음 등록이면 무료 참여권 — 원장 UNIQUE(grant:signup:<매장>) 라 몇 번을 저장해도 한 번만.
    const granted = existed ? false : await creditAdd(DB, sid, 'grant', SIGNUP_FREE_CREDITS, `signup:${sid}`, 0, '가입 무료 참여권')
    // 사장님이 없던 지역에 보관돼 있던 요청을 지금 보낸다(대표 "그냥 1명부터 열어줘").
    if (active) waitUntil(c, dispatchBacklogToPro(c.env, DB, sid, kstYmd(0)).catch(() => 0))
    return c.json({ success: true, data: { granted: granted ? SIGNUP_FREE_CREDITS : 0 } })
  } catch (err) {
    return safeError(c, err, '저장하지 못했습니다', '[home-service:pro-save]')
  }
})

homeServiceProRoutes.get('/requests', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const sid = sellerIdOf(c)
    const partners = await loadPartners(DB)
    const { results: open } = await DB.prepare(OPEN_REQUESTS_FOR_PRO_SQL)
      .bind(sid, kstYmd(0), partnerCategoriesCsv(partners, sid), sid, sid, 50).all()
    const { results: mine } = await DB.prepare(
      `SELECT r.id, r.category, r.summary, r.desired_date, r.status, r.quote_count, r.max_quotes,
              q.id AS my_quote_id, q.status AS my_quote_status, q.price AS my_price, q.created_at AS quoted_at
         FROM home_service_quotes q JOIN home_service_requests r ON r.id = q.request_id
        WHERE q.seller_id = ? ORDER BY q.id DESC LIMIT 50`,
    ).bind(sid).all()
    const partnerOf = Object.entries(partners).filter(([, v]) => v === sid).map(([k]) => k)
    return c.json({ success: true, data: { open: open ?? [], mine: mine ?? [], balance: await creditBalance(DB, sid), partnerOf } })
  } catch (err) {
    return safeError(c, err, '요청을 불러오지 못했습니다', '[home-service:pro-list]')
  }
})

/** 이 사장님이 이 요청을 볼 수 있는가 — 내 카테고리·지역이거나, 이미 견적을 보냈거나, 그 카테고리 제휴 업체이거나. */
async function proCanSee(DB: D1Database, sid: number, requestId: number): Promise<boolean> {
  const csv = partnerCategoriesCsv(await loadPartners(DB), sid)
  const r = await DB.prepare(
    `SELECT 1 AS x FROM home_service_requests r
      WHERE r.id = ?
        AND (EXISTS (SELECT 1 FROM home_service_quotes q WHERE q.request_id = r.id AND q.seller_id = ?)
          OR instr(',' || ? || ',', ',' || r.category || ',') > 0
          OR (r.category IN (SELECT category FROM home_service_pro_categories WHERE seller_id = ?)
              AND EXISTS (SELECT 1 FROM home_service_pro_areas a WHERE a.seller_id = ?
                    AND ((a.sido = r.sido AND (a.sigungu = '' OR a.sigungu = r.sigungu))
                      OR (r.sido2 IS NOT NULL AND a.sido = r.sido2 AND (a.sigungu = '' OR a.sigungu = r.sigungu2))))))`,
  ).bind(requestId, sid, csv, sid, sid).first()
  return !!r
}

homeServiceProRoutes.get('/requests/:id', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const sid = sellerIdOf(c)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0 || !(await proCanSee(DB, sid, id))) {
      return c.json({ success: false, error: '요청을 찾을 수 없습니다' }, 404)
    }
    const r = await DB.prepare(
      `SELECT r.id, r.category, r.details, r.summary, r.desired_date, r.status, r.quote_count, r.max_quotes, r.created_at,
              q.id AS my_quote_id, q.status AS my_quote_status, q.price AS my_price, q.message AS my_message,
              CASE WHEN q.status = 'chosen' THEN r.contact_name END AS customer_name,
              CASE WHEN q.status = 'chosen' THEN r.contact_phone END AS customer_phone,
              CASE WHEN q.status = 'chosen' THEN r.private_details END AS private_details
         FROM home_service_requests r
         LEFT JOIN home_service_quotes q ON q.request_id = r.id AND q.seller_id = ?
        WHERE r.id = ?`,
    ).bind(sid, id).first<Record<string, unknown>>()
    let details: unknown = {}
    try { details = JSON.parse(String(r?.details || '{}')) } catch { /* */ }
    // 🔒 상세 주소는 손님이 이 사장님을 고른 뒤에만(위 CASE) — 고르기 전엔 NULL 이라 동까지만 보인다.
    details = withPrivateDetails(details, r?.private_details)
    const { private_details: _p, ...rest } = r ?? {}
    const isPartner = (await loadPartners(DB))[r?.category as HomeServiceCategory] === sid
    return c.json({ success: true, data: { ...rest, details, balance: await creditBalance(DB, sid), is_partner: isPartner } })
  } catch (err) {
    return safeError(c, err, '요청을 불러오지 못했습니다', '[home-service:pro-detail]')
  }
})

homeServiceProRoutes.post('/requests/:id/quote', requireSeller(), rateLimit({ action: 'home_service_quote', max: 30, windowSec: 600 }), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    if (await homeServiceStopped(DB)) return c.json({ success: false, error: '지금은 견적을 받지 않습니다' }, 503)
    const sid = sellerIdOf(c)
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
    const seller = await DB.prepare(`SELECT status, COALESCE(NULLIF(business_name, ''), name) AS name FROM sellers WHERE id = ?`)
      .bind(sid).first<{ status: string; name: string }>()
    if (!['approved', 'active'].includes(String(seller?.status))) {
      return c.json({ success: false, error: '매장 심사가 끝나면 견적을 보낼 수 있어요', code: 'NOT_APPROVED' }, 403)
    }
    if (!(await proCanSee(DB, sid, id))) return c.json({ success: false, error: '내 지역·카테고리의 요청이 아닙니다' }, 403)
    const body = await c.req.json<{ price?: unknown; message?: unknown }>().catch(() => ({} as Record<string, unknown>))
    const rawPrice = body.price === '' || body.price == null ? null : Number(body.price)
    if (rawPrice != null && (!Number.isFinite(rawPrice) || rawPrice < 1000 || rawPrice > 100_000_000)) {
      return c.json({ success: false, error: '금액을 확인해 주세요(비워 두면 방문 후 견적)' }, 400)
    }
    const message = String(body.message ?? '').trim().slice(0, 500)
    if (message.length < 5) return c.json({ success: false, error: '손님에게 보낼 한마디를 적어 주세요(5자 이상)' }, 400)

    // 🤝 제휴 업체는 참여권 없이(2026-10-24 승인된 직영·협력 업체 규칙) — 자리는 똑같이 하나 차지한다.
    const cat = await DB.prepare(`SELECT category FROM home_service_requests WHERE id = ?`).bind(id).first<{ category: HomeServiceCategory }>()
    const isPartner = !!cat && (await loadPartners(DB))[cat.category] === sid
    const price = rawPrice == null ? null : Math.round(rawPrice)
    const res = isPartner
      ? await sendHouseQuoteAtomic(DB, id, sid, price, message, true)
      : await sendQuoteAtomic(DB, id, sid, price, message)
    if (!res.ok) {
      const map = {
        closed: ['이미 마감된 요청입니다', 409],
        full: ['선착순 자리가 다 찼어요', 409],
        already: ['이미 견적을 보냈어요', 409],
        no_credit: ['참여권이 없어요. 충전 후 다시 시도해 주세요', 402],
      } as const
      const [error, status] = map[res.reason]
      return c.json({ success: false, error, code: res.reason.toUpperCase() }, status)
    }
    const req = await DB.prepare(`SELECT category, contact_phone FROM home_service_requests WHERE id = ?`)
      .bind(id).first<{ category: HomeServiceCategory; contact_phone: string }>()
    if (req?.contact_phone) {
      const label = categoryDef(req.category)?.label || '생활'
      waitUntil(c, sendSystemAlimtalk(
        c.env, req.contact_phone, HOME_TPL.quoteArrived,
        msgQuoteArrived(seller?.name || '사장님', label, quotePriceText(rawPrice)),
        { dedupKey: `quote:${res.quoteId}` },
      ).catch(() => null))
    }
    return c.json({ success: true, data: { quote_id: res.quoteId, balance: await creditBalance(DB, sid) } })
  } catch (err) {
    return safeError(c, err, '견적을 보내지 못했습니다', '[home-service:quote]')
  }
})

// ── 참여권 충전 ────────────────────────────────────────────────────────────────

/** 주문번호 = HSC-<매장>-<묶음키>-<시각>. 승인 때 이 모양과 요청자를 대조한다(남의 주문으로 충전 불가). */
function parseOrderId(orderId: string): { sellerId: number; pkgKey: string } | null {
  const m = /^HSC-(\d+)-([a-z0-9]{1,10})-\d{10,16}$/.exec(String(orderId || ''))
  return m ? { sellerId: Number(m[1]), pkgKey: m[2] } : null
}

homeServiceProRoutes.post('/credits/charge', requireSeller(), rateLimit({ action: 'home_service_charge', max: 10, windowSec: 600 }), async (c) => {
  try {
    const DB = c.env.DB
    if ((await setting(DB, 'home_service_charge_enabled')) !== 'true') {
      return c.json({ success: false, error: '참여권 충전은 곧 열립니다. 지금은 무료 참여권을 써 주세요', code: 'CHARGE_CLOSED' }, 503)
    }
    const sid = sellerIdOf(c)
    const body = await c.req.json<{ package_key?: string }>().catch(() => ({} as { package_key?: string }))
    const pkg = (await packages(DB)).find((p) => p.key === body.package_key)
    if (!pkg) return c.json({ success: false, error: '묶음을 골라 주세요' }, 400)
    const { flow, flowReason } = decideTossFlow(c.env.TOSS_CLIENT_KEY)
    if (flow === 'invalid') return c.json({ success: false, error: '결제 시스템이 설정되지 않았습니다', _debug: flowReason }, 503)
    return c.json({
      success: true,
      data: {
        orderId: `HSC-${sid}-${pkg.key}-${Date.now()}`,
        amount: pkg.price,
        orderName: `생활 견적 참여권 ${pkg.label}`,
        clientKey: c.env.TOSS_CLIENT_KEY,
        flow,
      },
    })
  } catch (err) {
    return safeError(c, err, '충전을 시작하지 못했습니다', '[home-service:charge]')
  }
})

homeServiceProRoutes.post('/credits/confirm', requireSeller(), async (c) => {
  try {
    const DB = c.env.DB
    await ensureHomeServiceTables(DB)
    const sid = sellerIdOf(c)
    const body = await c.req.json<{ paymentKey?: string; orderId?: string; amount?: number }>()
      .catch(() => ({} as { paymentKey?: string; orderId?: string; amount?: number }))
    const paymentKey = String(body.paymentKey || '')
    const orderId = String(body.orderId || '')
    const parsed = parseOrderId(orderId)
    if (!paymentKey || !parsed || parsed.sellerId !== sid) return c.json({ success: false, error: '결제 정보가 올바르지 않습니다' }, 400)
    const pkg = (await packages(DB)).find((p) => p.key === parsed.pkgKey)
    if (!pkg) return c.json({ success: false, error: '묶음 정보를 확인할 수 없습니다' }, 400)
    // 금액은 서버 묶음 가격이 진실 — 클라 값이 다르면 승인하지 않는다.
    if (Number(body.amount) !== pkg.price) return c.json({ success: false, error: '결제 금액이 묶음 가격과 다릅니다' }, 400)

    const ref = `pay:${paymentKey}`
    const done = await DB.prepare(`SELECT 1 AS x FROM home_service_credit_tx WHERE kind = 'charge' AND ref = ?`).bind(ref).first()
    if (done) return c.json({ success: true, data: { credits_added: 0, balance: await creditBalance(DB, sid) }, message: '이미 충전된 결제입니다' })

    const toss = await confirmTossPayment({
      env: c.env, paymentKey, orderId, amount: pkg.price, idempotencyKey: `hsc_${orderId}`, circuitName: 'toss-confirm-home-service',
    })
    if (!toss.ok) return c.json({ success: false, error: toss.message, code: toss.code }, 400)

    const added = await creditAdd(DB, sid, 'charge', pkg.credits, ref, pkg.price, `참여권 ${pkg.label} 충전 (${orderId})`)
    return c.json({
      success: true,
      data: { credits_added: added ? pkg.credits : 0, balance: await creditBalance(DB, sid) },
      message: added ? `참여권 ${pkg.credits}장이 충전되었습니다` : '이미 충전된 결제입니다',
    })
  } catch (err) {
    return safeError(c, err, '충전을 완료하지 못했습니다', '[home-service:confirm]')
  }
})

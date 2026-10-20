/**
 * 🤖 GET /api/agent/search — AI 비서 검색 창구 (2026-10-19, 결재 `docs/decisions/2026-10-19-ai-agent-channel.md`).
 *
 * 입력 정리·응답 모양은 `shared/agent-search.ts`(순수). 여기는 게이트 · 조회 · 캐시만 한다.
 * 🔒 찾기 전용 — 결제·주문·원장 무접촉. 결제는 사람이 `url`(우리 상세)에서 한다.
 * 🔒 게이트 `agent_search_enabled` 기본 OFF — 꺼져 있으면 404(크롤러에게 존재를 알리지 않는다).
 * 📌 `publicUtilityRoutes` 아래에 붙는다(`worker/index.ts` 무접촉 — 로딩 잠금 파일).
 */
import { Hono } from 'hono'
import type { Env } from '../types/env'
import { publicCache } from '../middleware/edge-cache'
import { safeError } from '../utils/safe-error'
import { settingOn } from '../utils/owner-nudges'
import { mainScopeFor } from '../utils/consumer-scope'
import { VOUCHER_CATEGORIES } from '../../shared/constants/voucher-categories'
import { demoSlugSql } from '../../shared/constants/demo-products'
import { consumerVisibleProductSql, approvedSellerProductSql } from '../../shared/db/consumer-visible-product'
import {
  AGENT_SEARCH_GATE, AGENT_HOW_TO_BUY, parseAgentQuery, toAgentItem, type AgentRow,
} from '../../shared/agent-search'
import { AGENT_CHECKOUT_GATE, AGENT_HOW_TO_PAY, agentCheckoutUrl, clampAgentQty } from '../../shared/agent-checkout'
import { canonicalDetailPath } from '../../shared/product-flow'
import { priceDisplay } from '../../shared/price-display'
import { getSupplyMeta } from '../utils/product-supply-meta'
import { getPlatformQtyCap, resolveQtyCap } from '../utils/purchase-cap'

export const agentSearchRoutes = new Hono<{ Bindings: Env }>()

agentSearchRoutes.use('/search', publicCache(300))
agentSearchRoutes.get('/search', async (c) => {
  try {
    const DB = c.env.DB
    if (!DB || !(await settingOn(DB, AGENT_SEARCH_GATE))) return c.json({ success: false, error: 'NOT_FOUND' }, 404)

    const q = parseAgentQuery({
      q: c.req.query('q'), region: c.req.query('region'),
      category: c.req.query('category'), limit: c.req.query('limit'),
    })
    if (!q) return c.json({ success: false, error: '검색어(q)나 지역(region) 중 하나는 필요합니다' }, 400)

    const scope = await mainScopeFor(DB, 'products', 'p')
    const cats = q.category ? [q.category] : [...VOUCHER_CATEGORIES]
    const where: string[] = []
    const binds: (string | number)[] = [...cats]
    if (q.q) { where.push('(p.name LIKE ? OR p.restaurant_name LIKE ?)'); binds.push(`%${q.q}%`, `%${q.q}%`) }
    if (q.region) { where.push('p.restaurant_address LIKE ?'); binds.push(`%${q.region}%`) }
    binds.push(q.limit)

    const { results } = await DB.prepare(`
      SELECT p.id, p.name, p.restaurant_name, p.restaurant_address, p.category,
             p.price, p.original_price, p.discount_rate, p.deal_only
      FROM products p
      WHERE p.category IN (${cats.map(() => '?').join(',')})
        AND p.is_active = 1 AND p.group_buy_status = 'active'
        AND COALESCE(p.deal_only, 0) = 0
        AND ${consumerVisibleProductSql('p')}
        AND ${approvedSellerProductSql('p')}
        AND NOT ${demoSlugSql('p')}${scope}
        ${where.length ? `AND ${where.join(' AND ')}` : ''}
      ORDER BY p.id DESC
      LIMIT ?
    `).bind(...binds).all<AgentRow>()

    const origin = new URL(c.req.url).origin
    const items = (results || []).map(r => toAgentItem(r, origin)).filter(Boolean)
    return c.json({ success: true, data: { items, how_to_buy: AGENT_HOW_TO_BUY } })
  } catch (err) {
    return safeError(c, err, '검색 중 오류가 발생했습니다', '[agent-search]')
  }
})

/**
 * 🛒 GET /api/agent/checkout?id=&qty= — 결제 직전까지 넘겨주기 (2026-10-20 대표 *"4번도 일단은 하자"*).
 * 금액과 **결제 링크**만 준다. AI 는 결제하지 않는다 — 손님이 링크를 열어 직접 결제한다(근거: `shared/agent-checkout.ts`).
 * 🔒 검색과 **같은 조건**의 상품만(활성·승인 매장·데모 제외·교환권 제외) — 검색에 안 나오는 것을 링크로 팔지 않는다.
 * 🔒 금액은 안내용이다 — 실제 청구액·한도는 결제 직전에 서버가 다시 잰다. 그래서 캐시해도 위험이 없지만
 *    한도 설정이 바뀌면 바로 따라가도록 짧게(60초) 둔다.
 */
agentSearchRoutes.use('/checkout', publicCache(60))
agentSearchRoutes.get('/checkout', async (c) => {
  try {
    const DB = c.env.DB
    if (!DB) return c.json({ success: false, error: 'NOT_FOUND' }, 404)
    const [searchOn, checkoutOn] = await Promise.all([settingOn(DB, AGENT_SEARCH_GATE), settingOn(DB, AGENT_CHECKOUT_GATE)])
    if (!searchOn || !checkoutOn) return c.json({ success: false, error: 'NOT_FOUND' }, 404)

    const id = Math.trunc(Number(c.req.query('id')))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '상품번호(id)가 필요합니다' }, 400)

    const scope = await mainScopeFor(DB, 'products', 'p')
    const cats = [...VOUCHER_CATEGORIES]
    const row = await DB.prepare(`
      SELECT p.id, p.name, p.restaurant_name, p.restaurant_address, p.category,
             p.price, p.original_price, p.discount_rate, p.deal_only
      FROM products p
      WHERE p.id = ? AND p.category IN (${cats.map(() => '?').join(',')})
        AND p.is_active = 1 AND p.group_buy_status = 'active'
        AND COALESCE(p.deal_only, 0) = 0
        AND ${consumerVisibleProductSql('p')}
        AND ${approvedSellerProductSql('p')}
        AND NOT ${demoSlugSql('p')}${scope}
      LIMIT 1
    `).bind(id, ...cats).first<AgentRow>()
    if (!row) return c.json({ success: false, error: '지금 살 수 있는 이용권이 아닙니다' }, 404)

    const path = canonicalDetailPath({ id: row.id, deal_only: row.deal_only, category: row.category })
    const unit = priceDisplay(row).price
    if (!path || unit <= 0) return c.json({ success: false, error: '지금 살 수 있는 이용권이 아닙니다' }, 404)

    const meta = (await getSupplyMeta(DB, [row.id]).catch(() => null))?.get(row.id)
    // 오픈 예정형은 결제가 아니라 사전 응모다 — 결제 링크를 주면 손님이 막힌 버튼을 만난다.
    if (meta?.prelaunch === '1') return c.json({ success: false, error: '아직 판매 전인 이용권입니다' }, 409)

    // 숙소는 날짜·객실을 골라야 해서 수량을 미리 채울 수 없다 — 1장 기준 금액과 상세 링크만 준다.
    const stay = !path.startsWith('/pass/')
    const cap = stay ? 1 : resolveQtyCap(meta?.max_per_person, await getPlatformQtyCap(DB))
    const qty = clampAgentQty(c.req.query('qty'), cap)
    const origin = new URL(c.req.url).origin
    return c.json({
      success: true,
      data: {
        id: row.id,
        name: String(row.name || '').trim(),
        store: row.restaurant_name ? String(row.restaurant_name).trim() : null,
        unit_price: unit,
        quantity: qty,
        max_quantity: cap,
        total: unit * qty,
        currency: 'KRW',
        checkout_url: agentCheckoutUrl(origin, path, qty),
        how_to_pay: stay ? '숙소는 손님이 링크에서 날짜와 객실을 고른 뒤 직접 결제합니다.' : AGENT_HOW_TO_PAY,
      },
    })
  } catch (err) {
    return safeError(c, err, '결제 링크를 만드는 중 오류가 발생했습니다', '[agent-checkout]')
  }
})

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

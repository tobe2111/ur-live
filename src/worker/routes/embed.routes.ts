/**
 * 🧩 홈페이지 삽입 위젯 라우트 (2026-10-31 대표 *"HTML 임베드를 여러개 만들어줘. 1개만 선택하진 않을거야.
 * 일단 에이전시 홈페이지에 넣을 것. 인플루언서의 홈페이지에 넣을 것(자신의 유어샵 페이지에 있는 이용권들 보이게.)"*)
 *
 *   GET /embed/u/:handle             유어샵 — 인플루언서·유저가 자기 블로그·홈페이지에 (담은 이용권 + 내 가게 이용권)
 *   GET /embed/agency/:id            에이전시 — 맡아 운영하는 매장들의 이용권(포트폴리오)
 *   GET /embed/store/:username       매장 — 사장님이 가게 홈페이지에 자기 이용권을
 *   GET /embed/region/:sido/:sigungu? 지역 — 관광·상인회·지역 안내 사이트에 그 동네 이용권을
 *   GET /embed/pass/:id              이용권 하나 — 블로그 글 속 카드
 *   GET /embed/partner/:id           제휴사 입점 — 제휴사(에이전시)가 자기 사이트에서 사장님께 유어딜 입점을 판다
 *   GET /embed                       코드 만들기(스크립트 없는 폼 — 미리보기 + 복사할 코드)
 *
 * 🔓 iframe 허용: 워커 보안 헤더가 `/embed/` 로 시작하는 경로만 `frame-ancestors *` 로 연다(그 분기는
 *    전부터 있었다 — 라이브커머스 위젯 시절). 그래서 이 라우트는 **반드시 `/embed/` 아래**에 있어야 한다.
 * 🚫 색인 안 함: robots.txt 가 `/embed/` 를 막고, 문서·헤더 둘 다 noindex.
 * 💸 돈 경로 무접촉: 위젯은 보여 주고 링크할 뿐이다. 유어샵 핀은 기존 서버 리다이렉트
 *    (`/api/curator/:handle/p/:id/redirect`)로 보내 **소개 값·클릭 기록이 공유 링크와 똑같이** 잡힌다.
 */
import { Hono, type Context } from 'hono'
import type { Env } from '../types/env'
import { publicCache } from '../middleware/edge-cache'
import { publicReadDb } from '../utils/d1-read-replica'
import { consumerVisibleProductSql, approvedSellerProductSql } from '../../shared/db/consumer-visible-product'
import { VOUCHER_CATEGORIES } from '../../shared/constants/voucher-categories'
import { demoSlugSql } from '../../shared/constants/demo-products'
import { parseRegionPath, addressInRegion, regionLabel, regionPath } from '../../shared/constants/region-slugs'
import { curatorHomePins, isVoucherPin } from '../../shared/curator-pin-order'
import { findActiveDealPctsBySeller } from '../utils/influencer-deal'
import { OWNED_STORE_WHERE_SQL } from '../utils/seller-operators'
import { isValidHandleFormat } from '../utils/handle-generator'
import {
  parseEmbedParams, toEmbedCard, renderStrip, renderSingle, renderMissing, renderPartner, withUtm,
  type EmbedRow, type EmbedTheme,
} from '../utils/embed-widget'
import { renderEmbedBuilder } from '../utils/embed-builder'

export const embedRoutes = new Hono<{ Bindings: Env }>()

const COLS = `p.id, p.name, p.price, p.original_price, p.discount_rate, p.image_url, p.thumbnail, p.category,
  COALESCE(p.deal_only, 0) AS deal_only, p.restaurant_name, p.restaurant_address, s.name AS seller_name`
const CAT_IN = VOUCHER_CATEGORIES.map(() => '?').join(',') // d1-bind-ok: 고정 카테고리 5개 + 바인드 최대 3 = 8 (한도 100)
/** 소비자 피드와 같은 노출 조건 — 승인 매장 · 도매 원본 제외 · 판매 중 이용권. */
const LIVE = `p.is_active = 1 AND p.category IN (${CAT_IN}) AND COALESCE(p.group_buy_status, 'active') = 'active'
  AND ${consumerVisibleProductSql('p')} AND ${approvedSellerProductSql('p')}`
/** 데모는 맨 뒤(2026-07-04 대표 지시와 같은 규칙) → 많이 팔린 순 → 최신순. */
const ORDER = `CASE WHEN ${demoSlugSql('p')} THEN 1 ELSE 0 END, COALESCE(p.sold_count, 0) DESC, p.created_at DESC`

type Row = EmbedRow & { restaurant_address?: string | null; seller_id?: number | null }

function html(_c: unknown, body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex' } })
}

// 위젯은 공개 데이터라 엣지에 5분(엣지 15분) 둔다 — 남의 사이트 방문자가 몰려도 D1 이 안 맞는다.
embedRoutes.use('/embed/*', publicCache(300))

// ── 유어샵 ─────────────────────────────────────────────────────────────
embedRoutes.get('/embed/u/:handle', async (c) => {
  const { count, theme } = parseEmbedParams((k) => c.req.query(k))
  const handle = String(c.req.param('handle') || '').toLowerCase().trim()
  if (!isValidHandleFormat(handle)) return html(c, renderMissing(theme), 404)
  const DB = publicReadDb(c.env.DB)
  const user = await DB.prepare('SELECT id, name FROM users WHERE handle = ? LIMIT 1').bind(handle)
    .first<{ id: number; name: string | null }>().catch(() => null)
  if (!user) return html(c, renderMissing(theme), 404)

  const [pinRes, store, dealPct] = await Promise.all([
    DB.prepare(`SELECT ${COLS}, p.seller_id FROM product_pins pp JOIN products p ON p.id = pp.product_id
      LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE pp.user_id = ? AND p.is_active = 1 AND ${consumerVisibleProductSql('p')} AND ${approvedSellerProductSql('p')}
      ORDER BY pp.position ASC, pp.created_at DESC LIMIT 60`).bind(user.id).all<Row>().catch(() => ({ results: [] as Row[] })),
    DB.prepare(`SELECT s.id FROM sellers s WHERE ${OWNED_STORE_WHERE_SQL} LIMIT 1`).bind(user.id, user.id, user.id)
      .first<{ id: number }>().catch(() => null),
    findActiveDealPctsBySeller(DB, String(user.id)).catch(() => new Map<number, number>()),
  ])
  // 진열 순서는 유어샵 화면과 같은 SSOT(`curatorHomePins`) — 순번이 갈리면 위젯과 유어샵이 다른 순서로 보인다.
  const pins = curatorHomePins((pinRes.results || []).map((r) => ({ ...r, deal_pct: dealPct.get(Number(r.seller_id)) ?? null })))
    .filter(isVoucherPin)
  const pinCards = pins.map((r) => toEmbedCard(r, 'ushop',
    // 핀은 서버 리다이렉트로 — 소개 값(?aff=)·클릭 기록이 카톡 공유 링크와 똑같이 잡힌다.
    () => `/api/curator/${encodeURIComponent(handle)}/p/${r.id}/redirect`))

  let ownCards: ReturnType<typeof toEmbedCard>[] = []
  if (store?.id && pinCards.length < count) {
    const own = await DB.prepare(`SELECT ${COLS} FROM products p LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE p.seller_id = ? AND ${LIVE} ORDER BY ${ORDER} LIMIT ?`)
      .bind(store.id, ...VOUCHER_CATEGORIES, count).all<Row>().catch(() => ({ results: [] as Row[] }))
    const pinned = new Set(pins.map((p) => p.id))
    ownCards = (own.results || []).filter((r) => !pinned.has(r.id)).map((r) => toEmbedCard(r, 'ushop'))
  }
  const name = String(user.name || handle).trim()
  return html(c, renderStrip({
    kind: 'ushop', theme, title: `${name}님의 유어샵`,
    moreHref: withUtm(`/u/${encodeURIComponent(handle)}`, 'ushop'),
    cards: [...pinCards, ...ownCards].slice(0, count),
    emptyText: '아직 담은 이용권이 없어요.',
  }))
})

// ── 에이전시 ───────────────────────────────────────────────────────────
embedRoutes.get('/embed/agency/:id', async (c) => {
  const { count, theme } = parseEmbedParams((k) => c.req.query(k))
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) return html(c, renderMissing(theme), 404)
  const DB = publicReadDb(c.env.DB)
  const agency = await DB.prepare("SELECT id, name FROM agency_accounts WHERE id = ? AND status = 'active' LIMIT 1")
    .bind(id).first<{ id: number; name: string }>().catch(() => null)
  if (!agency) return html(c, renderMissing(theme), 404)
  // 맡아 운영 중인 매장(맡김 active)의 이용권. 한 매장을 여러 에이전시가 함께 맡을 수 있으므로
  // **다른 에이전시가 맡은 이용권**(`agency_products`)은 뺀다 — 남의 성과를 내 포트폴리오로 보이지 않게.
  const rows = await DB.prepare(`SELECT ${COLS} FROM products p LEFT JOIN sellers s ON s.id = p.seller_id
    WHERE p.seller_id IN (SELECT seller_id FROM agency_store_links WHERE agency_id = ? AND status = 'active')
      AND NOT EXISTS (SELECT 1 FROM agency_products ap WHERE ap.product_id = p.id AND ap.agency_id != ?)
      AND ${LIVE} ORDER BY ${ORDER} LIMIT ?`)
    .bind(id, id, ...VOUCHER_CATEGORIES, count).all<Row>().catch(() => ({ results: [] as Row[] }))
  // 🤝 머리띠에 유어딜과 **나란히**(제휴 위젯 시안 B 와 같은 언어) + 운영 매장 수.
  //   종전엔 유어샵·매장·지역과 똑같은 머리였고 '전체 보기' 가 **유어딜 홈**으로 갔다 —
  //   에이전시가 자기 사이트에 건 위젯이 손님을 우리 쪽으로 보내고 있었다(에이전시 공개 페이지는 없다).
  //   ⚠️ 0 곳이면 지표를 안 그린다. 신뢰를 주려고 넣은 자리에 0 이 서면 없는 것만 못하다.
  const stores = await DB.prepare("SELECT COUNT(*) AS n FROM agency_store_links WHERE agency_id = ? AND status = 'active'")
    .bind(id).first<{ n: number }>().catch(() => null)
  const storeCount = Number(stores?.n || 0)
  return html(c, renderStrip({
    kind: 'agency', theme, title: `${agency.name} 운영 매장`,
    brand: agency.name,
    meta: storeCount > 0 ? `운영 매장 ${storeCount}곳` : undefined,
    cards: (rows.results || []).map((r) => toEmbedCard(r, 'agency')),
  }))
})

// ── 매장 ───────────────────────────────────────────────────────────────
embedRoutes.get('/embed/store/:username', async (c) => {
  const { count, theme } = parseEmbedParams((k) => c.req.query(k))
  const username = String(c.req.param('username') || '').trim()
  if (!username || username.length > 64) return html(c, renderMissing(theme), 404)
  const DB = publicReadDb(c.env.DB)
  const store = await DB.prepare("SELECT id, name, username FROM sellers WHERE username = ? AND status IN ('approved', 'active') LIMIT 1")
    .bind(username).first<{ id: number; name: string | null; username: string }>().catch(() => null)
  if (!store) return html(c, renderMissing(theme), 404)
  const rows = await DB.prepare(`SELECT ${COLS} FROM products p LEFT JOIN sellers s ON s.id = p.seller_id
    WHERE p.seller_id = ? AND ${LIVE} ORDER BY ${ORDER} LIMIT ?`)
    .bind(store.id, ...VOUCHER_CATEGORIES, count).all<Row>().catch(() => ({ results: [] as Row[] }))
  return html(c, renderStrip({
    kind: 'store', theme, title: `${store.name || store.username} 이용권`,
    moreHref: withUtm(`/s/${encodeURIComponent(store.username)}`, 'store'),
    cards: (rows.results || []).map((r) => toEmbedCard(r, 'store')),
  }))
})

// ── 지역 ───────────────────────────────────────────────────────────────
async function regionHandler(c: Context<{ Bindings: Env }>): Promise<Response> {
  const { count, theme } = parseEmbedParams((k) => c.req.query(k))
  const ref = parseRegionPath(c.req.param('sido'), c.req.param('sigungu'))
  if (!ref) return html(c, renderMissing(theme), 404)
  const DB = publicReadDb(c.env.DB)
  // 주소 판정은 지역 페이지와 같은 SSOT(`addressInRegion`) — 문자열 포함으로 하면 '중구' 가 세 도시를 삼킨다.
  const rows = await DB.prepare(`SELECT ${COLS} FROM products p LEFT JOIN sellers s ON s.id = p.seller_id
    WHERE ${LIVE} ORDER BY ${ORDER} LIMIT 500`)
    .bind(...VOUCHER_CATEGORIES).all<Row>().catch(() => ({ results: [] as Row[] }))
  const inRegion = (rows.results || []).filter((r) => addressInRegion(r.restaurant_address, ref)).slice(0, count)
  return html(c, renderStrip({
    kind: 'region', theme, title: `${regionLabel(ref)} 이용권`,
    moreHref: withUtm(regionPath(ref), 'region'),
    cards: inRegion.map((r) => toEmbedCard(r, 'region')),
    emptyText: '이 지역에는 아직 판매 중인 이용권이 없어요.',
  }))
}
embedRoutes.get('/embed/region/:sido/:sigungu', regionHandler)
embedRoutes.get('/embed/region/:sido', regionHandler)

// ── 이용권 하나 ─────────────────────────────────────────────────────────
embedRoutes.get('/embed/pass/:id', async (c) => {
  const { theme } = parseEmbedParams((k) => c.req.query(k))
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) return html(c, renderMissing(theme), 404)
  const DB = publicReadDb(c.env.DB)
  const row = await DB.prepare(`SELECT ${COLS} FROM products p LEFT JOIN sellers s ON s.id = p.seller_id
    WHERE p.id = ? AND ${LIVE} LIMIT 1`)
    .bind(id, ...VOUCHER_CATEGORIES).first<Row>().catch(() => null)
  if (!row) return html(c, renderMissing(theme), 404)
  return html(c, renderSingle(theme, toEmbedCard(row, 'pass')))
})

// ── 제휴사 입점 ──────────────────────────────────────────────────────────
embedRoutes.get('/embed/partner/:id', async (c) => {
  const { theme } = parseEmbedParams((k) => c.req.query(k))
  const id = Number(c.req.param('id'))
  if (!Number.isInteger(id) || id <= 0) return html(c, renderMissing(theme), 404)
  const agency = await publicReadDb(c.env.DB).prepare("SELECT id, name FROM agency_accounts WHERE id = ? AND status = 'active' LIMIT 1")
    .bind(id).first<{ id: number; name: string }>().catch(() => null)
  if (!agency) return html(c, renderMissing(theme), 404)
  return html(c, renderPartner(theme, agency.name, agency.id))
})

// ── 코드 만들기 ─────────────────────────────────────────────────────────
embedRoutes.get('/embed', (c) => {
  const q = (k: string) => c.req.query(k)
  return html(c, renderEmbedBuilder({
    type: q('type'), key: q('key'), count: q('count'), theme: q('theme') as EmbedTheme | undefined,
    origin: new URL(c.req.url).origin,
  }))
})

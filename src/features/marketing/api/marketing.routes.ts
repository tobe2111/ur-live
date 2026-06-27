/**
 * 🆕 2026-06-26 통합 마케팅 서비스(가칭) — 유어딜·도매몰에 이은 3번째 서비스. /api/ads/*
 *
 * 도매몰(/api/wholesale)처럼 유어딜 소비자와 완전 분리된 자체 API 네임스페이스.
 * 계획: 네이버 검색광고 자동입찰(쇼핑검색 포함) / 쇼핑몰 발주수집(네이버 커머스 API) / 키워드 도구.
 * 현재: 분리 골격(ping). 각 기능 구현 시 ad_* D1 테이블 + 엔진(Queue/Durable Object/Browser Rendering) 도입.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { sellerIdFrom } from '../../supply/api/wholesale-helpers'
import { loadNaverConnection, saveNaverConnection, issueNaverToken, ensureNaverConnectionSchema } from '../../supply/api/naver-commerce-core'
import { collectAndStore, listCollectedOrders } from './order-collection'
import { keywordTrend, keywordShopping } from './keyword-tools'
import { searchAdCredsFrom, relatedKeywords } from './searchad-client'

const marketingRoutes = new Hono<{ Bindings: Env }>()

// 스캐폴딩 헬스체크 — GET /api/ads/ping
marketingRoutes.get('/ping', (c) =>
  c.json({ success: true, service: 'marketing', status: 'scaffold' }),
)

// ── 멀티테넌트 입점: 고객사별 스마트스토어 연동 (SELF 방식) ──────────────────
//   tenant = 인증된 계정(seller_id). owner_type='marketing' 으로 도매(supplier/distributor)와 데이터 격리.
//   각 고객사가 커머스 API센터에서 자기 앱(상품주문/배송 권한 포함) 발급 → client_id/secret 입력.
//   ⚠️ 라이브: 주문권한 스코프 + 엔드포인트 현행문서 검증 후(이 환경 egress 차단 미검증).

// POST /api/ads/naver/connect — 고객사 스토어 연결(토큰 발급으로 즉시 검증 후 암호화 저장)
marketingRoutes.post('/naver/connect', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const clientId = String(body.client_id || '').trim()
  const clientSecret = String(body.client_secret || '').trim()
  if (!/^[A-Za-z0-9]{10,64}$/.test(clientId)) return c.json({ success: false, error: '애플리케이션 ID 형식을 확인해주세요' }, 400)
  if (clientSecret.length < 20 || clientSecret.length > 128) return c.json({ success: false, error: '애플리케이션 시크릿을 확인해주세요' }, 400)
  const tok = await issueNaverToken(clientId, clientSecret)  // 실제 발급으로 검증 — 잘못된 키 저장 방지
  if (!tok.ok) return c.json({ success: false, error: tok.error }, 400)
  await saveNaverConnection(c.env.DB, sellerId, clientId, clientSecret, c.env.DATA_ENCRYPTION_KEY, 'marketing')
  return c.json({ success: true, message: '스마트스토어가 연결되었습니다' })
})

// GET /api/ads/naver/status — 이 고객사 연결 상태
marketingRoutes.get('/naver/status', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureNaverConnectionSchema(c.env.DB)
  const row = await c.env.DB.prepare(
    'SELECT client_id, connected_at FROM naver_commerce_connections WHERE owner_type = ? AND seller_id = ?'
  ).bind('marketing', sellerId).first<{ client_id: string; connected_at: string }>().catch(() => null)
  return c.json({ success: true, connected: !!row, client_id_masked: row ? `****${row.client_id.slice(-4)}` : null, connected_at: row?.connected_at || null })
})

// DELETE /api/ads/naver/connect — 연결 해제(marketing 스코프만)
marketingRoutes.delete('/naver/connect', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureNaverConnectionSchema(c.env.DB)
  await c.env.DB.prepare("DELETE FROM naver_commerce_connections WHERE owner_type = 'marketing' AND seller_id = ?").bind(sellerId).run()
  return c.json({ success: true })
})

// ── 발주수집 (네이버 커머스 API 재사용) ─────────────────────────────────────
//   기존 스마트스토어 연동(naver_commerce_connections, supplier/distributor)을 그대로 재사용.
//   ⚠️ 라이브 동작은 ① 커머스 앱에 '상품주문/배송' 권한 ② 엔드포인트 현행 문서 검증 후(egress 차단 환경 미검증).

// POST /api/ads/orders/sync — 연결된 스마트스토어 최근 주문 수집(본인)
marketingRoutes.post('/orders/sync', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  // 마케팅 입점 연결(owner_type='marketing')만 사용 — 도매(supplier/distributor) 연결과 격리.
  const conn = await loadNaverConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY, 'marketing')
  if (!conn) return c.json({ success: false, error: '스마트스토어가 연결되어 있지 않습니다. 먼저 연동해주세요.', code: 'NOT_CONNECTED' }, 400)
  const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 최근 24h(향후 param 화)
  const r = await collectAndStore(c.env.DB, sellerId, conn, sinceISO)
  if (!r.ok) return c.json({ success: false, error: r.error || '발주 수집 실패' }, 502)
  return c.json({ success: true, collected: r.collected })
})

// GET /api/ads/orders — 수집된 발주 목록(본인)
marketingRoutes.get('/orders', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const orders = await listCollectedOrders(c.env.DB, sellerId)
  return c.json({ success: true, orders })
})

// ── 키워드 도구 (네이버 오픈API — 고정IP/서버 불필요, 보유 키로 즉시) ──────────
//   검색광고 키 없이 가능한 범위: 검색어 트렌드(데이터랩) + 쇼핑 경쟁(쇼핑검색).
//   오픈API = NAVER_SEARCH_* 우선, 없으면 NAVER_* 폴백. 쿼터 보호 위해 rate limit.
const naverOpenId = (env: Env) => env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
const naverOpenSecret = (env: Env) => env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET

// GET /api/ads/keywords/trend?keywords=a,b,c — 검색어 트렌드(최대 5)
marketingRoutes.get('/keywords/trend', rateLimit({ action: 'ads-kw-trend', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const keywords = (c.req.query('keywords') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
  const r = await keywordTrend(naverOpenId(c.env), naverOpenSecret(c.env), keywords)
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, results: r.results })
})

// GET /api/ads/keywords/shopping?q=키워드 — 쇼핑 경쟁(상품수 + 가격대)
marketingRoutes.get('/keywords/shopping', rateLimit({ action: 'ads-kw-shop', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await keywordShopping(naverOpenId(c.env), naverOpenSecret(c.env), c.req.query('q') || '')
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, data: r.data })
})

// ── 연관키워드 추천 (네이버 검색광고 API — RelKwdStat) ───────────────────────
//   오픈API 와 별개. HMAC 서명 인증(고정IP 불필요). 관리/대행 계정 customer-level 로 광고계정 0개여도 동작.
//   키(NAVER_SEARCHAD_*) 미설정 시 503(NOT_CONFIGURED) — 프런트가 자동 숨김(fail-soft).

// GET /api/ads/keywords/related?seed=키워드 — 연관키워드 + 월 검색량(PC/모바일)
marketingRoutes.get('/keywords/related', rateLimit({ action: 'ads-kw-related', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = searchAdCredsFrom(c.env)
  if (!creds) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const seeds = (c.req.query('seed') || c.req.query('keywords') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
  if (!seeds.length) return c.json({ success: false, error: '키워드를 입력해주세요' }, 400)
  const r = await relatedKeywords(creds, seeds)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, results: r.results })
})

// TODO(자동입찰 — 고객사 광고계정 연동 후): 검색광고 Estimate(목표순위 입찰추정) + StatReport(실적).
//   GET/PATCH /bid/keywords  자동입찰 키워드/입찰설정(목표순위·최대입찰가) — 공식 검색광고 API only.
//   ⚠️ 순위 측정은 공식 API(Estimate/StatReport)로만 — SERP 스크래핑 금지(2026-04-22 제거 이력, PIPA).

export { marketingRoutes }

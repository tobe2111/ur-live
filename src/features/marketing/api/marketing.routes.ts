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
import { keywordTrend, keywordShopping, brandReputation, keywordAutocomplete } from './keyword-tools'
import { searchAdCredsFrom, relatedKeywords, listCampaigns, listAdgroups, listKeywords, estimateBidForPositions, updateKeywordBid, addKeywordsToAdgroup, accountStats, BID_MIN, BID_MAX, KW_ADD_MAX, type SearchAdCreds } from './searchad-client'
import { loadSearchAdConnection, saveSearchAdConnection, deleteSearchAdConnection, searchAdConnStatus } from './searchad-connection'
import { aiMarketerAdvice, type AiMarketerContext } from './ai-marketer'
import { registerSite, listSites, deleteSite, recordHit, clickReport, ensureClickguardSchema } from './clickguard'

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

// GET /api/ads/keywords/autocomplete?q=키워드 — 자동완성 롱테일 키워드(키워드확장 보강, 키 불필요)
marketingRoutes.get('/keywords/autocomplete', rateLimit({ action: 'ads-kw-auto', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await keywordAutocomplete(c.req.query('q') || '')
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, suggestions: r.suggestions })
})

// GET /api/ads/reputation?q=브랜드 — 블로그/카페/뉴스 언급량 + 최근 글(브랜드 평판 모니터링)
marketingRoutes.get('/reputation', rateLimit({ action: 'ads-reputation', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await brandReputation(naverOpenId(c.env), naverOpenSecret(c.env), c.req.query('q') || '')
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, data: r.data })
})

// ── 연관키워드 추천 (네이버 검색광고 API — RelKwdStat) ───────────────────────
//   오픈API 와 별개. HMAC 서명 인증(고정IP 불필요). 관리/대행 계정 customer-level 로 광고계정 0개여도 동작.
//   키(NAVER_SEARCHAD_*) 미설정 시 503(NOT_CONFIGURED) — 프런트가 자동 숨김(fail-soft).

// 연관키워드용 자격증명: 연결된 고객사 키 우선, 없으면 플랫폼(관리계정 47982) 폴백.
//   RelKwdStat 은 customer-level 이라 둘 다 동작 — 연결 시 그 계정 컨텍스트로.
async function resolveSearchAdCreds(c: { env: Env }, sellerId: number): Promise<SearchAdCreds | null> {
  const tenant = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY).catch(() => null)
  return tenant || searchAdCredsFrom(c.env)
}

// GET /api/ads/keywords/related?seed=키워드 — 연관키워드 + 월 검색량(PC/모바일)
marketingRoutes.get('/keywords/related', rateLimit({ action: 'ads-kw-related', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await resolveSearchAdCreds(c, sellerId)
  if (!creds) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const seeds = (c.req.query('seed') || c.req.query('keywords') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
  if (!seeds.length) return c.json({ success: false, error: '키워드를 입력해주세요' }, 400)
  const r = await relatedKeywords(creds, seeds)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, results: r.results })
})

// ── 검색광고 계정 연동 (멀티테넌트 — 고객사별 자기 키 연결) ───────────────────
//   자동입찰·실적·키워드 자동등록 등 per-advertiser 기능의 전제조건.

// POST /api/ads/searchad/connect — 고객사 검색광고 자격증명 연결(캠페인 조회로 즉시 검증 후 암호화 저장)
marketingRoutes.post('/searchad/connect', rateLimit({ action: 'ads-sa-connect', max: 10, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const customerId = String(body.customer_id || '').trim()
  const accessLicense = String(body.access_license || '').trim()
  const secretKey = String(body.secret_key || '').trim()
  if (!/^\d{1,15}$/.test(customerId)) return c.json({ success: false, error: '고객 ID(숫자)를 확인해주세요' }, 400)
  if (accessLicense.length < 20 || accessLicense.length > 200) return c.json({ success: false, error: '액세스라이선스를 확인해주세요' }, 400)
  if (secretKey.length < 20 || secretKey.length > 200) return c.json({ success: false, error: '비밀키를 확인해주세요' }, 400)
  const creds: SearchAdCreds = { customerId, accessLicense, secretKey }
  const verify = await listCampaigns(creds) // 200 OK = 유효(캠페인 0개여도 OK)
  if (!verify.ok) return c.json({ success: false, error: verify.error || '검색광고 인증 실패 — 키를 확인해주세요' }, 400)
  await saveSearchAdConnection(c.env.DB, sellerId, creds, c.env.DATA_ENCRYPTION_KEY)
  return c.json({ success: true, message: '검색광고 계정이 연결되었습니다', campaigns: verify.campaigns?.length || 0 })
})

// GET /api/ads/searchad/status — 연결 상태(마스킹)
marketingRoutes.get('/searchad/status', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const st = await searchAdConnStatus(c.env.DB, sellerId)
  return c.json({ success: true, ...st })
})

// DELETE /api/ads/searchad/connect — 연결 해제
marketingRoutes.delete('/searchad/connect', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await deleteSearchAdConnection(c.env.DB, sellerId)
  return c.json({ success: true })
})

// GET /api/ads/searchad/campaigns — 내 캠페인 목록(연결 필요)
marketingRoutes.get('/searchad/campaigns', rateLimit({ action: 'ads-sa-list', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const r = await listCampaigns(creds)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, campaigns: r.campaigns })
})

// GET /api/ads/searchad/adgroups?campaignId= — 광고그룹 목록(연결 필요)
marketingRoutes.get('/searchad/adgroups', rateLimit({ action: 'ads-sa-list', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const campaignId = String(c.req.query('campaignId') || '').trim()
  if (!campaignId) return c.json({ success: false, error: 'campaignId 가 필요합니다' }, 400)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const r = await listAdgroups(creds, campaignId)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, adgroups: r.adgroups })
})

// GET /api/ads/searchad/keywords?adgroupId= — 키워드+현재 입찰가(연결 필요, 자동입찰 토대)
marketingRoutes.get('/searchad/keywords', rateLimit({ action: 'ads-sa-list', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const adgroupId = String(c.req.query('adgroupId') || '').trim()
  if (!adgroupId) return c.json({ success: false, error: 'adgroupId 가 필요합니다' }, 400)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const r = await listKeywords(creds, adgroupId)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, keywords: r.keywords })
})

// GET /api/ads/searchad/estimate?keyword=&device=PC — 목표순위(1~5)별 예상 입찰가(읽기)
//   "원하는 순위로 노출하려면 얼마?" — 자동입찰의 핵심. 돈 변경 없음. 연결 시 고객사 키, 없으면 47982 폴백.
marketingRoutes.get('/searchad/estimate', rateLimit({ action: 'ads-sa-estimate', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await resolveSearchAdCreds(c, sellerId)
  if (!creds) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const keyword = String(c.req.query('keyword') || '').trim()
  if (!keyword) return c.json({ success: false, error: '키워드를 입력해주세요' }, 400)
  const device = c.req.query('device') === 'MOBILE' ? 'MOBILE' : 'PC'
  const r = await estimateBidForPositions(creds, keyword, [1, 2, 3, 4, 5], device)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, device, estimates: r.estimates })
})

// PATCH /api/ads/searchad/keywords/bid — 단일 키워드 입찰가 수동 변경(WRITE, 광고비 영향)
//   ⚠️ 사용자 명시 액션(프런트 confirm) + 서버 범위검증(70~100,000) + 연결 필수. 자동/cron 아님.
marketingRoutes.patch('/searchad/keywords/bid', rateLimit({ action: 'ads-sa-bid', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const keywordId = String(body.keyword_id || '').trim()
  const bidAmt = Number(body.bid_amt)
  if (!keywordId) return c.json({ success: false, error: '키워드를 지정해주세요' }, 400)
  if (!Number.isFinite(bidAmt) || bidAmt < BID_MIN || bidAmt > BID_MAX) {
    return c.json({ success: false, error: `입찰가는 ${BID_MIN}~${BID_MAX.toLocaleString()}원 범위여야 합니다` }, 400)
  }
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const r = await updateKeywordBid(creds, keywordId, bidAmt)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, bid_amt: Math.round(bidAmt) })
})

// POST /api/ads/searchad/keywords/add — 광고그룹에 키워드 자동등록(키워드확장 write)
//   ⚠️ 사용자 명시 액션 + 서버 검증(개수≤20·길이) + 연결 필수. 그룹입찰 상속(개별 입찰 surprise 없음).
marketingRoutes.post('/searchad/keywords/add', rateLimit({ action: 'ads-sa-kwadd', max: 20, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const adgroupId = String(body.adgroup_id || '').trim()
  const kwRaw: unknown[] = Array.isArray(body.keywords) ? body.keywords : []
  if (!adgroupId) return c.json({ success: false, error: '광고그룹을 지정해주세요' }, 400)
  const keywords = kwRaw.map((k: unknown) => String(k || '')).filter(Boolean)
  if (!keywords.length) return c.json({ success: false, error: '추가할 키워드를 입력해주세요' }, 400)
  if (keywords.length > KW_ADD_MAX) return c.json({ success: false, error: `한 번에 최대 ${KW_ADD_MAX}개까지 등록할 수 있습니다` }, 400)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const r = await addKeywordsToAdgroup(creds, adgroupId, keywords)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, added: r.added })
})

// GET /api/ads/searchad/stats?days=7 — 통합실적(캠페인별 노출/클릭/비용/전환 + 합계, 읽기)
marketingRoutes.get('/searchad/stats', rateLimit({ action: 'ads-sa-stats', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const days = Number(c.req.query('days')) === 30 ? 30 : 7
  const r = await accountStats(creds, days)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, data: r.data })
})

// ── AI 마케터 (Claude 진단/추천 — 읽기 전용, 자동 실행 없음) ────────────────
// POST /api/ads/ai-marketer  body: { seed?: '키워드' } — 실적(연결 시) + 키워드 분석(seed 시)을 Claude 에게.
marketingRoutes.post('/ai-marketer', rateLimit({ action: 'ads-ai', max: 10, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const seed = String(body.seed || '').trim().slice(0, 40)

  const ctx: AiMarketerContext = { connected: false }
  // 실적(연결 시)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY).catch(() => null)
  if (creds) {
    ctx.connected = true
    const st = await accountStats(creds, 7).catch(() => null)
    if (st?.ok && st.data) {
      const t = st.data.totals
      ctx.stats = {
        days: st.data.days, impCnt: t.impCnt, clkCnt: t.clkCnt, salesAmt: t.salesAmt, ccnt: t.ccnt, ctr: t.ctr, cpc: t.cpc,
        topCampaigns: st.data.campaigns.slice(0, 5).map(cp => ({ name: cp.name, salesAmt: cp.salesAmt, clkCnt: cp.clkCnt, ccnt: cp.ccnt })),
      }
    }
  }
  // 키워드 분석(seed 시) — 연관키워드(연결/플랫폼 키) + 쇼핑경쟁 + 추세
  if (seed) {
    const kwCreds = creds || searchAdCredsFrom(c.env)
    const [rel, shop, trend] = await Promise.allSettled([
      kwCreds ? relatedKeywords(kwCreds, [seed]) : Promise.resolve({ ok: false as const }),
      keywordShopping(naverOpenId(c.env), naverOpenSecret(c.env), seed),
      keywordTrend(naverOpenId(c.env), naverOpenSecret(c.env), [seed]),
    ])
    const related = rel.status === 'fulfilled' && rel.value.ok && 'results' in rel.value ? (rel.value.results || []).slice(0, 10).map(k => ({ keyword: k.keyword, monthlyTotal: k.monthlyTotal, compIdx: k.compIdx })) : []
    const shoppingTotal = shop.status === 'fulfilled' && shop.value.ok ? (shop.value.data?.total || 0) : 0
    const trendPct = trend.status === 'fulfilled' && trend.value.ok ? (trend.value.results?.[0]?.changePct || 0) : 0
    ctx.keyword = { seed, related, shoppingTotal, trendPct }
  }

  const r = await aiMarketerAdvice(c.env.ANTHROPIC_API_KEY, ctx)
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, advice: r.advice, grounded: { connected: ctx.connected, hasStats: !!ctx.stats, hasKeyword: !!ctx.keyword } })
})

// ── 부정클릭 방지 Phase 1 (수집·탐지·리포트 — 차단 0) ───────────────────────
//   설계: docs/design/urads-clickfraud-design.md. 프라이버시 바이 디자인.

// GET /api/ads/clickguard/pixel.js?k=KEY — 광고주 사이트 삽입용 픽셀(공개, 무인증)
marketingRoutes.get('/clickguard/pixel.js', (c) => {
  const js = `(function(){try{var s=document.currentScript;if(!s)return;var u=new URL(s.src);var k=u.searchParams.get('k');if(!k)return;`
    + `var isAd=/[?&](n_media|n_query|n_ad|gclid|utm_source=naver)/i.test(location.search);`
    + `var body=JSON.stringify({k:k,u:location.href,r:document.referrer,ad:isAd});`
    + `if(navigator.sendBeacon){navigator.sendBeacon(u.origin+'/api/ads/clickguard/hit',body)}`
    + `else{fetch(u.origin+'/api/ads/clickguard/hit',{method:'POST',body:body,keepalive:true,mode:'no-cors'})}}catch(e){}})();`
  return c.newResponse(js, 200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=3600' })
})

// POST /api/ads/clickguard/hit — 픽셀 수집(공개, 무인증, 도메인 검증으로 스푸핑 차단)
marketingRoutes.post('/clickguard/hit', rateLimit({ action: 'ads-cg-hit', max: 120, windowSec: 60 }), async (c) => {
  const raw = await c.req.text().catch(() => '')
  let body: { k?: string; u?: string; r?: string; ad?: boolean } = {}
  try { body = JSON.parse(raw || '{}') } catch { /* sendBeacon text */ }
  const key = String(body.k || '').trim()
  if (!key) return c.newResponse(null, 204)
  const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || ''
  const country = c.req.header('cf-ipcountry') || ''
  const ua = c.req.header('user-agent') || ''
  const originOrReferer = c.req.header('origin') || c.req.header('referer') || null
  await recordHit(c.env.DB, c.env.DATA_ENCRYPTION_KEY, {
    key, ip, country, ua, referrer: String(body.r || ''), landingUrl: String(body.u || ''), isAd: !!body.ad, originOrReferer,
  }).catch(() => null)
  return c.newResponse(null, 204) // 픽셀 — 항상 빈 응답(존재 여부 비노출)
})

// POST /api/ads/clickguard/site — 광고주 사이트 등록 → 픽셀 키 발급(인증)
marketingRoutes.post('/clickguard/site', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await registerSite(c.env.DB, sellerId, String(body.domain || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, advertiser_key: r.advertiser_key })
})

// GET /api/ads/clickguard/sites — 내 등록 사이트 목록(인증)
marketingRoutes.get('/clickguard/sites', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const sites = await listSites(c.env.DB, sellerId)
  return c.json({ success: true, sites })
})

// DELETE /api/ads/clickguard/site?key= — 사이트+이벤트 삭제(인증)
marketingRoutes.delete('/clickguard/site', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const key = String(c.req.query('key') || '').trim()
  if (!key) return c.json({ success: false, error: 'key 가 필요합니다' }, 400)
  await deleteSite(c.env.DB, sellerId, key)
  return c.json({ success: true })
})

// GET /api/ads/clickguard/report?days=7 — 의심 IP 리포트(인증, 탐지만 — 차단 0)
marketingRoutes.get('/clickguard/report', rateLimit({ action: 'ads-cg-report', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureClickguardSchema(c.env.DB)
  const days = Number(c.req.query('days')) === 30 ? 30 : 7
  const report = await clickReport(c.env.DB, sellerId, days)
  return c.json({ success: true, report })
})

// TODO(부정클릭 Phase 2 — 결정 B 후): 노출제한 IP 자동등록(API 지원 시) / 미지원 시 의심IP export(복붙).
// TODO(자동입찰 autonomous — staging 라이브검증 후): 규칙저장(목표순위·max_bid) + cron 엔진(Estimate→clamp→bid PUT)
//   + 변경로그(ad_autobid_log). ⚠️ 자율 money 루프 — 실 계정 1회 검증(estimate 응답·bid PUT 동작) 전 비활성 유지.
//   ⚠️ 순위 측정은 공식 API(Estimate/StatReport)로만 — SERP 스크래핑 금지(2026-04-22 제거 이력, PIPA).

export { marketingRoutes }

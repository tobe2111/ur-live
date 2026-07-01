/**
 * 🆕 2026-06-26 통합 마케팅 서비스(유어애즈) — /api/ads/*  (유어딜·도매몰과 분리된 자체 네임스페이스)
 *   2026-07-01 라우트 분할: 인증/검색광고/부정클릭 클러스터를 routes/ 서브 라우터로 추출(god 파일 해소).
 *   부모는 스캐폴딩·발주수집·키워드도구·소싱·평판·연관키워드·포트폴리오·알림·순위·경쟁·자동입찰·가격 담당.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { adsAccountIdFrom } from './ads-account'
import { loadNaverConnection, saveNaverConnection, issueNaverToken, ensureNaverConnectionSchema } from '@/services/naver-commerce-core'
import { collectAndStore, listCollectedOrders } from './order-collection'
import { keywordTrend, keywordShopping, brandReputation, keywordAutocomplete, shoppingCategoryTrends, categoryDemographics } from './keyword-tools'
import { relatedKeywords } from './searchad-client'
import { loadSearchAdConnection, getActiveTenantId } from './searchad-connection'
import { listRules, upsertRule, deleteRule, recentLog, runAutobidForSeller, bulkUpsertRules, parseCsvRules } from './autobid'
import { listWatches, addWatch, deleteWatch, refreshWatch } from './price-monitor'
import { getAlertSettings, saveAlertSettings, computeAlerts } from './alerts'
import { listRankTargets, addRankTarget, deleteRankTarget, refreshRankTarget } from './rank-tracker'
import { analyzeCompetitors } from './competitor-tracker'
import { saveKeyword, listSavedKeywords, listKeywordTags, deleteSavedKeyword, updateSavedKeyword } from './keyword-portfolio'
import { naverOpenId, naverOpenSecret, resolveSearchAdCreds } from './routes/helpers'
import { adsAuthRoutes } from './routes/auth.routes'
import { adsSearchadRoutes } from './routes/searchad.routes'
import { adsClickguardRoutes } from './routes/clickguard.routes'

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
marketingRoutes.post('/naver/connect', rateLimit({ action: 'ads-naver-connect', max: 10, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const clientId = String(body.client_id || '').trim()
  const clientSecret = String(body.client_secret || '').trim()
  // ⚠️ 형식 pre-check 는 최소 sanity 만(공백/빈값/과길이) — 실제 검증은 issueNaverToken(네이버 OAuth 실호출).
  //   과거 `[A-Za-z0-9]{10,64}` 고정 regex 가 정상 애플리케이션 ID 를 false-reject 함(커머스API 센터 ID 가 더 길거나 -/_ 포함 가능).
  if (!clientId || /\s/.test(clientId) || clientId.length < 6 || clientId.length > 128) return c.json({ success: false, error: '애플리케이션 ID를 입력해주세요 (커머스API센터의 애플리케이션 ID 그대로)' }, 400)
  if (!clientSecret || /\s/.test(clientSecret) || clientSecret.length < 8 || clientSecret.length > 200) return c.json({ success: false, error: '애플리케이션 시크릿을 입력해주세요 (커머스API센터의 시크릿 그대로)' }, 400)
  const tok = await issueNaverToken(clientId, clientSecret)  // 실제 발급으로 검증 — 잘못된 키 저장 방지
  if (!tok.ok) return c.json({ success: false, error: tok.error }, 400)
  await saveNaverConnection(c.env.DB, sellerId, clientId, clientSecret, c.env.DATA_ENCRYPTION_KEY, 'marketing')
  return c.json({ success: true, message: '스마트스토어가 연결되었습니다' })
})

// GET /api/ads/naver/status — 이 고객사 연결 상태
marketingRoutes.get('/naver/status', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureNaverConnectionSchema(c.env.DB)
  const row = await c.env.DB.prepare(
    'SELECT client_id, connected_at FROM naver_commerce_connections WHERE owner_type = ? AND seller_id = ?'
  ).bind('marketing', sellerId).first<{ client_id: string; connected_at: string }>().catch(() => null)
  return c.json({ success: true, connected: !!row, client_id_masked: row ? `****${row.client_id.slice(-4)}` : null, connected_at: row?.connected_at || null })
})

// DELETE /api/ads/naver/connect — 연결 해제(marketing 스코프만)
marketingRoutes.delete('/naver/connect', rateLimit({ action: 'ads-naver-disc', max: 20, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureNaverConnectionSchema(c.env.DB)
  await c.env.DB.prepare("DELETE FROM naver_commerce_connections WHERE owner_type = 'marketing' AND seller_id = ?").bind(sellerId).run()
  return c.json({ success: true })
})

// ── 발주수집 (네이버 커머스 API 재사용) ─────────────────────────────────────
//   기존 스마트스토어 연동(naver_commerce_connections, supplier/distributor)을 그대로 재사용.
//   ⚠️ 라이브 동작은 ① 커머스 앱에 '상품주문/배송' 권한 ② 엔드포인트 현행 문서 검증 후(egress 차단 환경 미검증).

// POST /api/ads/orders/sync — 연결된 스마트스토어 최근 주문 수집(본인)
marketingRoutes.post('/orders/sync', rateLimit({ action: 'ads-orders-sync', max: 10, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
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
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const orders = await listCollectedOrders(c.env.DB, sellerId)
  return c.json({ success: true, orders })
})

// ── 키워드 도구 (네이버 오픈API — 고정IP/서버 불필요, 보유 키로 즉시) ──────────
//   검색광고 키 없이 가능한 범위: 검색어 트렌드(데이터랩) + 쇼핑 경쟁(쇼핑검색).
//   오픈API = NAVER_SEARCH_* 우선, 없으면 NAVER_* 폴백. 쿼터 보호 위해 rate limit.


// GET /api/ads/keywords/trend?keywords=a,b,c — 검색어 트렌드(최대 5)
marketingRoutes.get('/keywords/trend', rateLimit({ action: 'ads-kw-trend', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const keywords = (c.req.query('keywords') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
  const r = await keywordTrend(naverOpenId(c.env), naverOpenSecret(c.env), keywords)
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, results: r.results })
})

// GET /api/ads/keywords/shopping?q=키워드 — 쇼핑 경쟁(상품수 + 가격대)
marketingRoutes.get('/keywords/shopping', rateLimit({ action: 'ads-kw-shop', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await keywordShopping(naverOpenId(c.env), naverOpenSecret(c.env), c.req.query('q') || '')
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, data: r.data })
})

// GET /api/ads/keywords/autocomplete?q=키워드 — 자동완성 롱테일 키워드(키워드확장 보강, 키 불필요)
marketingRoutes.get('/keywords/autocomplete', rateLimit({ action: 'ads-kw-auto', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await keywordAutocomplete(c.req.query('q') || '')
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, suggestions: r.suggestions })
})

// GET /api/ads/sourcing/trends — 분야별 쇼핑 트렌드(데이터랩 쇼핑인사이트, 소싱 리포트)
marketingRoutes.get('/sourcing/trends', rateLimit({ action: 'ads-sourcing', max: 20, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await shoppingCategoryTrends(naverOpenId(c.env), naverOpenSecret(c.env))
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, results: r.results })
})

// GET /api/ads/sourcing/demographics?cid=50000002 — 카테고리 기기/성별/연령 분포(쇼핑인사이트)
marketingRoutes.get('/sourcing/demographics', rateLimit({ action: 'ads-sourcing-demo', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const cid = String(c.req.query('cid') || '')
  const r = await categoryDemographics(naverOpenId(c.env), naverOpenSecret(c.env), cid)
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, data: r.data })
})

// ── 임계값 알림(예산 소진·최저가 역전) ─────────────────────────────────────
// GET /api/ads/alerts/settings
marketingRoutes.get('/alerts/settings', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  return c.json({ success: true, settings: await getAlertSettings(c.env.DB, id) })
})

// PATCH /api/ads/alerts/settings — 알림 켜기/임계값 변경
marketingRoutes.patch('/alerts/settings', rateLimit({ action: 'ads-alerts-patch', max: 30, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const settings = await saveAlertSettings(c.env.DB, id, {
    enabled: body.enabled !== undefined ? !!body.enabled : undefined,
    budget_pace_pct: body.budget_pace_pct !== undefined ? Number(body.budget_pace_pct) : undefined,
    price_undercut: body.price_undercut !== undefined ? !!body.price_undercut : undefined,
    rank_drop: body.rank_drop !== undefined ? Number(body.rank_drop) : undefined,
  })
  return c.json({ success: true, settings })
})

// GET /api/ads/alerts/preview — 지금 임계 초과 항목(발송 X)
marketingRoutes.get('/alerts/preview', rateLimit({ action: 'ads-alerts-preview', max: 20, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const settings = await getAlertSettings(c.env.DB, id)
  const items = await computeAlerts(c.env, id, settings)
  return c.json({ success: true, items })
})

// ── 네이버 쇼핑 순위 추적 ──────────────────────────────────────────────────
// GET /api/ads/rank/targets — 추적 키워드 목록(현재/직전 순위)
marketingRoutes.get('/rank/targets', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  return c.json({ success: true, targets: await listRankTargets(c.env.DB, id) })
})

// POST /api/ads/rank/target — 추적 추가(키워드 + 내 몰/도메인) + 즉시 1회 조회
marketingRoutes.post('/rank/target', rateLimit({ action: 'ads-rank-add', max: 20, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await addRankTarget(c.env, id, String(body.keyword || ''), String(body.mall || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, targets: await listRankTargets(c.env.DB, id) })
})

// POST /api/ads/rank/refresh?id= — 한 타겟 즉시 갱신
marketingRoutes.post('/rank/refresh', rateLimit({ action: 'ads-rank-refresh', max: 30, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const targets = await listRankTargets(c.env.DB, id)
  const t = targets.find(x => x.id === Number(c.req.query('id')))
  if (!t) return c.json({ success: false, error: '대상을 찾을 수 없습니다' }, 404)
  await refreshRankTarget(c.env, id, t.id, t.keyword, t.mall_match)
  return c.json({ success: true, targets: await listRankTargets(c.env.DB, id) })
})

// DELETE /api/ads/rank/target?id=
marketingRoutes.delete('/rank/target', rateLimit({ action: 'ads-rank-del', max: 30, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const targetId = Number(c.req.query('id'))
  if (!Number.isFinite(targetId)) return c.json({ success: false, error: '대상 ID가 올바르지 않습니다' }, 400)
  await deleteRankTarget(c.env.DB, id, targetId)
  return c.json({ success: true })
})

// GET /api/ads/rank/competitors?keyword=&mall= — 쇼핑검색 상위에서 나보다 위/아래 경쟁 몰 분석(읽기)
marketingRoutes.get('/rank/competitors', rateLimit({ action: 'ads-rank-comp', max: 20, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const keyword = String(c.req.query('keyword') || '').trim().slice(0, 60)
  const mall = String(c.req.query('mall') || '').trim().slice(0, 80)
  if (!keyword || mall.length < 2) return c.json({ success: false, error: '키워드와 내 몰/도메인을 입력해주세요' }, 400)
  const r = await analyzeCompetitors(c.env, keyword, mall)
  if (!r.ok) return c.json({ success: false, error: r.error === 'NOT_CONFIGURED' ? '네이버 쇼핑검색 키가 설정되지 않았습니다' : r.error, code: r.error === 'NOT_CONFIGURED' ? 'NOT_CONFIGURED' : undefined }, r.error === 'NOT_CONFIGURED' ? 503 : 502)
  return c.json({ success: true, data: r.data })
})

// GET /api/ads/reputation?q=브랜드 — 블로그/카페/뉴스 언급량 + 최근 글(브랜드 평판 모니터링)
marketingRoutes.get('/reputation', rateLimit({ action: 'ads-reputation', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await brandReputation(naverOpenId(c.env), naverOpenSecret(c.env), c.req.query('q') || '')
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, data: r.data })
})

// ── 연관키워드 추천 (네이버 검색광고 API — RelKwdStat) ───────────────────────
//   오픈API 와 별개. HMAC 서명 인증(고정IP 불필요). 관리/대행 계정 customer-level 로 광고계정 0개여도 동작.
//   키(NAVER_SEARCHAD_*) 미설정 시 503(NOT_CONFIGURED) — 프런트가 자동 숨김(fail-soft).


// GET /api/ads/keywords/related?seed=키워드 — 연관키워드 + 월 검색량(PC/모바일)
marketingRoutes.get('/keywords/related', rateLimit({ action: 'ads-kw-related', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await resolveSearchAdCreds(c, sellerId)
  if (!creds) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const seeds = (c.req.query('seed') || c.req.query('keywords') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 5)
  if (!seeds.length) return c.json({ success: false, error: '키워드를 입력해주세요' }, 400)
  const r = await relatedKeywords(creds, seeds)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, results: r.results })
})

// ── 키워드 포트폴리오(발굴 키워드 저장·태그) — 외부호출 0 ─────────────────────
// GET /api/ads/keywords/saved?tag= — 저장한 키워드 + 태그 목록
marketingRoutes.get('/keywords/saved', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const tag = (c.req.query('tag') || '').trim() || null
  const [items, tags] = await Promise.all([listSavedKeywords(c.env.DB, id, tag), listKeywordTags(c.env.DB, id)])
  return c.json({ success: true, items, tags })
})

// POST /api/ads/keywords/save — 키워드 저장(멱등 upsert)
marketingRoutes.post('/keywords/save', rateLimit({ action: 'ads-kw-save', max: 60, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await saveKeyword(c.env.DB, id, {
    keyword: String(b.keyword || ''),
    monthly_total: b.monthly_total != null ? Number(b.monthly_total) : null,
    comp_idx: b.comp_idx != null ? String(b.comp_idx) : null,
    tag: b.tag != null ? String(b.tag) : null,
    memo: b.memo != null ? String(b.memo) : null,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, items: await listSavedKeywords(c.env.DB, id) })
})

// PATCH /api/ads/keywords/saved?id= — 태그/메모 수정
marketingRoutes.patch('/keywords/saved', rateLimit({ action: 'ads-kw-saved-patch', max: 60, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const savedId = Number(c.req.query('id'))
  if (!Number.isFinite(savedId)) return c.json({ success: false, error: '대상 ID가 올바르지 않습니다' }, 400)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  await updateSavedKeyword(c.env.DB, id, savedId, { tag: b.tag != null ? String(b.tag) : undefined, memo: b.memo != null ? String(b.memo) : undefined })
  return c.json({ success: true, items: await listSavedKeywords(c.env.DB, id) })
})

// DELETE /api/ads/keywords/saved?id=
marketingRoutes.delete('/keywords/saved', rateLimit({ action: 'ads-kw-saved-del', max: 60, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const savedId = Number(c.req.query('id'))
  if (!Number.isFinite(savedId)) return c.json({ success: false, error: '대상 ID가 올바르지 않습니다' }, 400)
  await deleteSavedKeyword(c.env.DB, id, savedId)
  return c.json({ success: true, items: await listSavedKeywords(c.env.DB, id) })
})


// ── 자동입찰 자율 규칙 (목표순위→입찰가 자동조정) ───────────────────────────
//   ⚠️ 규칙 기본 OFF + max_bid 하드캡 + 글로벌 킬스위치(ADS_AUTOBID_ENABLED). cron 이 활성 규칙만 실행.

// GET /api/ads/searchad/autobid/rules — 내 규칙 + 최근 변경로그
marketingRoutes.get('/searchad/autobid/rules', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const tenant = (await getActiveTenantId(c.env.DB, sellerId)) || undefined // 활성 고객사 규칙만
  const [rules, log] = await Promise.all([listRules(c.env.DB, sellerId, tenant), recentLog(c.env.DB, sellerId, 30)])
  return c.json({ success: true, rules, log, engine_on: c.env.ADS_AUTOBID_ENABLED === 'true' })
})

// POST /api/ads/searchad/autobid/rule — 규칙 생성/수정(목표순위·max_bid·enable)
marketingRoutes.post('/searchad/autobid/rule', rateLimit({ action: 'ads-ab-rule', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const tenant = await getActiveTenantId(c.env.DB, sellerId) // 규칙을 활성 고객사로 격리
  // 🔒 돈 안전: 활성 고객사 없이 만든 규칙(tenant=NULL)은 이후 cron 에서 '그때 활성인' 고객사 계정에
  //   적용될 수 있음(잘못된 계정 과금). 광고계정 연결을 선행 요구해 고아 규칙 자체를 차단.
  if (!tenant) return c.json({ success: false, error: '자동입찰 규칙 등록 전에 광고계정(고객사)을 먼저 연결해주세요' }, 400)
  const r = await upsertRule(c.env.DB, sellerId, {
    keyword_id: String(body.keyword_id || ''), adgroup_id: body.adgroup_id ? String(body.adgroup_id) : undefined,
    keyword_text: body.keyword_text ? String(body.keyword_text) : undefined,
    target_rank: Number(body.target_rank), max_bid: Number(body.max_bid),
    device: body.device === 'MOBILE' ? 'MOBILE' : 'PC', enabled: !!body.enabled,
    schedule: 'schedule' in body ? body.schedule : undefined, // 시간대·요일 전략(미지정=기존 유지)
    tenant,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true })
})

// POST /api/ads/searchad/autobid/rules/bulk — CSV/배열 일괄 등록(대량 입찰설정). 최대 200행.
marketingRoutes.post('/searchad/autobid/rules/bulk', rateLimit({ action: 'ads-ab-bulk', max: 6, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const rows = typeof body.csv === 'string' ? parseCsvRules(body.csv)
    : Array.isArray(body.rules) ? (body.rules as Array<Record<string, unknown>>).map((r) => ({
        keyword_id: String(r.keyword_id || ''), keyword_text: r.keyword_text ? String(r.keyword_text) : undefined,
        target_rank: Number(r.target_rank), max_bid: Number(r.max_bid),
        device: r.device === 'MOBILE' ? 'MOBILE' : 'PC', schedule: r.schedule, enabled: !!r.enabled,
      }))
    : []
  if (!rows.length) return c.json({ success: false, error: '등록할 행이 없습니다 (CSV: keyword_id,keyword_text,target_rank,max_bid,device,schedule_preset)' }, 400)
  const tenant = await getActiveTenantId(c.env.DB, sellerId)
  // 🔒 돈 안전: 단일 규칙과 동일 — 활성 고객사 없이 만든 tenant=NULL 규칙의 잘못된-계정 적용 차단.
  if (!tenant) return c.json({ success: false, error: '자동입찰 규칙 등록 전에 광고계정(고객사)을 먼저 연결해주세요' }, 400)
  const result = await bulkUpsertRules(c.env.DB, sellerId, rows, tenant)
  return c.json({ success: true, ...result })
})

// DELETE /api/ads/searchad/autobid/rule?keyword_id=
marketingRoutes.delete('/searchad/autobid/rule', rateLimit({ action: 'ads-autobid-del', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const kid = String(c.req.query('keyword_id') || '').trim()
  if (!kid) return c.json({ success: false, error: 'keyword_id 가 필요합니다' }, 400)
  await deleteRule(c.env.DB, sellerId, kid)
  return c.json({ success: true })
})

// POST /api/ads/searchad/autobid/preview — dry-run(추정→계획만, 입찰 변경 0)
marketingRoutes.post('/searchad/autobid/preview', rateLimit({ action: 'ads-ab-prev', max: 20, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const tenant = (await getActiveTenantId(c.env.DB, sellerId)) || undefined
  const results = await runAutobidForSeller(c.env.DB, creds, sellerId, { dryRun: true, tenant })
  return c.json({ success: true, results })
})

// POST /api/ads/searchad/autobid/run — 수동 즉시 실행(활성 규칙 적용, WRITE). 킬스위치 무관(사용자 명시 액션).
marketingRoutes.post('/searchad/autobid/run', rateLimit({ action: 'ads-ab-run', max: 6, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const tenant = (await getActiveTenantId(c.env.DB, sellerId)) || undefined
  const results = await runAutobidForSeller(c.env.DB, creds, sellerId, { dryRun: false, tenant })
  return c.json({ success: true, applied: results.filter(r => r.applied).length, results })
})

// ── 가격 모니터링 (쇼핑검색 최저가 추적 — 읽기, 연동 불필요) ─────────────────
// GET /api/ads/price/watches — 내 워치 목록
marketingRoutes.get('/price/watches', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const watches = await listWatches(c.env.DB, sellerId)
  return c.json({ success: true, watches })
})

// POST /api/ads/price/watch — 워치 추가({query, my_price?}) + 즉시 1회 조회
marketingRoutes.post('/price/watch', rateLimit({ action: 'ads-price-add', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const myPrice = body.my_price != null && body.my_price !== '' ? Number(body.my_price) : null
  const r = await addWatch(c.env, sellerId, String(body.query || ''), myPrice)
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  const watches = await listWatches(c.env.DB, sellerId)
  return c.json({ success: true, watches })
})

// POST /api/ads/price/refresh?id= — 워치 1건 즉시 갱신
marketingRoutes.post('/price/refresh', rateLimit({ action: 'ads-price-refresh', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const id = Number(c.req.query('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'id 가 필요합니다' }, 400)
  const row = await c.env.DB.prepare('SELECT id, query FROM ad_price_watches WHERE seller_id = ? AND id = ?')
    .bind(sellerId, id).first<{ id: number; query: string }>().catch(() => null)
  if (!row) return c.json({ success: false, error: '워치를 찾을 수 없습니다' }, 404)
  await refreshWatch(c.env, row.id, row.query, sellerId).catch(() => null)
  const watches = await listWatches(c.env.DB, sellerId)
  return c.json({ success: true, watches })
})

// DELETE /api/ads/price/watch?id= — 워치 삭제
marketingRoutes.delete('/price/watch', rateLimit({ action: 'ads-price-del', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const id = Number(c.req.query('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'id 가 필요합니다' }, 400)
  await deleteWatch(c.env.DB, sellerId, id)
  return c.json({ success: true })
})

// ── 분리된 서브 라우터 마운트('/' 프리픽스 유지 → /api/ads/... 경로 불변) ──
marketingRoutes.route('/', adsAuthRoutes)
marketingRoutes.route('/', adsSearchadRoutes)
marketingRoutes.route('/', adsClickguardRoutes)

export { marketingRoutes }

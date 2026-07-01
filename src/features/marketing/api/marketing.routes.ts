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
import { adsAccountIdFrom, createAdsAccount, loginAdsAccount, getAdsAccount, signAdsToken, ensureAdsAccountSchema, updateAdsAccount, changeAdsPassword, requestPasswordReset, resetPasswordWithToken, unlockAdsAccount } from './ads-account'

// 베타 액세스 코드(대표 지정). env 로 교체 가능, 기본 358533.
const adsAccessCode = (env: Env) => (env as unknown as { ADS_ACCESS_CODE?: string }).ADS_ACCESS_CODE || '358533'
import { loadNaverConnection, saveNaverConnection, issueNaverToken, ensureNaverConnectionSchema } from '@/services/naver-commerce-core'
import { collectAndStore, listCollectedOrders } from './order-collection'
import { keywordTrend, keywordShopping, brandReputation, keywordAutocomplete, shoppingCategoryTrends, categoryDemographics } from './keyword-tools'
import { searchAdCredsFrom, relatedKeywords, listCampaigns, listAdgroups, listKeywords, estimateBidForPositions, updateKeywordBid, addKeywordsToAdgroup, accountStats, budgetPacing, keywordEfficiency, BID_MIN, BID_MAX, KW_ADD_MAX, type SearchAdCreds } from './searchad-client'
import { loadSearchAdConnection, saveSearchAdConnection, deleteSearchAdConnection, searchAdConnStatus, getActiveTenantId, listTenants, setActiveTenant } from './searchad-connection'
import { aiMarketerAdvice, type AiMarketerContext } from './ai-marketer'
import { listReports, generateWeeklyReport } from './weekly-report'
import { registerSite, listSites, deleteSite, recordHit, clickReport, ensureClickguardSchema, addBlockedIp, listBlockedIps, removeBlockedIp } from './clickguard'
import { listRules, upsertRule, deleteRule, recentLog, runAutobidForSeller, bulkUpsertRules, parseCsvRules, deleteRulesForTenant } from './autobid'
import { listWatches, addWatch, deleteWatch, refreshWatch } from './price-monitor'
import { getAlertSettings, saveAlertSettings, computeAlerts } from './alerts'
import { listRankTargets, addRankTarget, deleteRankTarget, refreshRankTarget } from './rank-tracker'
import { getMetricsHistory, computeWoW, snapshotAccountRecent, trendContextFrom } from './metrics-history'
import { analyzeCompetitors } from './competitor-tracker'

const marketingRoutes = new Hono<{ Bindings: Env }>()

// 스캐폴딩 헬스체크 — GET /api/ads/ping
marketingRoutes.get('/ping', (c) =>
  c.json({ success: true, service: 'marketing', status: 'scaffold' }),
)

// ── 유어애즈 독립 계정 인증 (셀러/카카오와 무관 — 자체 이메일/비밀번호) ───────────
//   2026-06-28 대표 결정: "유어애즈는 유어딜·도매몰과 전혀 무관" → 자체 가입/로그인.
//   same-origin JSON 200(XHR) → iOS-safe(쿠키 의존 X). 토큰은 ads_token(클라 localStorage).

// POST /api/ads/auth/signup — 신규 유어애즈 계정
marketingRoutes.post('/auth/signup', rateLimit({ action: 'ads-signup', max: 10, windowSec: 600 }), async (c) => {
  if (!c.env.JWT_SECRET) return c.json({ success: false, error: '서버 설정 오류(JWT_SECRET)' }, 500)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await createAdsAccount(c.env.DB, {
    email: String(body.email || ''),
    password: String(body.password || ''),
    company_name: String(body.company_name || ''),
    phone: body.phone ? String(body.phone) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 409 | 500)
  const token = await signAdsToken(r.account.id, c.env.JWT_SECRET)
  return c.json({ success: true, token, account: r.account })
})

// POST /api/ads/auth/login — 이메일/비밀번호 로그인
marketingRoutes.post('/auth/login', rateLimit({ action: 'ads-login', max: 20, windowSec: 300 }), async (c) => {
  if (!c.env.JWT_SECRET) return c.json({ success: false, error: '서버 설정 오류(JWT_SECRET)' }, 500)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await loginAdsAccount(c.env.DB, String(body.email || ''), String(body.password || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 401 | 403)
  const token = await signAdsToken(r.account.id, c.env.JWT_SECRET)
  return c.json({ success: true, token, account: r.account })
})

// GET /api/ads/auth/me — 현재 계정 정보(토큰 검증)
marketingRoutes.get('/auth/me', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureAdsAccountSchema(c.env.DB)
  const account = await getAdsAccount(c.env.DB, id)
  if (!account) return c.json({ success: false, error: '계정을 찾을 수 없습니다' }, 404)
  return c.json({ success: true, account })
})

// PATCH /api/ads/auth/account — 회사명/연락처 수정
marketingRoutes.patch('/auth/account', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await updateAdsAccount(c.env.DB, id, {
    company_name: body.company_name !== undefined ? String(body.company_name) : undefined,
    phone: body.phone !== undefined ? String(body.phone) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 404)
  return c.json({ success: true, account: r.account })
})

// POST /api/ads/auth/password — 비밀번호 변경(현재 비번 확인)
marketingRoutes.post('/auth/password', rateLimit({ action: 'ads-pw', max: 10, windowSec: 600 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await changeAdsPassword(c.env.DB, id, String(body.current_password || ''), String(body.new_password || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 401 | 404)
  return c.json({ success: true })
})

// POST /api/ads/auth/unlock — 베타 액세스 코드 입력 → 계정 잠금 해제(1회)
marketingRoutes.post('/auth/unlock', rateLimit({ action: 'ads-unlock', max: 10, windowSec: 300 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await unlockAdsAccount(c.env.DB, id, String(body.code || ''), adsAccessCode(c.env))
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, unlocked: true })
})

// POST /api/ads/auth/forgot — 비밀번호 재설정 요청(이메일 링크). 열거 방지 → 항상 success.
marketingRoutes.post('/auth/forgot', rateLimit({ action: 'ads-forgot', max: 5, windowSec: 600 }), async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const reset = await requestPasswordReset(c.env.DB, String(body.email || '')).catch(() => null)
  if (reset && c.env.RESEND_API_KEY && c.env.RESEND_FROM) {
    const origin = new URL(c.req.url).origin
    const link = `${origin}/ads/reset?token=${reset.token}`
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${c.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: c.env.RESEND_FROM, to: reset.email,
        subject: '[유어애즈] 비밀번호 재설정',
        text: `아래 링크에서 비밀번호를 재설정하세요(1시간 유효):\n\n${link}\n\n본인이 요청하지 않았다면 이 메일을 무시하세요.\n\n— 유어애즈 UR Ads`,
      }),
    }).catch(() => null)
  }
  // 이메일 존재 여부 노출 금지 — 항상 동일 응답.
  return c.json({ success: true, message: '가입된 이메일이면 재설정 링크를 보냈습니다.' })
})

// POST /api/ads/auth/reset — 토큰으로 새 비밀번호 설정
marketingRoutes.post('/auth/reset', rateLimit({ action: 'ads-reset', max: 10, windowSec: 600 }), async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await resetPasswordWithToken(c.env.DB, String(body.token || ''), String(body.new_password || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400)
  return c.json({ success: true })
})

// ── 멀티테넌트 입점: 고객사별 스마트스토어 연동 (SELF 방식) ──────────────────
//   tenant = 인증된 계정(seller_id). owner_type='marketing' 으로 도매(supplier/distributor)와 데이터 격리.
//   각 고객사가 커머스 API센터에서 자기 앱(상품주문/배송 권한 포함) 발급 → client_id/secret 입력.
//   ⚠️ 라이브: 주문권한 스코프 + 엔드포인트 현행문서 검증 후(이 환경 egress 차단 미검증).

// POST /api/ads/naver/connect — 고객사 스토어 연결(토큰 발급으로 즉시 검증 후 암호화 저장)
marketingRoutes.post('/naver/connect', async (c) => {
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
marketingRoutes.delete('/naver/connect', async (c) => {
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
marketingRoutes.post('/orders/sync', async (c) => {
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
const naverOpenId = (env: Env) => env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
const naverOpenSecret = (env: Env) => env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET

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
marketingRoutes.patch('/alerts/settings', async (c) => {
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
marketingRoutes.delete('/rank/target', async (c) => {
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

// 연관키워드용 자격증명: 연결된 고객사 키 우선, 없으면 플랫폼(관리계정 47982) 폴백.
//   RelKwdStat 은 customer-level 이라 둘 다 동작 — 연결 시 그 계정 컨텍스트로.
async function resolveSearchAdCreds(c: { env: Env }, sellerId: number): Promise<SearchAdCreds | null> {
  const tenant = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY).catch(() => null)
  return tenant || searchAdCredsFrom(c.env)
}

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

// ── 검색광고 계정 연동 (멀티테넌트 — 고객사별 자기 키 연결) ───────────────────
//   자동입찰·실적·키워드 자동등록 등 per-advertiser 기능의 전제조건.

// POST /api/ads/searchad/connect — 고객사 검색광고 자격증명 연결(캠페인 조회로 즉시 검증 후 암호화 저장)
marketingRoutes.post('/searchad/connect', rateLimit({ action: 'ads-sa-connect', max: 10, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
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
  const label = body.label ? String(body.label).slice(0, 40) : undefined // 고객사 이름(멀티테넌트)
  await saveSearchAdConnection(c.env.DB, sellerId, creds, c.env.DATA_ENCRYPTION_KEY, label)
  return c.json({ success: true, message: '검색광고 계정이 연결되었습니다', campaigns: verify.campaigns?.length || 0 })
})

// GET /api/ads/searchad/status — 활성 연결 상태(마스킹)
marketingRoutes.get('/searchad/status', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const st = await searchAdConnStatus(c.env.DB, sellerId)
  return c.json({ success: true, ...st })
})

// GET /api/ads/searchad/tenants — 연결된 고객사 목록(멀티테넌트, 마스킹)
marketingRoutes.get('/searchad/tenants', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const tenants = await listTenants(c.env.DB, sellerId)
  return c.json({ success: true, tenants })
})

// POST /api/ads/searchad/tenant/activate {customer_id} — 활성 고객사 전환
marketingRoutes.post('/searchad/tenant/activate', rateLimit({ action: 'ads-sa-tenant', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const customerId = String(body.customer_id || '').trim()
  if (!customerId) return c.json({ success: false, error: 'customer_id 가 필요합니다' }, 400)
  const r = await setActiveTenant(c.env.DB, sellerId, customerId)
  if (!r.ok) return c.json({ success: false, error: '해당 고객사를 찾을 수 없습니다' }, 404)
  return c.json({ success: true })
})

// DELETE /api/ads/searchad/connect?customer_id= — 연결 해제(특정 고객사 또는 활성)
marketingRoutes.delete('/searchad/connect', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const customerId = String(c.req.query('customer_id') || '').trim() || undefined
  const deleted = await deleteSearchAdConnection(c.env.DB, sellerId, customerId)
  if (deleted) await deleteRulesForTenant(c.env.DB, sellerId, deleted) // 옛 규칙 부활 방지(돈 안전)
  return c.json({ success: true })
})

// GET /api/ads/searchad/campaigns — 내 캠페인 목록(연결 필요)
marketingRoutes.get('/searchad/campaigns', rateLimit({ action: 'ads-sa-list', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const r = await listCampaigns(creds)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, campaigns: r.campaigns })
})

// GET /api/ads/searchad/adgroups?campaignId= — 광고그룹 목록(연결 필요)
marketingRoutes.get('/searchad/adgroups', rateLimit({ action: 'ads-sa-list', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
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
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
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
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
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
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
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
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
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
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const days = Number(c.req.query('days')) === 30 ? 30 : 7
  const r = await accountStats(creds, days)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, data: r.data })
})

// GET /api/ads/metrics/history?days=30 — 일별 메트릭 시계열(추세 차트) + WoW. cron 적재분 조회(읽기)
marketingRoutes.get('/metrics/history', rateLimit({ action: 'ads-metrics-hist', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const days = Math.min(120, Math.max(7, Number(c.req.query('days')) || 30))
  const tenant = await getActiveTenantId(c.env.DB, sellerId).catch(() => null)
  const series = await getMetricsHistory(c.env.DB, sellerId, days, tenant)
  return c.json({ success: true, series, wow: computeWoW(series) })
})

// POST /api/ads/metrics/snapshot — 자기 계정 최근치 즉시 적재(첫 진입/지금 갱신). 어제+오늘 2일.
marketingRoutes.post('/metrics/snapshot', rateLimit({ action: 'ads-metrics-snap', max: 6, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await snapshotAccountRecent(c.env, sellerId).catch(() => ({ ok: false as const, reason: 'error' }))
  if (!r.ok) return c.json({ success: false, error: r.reason === 'no_creds' ? '검색광고 계정을 먼저 연결해주세요' : '적재 실패', code: r.reason === 'no_creds' ? 'NOT_CONNECTED' : undefined }, r.reason === 'no_creds' ? 400 : 502)
  const tenant = await getActiveTenantId(c.env.DB, sellerId).catch(() => null)
  const series = await getMetricsHistory(c.env.DB, sellerId, 30, tenant)
  return c.json({ success: true, series, wow: computeWoW(series) })
})

// GET /api/ads/searchad/keyword-efficiency?days=30 — 키워드 ROAS·CPA + 낭비 키워드(쿼터 보호 cap)
marketingRoutes.get('/searchad/keyword-efficiency', rateLimit({ action: 'ads-sa-eff', max: 10, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const days = Number(c.req.query('days')) === 7 ? 7 : 30
  const r = await keywordEfficiency(creds, days)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, items: r.items, scanned: r.scanned })
})

// GET /api/ads/searchad/pacing — 오늘 캠페인별 예산 소진률(과속/과소, 연결 필요)
marketingRoutes.get('/searchad/pacing', rateLimit({ action: 'ads-sa-pacing', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const r = await budgetPacing(creds)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, campaigns: r.campaigns })
})

// ── AI 마케터 (Claude 진단/추천 — 읽기 전용, 자동 실행 없음) ────────────────
// POST /api/ads/ai-marketer  body: { seed?: '키워드' } — 실적(연결 시) + 키워드 분석(seed 시)을 Claude 에게.
marketingRoutes.post('/ai-marketer', rateLimit({ action: 'ads-ai', max: 10, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
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
    // 전주 대비 추세(적재된 시계열 있을 때만) — AI 진단에 시간축 반영(활성 고객사 기준).
    const trendTenant = await getActiveTenantId(c.env.DB, sellerId).catch(() => null)
    const trend = trendContextFrom(await getMetricsHistory(c.env.DB, sellerId, 14, trendTenant).catch(() => []))
    if (trend) ctx.trend = trend
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

// ── AI 주간 리포트 (자동 생성·저장 — 읽기 전용) ─────────────────────────────
// GET /api/ads/reports — 저장된 주간 리포트 목록
marketingRoutes.get('/reports', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const reports = await listReports(c.env.DB, sellerId, 12)
  return c.json({ success: true, reports })
})

// POST /api/ads/reports/generate — 이번 주 리포트 즉시 생성(연결 필요, AI 설정 시 진단 포함)
marketingRoutes.post('/reports/generate', rateLimit({ action: 'ads-report-gen', max: 4, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await generateWeeklyReport(c.env, sellerId, { replace: true })
  if (!r.ok) return c.json({ success: false, error: r.error === 'NOT_CONNECTED' ? '검색광고 계정을 먼저 연결해주세요' : r.error, code: r.error }, r.error === 'NOT_CONNECTED' ? 400 : 502)
  return c.json({ success: true, advice: r.advice })
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
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await registerSite(c.env.DB, sellerId, String(body.domain || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, advertiser_key: r.advertiser_key })
})

// GET /api/ads/clickguard/sites — 내 등록 사이트 목록(인증)
marketingRoutes.get('/clickguard/sites', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const sites = await listSites(c.env.DB, sellerId)
  return c.json({ success: true, sites })
})

// DELETE /api/ads/clickguard/site?key= — 사이트+이벤트 삭제(인증)
marketingRoutes.delete('/clickguard/site', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const key = String(c.req.query('key') || '').trim()
  if (!key) return c.json({ success: false, error: 'key 가 필요합니다' }, 400)
  await deleteSite(c.env.DB, sellerId, key)
  return c.json({ success: true })
})

// GET /api/ads/clickguard/report?days=7 — 의심 IP 리포트(인증, 탐지만 — 차단 0)
marketingRoutes.get('/clickguard/report', rateLimit({ action: 'ads-cg-report', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureClickguardSchema(c.env.DB)
  const days = Number(c.req.query('days')) === 30 ? 30 : 7
  const report = await clickReport(c.env.DB, sellerId, days)
  return c.json({ success: true, report })
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
  const result = await bulkUpsertRules(c.env.DB, sellerId, rows, tenant)
  return c.json({ success: true, ...result })
})

// DELETE /api/ads/searchad/autobid/rule?keyword_id=
marketingRoutes.delete('/searchad/autobid/rule', async (c) => {
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
  await refreshWatch(c.env, row.id, row.query).catch(() => null)
  const watches = await listWatches(c.env.DB, sellerId)
  return c.json({ success: true, watches })
})

// DELETE /api/ads/price/watch?id= — 워치 삭제
marketingRoutes.delete('/price/watch', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const id = Number(c.req.query('id'))
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'id 가 필요합니다' }, 400)
  await deleteWatch(c.env.DB, sellerId, id)
  return c.json({ success: true })
})

// ── 부정클릭 Phase 2 — 차단 목록(검색광고센터 노출제한 IP 복붙용) ───────────────
//   네이버 공식 API 가 노출제한 IP 관리를 미노출 → 반자동(복붙). API 열리면 자동등록으로 전환.

// POST /api/ads/clickguard/block — 의심 IP 를 차단 목록에 추가
marketingRoutes.post('/clickguard/block', rateLimit({ action: 'ads-cg-block', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await addBlockedIp(c.env.DB, sellerId, String(body.ip || ''), String(body.reason || '부정클릭 의심'))
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  const blocklist = await listBlockedIps(c.env.DB, sellerId)
  return c.json({ success: true, blocklist })
})

// GET /api/ads/clickguard/blocklist — 차단 목록(복붙용 전체)
marketingRoutes.get('/clickguard/blocklist', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const blocklist = await listBlockedIps(c.env.DB, sellerId)
  return c.json({ success: true, blocklist })
})

// DELETE /api/ads/clickguard/block?ip= — 차단 목록에서 제거
marketingRoutes.delete('/clickguard/block', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const ip = String(c.req.query('ip') || '').trim()
  if (!ip) return c.json({ success: false, error: 'ip 가 필요합니다' }, 400)
  await removeBlockedIp(c.env.DB, sellerId, ip)
  return c.json({ success: true })
})

//   ⚠️ 순위 측정은 공식 API(Estimate/StatReport)로만 — SERP 스크래핑 금지(2026-04-22 제거 이력, PIPA).

export { marketingRoutes }

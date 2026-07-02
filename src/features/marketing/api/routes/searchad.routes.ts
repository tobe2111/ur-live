/**
 * 유어애즈(/api/ads) 검색광고 라우터 — searchad/* · metrics/* · ai-marketer · reports (분리, 2026-07-01).
 *   광고 구조/예상가/실적/키워드효율/페이싱 + WRITE(입찰·예산·키워드·네거티브, 하드캡) + AI 진단/주간리포트.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { adsAccountIdFrom } from '../ads-account'
import { listCampaigns, listAdgroups, listKeywords, estimateBidForPositions, updateKeywordBid, addKeywordsToAdgroup, accountStats, budgetPacing, keywordEfficiency, updateCampaignStatus, updateCampaignBudget, addNegativeKeywords, searchAdCredsFrom, relatedKeywords, BID_MIN, BID_MAX, KW_ADD_MAX, BUDGET_MIN, BUDGET_MAX, type SearchAdCreds } from '../searchad-client'
import { loadSearchAdConnection, saveSearchAdConnection, deleteSearchAdConnection, searchAdConnStatus, getActiveTenantId, listTenants, setActiveTenant } from '../searchad-connection'
import { deleteRulesForTenant } from '../autobid'
import { getMetricsHistory, computeWoW, snapshotAccountRecent, trendContextFrom } from '../metrics-history'
import { aiMarketerAdvice, type AiMarketerContext } from '../ai-marketer'
import { listReports, generateWeeklyReport } from '../weekly-report'
import { keywordShopping, keywordTrend } from '../keyword-tools'
import { listRankTargets } from '../rank-tracker'
import { meterDaily } from '../ads-entitlements'
import { clickReport } from '../clickguard'
import { listWatches } from '../price-monitor'
import { resolveSearchAdCreds, naverOpenId, naverOpenSecret } from './helpers'

const adsSearchadRoutes = new Hono<{ Bindings: Env }>()

// ── 검색광고 계정 연동 (멀티테넌트 — 고객사별 자기 키 연결) ───────────────────
//   자동입찰·실적·키워드 자동등록 등 per-advertiser 기능의 전제조건.

// POST /api/ads/searchad/connect — 고객사 검색광고 자격증명 연결(캠페인 조회로 즉시 검증 후 암호화 저장)
adsSearchadRoutes.post('/searchad/connect', rateLimit({ action: 'ads-sa-connect', max: 10, windowSec: 60 }), async (c) => {
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
adsSearchadRoutes.get('/searchad/status', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const st = await searchAdConnStatus(c.env.DB, sellerId)
  return c.json({ success: true, ...st })
})

// GET /api/ads/searchad/tenants — 연결된 고객사 목록(멀티테넌트, 마스킹)
adsSearchadRoutes.get('/searchad/tenants', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const tenants = await listTenants(c.env.DB, sellerId)
  return c.json({ success: true, tenants })
})

// POST /api/ads/searchad/tenant/activate {customer_id} — 활성 고객사 전환
adsSearchadRoutes.post('/searchad/tenant/activate', rateLimit({ action: 'ads-sa-tenant', max: 60, windowSec: 60 }), async (c) => {
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
adsSearchadRoutes.delete('/searchad/connect', rateLimit({ action: 'ads-sa-disc', max: 20, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const customerId = String(c.req.query('customer_id') || '').trim() || undefined
  const deleted = await deleteSearchAdConnection(c.env.DB, sellerId, customerId)
  if (deleted) await deleteRulesForTenant(c.env.DB, sellerId, deleted) // 옛 규칙 부활 방지(돈 안전)
  return c.json({ success: true })
})

// GET /api/ads/searchad/campaigns — 내 캠페인 목록(연결 필요)
adsSearchadRoutes.get('/searchad/campaigns', rateLimit({ action: 'ads-sa-list', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const r = await listCampaigns(creds)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, campaigns: r.campaigns })
})

// GET /api/ads/searchad/adgroups?campaignId= — 광고그룹 목록(연결 필요)
adsSearchadRoutes.get('/searchad/adgroups', rateLimit({ action: 'ads-sa-list', max: 60, windowSec: 60 }), async (c) => {
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
adsSearchadRoutes.get('/searchad/keywords', rateLimit({ action: 'ads-sa-list', max: 60, windowSec: 60 }), async (c) => {
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
adsSearchadRoutes.get('/searchad/estimate', rateLimit({ action: 'ads-sa-estimate', max: 30, windowSec: 60 }), async (c) => {
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
adsSearchadRoutes.patch('/searchad/keywords/bid', rateLimit({ action: 'ads-sa-bid', max: 60, windowSec: 60 }), async (c) => {
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
adsSearchadRoutes.post('/searchad/keywords/add', rateLimit({ action: 'ads-sa-kwadd', max: 20, windowSec: 60 }), async (c) => {
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

// PATCH /api/ads/searchad/campaign — 캠페인 일시정지/재개 or 일예산 변경(WRITE, 광고비 영향)
//   ⚠️ 사용자 명시 액션 + 서버 검증(예산 하드캡) + 연결 필수. 예산 페이싱 '초과 임박' 조치용.
adsSearchadRoutes.patch('/searchad/campaign', rateLimit({ action: 'ads-sa-camp', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const campaignId = String(body.campaign_id || '').trim()
  const action = String(body.action || '')
  if (!campaignId) return c.json({ success: false, error: '캠페인을 지정해주세요' }, 400)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  if (action === 'pause' || action === 'resume') {
    const r = await updateCampaignStatus(creds, campaignId, action === 'pause')
    if (!r.ok) return c.json({ success: false, error: r.error }, 502)
    return c.json({ success: true, action })
  }
  if (action === 'budget') {
    const dailyBudget = Number(body.daily_budget)
    if (!Number.isFinite(dailyBudget) || dailyBudget < BUDGET_MIN || dailyBudget > BUDGET_MAX) {
      return c.json({ success: false, error: `일예산은 ${BUDGET_MIN.toLocaleString()}~${BUDGET_MAX.toLocaleString()}원 범위여야 합니다` }, 400)
    }
    const r = await updateCampaignBudget(creds, campaignId, dailyBudget)
    if (!r.ok) return c.json({ success: false, error: r.error }, 502)
    return c.json({ success: true, action, daily_budget: Math.round(dailyBudget) })
  }
  return c.json({ success: false, error: '지원하지 않는 작업입니다 (pause|resume|budget)' }, 400)
})

// POST /api/ads/searchad/negative — 광고그룹 제외(네거티브) 키워드 등록(WRITE, 노출제한)
//   ⚠️ 사용자 명시 액션 + 서버 검증(개수≤20·길이) + 연결 필수. 키워드 효율의 '낭비 키워드' 조치용.
adsSearchadRoutes.post('/searchad/negative', rateLimit({ action: 'ads-sa-neg', max: 20, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const adgroupId = String(body.adgroup_id || '').trim()
  const kwRaw: unknown[] = Array.isArray(body.keywords) ? body.keywords : []
  if (!adgroupId) return c.json({ success: false, error: '광고그룹을 지정해주세요' }, 400)
  const keywords = kwRaw.map((k: unknown) => String(k || '')).filter(Boolean)
  if (!keywords.length) return c.json({ success: false, error: '등록할 제외 키워드를 입력해주세요' }, 400)
  if (keywords.length > KW_ADD_MAX) return c.json({ success: false, error: `한 번에 최대 ${KW_ADD_MAX}개까지 등록할 수 있습니다` }, 400)
  const creds = await loadSearchAdConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY)
  if (!creds) return c.json({ success: false, error: '검색광고 계정을 먼저 연결해주세요', code: 'NOT_CONNECTED' }, 400)
  const r = await addNegativeKeywords(creds, adgroupId, keywords)
  if (!r.ok) return c.json({ success: false, error: r.error }, 502)
  return c.json({ success: true, added: r.added })
})

// GET /api/ads/searchad/stats?days=7 — 통합실적(캠페인별 노출/클릭/비용/전환 + 합계, 읽기)
adsSearchadRoutes.get('/searchad/stats', rateLimit({ action: 'ads-sa-stats', max: 30, windowSec: 60 }), async (c) => {
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
adsSearchadRoutes.get('/metrics/history', rateLimit({ action: 'ads-metrics-hist', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const days = Math.min(120, Math.max(7, Number(c.req.query('days')) || 30))
  const tenant = await getActiveTenantId(c.env.DB, sellerId).catch(() => null)
  const series = await getMetricsHistory(c.env.DB, sellerId, days, tenant)
  return c.json({ success: true, series, wow: computeWoW(series) })
})

// POST /api/ads/metrics/snapshot — 자기 계정 최근치 즉시 적재(첫 진입/지금 갱신). 어제+오늘 2일.
adsSearchadRoutes.post('/metrics/snapshot', rateLimit({ action: 'ads-metrics-snap', max: 6, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await snapshotAccountRecent(c.env, sellerId).catch(() => ({ ok: false as const, reason: 'error' }))
  if (!r.ok) return c.json({ success: false, error: r.reason === 'no_creds' ? '검색광고 계정을 먼저 연결해주세요' : '적재 실패', code: r.reason === 'no_creds' ? 'NOT_CONNECTED' : undefined }, r.reason === 'no_creds' ? 400 : 502)
  const tenant = await getActiveTenantId(c.env.DB, sellerId).catch(() => null)
  const series = await getMetricsHistory(c.env.DB, sellerId, 30, tenant)
  return c.json({ success: true, series, wow: computeWoW(series) })
})

// GET /api/ads/searchad/keyword-efficiency?days=30 — 키워드 ROAS·CPA + 낭비 키워드(쿼터 보호 cap)
adsSearchadRoutes.get('/searchad/keyword-efficiency', rateLimit({ action: 'ads-sa-eff', max: 10, windowSec: 60 }), async (c) => {
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
adsSearchadRoutes.get('/searchad/pacing', rateLimit({ action: 'ads-sa-pacing', max: 30, windowSec: 60 }), async (c) => {
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
adsSearchadRoutes.post('/ai-marketer', rateLimit({ action: 'ads-ai', max: 10, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  // 일일 사용량 미터링(집행은 ADS_BILLING_ENFORCED='true' 일 때만 — 기본은 카운트만 적재).
  const meter = await meterDaily(c.env, sellerId, 'ai_per_day')
  if (!meter.ok) return c.json({ success: false, error: meter.error, plan: meter.plan }, 429)
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
    // 🆕 키워드 효율(낭비 키워드) — 연결 시에만(검색광고 read). fail-soft.
    const eff = await keywordEfficiency(creds, 30, 60).catch(() => null)
    if (eff?.ok && eff.items?.length) {
      ctx.efficiency = {
        days: 30, scanned: eff.scanned || eff.items.length,
        waste: eff.items.filter(k => k.waste).slice(0, 8).map(k => ({ keyword: k.keyword, cost: k.cost, clicks: k.clicks })),
        top: eff.items.filter(k => k.conv > 0).slice(0, 5).map(k => ({ keyword: k.keyword, cost: k.cost, conv: k.conv, roas: k.roas })),
      }
    }
  }
  // 🆕 grounding 확장 — 유어애즈가 이미 적재한 데이터(연결 무관, DB read only). 전부 fail-soft 병렬.
  {
    const [rk, cg, pw] = await Promise.allSettled([
      listRankTargets(c.env.DB, sellerId),
      clickReport(c.env.DB, sellerId, 7),
      listWatches(c.env.DB, sellerId),
    ])
    if (rk.status === 'fulfilled' && rk.value.length) {
      ctx.ranks = rk.value.slice(0, 10).map(t => ({ keyword: t.keyword, mall: t.mall_match, rank: t.last_rank, prevRank: t.prev_rank }))
    }
    if (cg.status === 'fulfilled' && cg.value.totalClicks > 0) {
      ctx.clickguard = { days: cg.value.days, totalClicks: cg.value.totalClicks, adClicks: cg.value.adClicks, suspiciousIps: cg.value.suspects.filter(s => s.suspicious).length }
    }
    if (pw.status === 'fulfilled' && pw.value.length) {
      ctx.price = pw.value.slice(0, 10).map(w => ({
        query: w.query, myPrice: w.my_price, lowest: w.last_lowest, lowestMall: w.last_mall,
        undercut: w.my_price != null && w.last_lowest != null && w.last_lowest < w.my_price,
      }))
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
  return c.json({ success: true, advice: r.advice, grounded: { connected: ctx.connected, hasStats: !!ctx.stats, hasKeyword: !!ctx.keyword, hasEfficiency: !!ctx.efficiency, hasRanks: !!ctx.ranks, hasClickguard: !!ctx.clickguard, hasPrice: !!ctx.price } })
})

// ── AI 주간 리포트 (자동 생성·저장 — 읽기 전용) ─────────────────────────────
// GET /api/ads/reports — 저장된 주간 리포트 목록
adsSearchadRoutes.get('/reports', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const reports = await listReports(c.env.DB, sellerId, 12)
  return c.json({ success: true, reports })
})

// POST /api/ads/reports/generate — 이번 주 리포트 즉시 생성(연결 필요, AI 설정 시 진단 포함)
adsSearchadRoutes.post('/reports/generate', rateLimit({ action: 'ads-report-gen', max: 4, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const r = await generateWeeklyReport(c.env, sellerId, { replace: true })
  if (!r.ok) return c.json({ success: false, error: r.error === 'NOT_CONNECTED' ? '검색광고 계정을 먼저 연결해주세요' : r.error, code: r.error }, r.error === 'NOT_CONNECTED' ? 400 : 502)
  return c.json({ success: true, advice: r.advice })
})

export { adsSearchadRoutes }

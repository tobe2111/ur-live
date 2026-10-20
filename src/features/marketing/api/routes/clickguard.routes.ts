/**
 * 유어애즈(/api/ads) 부정클릭 라우터 — clickguard/* (분리, 2026-07-01).
 *   Phase1 픽셀 수집·의심IP 리포트(무인증 픽셀 + 도메인검증) + Phase2 반자동 차단목록(복붙).
 *   설계: docs/design/urads-clickfraud-design.md.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { adsAccountIdFrom } from '../ads-account'
import { checkCapacity } from '../ads-entitlements'
import { registerSite, listSites, deleteSite, recordHit, clickReport, ensureClickguardSchema, addBlockedIp, listBlockedIps, removeBlockedIp } from '../clickguard'

const adsClickguardRoutes = new Hono<{ Bindings: Env }>()

// ── 부정클릭 방지 Phase 1 (수집·탐지·리포트 — 차단 0) ───────────────────────
//   설계: docs/design/urads-clickfraud-design.md. 프라이버시 바이 디자인.

// GET /api/ads/clickguard/pixel.js?k=KEY — 광고주 사이트 삽입용 픽셀(공개, 무인증)
adsClickguardRoutes.get('/clickguard/pixel.js', (c) => {
  const js = `(function(){try{var s=document.currentScript;if(!s)return;var u=new URL(s.src);var k=u.searchParams.get('k');if(!k)return;`
    + `var isAd=/[?&](n_media|n_query|n_ad|gclid|utm_source=naver)/i.test(location.search);`
    + `var body=JSON.stringify({k:k,u:location.href,r:document.referrer,ad:isAd});`
    + `if(navigator.sendBeacon){navigator.sendBeacon(u.origin+'/api/ads/clickguard/hit',body)}`
    + `else{fetch(u.origin+'/api/ads/clickguard/hit',{method:'POST',body:body,keepalive:true,mode:'no-cors'})}}catch(e){}})();`
  return c.newResponse(js, 200, { 'content-type': 'application/javascript; charset=utf-8', 'cache-control': 'public, max-age=3600' })
})

// POST /api/ads/clickguard/hit — 픽셀 수집(공개, 무인증, 도메인 검증으로 스푸핑 차단)
adsClickguardRoutes.post('/clickguard/hit', rateLimit({ action: 'ads-cg-hit', max: 120, windowSec: 60 }), async (c) => {
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
adsClickguardRoutes.post('/clickguard/site', rateLimit({ action: 'ads-cg-site-add', max: 20, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  // 플랜 한도(ADS_BILLING_ENFORCED='true' 일 때만 집행 — 기본 무제한).
  const cap = await checkCapacity(c.env, sellerId, 'clickguard_sites', (await listSites(c.env.DB, sellerId)).length)
  if (!cap.ok) return c.json({ success: false, error: cap.error, plan: cap.plan }, 402)
  const r = await registerSite(c.env.DB, sellerId, String(body.domain || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, advertiser_key: r.advertiser_key })
})

// GET /api/ads/clickguard/sites — 내 등록 사이트 목록(인증)
adsClickguardRoutes.get('/clickguard/sites', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const sites = await listSites(c.env.DB, sellerId)
  return c.json({ success: true, sites })
})

// DELETE /api/ads/clickguard/site?key= — 사이트+이벤트 삭제(인증)
adsClickguardRoutes.delete('/clickguard/site', rateLimit({ action: 'ads-cg-site-del', max: 20, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const key = String(c.req.query('key') || '').trim()
  if (!key) return c.json({ success: false, error: 'key 가 필요합니다' }, 400)
  await deleteSite(c.env.DB, sellerId, key)
  return c.json({ success: true })
})

// GET /api/ads/clickguard/report?days=7 — 의심 IP 리포트(인증, 탐지만 — 차단 0)
adsClickguardRoutes.get('/clickguard/report', rateLimit({ action: 'ads-cg-report', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureClickguardSchema(c.env.DB)
  const days = Number(c.req.query('days')) === 30 ? 30 : 7
  const report = await clickReport(c.env.DB, sellerId, days)
  return c.json({ success: true, report })
})

// ── 부정클릭 Phase 2 — 차단 목록(검색광고센터 노출제한 IP 복붙용) ───────────────
//   네이버 공식 API 가 노출제한 IP 관리를 미노출 → 반자동(복붙). API 열리면 자동등록으로 전환.

// POST /api/ads/clickguard/block — 의심 IP 를 차단 목록에 추가
adsClickguardRoutes.post('/clickguard/block', rateLimit({ action: 'ads-cg-block', max: 60, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await addBlockedIp(c.env.DB, sellerId, String(body.ip || ''), String(body.reason || '부정클릭 의심'))
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  const blocklist = await listBlockedIps(c.env.DB, sellerId)
  return c.json({ success: true, blocklist })
})

// GET /api/ads/clickguard/blocklist — 차단 목록(복붙용 전체)
adsClickguardRoutes.get('/clickguard/blocklist', async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const blocklist = await listBlockedIps(c.env.DB, sellerId)
  return c.json({ success: true, blocklist })
})

// DELETE /api/ads/clickguard/block?ip= — 차단 목록에서 제거
adsClickguardRoutes.delete('/clickguard/block', rateLimit({ action: 'ads-cg-block-del', max: 30, windowSec: 60 }), async (c) => {
  const sellerId = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const ip = String(c.req.query('ip') || '').trim()
  if (!ip) return c.json({ success: false, error: 'ip 가 필요합니다' }, 400)
  await removeBlockedIp(c.env.DB, sellerId, ip)
  return c.json({ success: true })
})

export { adsClickguardRoutes }

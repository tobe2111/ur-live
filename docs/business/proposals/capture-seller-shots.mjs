#!/usr/bin/env node
/**
 * 셀러 대시보드 화면 캡처 — 실제 urdeal.kr 프론트를 띄우되, 셀러 API 응답만 예시 데이터로 대체한다.
 * 프로덕션 DB 에는 아무것도 쓰지 않는다(로그인도 하지 않는다). 토큰은 클라이언트 가드가 exp 만 보므로 서명 없는 JWT.
 *
 *   NODE_PATH=... NODE_USE_ENV_PROXY=1 node capture-seller.mjs /tmp/shots
 */
import { createRequire } from 'node:module'
import path from 'node:path'
import fs from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright-core')
const sharp = require('sharp')

const OUT = path.resolve(process.argv[2] || 'seller-shots')
const CHROME = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const ORIGIN = 'https://urdeal.kr'
const W = 430, H = 930

// ── 예시 데이터 (덱에 "예시" 로 표기) ──
const STORES = [
  { seller_id: 101, role: 'operator', source: 'grant', business_name: '홍대돈까스', name: '홍대돈까스', status: 'approved', username: 'hongdae-donkatsu' },
  { seller_id: 102, role: 'operator', source: 'grant', business_name: '한우한돈정육점', name: '한우한돈정육점', status: 'approved', username: 'hanwoo-butcher' },
  { seller_id: 103, role: 'owner', source: 'link', business_name: '선유동 네일스튜디오', name: '선유동 네일스튜디오', status: 'pending', username: 'seonyu-nail' },
]
const OPERATING = [
  { seller_id: 101, business_name: '홍대돈까스', username: 'hongdae-donkatsu', status: 'approved', role: 'operator', source: 'grant', granted_at: '2026-07-14 03:12:00', products_active: 3, orders_total: 172, revenue_total: 3420000, orders_since_grant: 61, revenue_since_grant: 1180000 },
  { seller_id: 102, business_name: '한우한돈정육점', username: 'hanwoo-butcher', status: 'approved', role: 'operator', source: 'grant', granted_at: '2026-08-02 06:40:00', products_active: 2, orders_total: 58, revenue_total: 2024000, orders_since_grant: 34, revenue_since_grant: 1186600 },
  { seller_id: 103, business_name: '선유동 네일스튜디오', username: 'seonyu-nail', status: 'pending', role: 'owner', source: 'link', granted_at: null, products_active: 1, orders_total: 0, revenue_total: 0, orders_since_grant: null, revenue_since_grant: null },
]
const OPERATORS = [
  { user_id: 501, role: 'operator', granted_at: '2026-07-14 03:12:00', revoked_at: null, user_name: '유어딜 파트너스', user_handle: 'urdeal-partners', user_email: null },
  { user_id: 502, role: 'operator', granted_at: '2026-08-20 01:05:00', revoked_at: null, user_name: '김민수', user_handle: 'minsu-k', user_email: null },
]
const LEADS = [
  { id: 1, platform: 'naver_blog', handle: 'mapo_eats', name: '마포 먹방일기', category: '맛집', region: '서울 마포구', thumbnail: null, subscriber_count: 18400, video_count: 612, recent_avg_views: 2100, recent_avg_comments: 34, last_post_at: '2026-09-05' },
  { id: 2, platform: 'youtube', handle: 'seoulfoodtrip', name: '서울푸드트립', category: '맛집', region: '서울', thumbnail: null, subscriber_count: 42300, video_count: 188, recent_avg_views: 9800, recent_avg_comments: 120, last_post_at: '2026-09-04' },
  { id: 3, platform: 'naver_blog', handle: 'hongdae_daily', name: '홍대 데일리', category: '카페', region: '서울 마포구', thumbnail: null, subscriber_count: 9700, video_count: 421, recent_avg_views: 1500, recent_avg_comments: 21, last_post_at: '2026-09-06' },
  { id: 4, platform: 'youtube', handle: 'yeongdeungpo_tv', name: '영등포 동네TV', category: '맛집', region: '서울 영등포구', thumbnail: null, subscriber_count: 12100, video_count: 96, recent_avg_views: 4300, recent_avg_comments: 58, last_post_at: '2026-09-01' },
  { id: 5, platform: 'naver_blog', handle: 'nailholic_sy', name: '네일홀릭', category: '미용', region: '서울 영등포구', thumbnail: null, subscriber_count: 6300, video_count: 233, recent_avg_views: 900, recent_avg_comments: 12, last_post_at: '2026-09-03' },
  { id: 6, platform: 'naver_blog', handle: 'weekend_seoul', name: '주말엔 서울', category: '맛집', region: '서울', thumbnail: null, subscriber_count: 27600, video_count: 540, recent_avg_views: 3300, recent_avg_comments: 47, last_post_at: '2026-09-06' },
]
const CATEGORIES = [{ category: '맛집', n: 41230 }, { category: '카페', n: 18877 }, { category: '미용', n: 9142 }, { category: '여행', n: 22015 }, { category: '육아', n: 7301 }]

function mock(url) {
  const u = new URL(url)
  const p = u.pathname
  const json = (obj) => ({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) })
  if (p === '/api/seller/surface') return json({ success: true, wholesale_only: false })
  if (p === '/api/seller/my-stores') return json({ success: true, data: STORES })
  if (p === '/api/seller/operating-summary') return json({ success: true, data: OPERATING })
  if (p === '/api/seller/operators') return json({ success: true, data: OPERATORS })
  if (p === '/api/seller/influencers/list') return json({ success: true, configured: true, data: LEADS, total: 198704, page: 1, limit: 20, contact_fee_krw: 0 })
  if (p === '/api/seller/influencers/categories') return json({ success: true, data: CATEGORIES })
  if (p === '/api/seller/products') return json({ success: true, data: [{ id: 2876, name: '한우 런치 정식 2인' }, { id: 2879, name: '치즈돈가스 2인 세트 할인권' }] })
  if (p === '/api/seller/refresh') return json({ success: true, token: FAKE_TOKEN })
  // 화면 장식 위젯이 부르는 부가 API 두 개(알림 벨·유입 바인딩) — 세션이 없어 401 이 나면 stores 페이지의
  // 소비자용 클라이언트가 throw 해 에러 경계가 뜬다. 스크린샷용으로 빈 목록/무응답을 준다.
  if (p === '/api/seller/stores/review-bonus') return json({ success: true, data: { amount: 300, store_set: false, funded_by: 'platform' } })
  if (p === '/api/dashboard-notifications') return json({ success: true, data: [], unread: 0 })
  if (p === '/api/acquisition/inflow/bind') return json({ success: true })
  if (p.startsWith('/api/seller/') || p.startsWith('/api/seller-public/') || p.startsWith('/api/disputes/')) return json({ success: true, data: [] })
  return null
}

const b64url = (s) => Buffer.from(s).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
const FAKE_TOKEN = `${b64url(JSON.stringify({ alg: 'none', typ: 'JWT' }))}.${b64url(JSON.stringify({ sub: 999, seller_id: 999, role: 'seller', exp: 1900000000 }))}.x`

const SHOTS = [
  { name: 'seller-stores', url: '/seller/stores' },
  { name: 'seller-influencers', url: '/seller/influencers' },
  { name: 'seller-operating', url: '/seller/operating' },
  { name: 'seller-operators', url: '/seller/operators' },
]

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking'] })
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  })
  await ctx.addInitScript(({ token }) => {
    localStorage.setItem('seller_token', token)
    localStorage.setItem('seller_id', '999')
    localStorage.setItem('seller_username', 'urdeal-partners')
    localStorage.setItem('seller_name', '유어딜 파트너스')
    localStorage.setItem('seller_type', 'store_owner')
    localStorage.setItem('user_type', 'seller')
    localStorage.setItem('ur_seller_full_menu', '1')
    sessionStorage.setItem('ur_seller_surface', 'seller')
    localStorage.setItem('seller_kakao_link_banner_dismissed_v1', '1')
  }, { token: FAKE_TOKEN })

  await ctx.route('**', async (route) => {
    const req = route.request()
    const url = req.url()
    if (!/^https?:/.test(url)) return route.continue()
    if (url.includes('sentry.io')) {
      const body = req.postData() || ''
      const hit = body.match(/"(?:type|value)":"([^"]{0,300})"/g)
      console.log('  [sentry]', (hit || []).slice(0, 4).join(' | '))
      const st = body.match(/"filename":"([^"]{0,120})","function":"([^"]{0,60})"/)
      if (st) console.log('  [sentry-frame]', st[1], st[2])
      return route.fulfill({ status: 200, body: '{}' })
    }
    const m = mock(url)
    if (m) return route.fulfill(m)
    try {
      const headers = { ...req.headers() }
      delete headers['accept-encoding']
      const init = { method: req.method(), headers, redirect: 'follow' }
      const post = req.postDataBuffer()
      if (post) init.body = post
      const res = await fetch(url, init)
      const body = Buffer.from(await res.arrayBuffer())
      const out = {}
      for (const [k, v] of res.headers) {
        const lk = k.toLowerCase()
        if (lk === 'content-encoding' || lk === 'content-length' || lk === 'content-security-policy') continue
        out[k] = v
      }
      await route.fulfill({ status: res.status, headers: out, body })
    } catch { await route.abort() }
  })

  const only = process.env.ONLY ? process.env.ONLY.split(',') : null
  for (const shot of SHOTS) {
    if (only && !only.includes(shot.name)) continue
    const page = await ctx.newPage()
    page.on('requestfailed', (r) => console.log(`  [failed] ${r.url().slice(0, 110)} ${r.failure()?.errorText}`))
    page.on('response', (r) => { if (r.status() >= 400) console.log(`  [${r.status()}] ${r.url().slice(0, 110)}`) })
    page.on('pageerror', (e) => console.log(`  [pageerror] ${shot.name}: ${String(e.message).split('\n')[0]}`))
    page.on('console', (m) => { if (m.type() === 'error') console.log(`  [console] ${shot.name}: ${m.text().slice(0, 200)}`) })
    const raw = path.join(OUT, `${shot.name}.png`)
    try {
      await page.goto(ORIGIN + shot.url, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await page.waitForTimeout(6000)
      await page.screenshot({ path: raw })
      const meta = await sharp(raw).metadata()
      await sharp(raw).resize({ width: W, height: H, fit: 'cover', position: 'top' }).jpeg({ quality: 88 }).toFile(path.join(OUT, `${shot.name}.jpg`))
      console.log(`${shot.name} OK ${meta.width}x${meta.height} url=${page.url()}`)
    } catch (err) { console.log(`${shot.name} FAIL ${String(err.message).split('\n')[0]}`) }
    await page.close()
  }
  await browser.close()
}
main()

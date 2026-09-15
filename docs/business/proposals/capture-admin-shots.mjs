// 어드민 화면 데스크톱 캡처 (소개서 참고 이미지용) — 2026-09-14
// 자동화 어드민 계정(URDEAL_ADMIN_EMAIL / URDEAL_ADMIN_PASSWORD, CLAUDE.md "어드민 진단 접근")으로 로그인해
// /admin/influencer-pool 을 열고, 연락처(이메일 · 인스타/틱톡 핸들)만 블러 처리한 뒤 표 영역을 잘라 저장한다.
// 실행: NODE_USE_ENV_PROXY=1 NODE_PATH=/opt/node22/lib/node_modules/playwright/node_modules:/opt/node22/lib/node_modules:/tmp/deck/node_modules \
//       node docs/business/proposals/capture-admin-shots.mjs <출력 폴더>
// ⚠️ 토큰은 메모리에만 두고 파일로 남기지 않는다. 읽기 전용(목록 열람)만 한다.
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const sharp = require('sharp')

const OUT = process.argv[2] || '/tmp/admin-shots'
fs.mkdirSync(OUT, { recursive: true })
const ORIGIN = 'https://urdeal.kr'
const API = 'https://live.ur-team.com'
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'

async function login() {
  const email = process.env.URDEAL_ADMIN_EMAIL, password = process.env.URDEAL_ADMIN_PASSWORD
  if (!email || !password) throw new Error('URDEAL_ADMIN_EMAIL / URDEAL_ADMIN_PASSWORD 가 없다')
  const r = await fetch(API + '/api/admin/login', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': UA }, body: JSON.stringify({ email, password }) })
  const j = await r.json()
  const d = j.data || j
  const token = d.accessToken || d.token || j.token
  if (!token) throw new Error('login: token 없음 ' + JSON.stringify(Object.keys(d)))
  return { token, refresh: d.refreshToken || '', admin: d.admin || { id: 10, name: 'Claude', email, role: 'super_admin' } }
}

async function main() {
  const auth = await login()
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] })
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2, userAgent: UA, locale: 'ko-KR' })
  await ctx.addInitScript(({ token, refresh, admin }) => {
    localStorage.setItem('admin_token', token)
    localStorage.setItem('access_token', token)
    localStorage.setItem('admin_refresh_token', refresh)
    localStorage.setItem('user_type', 'admin')
    localStorage.setItem('active_role', 'admin')
    localStorage.setItem('admin_id', String(admin.id))
    localStorage.setItem('admin_name', admin.name || '')
    localStorage.setItem('admin_email', admin.email || '')
    localStorage.setItem('admin_role', admin.role || 'admin')
  }, auth)
  // 이 환경은 브라우저 직접 이그레스가 막혀 있다(CONNECT 프록시). 모든 요청을 node fetch(NODE_USE_ENV_PROXY)로 대신 보낸다.
  await ctx.route('**', async (route) => {
    const req = route.request(); const url = req.url()
    if (!/^https?:/.test(url)) return route.continue()
    if (url.includes('sentry.io') || url.includes('googletagmanager') || url.includes('cloudflareinsights')) return route.fulfill({ status: 200, body: '{}' })
    try {
      const headers = { ...req.headers() }; delete headers['accept-encoding']
      const init = { method: req.method(), headers, redirect: 'follow' }
      const post = req.postDataBuffer(); if (post) init.body = post
      const res = await fetch(url, init)
      const body = Buffer.from(await res.arrayBuffer())
      const out = {}; res.headers.forEach((v, k) => { if (!['content-encoding', 'content-length', 'transfer-encoding', 'connection'].includes(k)) out[k] = v })
      await route.fulfill({ status: res.status, headers: out, body })
    } catch (e) { await route.abort() }
  })
  const page = await ctx.newPage()
  page.on('response', (r) => { if (r.status() >= 400 && r.url().includes('/api/')) console.log(`  [${r.status()}] ${r.url().slice(0, 110)}`) })
  await page.goto(ORIGIN + '/admin/influencer-pool', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForTimeout(9000)
  console.log('url', page.url())
  // 연락처만 블러: 이메일 · IG/TT 핸들 (이름·채널·구독자는 공개 정보라 그대로)
  const blurred = await page.evaluate(() => {
    const email = /[\w.+-]+@[\w-]+\.[\w.-]+/
    const handle = /^(IG|TT)\s*@/
    let n = 0
    const walk = (el) => {
      for (const c of Array.from(el.children)) {
        const t = (c.textContent || '').trim()
        if (c.children.length === 0 || c.tagName === 'A') {
          if (email.test(t) || handle.test(t)) { c.style.filter = 'blur(6px)'; c.style.userSelect = 'none'; n++; continue }
        }
        walk(c)
      }
    }
    walk(document.body)
    return n
  })
  console.log('blurred elements', blurred)
  // 아바타 이미지는 외부 CDN 이라 이 환경에서 못 받아 깨진 아이콘이 된다 → 중립 원으로 대체
  await page.evaluate(() => {
    for (const img of Array.from(document.querySelectorAll('img'))) {
      if (!img.complete || img.naturalWidth === 0) { img.src = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><circle cx="32" cy="32" r="32" fill="#E6E2DE"/></svg>'); img.style.objectFit = 'cover' }
    }
  })
  // ① 상단 통계 카드 줄 (전체 · 유튜브 · 네이버블로그 · 카페 · 이메일 보유)
  const statsClip = await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('div,span,p')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === '전체')
    if (!el) return null
    let row = el; for (let i = 0; i < 6 && row.parentElement; i++) { row = row.parentElement; if (row.getBoundingClientRect().width > 900) break }
    const r = row.getBoundingClientRect()
    return { x: r.left - 6, y: r.top - 6, width: r.width + 12, height: r.height + 12 }
  })
  if (statsClip) { await page.screenshot({ path: path.join(OUT, 'admin-influencer-pool-stats.png'), clip: statsClip }); await sharp(path.join(OUT, 'admin-influencer-pool-stats.png')).jpeg({ quality: 90 }).toFile(path.join(OUT, 'admin-influencer-pool-stats.jpg')); console.log('stats', statsClip) }
  // ② 목록 표 (헤더 "구독자" 가 있는 표) — 스크롤해서 위에 붙이고 보이는 만큼 자른다
  await page.setViewportSize({ width: 1600, height: 1500 })
  const tableClip = await page.evaluate(() => {
    const hdr = Array.from(document.querySelectorAll('th,div,span')).find((e) => e.children.length === 0 && (e.textContent || '').trim() === '구독자')
    if (!hdr) return null
    let t = hdr.closest('table'); if (!t) { t = hdr; for (let i = 0; i < 8 && t.parentElement; i++) { t = t.parentElement; if (t.getBoundingClientRect().height > 600) break } }
    t.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12)
    const r = t.getBoundingClientRect()
    return { x: Math.max(0, r.left - 8), y: Math.max(0, r.top - 8), width: Math.min(r.width + 16, window.innerWidth - Math.max(0, r.left - 8)), height: Math.min(r.height + 16, window.innerHeight - Math.max(0, r.top - 8)) }
  })
  await page.waitForTimeout(800)
  console.log('table', tableClip)
  if (tableClip) { await page.screenshot({ path: path.join(OUT, 'admin-influencer-pool-table.png'), clip: tableClip }); await sharp(path.join(OUT, 'admin-influencer-pool-table.png')).jpeg({ quality: 90 }).toFile(path.join(OUT, 'admin-influencer-pool-table.jpg')) }
  await page.screenshot({ path: path.join(OUT, 'admin-influencer-pool-full.png'), fullPage: false })
  await browser.close()
}
main().catch((e) => { console.error('FAIL', e.message); process.exit(1) })

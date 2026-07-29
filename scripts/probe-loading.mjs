#!/usr/bin/env node
/**
 * 🔬 로딩 실측 프로브 (2026-07-12 — 대표 "앞으로 만들 페이지들도 로딩은 이상적이어야 해").
 *
 * 새 페이지를 만들거나 로딩을 만졌으면 **추측 말고 이걸로 실측**한다 (ERROR_DEBUGGING_PLAYBOOK 철학).
 * 표면당 1줄: [TTFB(HTML) | 풀스크린 로더 구간 | 콘텐츠 완성 | 스켈레톤 종료] — 이상 기준(§docs/LOADING_ARCHITECTURE.md):
 *   - 풀스크린 로더는 1회만(재등장 = 리마운트/시드 미스 클래스), warm 기준 콘텐츠 ≤ ~1.5s.
 *
 * 사용:
 *   node scripts/probe-loading.mjs                        # 기본 표면 스윕(live)
 *   node scripts/probe-loading.mjs /new-page              # 단일 표면
 *   BASE=http://localhost:8788 node scripts/probe-loading.mjs /new-page   # 로컬/스테이징
 *   PROXY_RELAY=1 …                                       # 프록시 정책이 chromium 직결을 막는 환경(원격 세션)
 *
 * 요구: playwright + chromium (원격 세션엔 전역 설치 존재 — PLAYWRIGHT_BROWSERS_PATH 참조).
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium, devices
try { ({ chromium, devices } = require('playwright')) }
catch { ({ chromium, devices } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')) }

const BASE = process.env.BASE || 'https://live.ur-team.com'
const DEFAULT_URLS = ['/', '/vouchers', '/browse', '/group-buy/2609', '/vouchers/118', '/u/jiwon1228', '/blog', '/wholesale']
const urls = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_URLS

const b = await chromium.launch({ headless: true, args: ['--no-sandbox'] })
for (const path of urls) {
  const ctx = await b.newContext({ ...devices['iPhone 13'], ignoreHTTPSErrors: true, locale: 'ko-KR' })
  if (process.env.PROXY_RELAY === '1') {
    // 원격 세션: egress 정책이 chromium 직결을 리셋 → 모든 요청을 Node측 fetch(프록시 호환)로 릴레이
    await ctx.route('**/*', async (route) => {
      try { const r = await ctx.request.fetch(route.request(), { ignoreHTTPSErrors: true, maxRedirects: 0 }); await route.fulfill({ response: r }) }
      catch { try { await route.abort() } catch {} }
    })
  }
  await ctx.addInitScript(() => {
    window.__s = []
    setInterval(() => {
      let full = false
      for (const el of document.querySelectorAll('.ur-loader-breathe')) {
        const w = el.closest('[role="status"]') || el.parentElement || el
        if (w.getBoundingClientRect().height > innerHeight * 0.6) { full = true; break }
      }
      window.__s.push({ t: performance.now(), full, text: document.body ? document.body.innerText.length : 0, skel: document.querySelectorAll('[class*="animate-pulse"]').length })
    }, 120)
  })
  const p = await ctx.newPage()
  let ttfb = null
  const t0 = Date.now()
  p.on('response', (r) => { if (r.request().resourceType() === 'document' && ttfb == null) ttfb = (Date.now() - t0) / 1000 })
  try { await p.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30000 }) }
  catch (e) { console.log(path.padEnd(24), 'GOTO-ERR', e.message.split('\n')[0].slice(0, 60)); await ctx.close(); continue }
  await p.waitForTimeout(6500)
  const s = await p.evaluate(() => window.__s)
  const contentAt = s.find((x) => !x.full && x.text > 300)
  const skelGone = s.find((x) => !x.full && x.text > 300 && x.skel === 0)
  const loaderOns = []
  let prevFull = false
  for (const x of s) { if (x.full && !prevFull) loaderOns.push(x.t); prevFull = x.full }
  const on = s.find((x) => x.full)
  const off = on ? s.find((x) => x.t > on.t && !x.full) : null
  const loaderSpan = on ? (off ? `${(on.t / 1000).toFixed(1)}→${(off.t / 1000).toFixed(1)}s` : '계속!') : '없음'
  const reblink = loaderOns.length > 1 ? ` ⚠️로더 ${loaderOns.length}회(재등장!)` : ''
  console.log(
    path.padEnd(24),
    `TTFB ${ttfb?.toFixed(1)}s`,
    '| 로더', loaderSpan.padEnd(12),
    '| 콘텐츠', contentAt ? `${(contentAt.t / 1000).toFixed(1)}s` : '?(텍스트<300 표면)',
    '| 스켈종료', skelGone ? `${(skelGone.t / 1000).toFixed(1)}s` : (contentAt ? '잔존' : '-'),
    reblink,
  )
  await ctx.close()
}
await b.close()

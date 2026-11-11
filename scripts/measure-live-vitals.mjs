#!/usr/bin/env node
/**
 * 📏 라이브 속도·밀림 실측 (2026-11-11 대표 승인 — "소비자 화면을 바꾼 PR 은 배포 뒤 재서 보고한다", CLAUDE.md).
 *
 * 가드(시험·주입·무게 예산)는 "모양이 같은가"까지만 본다. 실제로 몇 초에 뜨고 몇 픽셀 밀리는지는 배포된 사이트에서 재야 안다
 * (2026-11-10 홈 카테고리: 검사는 전부 초록인데 라이브 CLS 0.83 그대로였다).
 *
 * 사용:
 *   node scripts/measure-live-vitals.mjs /pass/2919 "/search?q=돈가스"        # 폰(4G·CPU 4배) 3회씩
 *   node scripts/measure-live-vitals.mjs --pc /                                # PC 1440px
 *   node scripts/measure-live-vitals.mjs --runs=5 --base=https://urdeal.kr /   # 회수·출처
 * 출력: 주소마다 회차별 FCP · LCP · CLS · TBT, 그리고 0.001 넘는 밀림의 시각·크기·요소.
 * 읽는 법: 한 회차만 느리면 회선(HTML 이 늦은 회차)이다 — **여러 회차의 낮은 쪽**을 보고, CLS 는 모든 회차가 같아야 한다.
 *   기준(Core Web Vitals '좋음'): LCP ≤ 2.5s · CLS ≤ 0.1. 이 레포의 평소 값은 FCP 0.4~0.8s · CLS ≤ 0.005 다 — 그보다 나빠졌으면 회귀다.
 *
 * ⚠️ 못 보는 것: 로그인해야 보이는 화면(세션 없음 — 대표 폰 또는 RUM) · 실사용자의 회선·기기 분포.
 * ⚠️ 시험 주소는 **실재하는 것**을 쓸 것 — 없는 상품(404)은 로더만 2초 돌아 "느린 화면"으로 보인다(2026-11-11 `/stays/2887` 오판).
 * 요구: playwright + chromium(원격 세션엔 전역 설치 — `require('playwright')` 가 그대로 된다).
 */
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
let chromium
try { ({ chromium } = require('playwright')) } catch { ({ chromium } = await import('/opt/node22/lib/node_modules/playwright/index.mjs')) }

const args = process.argv.slice(2)
const flag = (name, dflt) => { const a = args.find((x) => x.startsWith(`--${name}=`)); return a ? a.slice(name.length + 3) : dflt }
const pc = args.includes('--pc')
const runs = Math.max(1, Number(flag('runs', '3')) || 3)
const base = flag('base', 'https://urdeal.kr').replace(/\/$/, '')
const paths = args.filter((a) => !a.startsWith('--'))
if (paths.length === 0) { console.error('주소를 하나 이상 주세요 — 예: node scripts/measure-live-vitals.mjs / /vouchers'); process.exit(2) }

const PHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
/** 측정 조건 — 느린 4G(왕복 150ms · 내려받기 약 6.4Mbps) + CPU 4배 느리게. 이 세션들의 실측이 전부 이 조건이라 값을 비교할 수 있다. */
export const THROTTLE = { latency: 150, downloadThroughput: (1.6e6 / 8) * 4, uploadThroughput: 750e3 / 8, cpuRate: 4 }

async function measureOnce(browser, url) {
  const ctx = await browser.newContext(pc ? { viewport: { width: 1440, height: 900 } } : { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: PHONE_UA })
  try {
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: THROTTLE.latency, downloadThroughput: THROTTLE.downloadThroughput, uploadThroughput: THROTTLE.uploadThroughput })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE.cpuRate })
    await page.addInitScript(() => {
      const v = (window.__v = { cls: 0, shifts: [], lt: [], lcp: 0, fcp: 0 })
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) { v.cls += e.value; v.shifts.push([Math.round(e.startTime), +e.value.toFixed(4), (e.sources || []).map((s) => (s.node && (s.node.className || s.node.nodeName) || '').toString().slice(0, 60)).join(' / ')]) } }).observe({ type: 'layout-shift', buffered: true })
      new PerformanceObserver((l) => { for (const e of l.getEntries()) v.lt.push(Math.round(e.duration)) }).observe({ type: 'longtask', buffered: true })
      new PerformanceObserver((l) => { for (const e of l.getEntries()) v.lcp = Math.round(e.startTime) }).observe({ type: 'largest-contentful-paint', buffered: true })
      new PerformanceObserver((l) => { for (const e of l.getEntries()) if (e.name === 'first-contentful-paint') v.fcp = Math.round(e.startTime) }).observe({ type: 'paint', buffered: true })
    })
    const res = await page.goto(url, { waitUntil: 'load', timeout: 60000 })
    await page.waitForTimeout(5000)
    const v = await page.evaluate(() => window.__v)
    return { status: res ? res.status() : 0, fcp: v.fcp, lcp: v.lcp, cls: +v.cls.toFixed(4), tbt: v.lt.reduce((s, d) => s + Math.max(0, d - 50), 0), shifts: v.shifts.filter((s) => s[1] > 0.001) }
  } finally { await ctx.close() }
}

// 🩸 레포의 playwright 버전과 설치된 chromium 이 어긋나면 기본 실행이 실패한다(원격 세션) — 있는 chromium 을 직접 가리킨다.
const { existsSync } = await import('node:fs')
const exe = [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((x) => x && existsSync(x))
const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'], ...(exe ? { executablePath: exe } : {}) })
let bad = false
try {
  for (const p of paths) {
    const url = /^https?:/.test(p) ? p : base + (p.startsWith('/') ? p : '/' + p)
    console.log(`\n${url}  (${pc ? 'PC 1440px' : '폰 390px'} · 4G · CPU ${THROTTLE.cpuRate}배 · ${runs}회)`)
    for (let i = 1; i <= runs; i++) {
      try {
        const r = await measureOnce(browser, url)
        if (r.status >= 400) { bad = true; console.log(`  ${i}회  ⚠️ HTTP ${r.status} — 실재하는 주소인지 확인할 것(없는 상품은 로더만 돈다)`) }
        console.log(`  ${i}회  FCP ${String(r.fcp).padStart(5)}ms  LCP ${String(r.lcp).padStart(5)}ms  CLS ${r.cls.toFixed(4)}  TBT ${String(r.tbt).padStart(4)}ms`)
        for (const s of r.shifts) console.log(`        밀림 ${s[0]}ms · ${s[1]} · ${s[2]}`)
      } catch (err) { bad = true; console.log(`  ${i}회  ❌ 측정 실패 — ${(err && err.message || String(err)).split('\n')[0]}`) }
    }
  }
} finally { await browser.close() }
process.exit(bad ? 1 : 0)

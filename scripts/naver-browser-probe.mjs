#!/usr/bin/env node
/**
 * 🔬 2026-10-26 네이버 지도 — 실제 브라우저(GitHub 러너)에서는 캡차 없이 업체 사진에 닿는가.
 *
 * 배경: 라이브 워커(Cloudflare)에서 네이버 검색이 `ncaptcha-all-search-no-result` 로 막혔다(진단 2차 실측).
 *   수집기를 브라우저로 옮기기 전에 그 환경에서 ① 가게 번호 ② 업체사진 주소 둘 다 얻히는지 먼저 잰다.
 * 읽기 전용 — 우리 DB 를 바꾸지 않는다. 가게 이름은 인자로 받는다.
 *
 *   node scripts/naver-browser-probe.mjs "55와인포차 산남점" "청주"
 */
import { chromium } from 'playwright'

const queries = process.argv.slice(2).join(' ').trim() || '55와인포차 산남점 청주'
const UA_M = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

const browser = await chromium.launch()
const ctx = await browser.newContext({ userAgent: UA_M, viewport: { width: 390, height: 844 }, locale: 'ko-KR' })
const page = await ctx.newPage()
const out = { query: queries, search: {}, photo: {} }

try {
  const res = await page.goto(`https://m.place.naver.com/place/list?query=${encodeURIComponent(queries)}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(3000)
  const html = await page.content()
  const ids = [...new Set([...html.matchAll(/\/(?:place|restaurant|hairshop|accommodation)\/(\d{5,12})/g)].map((m) => m[1]))]
  out.search = { status: res?.status(), bytes: html.length, captcha: /captcha/i.test(html), ids: ids.slice(0, 5), title: await page.title() }
  const nid = ids[0]
  if (nid) {
    const r2 = await page.goto(`https://m.place.naver.com/restaurant/${nid}/photo?filterType=${encodeURIComponent('업체사진')}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 2000); await page.waitForTimeout(800) }
    const h2 = (await page.content()).replace(/\\u002F/gi, '/')
    const ldb = [...new Set([...h2.matchAll(/https:\/\/ldb-phinf\.pstatic\.net\/[^"'\s\\<>)?]+/gi)].map((m) => m[0]))]
    const imgs = await page.$$eval('img', (els) => els.map((e) => e.getAttribute('src') || '').filter(Boolean))
    const hosts = {}
    for (const s of imgs) { try { const h = new URL(s).host; hosts[h] = (hosts[h] || 0) + 1 } catch {} }
    out.photo = { nid, status: r2?.status(), captcha: /captcha/i.test(h2), ldbCount: ldb.length, ldbSample: ldb.slice(0, 3), imgHosts: hosts }
  }
} catch (err) {
  out.error = String(err?.message || err).slice(0, 200)
}
console.log('PROBE_RESULT ' + JSON.stringify(out))
await browser.close()

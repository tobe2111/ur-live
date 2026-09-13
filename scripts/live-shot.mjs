#!/usr/bin/env node
/**
 * 📸 **라이브 화면을 실제로 찍는다** — 세션이 눈으로 볼 수 없을 때의 눈. (2026-09-13 신설)
 *
 * ## 왜 필요한가
 * 이 레포의 규칙은 *"추측 금지, 실측"* 이고, 디자인 변경은 **가드가 구조적으로 못 보는** 것이
 * 많다(타일 위 마커 겹침·가독성, 지오코딩이 실제로 부르는 동 이름…). 그래서 대표에게
 * *"배포 후 눈으로 봐 주세요"* 를 반복해 넘겨 왔다.
 *
 * 🩸 2026-09-13: 세션 컨테이너에서 **브라우저가 아예 막혔다** — 같은 URL 이 `curl` 로는 200 인데
 *   Chromium 은 모든 호스트에서 끊긴다(에이전트 프록시가 터널을 닫는다). 그날 지도 눈 검증을
 *   통째로 못 했다. **CI 러너는 네트워크가 열려 있으므로** 거기서 찍어 아티팩트로 받는다.
 *
 * ## 쓰는 법
 *   node scripts/live-shot.mjs --paths=/map,/vouchers --device=phone
 *   (워크플로: `.github/workflows/live-shot.yml` — `workflow_dispatch` 전용)
 *
 * 결과: `artifacts/live-shot/<이름>.png` + stdout 에 경로별 요약(주요 문구·에러·요청 실패).
 *
 * ⚠️ **읽기 전용이다.** 공개 페이지 GET 만 한다 — 로그인하지 않고, 자격증명을 안 싣고,
 *   아무것도 쓰지 않는다. 절대 PR 게이트로 올리지 말 것(느리고 외부 의존이라 간헐 실패한다 —
 *   `render-smoke.yml`·`dark-contrast.yml`·`live-contracts.yml` 과 같은 판단).
 */
import fs from 'node:fs'
import path from 'node:path'

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`))
  return hit ? hit.slice(k.length + 3) : d
}

const BASE = (arg('base', 'https://urdeal.kr') || '').replace(/\/+$/, '')
const PATHS = arg('paths', '/map').split(',').map((s) => s.trim()).filter(Boolean)
const DEVICE = arg('device', 'phone')
const THEME = arg('theme', 'light')          // light | dark
const WAIT_MS = Number(arg('wait', '9000'))
const OUT = path.join(process.cwd(), 'artifacts/live-shot')

/** 폰은 대표가 실제로 보는 화면, PC 는 액자 밖 레이아웃 — 둘의 실패 모드가 다르다. */
const DEVICES = {
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' },
  pc: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
}

/** 동탄 — 대표가 예로 든 자리(`동탄6동`). 지역명·거리순이 실제로 무엇을 부르는지 보려면 좌표가 있어야 한다. */
const GEO = { latitude: Number(arg('lat', '37.2003')), longitude: Number(arg('lng', '127.0730')) }

let chromium
try { ({ chromium } = await import('playwright')) } catch {
  console.log('⏭️  live-shot: playwright 없음 (skip)')
  process.exit(0)
}

fs.mkdirSync(OUT, { recursive: true })
const launch = {}
if (process.env.PW_CHROMIUM) launch.executablePath = process.env.PW_CHROMIUM
// 세션 컨테이너에서 손으로 돌릴 때만 필요하다(CI 는 프록시가 없다). 지금은 이 경로가 안 통하지만
// 프록시 정책이 바뀌면 바로 살아나므로 남겨 둔다 — 있으면 쓰고, 없으면 직결.
if (process.env.HTTPS_PROXY) launch.proxy = { server: process.env.HTTPS_PROXY }

const browser = await chromium.launch(launch)
const ctx = await browser.newContext({
  ...DEVICES[DEVICE] || DEVICES.phone,
  locale: 'ko-KR', timezoneId: 'Asia/Seoul',
  colorScheme: THEME === 'dark' ? 'dark' : 'light',
  geolocation: GEO, permissions: ['geolocation'],
})

let bad = 0
for (const p of PATHS) {
  const url = `${BASE}${p.startsWith('/') ? p : '/' + p}`
  const name = (p.replace(/^\//, '').replace(/[^\w.-]+/g, '_') || 'root') + `-${DEVICE}-${THEME}`
  const page = await ctx.newPage()
  const errs = []
  const failed = []
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text().slice(0, 200)) })
  page.on('requestfailed', (r) => failed.push(`${r.failure()?.errorText} ${r.url().slice(0, 110)}`))
  let status = null
  try {
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    status = res?.status() ?? null
    await page.waitForTimeout(WAIT_MS)
  } catch (e) {
    errs.push('goto: ' + String(e.message).split('\n')[0])
  }
  const file = path.join(OUT, `${name}.png`)
  await page.screenshot({ path: file, fullPage: false }).catch(() => {})
  // 🔎 화면이 실제로 무엇을 말하는지 — 스크린샷만 있으면 다음 세션이 또 눈으로 세야 한다.
  const said = await page.evaluate(() => {
    const t = (document.body?.innerText || '').split('\n').map((s) => s.trim()).filter(Boolean)
    return { title: document.title, lines: t.slice(0, 25) }
  }).catch(() => ({ title: '', lines: [] }))
  const shellOnly = said.lines.length === 0
  if (status !== 200 || shellOnly) bad++
  console.log(`\n━━ ${url}  [${DEVICE}/${THEME}]  HTTP ${status}`)
  console.log(`   title: ${said.title}`)
  console.log(`   본문 첫 줄들: ${said.lines.slice(0, 8).join(' | ') || '(비어 있음 — 렌더 실패 의심)'}`)
  if (errs.length) console.log(`   콘솔 에러 ${errs.length}: ${errs.slice(0, 3).join(' // ')}`)
  if (failed.length) console.log(`   요청 실패 ${failed.length}: ${failed.slice(0, 3).join(' // ')}`)
  console.log(`   → ${path.relative(process.cwd(), file)}`)
  await page.close()
}

await browser.close()
console.log(`\n📸 live-shot: ${PATHS.length}개 · 이상 ${bad}개 — 아티팩트 artifacts/live-shot/`)
// 🔴 실패로 끝내지 않는다. 이건 **보는 도구**이지 판정 게이트가 아니다(초록/빨강이 뜻을 갖지 않는다).
process.exit(0)

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
 *   🔬 **원인까지 재 놨다(2026-09-14 — 다음 세션이 또 20분 태우지 않도록).** 이 컨테이너엔
 *   Playwright 1.58 + Chromium 1194 가 이미 깔려 있고 `/map` 은 `curl` 로 200 이라 **된다고 착각하기 쉽다.**
 *   실제로 하면 `net::ERR_CONNECTION_RESET` 이고, 프록시 `/__agentproxy/status` 가 원인을 말한다:
 *   `ws_closed_mid_exchange … 1751 B sent, 39 B received, client reading` — **CONNECT 는 통과했는데
 *   TLS 핸드셰이크 중간에 릴레이가 6초 만에 터널을 닫는다.** 즉 인증서 신뢰 문제가 아니다
 *   (NSS 저장소는 이미 설정돼 있고, 애초에 핸드셰이크가 안 끝난다). 시도해 봤지만 **소용없는 것**:
 *   `proxy: { server: HTTPS_PROXY }` 전달 · `--disable-features=PostQuantumKyber,EncryptedClientHello`
 *   · `--disable-quic` (ClientHello 를 1793→1719 B 로 줄여도 같은 자리에서 끊긴다).
 *   ⇒ **라이브 URL 을 여는 로컬 브라우저는 이 환경에서 불가**. 프록시 README 의 "지원 안 함" 항목이다.
 *
 *   ✅ **단, 브라우저 자체는 멀쩡히 뜬다 — 로컬만 열면 된다(2026-09-14 실측).**
 *   `check-dark-contrast.mjs` 는 `dist/client` 를 `127.0.0.1` 로 서빙하고 외부 요청을 전부
 *   `route.abort()` 하기 때문에 **이 컨테이너에서 그대로 돌아간다**(39개 경로·텍스트 1,177개 측정 성공).
 *   즉 막힌 것은 "브라우저"가 아니라 "외부 오리진"이다. 화면을 눈으로 재야 할 때는
 *   **`npm run build` 후 로컬 정적 서버 + Playwright** 가 먼저다. 라이브 실물이 꼭 필요할 때만 이 도구.
 *
 * ## 쓰는 법
 *   node scripts/live-shot.mjs --paths=/map,/vouchers --device=phone
 *   (워크플로: `.github/workflows/live-shot.yml` — `workflow_dispatch` 전용)
 *
 * 결과: `artifacts/live-shot/<이름>.png` + stdout 에 경로별 요약(주요 문구·에러·요청 실패).
 *
 * ## 🔴 세션이 이 도구로 **볼 수 있는 것 / 없는 것** (2026-09-14 실측 — 만든 날 바로 막혔다)
 * 만들면서 "이제 세션이 눈 검증을 할 수 있다"고 적었는데 **둘 다 막혀 있었다.** 정정한다:
 *
 * | | 세션 | 대표(브라우저) |
 * |---|---|---|
 * | 워크플로 dispatch | ❌ `403 Resource not accessible by integration`(actions:write 없음) | ✅ Actions 탭 |
 * | 아티팩트(PNG) 내려받기 | ❌ `productionresultssa19.blob.core.windows.net` CONNECT 403 | ✅ |
 * | **잡 로그 읽기** | ✅ `get_job_logs` | ✅ |
 *
 * ⇒ **실행은 대표가 한 번 눌러 주셔야 하고, 세션이 볼 수 있는 것은 로그뿐이다.**
 *   그래서 이 스크립트는 **로그에 사실을 최대한 싣는다** — 우리 DOM 텍스트는 그대로 찍고
 *   (`○○동 16곳 · 전체 338곳` 같은 것은 이걸로 판정된다), 그림이 꼭 필요하면
 *   `--b64crop=x,y,w,h` 로 **잘라낸 조각만** base64 로 찍는다(로그가 유일한 통로라서).
 *   ⚠️ 교차 출처 iframe(유튜브) 안은 JS 로 못 잰다 — 그 겹침은 **그림으로만** 판정된다.
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
/** `x,y,w,h` — 그 조각만 base64 로 로그에 찍는다. 세션이 그림을 볼 수 있는 **유일한 통로**. */
const B64CROP = arg('b64crop', '')
const OUT = path.join(process.cwd(), 'artifacts/live-shot')

/** 로그에 넣을 수 있는 상한. 넘으면 안 찍는다 — 잡 로그를 base64 로 덮으면 아무도 못 읽는다. */
const B64_MAX = 48_000

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
  if (B64CROP) {
    const [x, y, w, h] = B64CROP.split(',').map(Number)
    if ([x, y, w, h].every(Number.isFinite) && w > 0 && h > 0) {
      const buf = await page.screenshot({ clip: { x, y, width: w, height: h } }).catch(() => null)
      const b64 = buf ? buf.toString('base64') : ''
      if (!b64) console.log('   [b64crop] 실패')
      else if (b64.length > B64_MAX) console.log(`   [b64crop] 너무 크다(${b64.length}) — 영역을 줄일 것`)
      else console.log(`   [b64crop ${x},${y},${w},${h}]\n${b64}`)
    } else {
      console.log(`   [b64crop] 값이 이상하다: ${B64CROP}`)
    }
  }
  await page.close()
}

await browser.close()
console.log(`\n📸 live-shot: ${PATHS.length}개 · 이상 ${bad}개 — 아티팩트 artifacts/live-shot/`)
// 🔴 실패로 끝내지 않는다. 이건 **보는 도구**이지 판정 게이트가 아니다(초록/빨강이 뜻을 갖지 않는다).
process.exit(0)

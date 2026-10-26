/**
 * 🖼️ **몰 홈 렌더 스모크** — 시안 적용분이 실제로 그려지는지 브라우저로 본다 (2026-08-02).
 *
 * 이 레포의 시안 작업은 그동안 전부 **정적 검사**(tsc·유닛·가드)였다. 그건 "틀리지 않았다"만
 * 말하고 "보인다"는 말하지 못한다. 특히 `--mall` CSS 변수의 라이트/다크 전환은 단위 테스트가
 * **원리적으로** 못 본다 — 값이 브라우저 캐스케이드에서 정해지기 때문이다.
 *
 * ## 무엇을 판정하나
 * 스크린샷을 눈으로 보는 게 아니라 **계산된 색을 읽어 WCAG 대비를 직접 잰다.**
 * 사람이 "초록 위 흰 글씨네" 하고 넘어가는 자리가 정확히 사고가 나는 자리다
 * (실제로 이 작업에서 다크 2.24:1 을 그렇게 놓칠 뻔했다).
 *
 * ## 실행
 *   node scripts/smoke-mall-render.mjs         # vite dev 를 직접 띄운다
 *   BASE=http://localhost:5173 node ...        # 이미 떠 있으면 재사용
 *
 * ⚠️ **못 보는 것**: 서버 응답은 라우트 인터셉트로 **가짜**다. API 계약이 바뀌면 이 스모크는
 *   초록인 채로 실물이 깨진다. 계약은 `mall-surface-boundary` 같은 소스 가드가 지킨다.
 */
import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync, existsSync } from 'node:fs'

const OUT = 'artifacts/smoke'
const SLUG = 'happybanchan'
const MALL = {
  id: 1, slug: SLUG, name: '행복반찬', initial: '행', logoUrl: null,
  colorLight: '#2E7D5B', colorDark: '#5FBF95',
  intro: '매일 아침 직접 만드는 집반찬', contactUrl: null,
}
const ITEMS = [
  { product_id: 11, name: '수제 사과잼 250g 2병 세트', image_url: null, list_price: 10000, gb_price: 7000,
    discount_pct: 30, deadline: new Date(Date.now() + 2 * 86400e3).toISOString(), stock: 3,
    pickup: { date: '2026-08-10', place: '행복반찬', storage: 'cold' } },
  { product_id: 12, name: '담백한 통밀 식빵 1봉', image_url: null, list_price: 5500, gb_price: 4500,
    discount_pct: 18, deadline: new Date(Date.now() + 9 * 86400e3).toISOString(), stock: null,
    pickup: { date: '2026-08-16', place: '행복반찬', storage: 'room' } },
]

/** WCAG 상대 휘도 — 브라우저가 준 `rgb(r, g, b)` 문자열을 그대로 먹는다. */
function lum(rgb) {
  const [r, g, b] = rgb.match(/\d+/g).slice(0, 3).map(Number)
  const f = (c8) => { const c = c8 / 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }

async function waitFor(url, ms = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try { const r = await fetch(url); if (r.ok) return true } catch { /* 아직 안 뜸 */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

const results = []
const devLog = []
// devLog 는 200줄에서 잘리므로 재최적화 리로드는 따로 센다(인덱스로 자르면 잘린 뒤 엉뚱한 구간을 본다).
let depReloads = 0
const check = (name, pass, detail) => {
  results.push({ name, pass, detail })
  console.log(`${pass ? '✅' : '❌'} ${name} — ${detail}`)
  // 🔎 2026-10-14: 실패를 GitHub 주석으로도 낸다 — 잡 로그는 별도 저장소(blob)에 있어 원격 세션이 못 읽고,
  //   주석은 check-runs API 로 읽힌다. "왜 빨간불인가" 가 로그 접근에 묶이지 않게.
  if (!pass && process.env.GITHUB_ACTIONS) console.log(`::error title=smoke ${name}::${String(detail).replace(/\r?\n/g, ' | ').slice(0, 900)}`)
}

let dev = null
let base = process.env.BASE
if (!base) {
  dev = spawn('npx', ['vite', '--port', '5199', '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], detached: false })
  // 🔎 실패 진단용 — vite dev 가 그동안 뭘 했는지(의존성 재최적화·리로드 등) 끝부분을 남긴다.
  for (const st of [dev.stdout, dev.stderr]) st?.on('data', (d) => { const t = String(d); if (t.includes('optimized dependencies changed')) depReloads++; devLog.push(t); if (devLog.length > 200) devLog.shift() })
  base = 'http://localhost:5199'
  if (!await waitFor(base)) { console.error('vite dev 가 뜨지 않았다'); dev.kill(); process.exit(1) }
}

mkdirSync(OUT, { recursive: true })
// ⚠️ 이 컨테이너의 브라우저는 `/opt/pw-browsers` 에 **미리 설치**돼 있고 빌드 번호가 레포의
//   playwright 핀과 다르다(`npx playwright install` 금지 — 환경 방침). 실행파일을 직접 준다.
const PW_CHROME = process.env.PW_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
const browser = await chromium.launch({
  executablePath: existsSync(PW_CHROME) ? PW_CHROME : undefined,
  args: ['--no-sandbox'],
})

try {
  for (const mode of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: 430, height: 1400 }, deviceScaleFactor: 2 })
    await ctx.addInitScript((m) => { try { localStorage.setItem('ur_theme_mode_v1', m) } catch { /* private */ } }, mode)
    // 🔴 API 는 가짜다 — 이 스모크는 **렌더**를 보지 계약을 보지 않는다(파일 상단 주석 참조).
    await ctx.route('**/api/mall/**', (route) => {
      const u = route.request().url()
      const body = u.includes('/products') ? { success: true, data: ITEMS } : { success: true, mall: MALL }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
    })
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e)))
    await page.goto(`${base}/${SLUG}`, { waitUntil: 'networkidle' })
    await page.waitForSelector('text=진행 중인 공동구매', { timeout: 20000 })

    check(`[${mode}] 페이지 런타임 에러 0`, errs.length === 0, errs[0] || '없음')
    check(`[${mode}] 가게 이름 렌더`, await page.locator('h1', { hasText: '행복반찬' }).count() > 0, '행복반찬')
    check(`[${mode}] 상품 카드 2개`, (await page.locator('main ul > li').count()) === 2, `${await page.locator('main ul > li').count()}개`)
    check(`[${mode}] 마감 배지`, (await page.getByText(/남음/).count()) > 0, '표시됨')
    check(`[${mode}] 픽업 줄`, (await page.getByText(/픽업/).count()) > 0, '표시됨')

    // 🔴 본진 입구 금지(대표 UX 기준 ⑤) — 실제 렌더된 DOM 에서 확인한다.
    const bodyTxt = await page.locator('body').innerText()
    check(`[${mode}] 유어딜 본진 링크 0`, (await page.locator('a[href^="/vouchers"], a[href^="/browse"], nav a[href="/"]').count()) === 0, '없음')
    check(`[${mode}] powered by 는 링크 아님`, (await page.locator('a', { hasText: 'powered by' }).count()) === 0 && bodyTxt.includes('powered by'), '글자')

    // 🎨 몰 색 위 글자 대비 — 이 스모크의 존재 이유
    const avatar = page.locator('header div[aria-hidden]').first()
    const strip = page.locator('p', { hasText: '결제는 유어딜' }).first()
    for (const [label, loc] of [['아바타', avatar], ['안전결제 띠', strip]]) {
      const s = await loc.evaluate((el) => {
        const c = getComputedStyle(el)
        return { bg: c.backgroundColor, fg: c.color }
      })
      const r = ratio(s.bg, s.fg)
      check(`[${mode}] ${label} 대비 ≥ 4.5:1`, r >= 4.5, `${r.toFixed(2)}:1  (bg ${s.bg} / fg ${s.fg})`)
    }

    // 🔴 마감 배지가 **실제로 빨강인가** — 이 검사가 없으면 조용히 회귀한다.
    //   `tailwind.config.js` 가 `rose: MONO` 로 **브랜드 색조를 잉크로 리맵**해서, `bg-rose-600`
    //   이라고 써 두면 화면엔 **네이비**가 나온다(2026-08-02 스크린샷으로 실제로 발견).
    //   살아남는 기능색은 `red` 하나뿐이다(그 파일 주석: *"유일 예외 = red(에러/마감임박)"*).
    const badgeBg = await page.locator('span', { hasText: /남음$/ }).first()
      .evaluate((el) => getComputedStyle(el).backgroundColor)
    const [br, bg, bb] = badgeBg.match(/\d+/g).slice(0, 3).map(Number)
    check(`[${mode}] 마감 배지가 빨강 계열`, br > bg + 60 && br > bb + 60, `${badgeBg} (R이 G·B보다 우세해야 함)`)

    await page.screenshot({ path: `${OUT}/mall-home-${mode}.png`, fullPage: true })
    console.log(`   📸 ${OUT}/mall-home-${mode}.png`)
    await ctx.close()
  }
  // ── 화면 A-2 손님 상품 상세(픽업) ────────────────────────────────────────
  // 🔴 이 화면은 **본진 쇼핑 전체가 쓰는 페이지**다. 시안은 픽업 상품에만 얹혔고,
  //   그 분기가 실제로 갈리는지는 렌더로만 보인다(유닛은 마크업만 본다).
  for (const mode of ['light', 'dark']) {
    // 🇰🇷 `locale` 을 안 주면 i18n 이 브라우저 기본(en)으로 붙어 **영어 화면을 판정**하게 된다.
    const ctx = await browser.newContext({ viewport: { width: 430, height: 1600 }, deviceScaleFactor: 2, locale: 'ko-KR' })
    await ctx.addInitScript((m) => { try { localStorage.setItem('ur_theme_mode_v1', m) } catch { /* private */ } }, mode)
    // ⚠️ 등록 순서 주의 — Playwright 는 **나중에 등록한 라우트가 먼저** 매치된다.
    //   그래서 포괄 스텁을 먼저 깔고 구체 경로를 뒤에 등록한다.
    await ctx.route('**/api/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"data":[]}' }))
    await ctx.route('**/api/products/11', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: {
        id: 11, name: '수제 사과잼 250g 2병 세트', price: 7000, original_price: 10000,
        stock: 8, deal_only: 0, group_buy_status: null, category: 'food', image_url: null,
        description: '국내산 사과만 골라 오래 졸였습니다.', mall_id: 2,
        pickup: { date: '2026-08-10', place: '행복반찬', storage: 'cold' },
      } }),
    }))
    await ctx.route('**/api/products/11/options', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: [
        { id: 1, option_value: '사과잼 2병', price_adjustment: 0, stock: 5 },
        { id: 2, option_value: '유자청 2병', price_adjustment: 1500, stock: 0 },
      ] }),
    }))
    // ⚠️ 리뷰 목록은 `data.reviews` 형태다(`reviews.routes` GET /product/:id). 포괄 스텁의
    //   `data: []` 를 그대로 먹이면 화면이 터진다 — 그게 실제로 여기서 드러나 클라를 고쳤다.
    await ctx.route('**/api/reviews/product/**', (r) => r.fulfill({
      status: 200, contentType: 'application/json',
      body: r.request().url().includes('/summary')
        ? '{"success":true,"data":{"avg_rating":0,"total_count":0}}'
        : '{"success":true,"data":{"reviews":[],"total":0,"page":1,"limit":5}}',
    }))
    const page = await ctx.newPage()
    const errs = []
    page.on('pageerror', (e) => errs.push(String(e)))
    const reloads0 = depReloads
    await page.goto(`${base}/products/11`, { waitUntil: 'networkidle' })
    await page.waitForSelector('text=가게에 직접 찾으러 오는 상품이에요', { timeout: 20000 })
    // ♻️ 2026-10-25: 이 화면의 **첫 방문**에서 vite dev 가 새 의존성을 찾아 페이지를 통째로 다시 불러오면, 옛 모듈과 새 모듈의
    //   React 가 섞여 `Cannot read properties of null (reading 'useContext')` 가 한 번 난다(CI 실측 — 라이트만 실패, 다크는 통과).
    //   배포본엔 vite 가 없어 이 일이 안 일어난다 ⇒ B·D 와 같은 처방: 리로드가 **실제로 있었을 때만** 에러를 비우고 한 번 다시 연다.
    if (depReloads > reloads0) {
      console.log(`   ♻️ [A-2 ${mode}] vite 의존성 재최적화 리로드가 있었다 — 한 번 다시 연다`)
      errs.length = 0
      await page.goto(`${base}/products/11`, { waitUntil: 'networkidle' })
      await page.waitForSelector('text=가게에 직접 찾으러 오는 상품이에요', { timeout: 20000 })
    }

    check(`[A-2 ${mode}] 런타임 에러 0`, errs.length === 0, errs[0] || '없음')
    check(`[A-2 ${mode}] 픽업 안내 + 받는 날`, (await page.getByText('8월 10일').count()) > 0, '8월 10일')
    check(`[A-2 ${mode}] 옵션 3벌(선택/미선택/품절)`, (await page.getByText('품절', { exact: true }).count()) > 0, '품절 옵션 표시')

    // 🔴 하단 바가 **픽업 벌**인가 — 본진 라벨('바로 구매', 공백 있음)이 뜨면 분기가 안 갈린 것이다.
    const buy = page.locator('button', { hasText: /^바로구매$/ }).first()
    check(`[A-2 ${mode}] 픽업 하단 바`, (await buy.count()) > 0 && (await page.getByText('바로 구매').count()) === 0, '바로구매')
    check(`[A-2 ${mode}] 요약 줄(수량 · 픽업일)`, (await page.getByText(/개 · .*픽업/).count()) > 0, '표시됨')

    // 🎨 주요 CTA 대비 — 다크에서 잉크↔반전이 뒤집히는 자리다(2026-08-02 에 몰 홈이 여기서 2.24:1 이었다).
    const s = await buy.evaluate((el) => { const c = getComputedStyle(el); return { bg: c.backgroundColor, fg: c.color } })
    const r = ratio(s.bg, s.fg)
    check(`[A-2 ${mode}] 바로구매 대비 ≥ 4.5:1`, r >= 4.5, `${r.toFixed(2)}:1  (bg ${s.bg} / fg ${s.fg})`)

    // 🔴 몰 상품(mall_id=2)이라 유어딜 본진 입구가 없어야 한다(대표 UX 기준 ⑤ · PR #971 경계).
    check(`[A-2 ${mode}] 유어딜 본진 링크 0`,
      (await page.locator('a[href^="/vouchers"], a[href^="/browse"], nav a[href="/"]').count()) === 0, '없음')

    await page.screenshot({ path: `${OUT}/product-detail-pickup-${mode}.png`, fullPage: true })
    console.log(`   📸 ${OUT}/product-detail-pickup-${mode}.png`)
    await ctx.close()
  }

  // ── 사장님 화면 B·D ────────────────────────────────────────────────────
  // 🔴 대시보드는 **라이트 한 벌**이다(의뢰서 §5.2 — 다크는 만들지 마세요). 그래서 한 모드만 본다.
  //   인증은 localStorage 토큰 스텁 + API 인터셉트로 통과시킨다(진짜 로그인을 하려는 게 아니다).
  // 🪑 2026-10-12: 셀러 대시보드가 지워져 `/seller/*` 는 마이(`/user/profile?tool=…`)의 시트로 열린다.
  //   시트는 **좌석이 있어야** 열리므로 좌석 토큰을 JWT 모양으로 주고(`readSeatClaims` 가 seller_id 를 읽는다)
  //   좌석 요약에 그 매장을 싣는다(모양은 `seller-operators.routes` 의 `GET /my-stores/summary` 그대로 —
  //   `visual-preview.mjs` 의 `seatToken`·좌석 픽스처와 같다). 없으면 시트가 닫혀 마이 첫 화면만 남는다.
  const b64u = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const SEAT = `${b64u({ alg: 'none', typ: 'JWT' })}.${b64u({ seller_id: 1, seller_type: 'store_owner', name: MALL.name })}.smoke`
  const SUMMARY = { success: true, data: {
    stores: [{ seller_id: 1, name: MALL.name, role: 'owner', status: 'approved', today_revenue: 0, today_orders: 0, pending: 0 }],
    totals: { today_revenue: 0, today_orders: 0, pending: 0 }, current_seller_id: 1,
  } }
  const sellerCtx = await browser.newContext({ viewport: { width: 430, height: 1600 }, deviceScaleFactor: 2 })
  await sellerCtx.addInitScript((seat) => {
    try {
      localStorage.setItem('seller_token', seat)
      localStorage.setItem('seller_id', '1')
      localStorage.setItem('user_type', 'seller')
      localStorage.setItem('user_id', '1')
      localStorage.setItem('ur_theme_mode_v1', 'light')
    } catch { /* private */ }
  }, SEAT)
  // 제3자 분석 비콘은 스모크와 무관하다 — CI 만 실제로 받아 CORS 오류로 콘솔을 채우고 두 환경을 다르게 만든다.
  await sellerCtx.route('**/*cloudflareinsights.com/**', (r) => r.fulfill({ status: 200, contentType: 'application/javascript', body: '' }))
  await sellerCtx.route('**/api/seller/**', (route) => {
    const u = route.request().url()
    let body = { success: true, data: [] }
    if (u.includes('/returns')) body = { success: true, data: [] }
    if (u.includes('/my-stores/summary')) body = SUMMARY
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
  await sellerCtx.route('**/api/returns/seller**', (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ success: true, data: [
      { id: 1, order_id: 260810031, status: 'requested', reason: '픽업일에 방문이 어려워졌어요.',
        requested_at: '2026-08-10 04:00:00', order_total: 14000, shipping_name: '김민서' },
      { id: 2, order_id: 260808019, status: 'approved', reason: '수량을 잘못 눌렀어요.',
        requested_at: '2026-08-08 04:00:00', order_total: 9600, shipping_name: '박지훈' },
    ] }),
  }))

  // 🔥 2026-10-14 — **vite 를 먼저 데운다.** CI 는 매번 빈 의존성 캐시로 시작해, 시트가 셀러 화면 청크를 처음 불러오는
  //   순간 vite 가 새 의존성을 발견하고 **페이지를 통째로 다시 불러온다**(주석 기록: `[vite] connected` 3회). 깊은 링크는
  //   `?tool=` 을 읽자마자 주소에서 지우므로(새로고침이 시트를 또 열지 않게 — 제품의 의도), 다시 불러온 페이지엔 시트가 없다.
  //   운영엔 vite 가 없어 이 일이 안 일어난다 ⇒ 판정 전에 한 번씩 열어 의존성을 다 찾게 둔다(판정은 새 페이지에서).
  for (const p of ['/seller/products/quick', '/seller/returns']) {
    const warm = await sellerCtx.newPage()
    await warm.goto(`${base}${p}`, { waitUntil: 'networkidle' }).catch(() => {})
    await warm.waitForTimeout(3000)
    await warm.close()
  }

  for (const [name, path, expect1] of [
    ['B 빠른 공구 등록', '/seller/products/quick', '빠른 공구 등록'],
    // 2026-08-20 대표: 사용자-가시 라벨 반품→환불 (이용권엔 배송 반품이 없다)
    ['D 환불 요청 큐', '/seller/returns', '환불 요청이에요'],
  ]) {
    const page = await sellerCtx.newPage()
    // 토스트는 몇 초 뒤 사라진다 — 실패 원인(예: "가게가 선택돼 있지 않아요")이 그 안에 있으므로 떠 있던 것을 모아 둔다.
    await page.addInitScript(() => {
      const seen = (window.__toasts = [])
      const ob = new MutationObserver(() => document.querySelectorAll('[role=status],[role=alert]').forEach((n) => {
        const t = (n.textContent || '').trim(); if (t && !seen.includes(t)) seen.push(t)
      }))
      document.addEventListener('DOMContentLoaded', () => ob.observe(document.body, { childList: true, subtree: true }))
    })
    const errs = []
    // 🔎 실패 진단 — 콘솔·주소 변경·실패 요청을 시간순으로 모아 둔다(실패할 때만 출력).
    const trace = []
    const t0 = Date.now()
    page.on('console', (m) => trace.push(`+${Date.now() - t0}ms console.${m.type()} ${m.text().slice(0, 200)}`))
    page.on('requestfailed', (r) => trace.push(`+${Date.now() - t0}ms reqfail ${r.url().slice(0, 120)} ${r.failure()?.errorText || ''}`))
    page.on('framenavigated', (f) => { if (f === page.mainFrame()) trace.push(`+${Date.now() - t0}ms nav ${f.url()}`) })
    await page.addInitScript(() => {
      const r = history.replaceState.bind(history), p = history.pushState.bind(history)
      history.replaceState = (a, b, u) => { console.log('[diag] replaceState ' + u); return r(a, b, u) }
      history.pushState = (a, b, u) => { console.log('[diag] pushState ' + u); return p(a, b, u) }
    })
    page.on('pageerror', (e) => errs.push(`${String(e)} @ ${String(e.stack || '').split('\n').slice(1, 3).join(' ')}`))
    const logMark = devLog.length
    await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
    // ♻️ 2026-10-14: vite dev 가 첫 방문 중 의존성을 새로 찾으면 페이지를 **통째로 리로드**한다
    //   (CI 실측: lucide 아이콘 파일 단위 import 를 하나씩 발견하며 6번 — "optimized dependencies changed. reloading").
    //   깊은 링크(`/seller/returns` → `/user/profile?tool=…`)는 `?tool=` 을 지운 직후 리로드를 맞으면 시트가 안 열린다.
    //   배포본은 미리 묶인 파일이라 이 리로드가 없다 — 그래서 **리로드가 실제로 있었을 때만** 한 번 다시 연다.
    {
      const reloaded = () => devLog.slice(logMark).join('').includes('optimized dependencies changed')
      await page.getByText(expect1, { exact: false }).first().waitFor({ timeout: 8000 }).catch(() => {})
      if (reloaded() && (await page.getByText(expect1, { exact: false }).count().catch(() => 0)) === 0) {
        console.log(`   ♻️ [${name}] vite 의존성 재최적화 리로드가 있었다 — 한 번 다시 연다`)
        await page.goto(`${base}${path}`, { waitUntil: 'networkidle' })
      }
    }
    // ⏳ 2026-10-14: networkidle 직후 바로 세면 CI(콜드 vite dev)에서 화면이 아직 안 그려져 0 이 나왔다
    //   (10-12·10-14 같은 자리 두 번 — 재실행하면 통과). 글자가 뜰 때까지 기다린 뒤 센다. 판정 자체는 그대로다.
    await page.getByText(expect1, { exact: false }).first().waitFor({ timeout: 15000 }).catch(() => {})
    const seen = await page.getByText(expect1, { exact: false }).count().catch(() => 0)
    // 주석(::error)으로 읽히도록 실패 원인을 detail 에 함께 싣는다 — 잡 로그는 원격 세션이 못 읽는다.
    const where = seen ? '' : ` — 못 찾음 @ ${page.url()} :: ${(await page.evaluate(() => (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 200)).catch(() => '?'))} :: 토스트 ${JSON.stringify(await page.evaluate(() => window.__toasts || []).catch(() => []))} :: 시트 ${await page.locator('[role=dialog]').count().catch(() => -1)}`
    check(`[${name}] 렌더 + 런타임 에러 0`, seen > 0 && errs.length === 0, errs.length ? errs.join(' || ') : `"${expect1}" 확인${where}`)
    // 🔎 실패하면 그 자리에서 무엇이 떠 있었는지 남긴다 — CI 스크린샷은 꺼내기 어렵다(2026-10-14).
    if (!(seen > 0 && errs.length === 0)) {
      const diag = await page.evaluate(() => ({ url: location.pathname + location.search, text: (document.body?.innerText || '').replace(/\s+/g, ' ').slice(0, 400) })).catch((e) => ({ url: '?', text: String(e) }))
      console.log(`   🔎 vite(끝 15줄):\n${devLog.join('').split('\n').slice(-15).join('\n')}`)
      console.log(`   🔎 trace:\n${trace.filter((l) => !/vitals|\[vite\]|Download the React/.test(l)).slice(0, 45).map((l) => '     ' + l).join('\n')}`)
      console.log(`   🔎 vite 재최적화·리로드:\n${devLog.join('').split('\n').filter((l) => /optimiz|reload|dependenc|page reload/i.test(l)).slice(-15).join('\n')}`)
      console.log(`   🔎 url=${diag.url}\n   🔎 text=${diag.text}\n   🔎 errs=${JSON.stringify(errs.slice(0, 3))}`)
    }

    // 🔴 대시보드 라이트 고정 — 다크 클래스가 붙으면 정책 위반이다(check-dashboard-theme 의 렌더판).
    const isDark = await page.evaluate(() => document.documentElement.classList.contains('dark'))
    check(`[${name}] 다크 클래스 없음`, !isDark, isDark ? 'dark 붙음' : '라이트 고정')

    await page.screenshot({ path: `${OUT}/${path.replace(/\W+/g, '-').replace(/^-|-$/g, '')}.png`, fullPage: true })
    await page.close()
  }
  await sellerCtx.close()
} finally {
  await browser.close()
  if (dev) { try { process.kill(-dev.pid) } catch { dev.kill('SIGKILL') } }
}

writeFileSync(`${OUT}/result.json`, JSON.stringify(results, null, 2))
const failed = results.filter((r) => !r.pass)
console.log(`\n${failed.length === 0 ? '✅' : '❌'} ${results.length - failed.length}/${results.length} 통과`)
process.exit(failed.length === 0 ? 0 : 1)

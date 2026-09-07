#!/usr/bin/env node
/**
 * 🌓 다크 모드에서 **밝은 표면 위 밝은 글자**를 실제 렌더로 찾는다 (2026-09-03 신설)
 *
 * ■ 왜 만들었나 — 실제로 막혔던 일
 *   대표 신고: 지도 검색창(`urdeal.kr/map?q=부산`)에 친 글자가 **흰 배경 위에 흰색**이라 안 보였다.
 *   원인은 오타가 아니라 구조였다 — 전역 규칙 `.dark input:not(...)`(특이도 0,5,1)이
 *   `text-gray-900`(0,1,0)을 **언제나** 이긴다. 즉 코드는 맞게 썼는데 CSS 가 조용히 뒤집는다.
 *
 *   그리고 이 사고는 **점점 늘어날 수밖에 없는 구조**였다. 2026-09-02 에 지도 위 UI·홈 패널·티켓
 *   카드를 "테마와 무관하게 늘 흰 면"으로 바꿨는데, 전역 다크 규칙은 여전히
 *   "앱이 다크면 표면도 어둡다"를 전제한다. 늘 밝은 표면을 늘릴수록 어긋나는 자리가 늘어난다.
 *   대표가 정확히 그걸 짚었다: *"이런 경우 지금 많은 것 같은데 전수조사 필요해"*.
 *
 * ■ 왜 grep 이 아니라 렌더인가
 *   같은 className 안에 밝은 분기와 어두운 분기가 함께 있어(`panel ? A : B`) 문자열 검사로는
 *   구분이 안 된다. 실제로 이 사고를 grep 으로 찾으려다 **0건**이 나왔다(그 파일의 다른 분기에
 *   `dark:text-` 가 있어서 통과). 특이도 싸움의 승자는 브라우저만 안다 → 렌더해서 잰다.
 *
 * ■ 무엇을 재나
 *   다크 모드로 페이지를 띄우고, 보이는 모든 텍스트 노드에 대해
 *   **실제 글자색(getComputedStyle) vs 실제 뒤 배경색**(투명하면 조상을 타고 올라가 찾는다)의
 *   WCAG 대비를 계산해 3.0 미만이면 신고한다. 배경이 밝은데(휘도 0.5+) 글자도 밝은 경우만 —
 *   즉 "밝은 위 밝음". 어두운 위 어두움은 별개 문제라 여기서 안 본다.
 *
 * ■ 어디서 도는가
 *   `.github/workflows/dark-contrast.yml`(브라우저 필요 — 이 클래스를 건드리는 PR + 손으로 실행)
 *   + `audit-gate.sh`(dist/client 가 있을 때만). **`verify.yml` PR 게이트에는 넣지 않는다** —
 *   `render-smoke.yml` 주석이 정한 판단이다: 브라우저 검사는 느리고 환경에 민감해서, 간헐 실패가
 *   머지를 막으면 결국 가드를 꺼 버리게 된다.
 *
 * ■ 한계 (과신 금지)
 *   - 사진/그라디언트 위 글자는 배경색을 못 재서 건너뛴다(마스크·이미지는 계산 밖).
 *   - 시드로 못 그리는 화면(로그인 후 전용 등)은 그 경로를 안 돈다 → 경로 목록이 곧 범위다.
 *   - 포커스·호버·입력중 상태는 기본 상태만 잰다. 그래서 입력요소는 **값을 넣어** 잰다.
 */
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIST = path.join(ROOT, 'dist/client')

if (!fs.existsSync(DIST)) {
  console.log('⏭️  dark-contrast: dist/client 없음 — `npm run build` 후 실행 (skip)')
  process.exit(0)
}

/** 검사할 소비자 경로. 다크가 켜질 수 있는 화면만(대시보드는 라이트 고정이라 제외). */
const ROUTES = [
  // 지도 — 이번 사고가 난 자리
  { route: '/map?q=부산', name: '지도', fill: true },
  { route: '/map?q=부산', name: '지도(필터 시트)', fill: true, open: '[data-testid="open-filter"]' },
  { route: '/map', name: '지도(PC 패널)', pc: true, fill: true },
  // 홈 — 히어로가 사진 위 흰 글자라 픽셀 패스가 꼭 필요한 자리
  { route: '/', name: '홈(모바일)', fill: true },
  { route: '/', name: '홈(PC)', pc: true, fill: true },
  // 목록·카탈로그
  { route: '/vouchers', name: '교환권', fill: true },
  { route: '/vouchers', name: '교환권(PC)', pc: true, fill: true },
  { route: '/browse', name: '쇼핑', fill: true },
  { route: '/search', name: '검색', fill: true },
  { route: '/group-buy', name: '동네딜', fill: true },
  { route: '/stays', name: '숙소', fill: true },
  { route: '/blog', name: '블로그', fill: true },
  // 상세
  { route: '/group-buy/2846', name: '이용권 상세', fill: true },
  { route: '/group-buy/2846', name: '이용권 상세(PC)', pc: true, fill: true },
  // 유어샵
  { route: '/u/jiwon1228', name: '유어샵', fill: true },
  { route: '/u/jiwon1228', name: '유어샵(PC)', pc: true, fill: true },
  // 로그인 후 내 화면
  { route: '/user/profile', name: '마이', auth: 'user', fill: true },
  { route: '/user/profile', name: '마이(PC)', pc: true, auth: 'user', fill: true },
  { route: '/my-vouchers', name: '지갑', auth: 'user', fill: true },
  { route: '/my-orders', name: '주문내역', auth: 'user', fill: true },
  { route: '/cart', name: '장바구니', auth: 'user', fill: true },
  { route: '/notifications', name: '알림', auth: 'user', fill: true },
  { route: '/wishlist', name: '찜', auth: 'user', fill: true },
  { route: '/my-deal-history', name: '딜 내역', auth: 'user', fill: true },
  // 대외·정적
  { route: '/about', name: '소개', fill: true },
  { route: '/faq', name: 'FAQ', fill: true },
  { route: '/login', name: '로그인', fill: true },
]

const PORT = 8790

// dist/client 정적 서버 (visual-preview 와 같은 방식 — SPA 폴백)
const server = (await import('node:http')).createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0])
  let file = path.join(DIST, url)
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  const ext = path.extname(file)
  const type = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2' }[ext] || 'application/octet-stream'
  res.writeHead(200, { 'Content-Type': type })
  fs.createReadStream(file).pipe(res)
})
await new Promise((r) => server.listen(PORT, '127.0.0.1', r))

let chromium
try { ({ chromium } = await import('playwright')) } catch {
  console.log('⏭️  dark-contrast: playwright 없음 (skip)')
  server.close(); process.exit(0)
}
let exe = process.env.PW_CHROMIUM || ''
if (!exe) {
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers'
  try {
    const dir = fs.readdirSync(base).filter((d) => d.startsWith('chromium-')).sort().pop()
    if (dir) {
      for (const c of ['chrome-linux/chrome', 'chrome-linux/headless_shell']) {
        const p = path.join(base, dir, c)
        if (fs.existsSync(p)) { exe = p; break }
      }
    }
  } catch { /* 없으면 기본 탐색 */ }
}
/* 🛡️ 브라우저 바이너리가 없으면(설치 안 한 CI·로컬) **인프라 이유로 빨간불을 내지 않는다** —
   그러면 사람들이 가드를 꺼 버린다(`render-smoke.yml` 이 같은 이유로 PR 게이트가 아니다).
   대신 **크게 소리내고** 건너뛴다. 조용히 통과하면 "돌고 있다"고 착각하게 되는데, 그게 이 레포가
   반복해 당한 '헛도는 가드'다. 실제로 돌리려면 `npx playwright install chromium`. */
let browser
try {
  browser = await chromium.launch(exe ? { executablePath: exe } : {})
} catch (e) {
  console.log('⏭️  dark-contrast: chromium 을 못 띄웠다 — **검사하지 않았다**(통과가 아니다).')
  console.log(`   ${String(e).split('\n')[0]}`)
  console.log('   실행하려면: npx playwright install --with-deps chromium')
  server.close()
  process.exit(0)
}

/** 브라우저 안에서 도는 측정기 — 보이는 텍스트마다 글자색/배경색을 실제로 읽는다. */
const MEASURE = () => {
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[,/]/).map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  /* 뒤 배경: 투명하면 조상을 타고 올라간다.
     사진/그라디언트를 만나면 **포기하지 않고** 'PIXEL' 을 돌려준다 — 바깥에서 글자를 잠깐 투명하게
     만들고 그 자리를 스크린샷으로 찍어 진짜 픽셀을 잰다. 2026-09-03 1차판은 여기서 continue 해서
     **사진 위 흰 글자를 통째로 못 봤다**(우리 히어로가 정확히 그 형태다 — 가장 위험한 자리를
     검사에서 빼 놓고 "0건" 을 보고하고 있었던 셈). */
  const bgOf = (el) => {
    let n = el
    while (n && n !== document.documentElement) {
      const s = getComputedStyle(n)
      if (s.backgroundImage && s.backgroundImage !== 'none') return 'PIXEL'
      const c = parse(s.backgroundColor)
      if (c && c.a >= 0.85) return c
      n = n.parentElement
    }
    const c = parse(getComputedStyle(document.body).backgroundColor)
    return c && c.a >= 0.85 ? c : 'PIXEL'
  }
  const out = []
  const seen = new Set()
  const pixelQueue = []
  let measured = 0
  for (const el of document.querySelectorAll('body *')) {
    const tag = el.tagName.toLowerCase()
    if (['script', 'style', 'svg', 'path', 'noscript'].includes(tag)) continue
    const isField = ['input', 'textarea', 'select'].includes(tag)
    // 텍스트를 직접 갖고 있는 요소만(부모 중복 방지)
    const own = isField
      ? (el.value || el.getAttribute('value') || '')
      : Array.from(el.childNodes).filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join(' ')
    if (!own.trim()) continue
    const r = el.getBoundingClientRect()
    if (r.width < 4 || r.height < 4) continue
    const s = getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.15) continue
    const fg = parse(s.webkitTextFillColor && s.webkitTextFillColor !== 'currentcolor' ? s.webkitTextFillColor : s.color)
    if (!fg || fg.a < 0.35) continue
    const key = `${tag}|${own.slice(0, 40)}|${Math.round(r.top)}`
    if (seen.has(key)) continue
    seen.add(key)
    const info = {
      tag, isField,
      text: own.slice(0, 46),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 110),
      fg: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
      rect: { x: r.left, y: r.top, w: r.width, h: r.height },
    }
    const bg = bgOf(el)
    if (bg === 'PIXEL') {
      // 사진/그라디언트 위 — 바깥에서 픽셀로 잰다. 여기서 재는 척하고 넘기면 안 된다.
      el.setAttribute('data-dc-pixel', String(pixelQueue.length))
      pixelQueue.push({ ...info, fgRaw: fg })
      continue
    }
    measured++
    const cr = ratio(fg, bg)
    // 두 방향 다 본다: 밝은 위 밝음(이번 사고) · 어두운 위 어두움(같은 클래스의 반대 방향).
    if (cr >= 3.0) continue
    out.push({
      ...info,
      dir: lum(bg) >= 0.5 ? '밝은 표면 위 밝은 글자' : '어두운 표면 위 어두운 글자',
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      ratio: Math.round(cr * 100) / 100,
    })
  }
  return { rows: out, measured, pixelQueue }
}

/** 사진/그라디언트 위 글자를 **잠깐 투명하게** 만든다 — 그래야 그 자리의 배경 픽셀이 찍힌다. */
const HIDE_PIXEL_TEXT = () => {
  for (const el of document.querySelectorAll('[data-dc-pixel]')) {
    el.style.setProperty('color', 'transparent', 'important')
    el.style.setProperty('-webkit-text-fill-color', 'transparent', 'important')
    el.style.setProperty('text-shadow', 'none', 'important')
  }
}

/** 한 요소만 **지금 상태 그대로**(호버·포커스가 걸린 채) 잰다. */
const MEASURE_ONE = (sel) => {
  const el = document.querySelector(sel)
  if (!el) return null
  const parse = (c) => {
    const m = String(c).match(/rgba?\(([^)]+)\)/)
    if (!m) return null
    const p = m[1].split(/[,/]/).map((x) => parseFloat(x))
    return { r: p[0], g: p[1], b: p[2], a: p[3] === undefined ? 1 : p[3] }
  }
  const lum = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  const s = getComputedStyle(el)
  const fg = parse(s.webkitTextFillColor && s.webkitTextFillColor !== 'currentcolor' ? s.webkitTextFillColor : s.color)
  if (!fg || fg.a < 0.35) return null
  let n = el, bg = null
  while (n && n !== document.documentElement) {
    const cs = getComputedStyle(n)
    if (cs.backgroundImage && cs.backgroundImage !== 'none') return null // 사진 위는 픽셀 패스가 맡는다
    const c = parse(cs.backgroundColor)
    if (c && c.a >= 0.85) { bg = c; break }
    n = n.parentElement
  }
  if (!bg) bg = parse(getComputedStyle(document.body).backgroundColor)
  if (!bg || bg.a < 0.85) return null
  const cr = ratio(fg, bg)
  const own = Array.from(el.childNodes).filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join(' ')
  if (cr >= 3.0) return { bad: null }
  return {
    bad: {
      tag: el.tagName.toLowerCase(),
      text: (own || el.getAttribute('aria-label') || '').slice(0, 46),
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 110),
      dir: lum(bg) >= 0.5 ? '밝은 표면 위 밝은 글자' : '어두운 표면 위 어두운 글자',
      fg: `rgb(${Math.round(fg.r)},${Math.round(fg.g)},${Math.round(fg.b)})`,
      bg: `rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`,
      ratio: Math.round(cr * 100) / 100,
    },
  }
}

/* PNG 픽셀 읽기 — 의존성을 새로 들이지 않으려고 chromium 자신에게 디코딩을 시킨다
   (sharp/pngjs 를 추가하면 이 가드 하나 때문에 설치가 무거워진다). */
const SHOTDIR = fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'dc-'))
const shotPage = await (await browser.newContext()).newPage()
const readPng = async (file) => {
  const b64 = fs.readFileSync(file).toString('base64')
  return await shotPage.evaluate(async (data) => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + data
    await img.decode()
    const c = document.createElement('canvas')
    c.width = img.naturalWidth; c.height = img.naturalHeight
    c.getContext('2d').drawImage(img, 0, 0)
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height)
    return { w: c.width, h: c.height, data: Array.from(d.data) }
  }, b64)
}
const relLum = ({ r, g, b }) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
const contrast = (a, b) => { const [x, y] = [relLum(a), relLum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
/** 스크린샷에서 그 사각형의 평균 색 — 글자를 지운 상태로 찍었으니 이게 뒤 배경이다. */
const avgRect = (png, rect) => {
  const sx = Math.max(0, Math.round(rect.x)), sy = Math.max(0, Math.round(rect.y))
  const ex = Math.min(png.w, Math.round(rect.x + rect.w)), ey = Math.min(png.h, Math.round(rect.y + rect.h))
  if (ex <= sx || ey <= sy) return null
  let r = 0, g = 0, b = 0, n = 0
  for (let y = sy; y < ey; y += 2) {
    for (let x = sx; x < ex; x += 2) {
      const i = (y * png.w + x) * 4
      r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2]; n++
    }
  }
  return n ? { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) } : null
}

const findings = []
let measured = 0
for (const R of ROUTES) {
  const ctx = await browser.newContext({
    viewport: { width: R.pc ? 1440 : 430, height: 1400 },
    colorScheme: 'dark',
  })
  await ctx.route('**/*', (r) => (r.request().url().startsWith(`http://127.0.0.1:${PORT}`) ? r.continue() : r.abort()))
  await ctx.addInitScript(() => { try { localStorage.setItem('ur_theme_mode_v1', 'dark') } catch { /* private */ } })
  if (R.auth === 'user') {
    await ctx.addInitScript(() => {
      try {
        localStorage.setItem('user_id', '1'); localStorage.setItem('user_type', 'user')
        localStorage.setItem('user_handle', 'preview'); localStorage.setItem('user_name', '정지원')
      } catch { /* private */ }
    })
  }
  const page = await ctx.newPage()
  await page.goto(`http://127.0.0.1:${PORT}${R.route}`, { waitUntil: 'domcontentloaded', timeout: 40000 }).catch(() => {})
  await page.waitForTimeout(3500)
  // 시트/모달은 열어야 잰다 — 닫힌 화면만 보면 "0건"이 거짓 안심이 된다.
  if (R.open) {
    await page.click(R.open, { timeout: 4000 }).catch(() => {})
    await page.waitForTimeout(900)
  }
  // 입력요소는 **값이 있을 때** 글자색이 보인다 — 비어 있으면 placeholder 만 재게 된다.
  if (R.fill) {
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), textarea')) {
        if (!el.value) {
          const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')?.set
          setter?.call(el, '부산')
          el.dispatchEvent(new Event('input', { bubbles: true }))
        }
      }
    }).catch(() => {})
    await page.waitForTimeout(600)
  }
  const res = await page.evaluate(MEASURE).catch(() => ({ rows: [], measured: 0, pixelQueue: [] }))
  measured += res.measured || 0
  for (const r of (res.rows || [])) findings.push({ ...r, where: R.name, route: R.route })

  /* 🖼️ 사진/그라디언트 위 글자 — 계산으로는 배경색을 못 구한다. 글자를 잠깐 투명하게 만들고
     그 자리를 스크린샷으로 찍어 **진짜 픽셀의 평균 밝기**로 잰다. 우리 히어로가 정확히 이 형태라
     (사진 위 흰 글자) 여기를 안 보면 가장 위험한 자리를 빼놓고 "0건" 을 보고하게 된다. */
  const queue = res.pixelQueue || []
  if (queue.length) {
    await page.evaluate(HIDE_PIXEL_TEXT).catch(() => {})
    await page.waitForTimeout(250)
    const shotPath = path.join(SHOTDIR, `dc-${R.name.replace(/[^\w가-힣]+/g, '_')}.png`)
    await page.screenshot({ path: shotPath }).catch(() => {})
    if (fs.existsSync(shotPath)) {
      const png = await readPng(shotPath)
      for (const q of queue) {
        const avg = avgRect(png, q.rect)
        if (!avg) continue
        measured++
        const cr = contrast(q.fgRaw, avg)
        if (cr >= 3.0) continue
        findings.push({
          ...q, fgRaw: undefined,
          where: R.name, route: R.route,
          dir: relLum(avg) >= 0.5 ? '사진 위 밝은 글자' : '사진 위 어두운 글자',
          bg: `rgb(${avg.r},${avg.g},${avg.b}) (사진 평균)`,
          ratio: Math.round(cr * 100) / 100,
        })
      }
      fs.unlinkSync(shotPath)
    }
  }

  /* 🖱️ 호버·포커스 — 기본 상태만 보면 "누르려는 순간 사라지는 글자" 를 못 본다.
     hover: 로 색이 바뀌는 요소만 골라 실제로 마우스를 올리고 다시 잰다(전부 하면 느리다). */
  const hoverables = await page.evaluate(() => {
    const out = []
    let i = 0
    for (const el of document.querySelectorAll('a,button,[role="button"]')) {
      const cls = typeof el.className === 'string' ? el.className : ''
      if (!/hover:(text-|bg-)/.test(cls)) continue
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || r.top < 0 || r.top > innerHeight) continue
      if (!Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.textContent.trim())) continue
      el.setAttribute('data-dc-hover', String(i))
      out.push(i); i++
      if (i >= 12) break
    }
    return out
  }).catch(() => [])
  for (const i of hoverables) {
    const sel = `[data-dc-hover="${i}"]`
    await page.hover(sel, { timeout: 1500 }).catch(() => {})
    const hit = await page.evaluate(MEASURE_ONE, sel).catch(() => null)
    if (hit) { measured++; if (hit.bad) findings.push({ ...hit.bad, where: `${R.name} (호버)`, route: R.route }) }
  }
  const focusables = await page.evaluate(() => {
    const out = []
    let i = 0
    for (const el of document.querySelectorAll('a,button,input,textarea,select,[tabindex]')) {
      const r = el.getBoundingClientRect()
      if (r.width < 8 || r.height < 8 || r.top < 0 || r.top > innerHeight) continue
      el.setAttribute('data-dc-focus', String(i)); out.push(i); i++
      if (i >= 12) break
    }
    return out
  }).catch(() => [])
  for (const i of focusables) {
    const sel = `[data-dc-focus="${i}"]`
    await page.focus(sel, { timeout: 1500 }).catch(() => {})
    const hit = await page.evaluate(MEASURE_ONE, sel).catch(() => null)
    if (hit) { measured++; if (hit.bad) findings.push({ ...hit.bad, where: `${R.name} (포커스)`, route: R.route }) }
  }

  await ctx.close()
}
await browser.close()
server.close()
try { fs.rmSync(SHOTDIR, { recursive: true, force: true }) } catch { /* 임시 디렉터리 */ }

/* 🛡️ 측정 대상이 0이면 **통과가 아니라 실패**로 본다. 렌더가 깨졌거나(시드 실패·라우트 삭제)
   측정기가 헛돌면 findings 도 0 이라 초록불이 되는데, 그게 이 레포가 반복해 당한 사고다
   (check-guard-registry 가 명시한 "등록은 됐는데 늘 통과하는 가드"). */
if (measured < 200) {
  console.log(`❌ dark-contrast: 측정된 텍스트가 ${measured}개뿐 — 렌더가 깨졌거나 측정기가 헛돈다(통과 아님).`)
  process.exit(1)
}

const BASELINE = path.join(ROOT, 'scripts/dark-contrast-baseline.json')
const known = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { allow: [] }
const sig = (f) => `${f.where}|${f.tag}|${f.text}`
const fresh = findings.filter((f) => !known.allow.includes(sig(f)))

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(findings, null, 1))
  process.exit(0)
}

if (fresh.length === 0) {
  console.log(`✅ dark-contrast: 다크에서 안 보이는 글자 0건 (${ROUTES.length}개 경로 실제 렌더 측정, 텍스트 ${measured}개)`)
  process.exit(0)
}
console.log(`❌ dark-contrast: 다크에서 안 보이는 글자 ${fresh.length}건\n`)
for (const f of fresh) {
  console.log(`   ${f.where} (${f.route})`)
  console.log(`     <${f.tag}> "${f.text}"  대비 ${f.ratio}:1  (${f.dir})`)
  console.log(`     글자 ${f.fg} / 배경 ${f.bg}`)
  if (f.cls) console.log(`     class: ${f.cls}`)
  console.log('')
}
console.log('   수정: 그 표면이 "늘 밝은" 자리면 조상에 `light-island` 를 붙인다(전역 .dark 규칙을 끈다).')
console.log('   의도적 예외는 scripts/dark-contrast-baseline.json 의 allow 에 등록.')
process.exit(process.env.STRICT_DARK_CONTRAST === '1' ? 1 : 0)

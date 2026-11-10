/**
 * 🎨 첫 화면 전용 CSS 생성기 (2026-10-14 — 대표 신고: 구글 검색으로 들어가니 빈 화면이 *"2초는 넘게"*).
 *
 * ## 무엇이 느렸나
 *   서버가 그리는 첫 화면(홈·이용권 상세·교환권 상세·유어샵 · 폰)은 스크립트 없이 보인다. 그런데 그 HTML 이
 *   도착해도 **렌더를 막는 앱 CSS(원본 286KB · 전송 37KB)** 가 다 와야 그려진다. 그 CSS 는 앱 **전체**의
 *   클래스이고 첫 화면이 쓰는 건 일부다.
 *   ⇒ 첫 화면을 그리는 모듈이 쓰는 클래스만으로 CSS 를 따로 만들어(원본 ~48KB · gzip ~10KB) HTML 에 넣고,
 *     앱 CSS 는 렌더를 막지 않게 받는다(`css-first-boot.ts` — 스크립트는 여전히 앱 CSS 가 온 뒤에 출발한다).
 *   A/B(라이브 HTML · 느린 4G·CPU 4배 · 5회 중앙값): HTML 도착 → 내용 표시 **1.49 → 1.15초**.
 *
 * ## 어떻게 고르나 — 손으로 목록을 적지 않는다
 *   `ROOTS`(워커가 `#root` 첫 화면을 그리는 모듈) 에서 **상대 import 를 따라간 폐쇄** 전체를 Tailwind content 로 준다.
 *   Tailwind 는 원래도 소스의 글자 그대로를 보고 클래스를 만들므로, 첫 화면 HTML 의 클래스가 앱 CSS 에 있다면
 *   그 글자는 이 폐쇄 어딘가에 있다(상수 파일까지 따라가는 이유). 워커의 정적 로더(`urdealLoaderHtml`)는
 *   `worker/index.ts` 에서 그 블록만 떼어 넣는다(파일 전체를 넣으면 봇 셸 등 무관한 클래스가 딸려 온다).
 *   🔒 시험(`critical-css-2026-10-14.test.ts`)이 워커가 import 하는 첫 화면 모듈이 전부 ROOTS 에 있는지 대조한다.
 *
 * ## 산출물
 *   `src/worker/generated/critical-css.build.ts` — **추적 안 함**(2026-11-03). 추적되는 `critical-css.ts` 는 빈 자리표시자이고
 *   워커 빌드가 번들할 때 바꿔 끼운다(`scripts/critical-css-plugin.cjs`). 종전엔 커밋해서 머지마다 충돌했다.
 *   첫 화면 모듈을 고쳐도 **커밋할 것이 없다** — 빌드(`build:worker`)가 매번 다시 만든다.
 *   생성 실패는 빌드 실패다 — 조용히 빈 값을 내면 첫 화면이 스타일 없이 그려진다(그 반대는 없다:
 *   빈 값이면 워커가 이 기능을 끄고 종전처럼 앱 CSS 로 막는다 — `css-first-boot.ts`).
 */
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// postcss·tailwind·esbuild 는 생성할 때만 불러온다 — 시험(jsdom)이 ROOTS·폐쇄 계산만 import 할 수 있게.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
// 🎨 2026-11-03 — **추적 안 하는 파일로 쓴다**(추적 파일은 자리표시자 — scripts/critical-css-plugin.cjs 가 번들할 때 바꿔 끼운다).
//   종전엔 59KB 한 줄을 커밋해 동시에 고친 PR 끼리 무조건 충돌했다(3일 머지 109건 중 16건).
export const CRITICAL_CSS_BUILD = join(ROOT, 'src/worker/generated/critical-css.build.ts')
const OUT = CRITICAL_CSS_BUILD

/** 워커가 `#root` 에 첫 화면을 그리는 모듈 — 시험이 worker/index.ts 의 import 와 대조한다. */
export const ROOTS = [
  'src/worker/utils/home-first-screen.ts',
  'src/worker/utils/detail-ssr-body.ts',
  'src/worker/utils/voucher-detail-ssr-body.ts',
  'src/worker/utils/curator-ssr-body.ts',
  'src/worker/utils/stay-detail-ssr-body.ts',
  'src/worker/utils/vouchers-first-screen.ts',
  'src/worker/utils/stays-first-screen.ts',
  'src/worker/utils/blog-detail-first-screen.ts',
  'src/worker/utils/blog-list-first-screen.ts',
  'src/worker/utils/guest-first-screen.ts',
  'src/worker/utils/life-first-screen.ts', // 🏠 2026-11-08
  'src/worker/utils/region-first-screen.ts', // 🗺️ 2026-11-08
  'src/worker/utils/pc-home-first-screen.ts', // 🖥️ 2026-11-09 PC 홈(shared/pc-home-first-screen 은 import 로 따라온다)
  'src/worker/utils/urshorts-first-screen.ts', // 🎬 2026-11-09 유어쇼츠 목록
  'src/worker/utils/map-first-screen.ts', // 🗺️ 2026-11-09 지도 껍데기
  'src/worker/utils/search-first-screen.ts', // 🔎 2026-11-10 검색 헤더·빈 검색 안내
  'src/worker/utils/faq-first-screen.ts', // ❓ 2026-11-10 자주 묻는 질문 전체
  'src/worker/utils/notifications-first-screen.ts', // 🔔 2026-11-10 알림 머리줄(세션 있을 때만)
  'src/worker/utils/cart-first-screen.ts', // 🧺 2026-11-10 장바구니 머리줄
  'src/worker/utils/landing-first-screen.ts', // 🧭 2026-11-10 안내 랜딩 셋 머리줄 + 사진 칸
]

/**
 * 🧱 2026-11-09 대표 승인("가장 이상적으로") — 상한을 **표면별**로 옮겼다.
 *   종전엔 전체판(모든 첫 화면 폐쇄의 합) 하나에 70,000B 상한이었다. 그런데 손님 HTML 에 실제로 실리는 것은
 *   **표면 하나의 CSS**(`CRITICAL_CSS_SURFACES[k]`, 20~38KB)이고 전체판은 표면 항목이 빠졌을 때의 폴백뿐이다.
 *   첫 화면이 14개가 되자 전체판이 69,8xxB 로 상한에 닿아 **새 첫 화면(PC 상세·PC 교환권…)을 못 더하는** 상황이 됐는데,
 *   그 상한이 지키려던 것("한 화면에 너무 많은 CSS 를 인라인하지 않는다")은 표면 상한이 더 정확히 지킨다.
 *   - `CRITICAL_SURFACE_MAX_BYTES` 40,000: 표면 하나(=손님이 실제로 받는 인라인 CSS)의 하드 상한. 가장 큰 표면(지도 38,0xx)이 기준.
 *   - `CRITICAL_CSS_MAX_BYTES` 160,000: 전체판의 **정신 건강 상한**(어떤 모듈이 앱 CSS 를 통째로 끌고 오는 사고만 잡는다).
 *   가드 `critical-css-2026-10-14.test.ts` 가 두 값과 모든 표면 크기를 대조한다. 기록: docs/locks/loading/2026-11-09-critical-css-cap-per-surface.md
 */
export const CRITICAL_CSS_MAX_BYTES = 160_000
/** 표면 하나(손님 HTML 에 실제로 인라인되는 CSS)의 원본 바이트 상한 — 넘으면 빌드 실패. */
export const CRITICAL_SURFACE_MAX_BYTES = 40_000

/** 대시보드 전용 껍데기 클래스 — 첫 화면엔 없다. 그 클래스만 겨냥한 규칙은 뺀다. */
const DASHBOARD_ONLY = /\.(?:admin|seller|agency)-light-theme\b/

/**
 * 셀렉터에서 `:not(…)` 를 걷어 낸 나머지 — 🩸 다크 변형은 `…:not(.admin-light-theme *)` 처럼 대시보드 클래스를
 *   **제외 조건**으로 품는다. 그걸 그대로 검사했더니 다크 규칙이 **전부** 대시보드 전용으로 오판돼 지워졌다(시험이 잡았다).
 */
export function positivePart(selector) {
  let out = '', depth = 0
  for (let i = 0; i < selector.length; i++) {
    if (depth === 0 && selector.startsWith(':not(', i)) { depth = 1; i += 4; continue }
    if (depth > 0) { if (selector[i] === '(') depth++; else if (selector[i] === ')') depth--; continue }
    out += selector[i]
  }
  return out
}

function resolveImport(from, spec) {
  const base = resolve(dirname(from), spec)
  for (const ext of ['.ts', '.tsx', '/index.ts', '/index.tsx', '']) {
    const p = base + ext
    if (existsSync(p) && statSync(p).isFile()) return p
  }
  return null
}

/** ROOTS 에서 상대 import(정적 import · re-export)를 따라간 폐쇄. */
export function importClosure(roots = ROOTS, root = ROOT) {
  const seen = new Set()
  const walk = (f) => {
    if (seen.has(f)) return
    seen.add(f)
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(/(?:import|export)\s[^'"]*?from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
      const r = resolveImport(f, m[1])
      if (r) walk(r)
    }
  }
  for (const r of roots) walk(join(root, r))
  return [...seen].map((f) => relative(root, f)).sort()
}

/** worker/index.ts 의 정적 로더 HTML 블록만 떼어 낸다. 못 찾으면 던진다(조용히 빠지면 로더가 스타일 없이 뜬다). */
export function loaderBlock(root = ROOT) {
  const s = readFileSync(join(root, 'src/worker/index.ts'), 'utf8')
  const i = s.indexOf('const urdealLoaderHtml =')
  const j = i < 0 ? -1 : s.indexOf("'</div>';", i)
  if (i < 0 || j < 0) throw new Error('[critical-css] worker/index.ts 에서 urdealLoaderHtml 블록을 못 찾음')
  return s.slice(i, j + 9)
}

export async function generateCriticalCss() {
  const { default: postcss } = await import('postcss')
  const { default: tailwindcss } = await import('tailwindcss')
  const { default: autoprefixer } = await import('autoprefixer')
  const { transform } = await import('esbuild')
  const files = importClosure()
  const twBase = (await import(pathToFileURL(join(ROOT, 'tailwind.config.js')).href)).default
  const config = {
    ...twBase,
    content: [
      join(ROOT, 'index.html'),
      ...files.map((f) => join(ROOT, f)),
      { raw: loaderBlock(), extension: 'html' },
    ],
  }
  const input = readFileSync(join(ROOT, 'src/index.css'), 'utf8')
  const out = await postcss([
    tailwindcss(config),
    autoprefixer(),
    // 대시보드 껍데기 전용 규칙 제거(셀렉터가 **전부** 그쪽일 때만 — 섞인 규칙은 남긴다).
    {
      postcssPlugin: 'drop-dashboard-only',
      Rule(rule) {
        if (rule.selectors?.length && rule.selectors.every((s) => DASHBOARD_ONLY.test(positivePart(s)))) rule.remove()
      },
    },
  ]).process(input, { from: join(ROOT, 'src/index.css') })
  const { code } = await transform(out.css, { loader: 'css', minify: true })
  const css = code.trim()
  if (!css) throw new Error('[critical-css] 결과가 비었다')
  if (/<\/style/i.test(css)) throw new Error('[critical-css] </style 가 들어 있다 — 인라인 불가')
  if (css.length > CRITICAL_CSS_MAX_BYTES) {
    throw new Error(`[critical-css] ${css.length}B > 상한 ${CRITICAL_CSS_MAX_BYTES}B — 첫 화면 모듈이 무관한 클래스를 끌고 왔는지 확인`)
  }
  return { css, files }
}

/**
 * 🏠 2026-11-05 대표 *"그냥 구글이나 브라우저에서 urdeal.kr 들어가면 느린거"* — **홈 전용** 첫 화면 CSS.
 *   실측(라이브 홈 HTML): `<head>` 101KB 중 첫 화면 CSS 가 **62KB** — 첫 화면 열 개(홈·상세·교환권·유어샵·블로그…)를
 *   한 벌로 합쳐서다. 홈 내용(`#root`)은 압축 24KB 지점에서야 시작한다(폰의 첫 왕복은 약 14KB). 홈이 쓰는 것만 남기면 절반.
 *   규칙을 고르는 법: 셀렉터의 클래스가 **홈 폐쇄 소스(+ index.html · 로더)에 글자로 하나도 없으면** 그 규칙은 홈 첫 화면에서
 *   맞을 수 없다 → 뺀다. 부분 문자열로 보므로 보수적이다(애매하면 남는다). 클래스 없는 규칙(:root·*·html)은 남는다.
 */
export const HOME_ROOTS = ['src/worker/utils/home-first-screen.ts', 'src/worker/utils/pc-home-first-screen.ts'] // 🖥️ 2026-11-09 PC 홈도 같은 `/` — 홈판에 PC 첫 화면 클래스가 있어야 PC 가 첫 페인트에 배너를 그린다

/**
 * 🧩 2026-11-08 대표 *"1~5 모두 진행"* — 홈과 같은 처방을 **첫 화면이 있는 모든 표면**에. 표면 → 그 표면을 그리는 ROOT.
 *   워커는 `css-first-boot.ts` `criticalSurfaceOf(pathname)` 으로 같은 이름을 고른다(시험이 두 목록을 대조한다).
 */
export const SURFACE_ROOTS = {
  home: ['src/worker/utils/home-first-screen.ts', 'src/worker/utils/pc-home-first-screen.ts'],
  detail: ['src/worker/utils/detail-ssr-body.ts'],
  voucherDetail: ['src/worker/utils/voucher-detail-ssr-body.ts'],
  curator: ['src/worker/utils/curator-ssr-body.ts'],
  stayDetail: ['src/worker/utils/stay-detail-ssr-body.ts'],
  vouchers: ['src/worker/utils/vouchers-first-screen.ts'],
  stays: ['src/worker/utils/stays-first-screen.ts'],
  blogDetail: ['src/worker/utils/blog-detail-first-screen.ts'],
  blogList: ['src/worker/utils/blog-list-first-screen.ts'],
  guest: ['src/worker/utils/guest-first-screen.ts'],
  life: ['src/worker/utils/life-first-screen.ts'],
  region: ['src/worker/utils/region-first-screen.ts'],
  urshorts: ['src/worker/utils/urshorts-first-screen.ts'], // 🎬 2026-11-09
  map: ['src/worker/utils/map-first-screen.ts'], // 🗺️ 2026-11-09
  search: ['src/worker/utils/search-first-screen.ts'], // 🔎 2026-11-10
  faq: ['src/worker/utils/faq-first-screen.ts'], // ❓ 2026-11-10
  notifications: ['src/worker/utils/notifications-first-screen.ts'], // 🔔 2026-11-10
  cart: ['src/worker/utils/cart-first-screen.ts'], // 🧺 2026-11-10
  landing: ['src/worker/utils/landing-first-screen.ts'], // 🧭 2026-11-10
}

/** 셀렉터의 클래스 이름들(이스케이프 해제) — `:not(…)` 안은 제외 조건이라 보지 않는다. */
export function selectorClasses(sel) {
  return [...positivePart(sel).matchAll(/\.((?:\\.|[A-Za-z0-9_-])+)/g)].map((m) => m[1].replace(/\\(.)/g, '$1'))
}

export async function purgeUnusedRules(css, content) {
  const { default: postcss } = await import('postcss')
  const root = postcss.parse(css)
  root.walkRules((r) => {
    if (r.parent?.type === 'atrule' && /keyframes/i.test(r.parent.name)) return
    const live = (r.selectors || []).filter((s) => selectorClasses(s).every((c) => content.includes(c)))
    if (live.length === 0) r.remove()
    else if (live.length < r.selectors.length) r.selectors = live
  })
  root.walkAtRules((a) => { if (a.nodes && a.nodes.length === 0) a.remove() })
  const { transform } = await import('esbuild')
  return (await transform(root.toString(), { loader: 'css', minify: true })).code.trim()
}

/**
 * 앱이 **실행 중에** 붙이는 클래스(`classList.add|toggle('…')` — 다크 · 키보드 열림 · PC 전체폭 …).
 *   첫 화면 소스에는 안 나오지만 그 클래스를 조건으로 한 규칙은 첫 화면에서도 맞을 수 있다 → 남긴다.
 *   손으로 적지 않고 소스에서 모은다(새로 생겨도 저절로 들어온다).
 */
export function runtimeClasses(root = ROOT) {
  const out = new Set()
  const walk = (d) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f)
      if (statSync(p).isDirectory()) { if (!/tests|generated|node_modules/.test(f)) walk(p); continue }
      if (!/\.(tsx?|html)$/.test(f)) continue
      for (const m of readFileSync(p, 'utf8').matchAll(/classList\.(?:add|toggle|replace)\(\s*['"]([A-Za-z0-9_-]+)['"]/g)) out.add(m[1])
    }
  }
  walk(join(root, 'src'))
  for (const m of readFileSync(join(root, 'index.html'), 'utf8').matchAll(/classList\.(?:add|toggle|replace)\(\s*['"]([A-Za-z0-9_-]+)['"]/g)) out.add(m[1])
  return [...out].sort()
}

/**
 * 🎨 2026-11-09 토큰판 — 전체판에서 **변수 선언 규칙만**(`:root{…}` · `.dark,[data-theme=dark]{…}`) 뽑는다.
 *   🩸 왜: 로더-먼저 표면(검색·장바구니·뷰어 …)은 첫 화면 CSS 를 안 넣는데(2026-11-09), 로더 마크업은
 *   `var(--brand)`·`var(--rule)` 로 색을 받는다. 변수가 없으면 로더가 **투명**이라 첫 그림이 0 이고 — 라이브 실측(배포 뒤):
 *   `/cart` HTML 0.18s · 첫 그림 2.1s(앱이 그린 것). "로더가 먼저 보인다" 는 설계가 변수 한 벌이 없어 한 번도 안 보였다.
 *   토큰판은 2~3KB 라 모든 로더-먼저 표면에 넣는다.
 */
export function tokensCssOf(fullCss) {
  const out = []
  const re = /(?<=^|\})\s*((?::root|\.dark,\[data-theme=dark\]|\[data-theme=dark\],\.dark)\s*\{[^}]*\})/g // 앞의 `}` 를 소비하지 않는다(연달아 선 두 블록의 둘째가 빠졌다)
  for (const m of fullCss.matchAll(re)) out.push(m[1])
  return out.join('')
}

export async function generateSurfaceCriticalCss(fullCss, roots) {
  const content = importClosure(roots).map((f) => readFileSync(join(ROOT, f), 'utf8')).join('\n') +
    readFileSync(join(ROOT, 'index.html'), 'utf8') + loaderBlock() + '\n' + runtimeClasses().join(' ')
  return purgeUnusedRules(fullCss, content)
}
export async function generateHomeCriticalCss(fullCss) {
  return generateSurfaceCriticalCss(fullCss, HOME_ROOTS)
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const { css, files } = await generateCriticalCss()
  const surfaces = {}
  for (const [k, roots] of Object.entries(SURFACE_ROOTS)) {
    const v = await generateSurfaceCriticalCss(css, roots)
    if (!v || v.length >= css.length) throw new Error(`[critical-css] ${k} 전용 CSS 가 비었거나 전체보다 크다`)
    if (v.length > CRITICAL_SURFACE_MAX_BYTES) throw new Error(`[critical-css] ${k} 표면 CSS ${v.length}B > 표면 상한 ${CRITICAL_SURFACE_MAX_BYTES}B — 그 첫 화면 모듈이 무관한 클래스를 끌고 왔는지 확인`)
    surfaces[k] = v
  }
  const home = surfaces.home
  const tokens = tokensCssOf(css)
  if (!tokens.includes('--brand') || !tokens.includes('--rule') || !/\.dark/.test(tokens)) throw new Error('[critical-css] 토큰판에 --brand/--rule/.dark 가 없다 — 로더가 보이지 않게 된다')
  if (tokens.length > 4000) throw new Error(`[critical-css] 토큰판 ${tokens.length}B > 4000B — :root 가 비대해졌다`)
  mkdirSync(dirname(OUT), { recursive: true })
  const body =
    '// ⚠️ AUTO-GENERATED — scripts/generate-critical-css.mjs 가 빌드 때 만든다. 추적 안 함 · 수동 편집 금지.\n' +
    `// 첫 화면 전용 CSS — 폐쇄 ${files.length}개 파일 · ${css.length}B. 워커가 첫 화면 표면에서 <style> 로 넣는다.\n` +
    `export const CRITICAL_CSS: string = ${JSON.stringify(css)}\n` +
    `// 🏠 홈(/) 전용 — ${home.length}B\n` +
    `export const CRITICAL_CSS_HOME: string = ${JSON.stringify(home)}\n` +
    `// 🧩 표면별 — ${Object.entries(surfaces).map(([k, v]) => `${k} ${v.length}B`).join(' · ')}\n` +
    `export const CRITICAL_CSS_SURFACES: Record<string, string> = ${JSON.stringify(surfaces)}\n` +
    `// 🎨 토큰판(:root · .dark 변수만) — ${tokens.length}B. 첫 화면이 없는 로더-먼저 표면에서 로더의 var(--brand/--rule) 가 값을 갖게.\n` +
    `export const CRITICAL_CSS_TOKENS: string = ${JSON.stringify(tokens)}\n`
  const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (prev !== body) writeFileSync(OUT, body)
  console.log(`✅ critical-css: ${css.length}B · ${Object.entries(surfaces).map(([k, v]) => `${k} ${v.length}`).join(' · ')} (${files.length} files)${prev === body ? ' — 변경 없음' : ''}`)
}

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
 *   `src/worker/generated/critical-css.ts` — 결정적(같은 소스 = 같은 바이트)이라 **커밋한다**.
 *   첫 화면 모듈을 고친 커밋은 이 파일도 같이 바뀐다(pre-commit 워커 빌드가 다시 만든다).
 *   생성 실패는 빌드 실패다 — 조용히 빈 값을 내면 첫 화면이 스타일 없이 그려진다(그 반대는 없다:
 *   빈 값이면 워커가 이 기능을 끄고 종전처럼 앱 CSS 로 막는다 — `css-first-boot.ts`).
 */
import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve, relative } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
// postcss·tailwind·esbuild 는 생성할 때만 불러온다 — 시험(jsdom)이 ROOTS·폐쇄 계산만 import 할 수 있게.

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'src/worker/generated/critical-css.ts')

/** 워커가 `#root` 에 첫 화면을 그리는 모듈 — 시험이 worker/index.ts 의 import 와 대조한다. */
export const ROOTS = [
  'src/worker/utils/home-first-screen.ts',
  'src/worker/utils/detail-ssr-body.ts',
  'src/worker/utils/voucher-detail-ssr-body.ts',
  'src/worker/utils/curator-ssr-body.ts',
  'src/worker/utils/stay-detail-ssr-body.ts',
  'src/worker/utils/vouchers-first-screen.ts',
]

/** 원본 바이트 상한 — 넘으면 빌드 실패(첫 화면 CSS 가 앱 CSS 를 닮아 가면 이 일의 의미가 없다). */
export const CRITICAL_CSS_MAX_BYTES = 70_000

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

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (isMain) {
  const { css, files } = await generateCriticalCss()
  mkdirSync(dirname(OUT), { recursive: true })
  const body =
    '// ⚠️ AUTO-GENERATED — scripts/generate-critical-css.mjs. 수동 편집 금지(결정적 산출물이라 커밋한다).\n' +
    `// 첫 화면 전용 CSS — 폐쇄 ${files.length}개 파일 · ${css.length}B. 워커가 첫 화면 표면에서 <style> 로 넣는다.\n` +
    `export const CRITICAL_CSS: string = ${JSON.stringify(css)}\n`
  const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : ''
  if (prev !== body) writeFileSync(OUT, body)
  console.log(`✅ critical-css: ${css.length}B (${files.length} files)${prev === body ? ' — 변경 없음' : ''}`)
}

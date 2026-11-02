/**
 * 📏 화면별 첫 화면 무게 래칫 (2026-10-14) — 근거는 `scripts/check-surface-budgets.mjs` 머리말.
 *   대표 *"대기업 수준 — 기능이 늘어나도 최적화된 상태여야"*. 지금까지 예산은 헐거운 선이라
 *   상세·지도 봉투에 30KB 가 붙어도 PR 이 초록이었다.
 *
 * 고정하는 것:
 *   ① 측정 범위 — 엔트리 폐쇄 + CSS + 화면 봉투(엔트리와 겹치는 건 한 번만)
 *   ② 판정 — 늘면 실패 · 줄면 '잠그라' 실패 · 새 화면/사라진 화면 실패 · 허용오차 안은 통과
 *   ③ 배선 — verify(빌드 뒤) · main 예산 워크플로 · 기준 파일이 실제 화면 목록을 덮는다
 * ⚠️ 못 막는 것: 이미지·API · 진입점 목록 밖 화면. (실행 비용은 2026-10-14 `check-exec-cost` 가, 대시보드는 같은 날 dash:* 로 편입)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { surfacesFrom, judge, routeSurfacesFrom, mapSubsetErrors, TOLERANCE_KB, LOCK_SLACK_KB, nextBaselineDoc, historyFileName } from '../../../scripts/check-surface-budgets.mjs'
import { DASHBOARD_SURFACES } from '../../../scripts/dashboard-surfaces.mjs'

const HTML = `<script type="module" crossorigin src="/assets/index-AAAAAAAA.js"></script>
<link rel="modulepreload" crossorigin href="/assets/react-core-BBBBBBBB.js">
<link rel="stylesheet" crossorigin href="/assets/index-CCCCCCCC.css">`
const MAP = `export const ROUTE_CHUNK_MAP: Record<string, { js: string[]; css: string[] }> = {
  "gbDetail": { "js": ["/assets/GroupBuyDetailPage-DDDDDDDD.js", "/assets/react-core-BBBBBBBB.js"], "css": [] }
}`

describe('① 측정 범위', () => {
  const r = surfacesFrom(HTML, MAP)
  it('엔트리·modulepreload·CSS 를 boot 로 센다', () => {
    expect(r.bootCount).toBe(2)
    expect(r.cssCount).toBe(1)
    expect(r.surfaces.__boot__.sort()).toEqual(['/assets/index-AAAAAAAA.js', '/assets/index-CCCCCCCC.css', '/assets/react-core-BBBBBBBB.js'])
  })
  it('화면 = boot + 봉투, 엔트리와 겹치는 청크는 한 번만', () => {
    const g = r.surfaces.gbDetail
    expect(g).toContain('/assets/GroupBuyDetailPage-DDDDDDDD.js')
    expect(g).toContain('/assets/index-CCCCCCCC.css')
    expect(g.filter((f) => f.includes('react-core')).length).toBe(1)
  })
})

describe('② 판정', () => {
  const base = { surfaces: { a: { totalKB: 100, chunks: { 'x.js': 60, 'y.js': 40 } } } }
  const m = (t: number, chunks: Record<string, number> = { 'x.js': t - 40, 'y.js': 40 }) => ({ a: { totalKB: t, chunks } })
  it('허용오차 안은 통과', () => {
    expect(judge(m(100 + TOLERANCE_KB - 0.1), base)).toEqual([])
    expect(judge(m(100 - LOCK_SLACK_KB + 0.1), base)).toEqual([])
  })
  it('늘면 실패하고 늘어난 청크 이름을 댄다', () => {
    const e = judge(m(110, { 'x.js': 60, 'y.js': 40, 'new.js': 10 }), base)
    expect(e.map((x) => x.kind)).toEqual(['grew'])
    expect(e[0].msg).toContain('new.js +10.0')
  })
  it('줄었는데 안 잠그면 실패', () => {
    expect(judge(m(90), base).map((x) => x.kind)).toEqual(['slack'])
  })
  it('새 화면 · 사라진 화면은 실패', () => {
    expect(judge({ ...m(100), b: { totalKB: 1, chunks: {} } }, base).map((x) => x.kind)).toEqual(['new'])
    expect(judge({}, base).map((x) => x.kind)).toEqual(['gone'])
  })
})

describe('③ 배선', () => {
  const read = (p: string) => readFileSync(p, 'utf8')
  it('verify.yml 이 build:worker 뒤에 돌린다', () => {
    const y = read('.github/workflows/verify.yml')
    // 🔁 2026-10-16 재조준: 같은 이유(ci-run 래퍼) — 불변식은 build:worker 뒤라는 순서다.
    const run = y.indexOf('scripts/check-surface-budgets.mjs')
    expect(run).toBeGreaterThan(y.indexOf('run: npm run build:worker'))
    expect(y.slice(run - 300, run)).not.toMatch(/continue-on-error:\s*true/)
  })
  it('main 예산 워크플로도 돌린다', () => {
    expect(read('.github/workflows/bundle-budget-main.yml')).toContain('node scripts/check-surface-budgets.mjs')
  })
  it('기준 파일이 하드로드 화면 전부 + 대시보드·마이(dash:*) + __boot__ 를 덮고 값이 0 이 아니다', () => {
    const b = JSON.parse(read('scripts/surface-budgets.json'))
    // 하드로드 화면 목록 = 생성기의 ROUTES 키(그 파일은 .mjs 라 소스에서 키를 읽는다)
    const gen = read('scripts/generate-route-chunk-map.mjs')
    // 🐢 2026-10-15: preload 전용 표(`PRELOAD_ONLY_ROUTES`)도 워커가 미리받게 하는 화면이다 — 둘 다 센다.
    const block = (name: string) => gen.slice(gen.indexOf(`export const ${name} = {`), gen.indexOf('\n}', gen.indexOf(`export const ${name} = {`)))
    const body = block('ROUTES') + block('PRELOAD_ONLY_ROUTES')
    const keys = [...body.matchAll(/^  (\w+): \[/gm)].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(5)
    // 🧰 2026-10-14: 대시보드·마이는 route-chunk-map 밖이라 `dashboard-surfaces.mjs` 에서 온다(dash:<키>).
    const dash = Object.keys(DASHBOARD_SURFACES).map((k) => `dash:${k}`)
    expect(dash.length).toBeGreaterThanOrEqual(3)
    const want = ['__boot__', ...keys, ...dash].sort()
    expect(Object.keys(b.surfaces).sort()).toEqual(want)
    for (const v of Object.values(b.surfaces) as Array<{ totalKB: number }>) expect(v.totalKB).toBeGreaterThan(50)
    expect(b.toleranceKB).toBe(TOLERANCE_KB)
  })
})

/**
 * ④ 손님 화면은 정적 폐쇄로 잰다 (2026-10-18) — 미리받기 맵은 js 를 10개에서 잘라서, 11번째부터는 무게 예산에서도 안 보였다.
 *    그 상한이 #1912 에서 '아무것도 안 늘었는데 +6.0' 착시를 만들었고, 정정하니 cart +33 · guestMy +26 · stayDetail +8 이
 *    원래 받고 있던 무게로 드러났다. 반대 방향(11번째 뒤로 30KB 가 붙어도 초록)이 더 나빴다.
 */
describe('④ 손님 화면 = 정적 폐쇄(상한 없음)', () => {
  const boot = ['/assets/index-AAAAAAAA.js']
  const css = ['/assets/index-CCCCCCCC.css']
  // 페이지 하나가 공유 청크 12개를 정적으로 끌고 온다 — 맵이라면 10개에서 잘린다
  const manifest: Record<string, { file: string; imports?: string[]; isDynamicEntry?: boolean; css?: string[] }> = {
    'src/pages/CartPage.tsx': { file: 'assets/CartPage-PPPPPPPP.js', isDynamicEntry: true, imports: Array.from({ length: 12 }, (_, i) => `_s${i}.js`) },
  }
  for (let i = 0; i < 12; i++) manifest[`_s${i}.js`] = { file: `assets/s${i}-${String(i).padStart(8, '0')}.js` }
  const r = routeSurfacesFrom(manifest, boot, css, { cart: ['src/pages/CartPage.tsx'] })
  it('10개를 넘는 정적 폐쇄를 전부 센다', () => {
    const js = r.cart.filter((f: string) => f.endsWith('.js') && !boot.includes(f))
    expect(js.length).toBe(13)
    expect(r.cart).toContain('/assets/s11-00000011.js')
  })
  it('진입점이 매니페스트에 없으면 0 으로 재지 않고 던진다', () => {
    expect(() => routeSurfacesFrom(manifest, boot, css, { gone: ['src/pages/Nope.tsx'] })).toThrow()
  })
  it('맵의 청크가 폐쇄에 없으면 어긋남으로 잡는다(둘 중 하나가 틀렸다)', () => {
    expect(mapSubsetErrors({ __boot__: [], cart: ['/assets/s0-00000000.js'] }, r)).toEqual([])
    expect(mapSubsetErrors({ __boot__: [], cart: ['/assets/ghost-ZZZZZZZZ.js'] }, r)[0]).toContain('ghost.js')
    expect(mapSubsetErrors({ __boot__: [], other: [] }, r)[0]).toContain('other')
  })
  it('main 이 손님 화면을 맵이 아니라 폐쇄로 채운다', () => {
    const src = readFileSync('scripts/check-surface-budgets.mjs', 'utf8')
    const main = src.slice(src.indexOf('function main()'))
    expect(main).toMatch(/routeSurfacesFrom\(manifest, bootFiles, bootCss, \{ \.\.\.ROUTES, \.\.\.PRELOAD_ONLY_ROUTES \}\)/)
    expect(main).toMatch(/Object\.assign\(surfaces, routeSurfaces, /)
    expect(main).toMatch(/mapSubsetErrors\(surfaces, routeSurfaces\)/)
  })
})

/**
 * 🧩 2026-11-02 — rebaseline 이 **위반한 화면만** 바꾼다 (대표 *"이러니까 계속 충돌이 되었지"*).
 *   종전엔 27개 화면을 전부 새로 써서 다른 세션과 같은 줄을 다퉜다(최근 머지 200건 중 7건).
 *   기록도 JSON 끝에 덧붙여 같은 자리를 다퉜다 → 파일 하나씩으로.
 */
describe('④ rebaseline 범위 — 위반한 화면만, 기록은 파일 하나씩', () => {
  const baseline = {
    surfaces: {
      a: { totalKB: 100, chunks: { 'x.js': 100 } },
      b: { totalKB: 50, chunks: { 'y.js': 50 } },
      gone: { totalKB: 10, chunks: {} },
    },
    history: [{ date: '2026-10-01', reason: 'old', changes: [] }],
  }
  // b 는 허용오차 안에서 흔들렸을 뿐(50 → 50.03) · a 는 늘었다 · c 는 새 화면 · gone 은 사라졌다
  const measured = {
    a: { totalKB: 104, chunks: { 'x.js': 104 } },
    b: { totalKB: 50.03, chunks: { 'y.js': 50.03 } },
    c: { totalKB: 20, chunks: { 'z.js': 20 } },
  }
  const errs = judge(measured, baseline)
  const { doc, entry } = nextBaselineDoc(measured, baseline, errs, { reason: '시험', date: '2026-11-02' })
  it('위반 없는 화면은 커밋된 값 그대로 (±0.03 흔들림이 diff 를 만들지 않는다)', () => {
    expect(doc.surfaces.b).toBe(baseline.surfaces.b)
  })
  it('늘어난 화면·새 화면은 새 측정값, 사라진 화면은 빠진다', () => {
    expect(doc.surfaces.a).toBe(measured.a)
    expect(doc.surfaces.c).toBe(measured.c)
    expect('gone' in doc.surfaces).toBe(false)
  })
  it('기존 순서를 지킨다 (순서만 바뀌어도 diff 가 생긴다)', () => {
    expect(Object.keys(doc.surfaces)).toEqual(['a', 'b', 'c'])
  })
  it('JSON 안의 history 는 동결 — 덧붙이지 않는다', () => {
    expect(doc.history).toEqual(baseline.history)
    expect(entry?.surfaces.sort()).toEqual(['a', 'c', 'gone'])
  })
  it('--all 만 전부 다시 쓴다', () => {
    const r = nextBaselineDoc(measured, baseline, errs, { date: '2026-11-02', all: true })
    expect(r.doc.surfaces.b).toBe(measured.b)
  })
  it('기록 파일 이름은 날짜-화면, 겹치면 번호', () => {
    const e = { date: '2026-11-02', surfaces: ['vouchers'] }
    expect(historyFileName(e, () => false)).toBe('2026-11-02-vouchers.json')
    const taken = new Set(['2026-11-02-vouchers.json'])
    expect(historyFileName(e, (n) => taken.has(n))).toBe('2026-11-02-vouchers-2.json')
  })
  it('실제 기준 파일의 history 가 동결 수(28)를 넘지 않는다 — 새 기록은 디렉터리로', () => {
    const real = JSON.parse(readFileSync('scripts/surface-budgets.json', 'utf8'))
    expect(real.history.length).toBeLessThanOrEqual(28)
  })
})

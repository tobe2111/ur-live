/**
 * 📏 화면별 첫 화면 무게 래칫 (2026-10-14) — 근거는 `scripts/check-surface-budgets.mjs` 머리말.
 *   대표 *"대기업 수준 — 기능이 늘어나도 최적화된 상태여야"*. 지금까지 예산은 헐거운 선이라
 *   상세·지도 봉투에 30KB 가 붙어도 PR 이 초록이었다.
 *
 * 고정하는 것:
 *   ① 측정 범위 — 엔트리 폐쇄 + CSS + 화면 봉투(엔트리와 겹치는 건 한 번만)
 *   ② 판정 — 늘면 실패 · 줄면 '잠그라' 실패 · 새 화면/사라진 화면 실패 · 허용오차 안은 통과
 *   ③ 배선 — verify(빌드 뒤) · main 예산 워크플로 · 기준 파일이 실제 화면 목록을 덮는다
 * ⚠️ 못 막는 것: 실행 비용 · 이미지·API · 맵에 없는 화면(대시보드).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { surfacesFrom, judge, TOLERANCE_KB, LOCK_SLACK_KB } from '../../../scripts/check-surface-budgets.mjs'

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
    const run = y.indexOf('run: node scripts/check-surface-budgets.mjs')
    expect(run).toBeGreaterThan(y.indexOf('run: npm run build:worker'))
    expect(y.slice(run - 300, run)).not.toMatch(/continue-on-error:\s*true/)
  })
  it('main 예산 워크플로도 돌린다', () => {
    expect(read('.github/workflows/bundle-budget-main.yml')).toContain('node scripts/check-surface-budgets.mjs')
  })
  it('기준 파일이 하드로드 화면 전부 + __boot__ 를 덮고 값이 0 이 아니다', () => {
    const b = JSON.parse(read('scripts/surface-budgets.json'))
    // 하드로드 화면 목록 = 생성기의 ROUTES 키(그 파일은 .mjs 라 소스에서 키를 읽는다)
    const gen = read('scripts/generate-route-chunk-map.mjs')
    const body = gen.slice(gen.indexOf('export const ROUTES = {'), gen.indexOf('\n}', gen.indexOf('export const ROUTES = {')))
    const keys = [...body.matchAll(/^  (\w+): \[/gm)].map((m) => m[1])
    expect(keys.length).toBeGreaterThan(5)
    const want = ['__boot__', ...keys].sort()
    expect(Object.keys(b.surfaces).sort()).toEqual(want)
    for (const v of Object.values(b.surfaces) as Array<{ totalKB: number }>) expect(v.totalKB).toBeGreaterThan(50)
    expect(b.toleranceKB).toBe(TOLERANCE_KB)
  })
})

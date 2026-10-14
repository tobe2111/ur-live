/**
 * ⚙️ 대시보드 무게 예산 · 첫 화면 실행 비용 래칫 · 실행 비용 처방 (2026-10-14 대표 *"대시보드랑 실행비용도 최적화 해줘"*)
 *
 * 고정하는 것:
 *   ① 실행 비용 판정 — 하네스 한 줄을 읽고(못 읽으면 null = 실패), 늘면 실패 · 줄면 '잠그라' 실패 · 새/사라진 화면 실패
 *   ② 범위 — 대시보드·마이 목록(dashboard-surfaces)이 무게 예산과 실행 비용 **둘 다**에 들어 있다(한쪽만이면 감시 밖)
 *   ③ 측정기 — 하네스 `--cpu` 가 V8 커버리지 · CPU 감속 · `CPU_RESULT` 를 낸다 · 어드민 로그인 시딩
 *   ④ 배선 — verify(빌드 뒤 · chromium 설치 뒤) · main 예산 워크플로 · 로컬 게이트 제외 사유
 *   ⑤ 대시보드 무게 측정 — 매니페스트 정적 폐쇄 · 엔트리 중복 제외 · 진입점 못 찾으면 **던진다**
 *   ⑥ 처방 둘 — 번역 JSON 은 `JSON.parse` 문자열로 · `cn()`/tailwind-merge 는 app-ui-utils(지도 봉투로 끌려가지 않게)
 * ⚠️ 못 막는 것: 실행 **시간**(러너마다 2배 흔들려 판정에 안 쓴다) · 4초 뒤에 도는 코드 · 워커(서버) 실행 비용.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse, judge, PAGES, TOLERANCE_KB, LOCK_SLACK_KB } from '../../../scripts/check-exec-cost.mjs'
import { dashboardSurfacesFrom } from '../../../scripts/check-surface-budgets.mjs'
import { DASHBOARD_SURFACES } from '../../../scripts/dashboard-surfaces.mjs'
import { LIBRARY_ENVELOPES } from '../../../scripts/surface-chunks.mjs'
import { stripComments } from '../helpers/source-text'

const read = (f: string) => readFileSync(f, 'utf8')

describe('① 실행 비용 판정', () => {
  it('하네스의 CPU_RESULT 한 줄을 읽는다 — 없거나 깨졌으면 null(= 측정 실패, 통과 아님)', () => {
    const r = parse('foo\nCPU_RESULT {"route":"/","execKB":300.5,"top":[["a.js",10]]}\nbar')
    expect(r?.execKB).toBe(300.5)
    expect(parse('⚙️ 실행 비용 … 줄만 있고 기계용 줄이 없다')).toBeNull()
    expect(parse('CPU_RESULT {깨진')).toBeNull()
  })
  const base = { pages: { 홈: { execKB: 300, top: [['a.js', 100]] as Array<[string, number]> } } }
  it('허용오차 안은 통과', () => {
    expect(judge({ 홈: { execKB: 300 + TOLERANCE_KB - 0.1, top: [] } }, base)).toEqual([])
  })
  it('늘면 실패 — 어느 청크에서 늘었는지 이름으로', () => {
    const e = judge({ 홈: { execKB: 320, top: [['a.js', 118]] as Array<[string, number]> } }, base)
    expect(e).toHaveLength(1)
    expect(e[0].kind).toBe('grew')
    expect(e[0].msg).toContain('a.js +18')
  })
  it('줄었는데 안 잠그면 실패(그 여유가 다음 기능에 조용히 먹힌다)', () => {
    expect(judge({ 홈: { execKB: 300 - LOCK_SLACK_KB - 1, top: [] } }, base)[0].kind).toBe('slack')
  })
  it('새 화면 · 사라진 화면은 실패', () => {
    expect(judge({ 홈: { execKB: 300, top: [] }, 새화면: { execKB: 200, top: [] } }, base).map((e) => e.kind)).toEqual(['new'])
    expect(judge({}, base).map((e) => e.kind)).toEqual(['gone'])
  })
})

describe('② 범위 — 대시보드·마이가 두 예산 모두에', () => {
  const dashKeys = Object.keys(DASHBOARD_SURFACES)
  it('실행 비용 화면 목록이 대시보드 목록을 하나씩 덮는다', () => {
    expect(dashKeys.length).toBeGreaterThanOrEqual(3)
    for (const k of dashKeys) expect(PAGES.filter((p) => p.dashboard === k).length, k).toBe(1)
    expect(PAGES.filter((p) => !p.dashboard).length).toBeGreaterThanOrEqual(7)
  })
  it('기준 파일 둘이 그 화면들을 실제로 갖고 있다', () => {
    const exec = JSON.parse(read('scripts/exec-cost-baseline.json'))
    for (const p of PAGES) expect(exec.pages[p.name], p.name).toBeTruthy()
    const bytes = JSON.parse(read('scripts/surface-budgets.json'))
    for (const k of dashKeys) expect(bytes.surfaces[`dash:${k}`], k).toBeTruthy()
  })
  it('기준 파일의 허용오차가 코드와 같다', () => {
    const exec = JSON.parse(read('scripts/exec-cost-baseline.json'))
    expect(exec.toleranceKB).toBe(TOLERANCE_KB)
    expect(exec.lockSlackKB).toBe(LOCK_SLACK_KB)
  })
  it('대시보드 진입점 파일이 실재한다(옮겨지면 조용히 0 으로 재는 대신 여기서 빨간불)', () => {
    for (const files of Object.values(DASHBOARD_SURFACES)) for (const f of files) expect(() => read(f), f).not.toThrow()
  })
})

describe('③ 측정기 — 하네스 --cpu', () => {
  const src = stripComments(read('scripts/visual-preview.mjs'))
  it('V8 커버리지를 탐색 전에 켜고 CPU 를 느리게 한다', () => {
    const cov = src.indexOf('startJSCoverage')
    const nav = src.indexOf('await page.goto(')
    expect(cov).toBeGreaterThan(0)
    expect(cov).toBeLessThan(nav)
    expect(src).toMatch(/Emulation\.setCPUThrottlingRate/)
  })
  it('실행된 바이트는 범위를 순서대로 칠해서 센다(count>0 → 1, 0 → 0)', () => {
    expect(src).toMatch(/mark\.fill\(r\.count > 0 \? 1 : 0, r\.startOffset, r\.endOffset\)/)
  })
  it('기계가 읽는 CPU_RESULT 한 줄을 낸다', () => {
    expect(src).toMatch(/console\.log\(`CPU_RESULT \$\{JSON\.stringify\(result\)\}`\)/)
  })
  it('어드민 로그인 시딩 — 가드가 보는 admin_token', () => {
    expect(src).toMatch(/AUTH === 'admin'\s*\?\s*\{\s*admin_token:/)
  })
})

describe('④ 배선', () => {
  const v = read('.github/workflows/verify.yml')
  it('verify: 빌드 → chromium 설치 → 실행 비용 순서', () => {
    const build = v.indexOf('run: npm run build:worker')
    const install = v.indexOf('Install chromium (execution cost)')
    const run = v.indexOf('run: node scripts/check-exec-cost.mjs')
    expect(build).toBeGreaterThan(0)
    expect(install).toBeGreaterThan(build)
    expect(run).toBeGreaterThan(install)
    // continue-on-error 로 경고만 하게 바뀌면 PR 게이트가 아니다
    expect(v.slice(run, run + 200)).not.toMatch(/continue-on-error:\s*true/)
  })
  it('main push 예산 워크플로도 잰다(두 PR 이 각자 통과해도 합치면 넘는다)', () => {
    expect(read('.github/workflows/bundle-budget-main.yml')).toMatch(/run: node scripts\/check-exec-cost\.mjs/)
  })
  it('로컬 게이트 제외에 사유가 있다(브라우저 렌더 ~2분 · 이번 빌드 필요)', () => {
    expect(read('scripts/local-ci-parity.mjs')).toMatch(/'check-exec-cost\.mjs':\s*\n\s*'[^']{10,}'/)
  })
})

describe('⑤ 대시보드 무게 측정', () => {
  const manifest = {
    'src/pages/AdminPage.tsx': { file: 'assets/AdminPage-AAAAAAAA.js', isDynamicEntry: true, imports: ['_app-components-BBBBBBBB.js', '_react-core-CCCCCCCC.js'], css: ['assets/admin-DDDDDDDD.css'] },
    '_app-components-BBBBBBBB.js': { file: 'assets/app-components-BBBBBBBB.js', imports: ['_lz-map-EEEEEEEE.js'] },
    '_lz-map-EEEEEEEE.js': { file: 'assets/lz-map-EEEEEEEE.js' },
    '_react-core-CCCCCCCC.js': { file: 'assets/react-core-CCCCCCCC.js' },
    '_UserProfilePage-FFFFFFFF.js': { file: 'assets/UserProfilePage-FFFFFFFF.js', name: 'UserProfilePage', isDynamicEntry: true },
  }
  const boot = ['/assets/index-ZZZZZZZZ.js', '/assets/react-core-CCCCCCCC.js']
  const css = ['/assets/index-YYYYYYYY.css']
  it('정적 폐쇄를 끝까지 따라가고(전이), 엔트리와 겹치는 건 한 번만', () => {
    const r = dashboardSurfacesFrom(manifest, boot, css, { admin: ['src/pages/AdminPage.tsx'] })['dash:admin']
    expect(r).toContain('/assets/lz-map-EEEEEEEE.js')
    expect(r).toContain('/assets/admin-DDDDDDDD.css')
    expect(r.filter((f: string) => f.includes('react-core')).length).toBe(1)
  })
  it('여러 곳에서 lazy 로 불려 키가 `_이름-해시` 인 진입점도 이름으로 찾는다', () => {
    const r = dashboardSurfacesFrom(manifest, boot, css, { my: ['src/pages/UserProfilePage.tsx'] })['dash:my']
    expect(r).toContain('/assets/UserProfilePage-FFFFFFFF.js')
  })
  it('진입점을 못 찾으면 던진다(조용히 0 으로 재면 가드가 헛돈다)', () => {
    expect(() => dashboardSurfacesFrom(manifest, boot, css, { x: ['src/pages/Gone.tsx'] })).toThrow(/못 찾았다/)
  })
})

describe('⑥ 처방', () => {
  const vite = stripComments(read('vite.config.ts'))
  it('JSON 은 JSON.parse 문자열로 낸다(큰 번역 객체 리터럴의 파싱 비용)', () => {
    expect(vite).toMatch(/json:\s*\{\s*stringify:\s*true\s*\}/)
    // 이름 있는 JSON import 는 stringify 에서 안 생긴다 — 그런 import 가 생기면 그 화면이 깨진다
    expect(read('src/i18n.ts')).toMatch(/mod\.default \|\| mod/)
  })
  it('cn()·clsx·tailwind-merge 는 app-ui-utils 이고, 묶음기가 그 봉투를 건드리지 않는다', () => {
    expect(vite).toMatch(/id\.includes\('\/src\/lib\/utils'\)\) return 'app-ui-utils'/)
    expect(vite).toMatch(/node_modules\/clsx\/'\) \|\| id\.includes\('node_modules\/tailwind-merge\/'\)\) return 'app-ui-utils'/)
    expect(LIBRARY_ENVELOPES.has('app-ui-utils')).toBe(true)
  })
})

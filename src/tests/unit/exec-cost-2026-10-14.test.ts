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
import { parse, judge, pickFloor, RUNS, PAGES, TOLERANCE_KB, LOCK_SLACK_KB } from '../../../scripts/check-exec-cost.mjs'
import { dashboardSurfacesFrom } from '../../../scripts/check-surface-budgets.mjs'
import { DASHBOARD_SURFACES } from '../../../scripts/dashboard-surfaces.mjs'
import { LIBRARY_ENVELOPES } from '../../../scripts/surface-chunks.mjs'
import { stripComments } from '../helpers/source-text'

const read = (f: string) => readFileSync(f, 'utf8')
const base = { pages: { 홈: { execKB: 300, top: [['a.js', 100]] as Array<[string, number]> } } }

describe('① 실행 비용 판정', () => {
  it('하네스의 CPU_RESULT 한 줄을 읽는다 — 없거나 깨졌으면 null(= 측정 실패, 통과 아님)', () => {
    const r = parse('foo\nCPU_RESULT {"route":"/","execKB":300.5,"top":[["a.js",10]]}\nbar')
    expect(r?.execKB).toBe(300.5)
    expect(parse('⚙️ 실행 비용 … 줄만 있고 기계용 줄이 없다')).toBeNull()
    expect(parse('CPU_RESULT {깨진')).toBeNull()
  })
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

/**
 * 📏 라이브 CI 실제 표본 (main 10-15~10-17 세 회차 · 화면당 3회 = 30점).
 *   ❌ 둘은 그 회차가 실제로 부른 발간불이다(job 116534627981 · 116587563406).
 *   형식: [기준, [표본1, 표본2, 표본3]]
 */
const CI_SAMPLES: Record<string, Record<string, [number, number[]]>> = {
  '10-15 ❌ fbc64c074': {
    홈: [345.7, [346.9, 346.9, 346.9]], '홈(PC)': [453.7, [454.8, 454.7, 454.7]],
    교환권: [320.7, [321.8, 321.8, 321.8]], '이용권 상세': [352.4, [362.5, 354.7, 354.7]],
    쇼핑: [296.2, [297.1, 297.1, 297.1]], 지도: [351, [360, 352.3, 352.3]],
    유어샵: [295.9, [296.9, 296.9, 296.9]], 마이: [405.8, [406.8, 406.8, 406.8]],
    어드민: [529.8, [531.5, 539.4, 539.4]], 에이전시: [478.1, [486.9, 486.9, 479.2]],
  },
  '10-15 ❌ 0e58ab293': {
    홈: [333.3, [341.4, 333.9, 341.4]], '홈(PC)': [453.7, [453.7, 453.7, 453.7]],
    교환권: [320.7, [318.5, 318.3, 318.5]], '이용권 상세': [352.4, [351.7, 351.9, 351.7]],
    쇼핑: [296.2, [292.7, 292.7, 292.7]], 지도: [351, [346.2, 346.2, 346.2]],
    유어샵: [295.9, [289.4, 289.4, 289.4]], 마이: [405.8, [407.8, 407.8, 407.8]],
    어드민: [529.8, [533, 533.2, 533.1]], 에이전시: [478.1, [480.4, 480.4, 480.4]],
  },
  '10-17 ✅ 3d49f187b': {
    홈: [322.7, [322.8, 322.8, 322.8]], '홈(PC)': [435.3, [435.6, 435.6, 435.6]],
    교환권: [305.2, [305.3, 319, 305.5]], '이용권 상세': [339, [338.6, 338.7, 338.7]],
    쇼핑: [279.6, [279.5, 279.5, 279.5]], 지도: [337.4, [336.7, 335.4, 335.5]],
    유어샵: [276.2, [276.3, 276.3, 276.3]], 마이: [383.8, [382.8, 383, 382.8]],
    어드민: [521.2, [520, 520, 520]], 에이전시: [468, [467.1, 467.5, 467.4]],
  },
}
const asResults = (v: number[]) => v.map((execKB) => ({ execKB }))
const medianOf = (v: number[]) => [...v].sort((a, b) => a - b)[1]

describe('①-2 흔들림 — 세 번 재서 바닥값(최소)', () => {
  it('기본 3회이고, 바닥값은 위로 튀는 표본을 둘까지 버린다', () => {
    expect(RUNS).toBeGreaterThanOrEqual(3)
    // 중앙값이면 317.4 — 튀는 한 번만 버린다
    expect(pickFloor(asResults([317, 325, 317.4]))?.execKB).toBe(317)
    // ⭐ 참조 사고: 셋 중 **둘**이 높은 갈래여도 바닥은 낮은 갈래를 고른다(10-15 어드민)
    expect(pickFloor(asResults([539.4, 531.5, 539.4]))?.execKB).toBe(531.5)
    expect(pickFloor(asResults([300]))?.execKB).toBe(300)
    expect(pickFloor([])).toBeNull()
  })
  it('라이브 표본 30점 — 바닥값은 한 번도 허용오차를 안 넘고, 중앙값은 3번 넘는다', () => {
    let floorOver = 0
    let medianOver = 0
    let n = 0
    for (const run of Object.values(CI_SAMPLES)) {
      for (const [base, v] of Object.values(run)) {
        n++
        if (pickFloor(asResults(v))!.execKB - base > TOLERANCE_KB) floorOver++
        if (medianOf(v) - base > TOLERANCE_KB) medianOver++
      }
    }
    expect(n).toBe(30) // 표본이 줄었으면 통과가 아니다
    expect(floorOver).toBe(0)
    expect(medianOver).toBe(3) // 바꾼 이유 — 이 셋이 10-15 빨간불이다
  })
  /**
   * 🩸 이 시험의 첫 판은 *"아래 방향 이상치 0건"* 을 단언했는데 **내 시험이 그 주장을 반증했다**:
   *   [531.5, 539.4, 539.4] 는 "둘이 위로 튄 것" 과 "하나가 아래로 떨어진 것" 이 **같은 모양**이다 —
   *   3표본으로는 방향을 알 수 없다. 그 주장은 통계가 아니라 ⓐ 실행 커버리지가 아래에서 단조라는 성질과
   *   ⓑ 10-15 홈의 높은 갈래가 `lz-home-homePc-map.js`·`react-router.js` 를 **이름으로 댄 것** 에서 온다.
   *   ⇒ 여기서는 통계로 **말할 수 있는 것만** 단언한다: 흔들림이 매끄러운 잡음이 아니라 **두 갈래**다.
   */
  it('흔들림은 매끄러운 잡음이 아니라 두 갈래다 — 폭은 0 아니면 7KB 이상(그 사이가 비어 있다)', () => {
    const spreads: number[] = []
    for (const run of Object.values(CI_SAMPLES)) {
      for (const [, v] of Object.values(run)) spreads.push(Math.max(...v) - Math.min(...v))
    }
    expect(spreads).toHaveLength(30)
    // 허용오차(4KB)와 관측된 가장 작은 '큰 폭'(7.5KB) 사이에 표본이 하나도 없다
    expect(spreads.filter((x) => x > TOLERANCE_KB && x < 7)).toEqual([])
    expect(spreads.filter((x) => x > TOLERANCE_KB)).toHaveLength(6)
    // 그 여섯의 폭은 허용오차의 두 배가 넘는다 ⇒ 중앙값 한 겹으로는 못 막는다
    expect(Math.min(...spreads.filter((x) => x > TOLERANCE_KB))).toBeGreaterThan(TOLERANCE_KB * 1.8)
  })
  // 📡 2026-10-18 현장 관측 — `CI_RUN_NOTICE` 로 **초록 회차**의 3회 표본을 읽게 된 뒤 처음 잰 값이다.
  //   아래 방향 잡음이 실재하고(교환권 302.2 / 305.4 / 305.6, run 39072017152) 바닥값이 그걸 채택한다.
  //   ⇒ `LOCK_SLACK_KB` 는 그 잡음보다 커야 한다. 작아지면 **코드가 안 바뀌어도** 빨간불이 난다.
  it('아래 방향 잡음(현장 3.2KB)이 거짓 "개선 미잠금"을 내지 않는다', () => {
    const floor = pickFloor(asResults([302.2, 305.4, 305.6]))!
    expect(floor.execKB).toBe(302.2) // 바닥값은 낮은 표본을 **채택한다**(중앙값이면 버린다)
    const b305 = { pages: { 홈: { execKB: 305.2, top: [['a.js', 100]] as Array<[string, number]> } } }
    expect(judge({ 홈: { execKB: floor.execKB, top: [] } }, b305)).toEqual([])
    // 관측된 아래 잡음보다 잠금여유가 넉넉해야 한다 — 이 값을 내리려면 현장 분포를 다시 재라.
    expect(LOCK_SLACK_KB).toBeGreaterThan(305.6 - 302.2)
  })
  it('바닥값이어도 진짜 증가는 막는다(새 코드가 꼭 돌면 모든 표본에 들어 바닥도 오른다)', () => {
    const floor = pickFloor(asResults([310, 310.2, 318]))!
    expect(judge({ 홈: { execKB: floor.execKB, top: [] } }, base)[0].kind).toBe('grew')
  })
  it('한 번이라도 못 읽으면 그 화면은 실패다(추정기가 고장을 가리지 않는다)', () => {
    const src = stripComments(read('scripts/check-exec-cost.mjs'))
    expect(src).toMatch(/if \(runs\.some\(\(x\) => !x\)\) \{[^\n]{0,240}failed\+\+; continue \}/)
    expect(src).toMatch(/for \(let i = 0; i < RUNS; i\+\+\)/)
    // 바닥값은 낮은 표본을 채택하므로 이 세 검사가 특히 중요하다
    expect(src).toMatch(/문제가 발생했습니다/)
    expect(src).toMatch(/res\.execKB > 100/)
  })
  it('판정에 쓰는 추정기는 바닥값이다(중앙값으로 되돌아가면 10-15 빨간불이 재발한다)', () => {
    const src = stripComments(read('scripts/check-exec-cost.mjs'))
    expect(src).toMatch(/const res = pickFloor\(runs\)/)
    expect(src).not.toMatch(/pickMedian/)
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
    // 🔁 2026-10-16 재조준: `run:` 줄에 `ci-run` 래퍼가 붙었다(실패를 annotation 으로 내보낸다).
    //   지키는 불변식은 **순서**이므로 명령 앞부분이 아니라 스크립트 이름으로 앵커한다.
    const run = v.indexOf('scripts/check-exec-cost.mjs')
    expect(build).toBeGreaterThan(0)
    expect(install).toBeGreaterThan(build)
    expect(run).toBeGreaterThan(install)
    // continue-on-error 로 경고만 하게 바뀌면 PR 게이트가 아니다
    expect(v.slice(run, run + 200)).not.toMatch(/continue-on-error:\s*true/)
  })
  it('main push 예산 워크플로도 잰다(두 PR 이 각자 통과해도 합치면 넘는다)', () => {
    // 🔁 2026-10-16: 같은 이유 — 불변식은 **그 워크플로가 이 가드를 돌린다**는 것이다(명령 앞부분 아님).
    expect(read('.github/workflows/bundle-budget-main.yml')).toMatch(/scripts\/check-exec-cost\.mjs/)
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

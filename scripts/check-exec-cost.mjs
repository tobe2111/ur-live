#!/usr/bin/env node
/**
 * ⚙️ 첫 화면 **실행 비용** 래칫 (2026-10-14 대표 *"대시보드랑 실행비용도 최적화 해줘"* — 직전 지시
 *    *"대기업 수준의 인프라 … 앞으로 기능이 추가되어도 최적화된 상태여야"* 의 실행 쪽 절반)
 *
 * ## 왜 있나
 * `check-surface-budgets` 는 **받는 바이트**만 잰다. 같은 바이트라도 첫 화면에서 **실제로 도는 코드**가 늘면
 * 폰이 그만큼 바빠지고(파싱·컴파일·실행) 버튼이 늦게 반응한다. 그건 지금까지 실사용 SLO(`vitals-slo` cron)가
 * **배포 다음 날** 알려 주는 것뿐이었다 — 미리 막는 장치가 없었다.
 *
 * ## 무엇을 재나 (`visual-preview.mjs --cpu` — 측정기는 한 벌이다)
 *   execKB   한 번이라도 실행된 우리 JS(/assets/*.js) 바이트 — V8 블록 커버리지. 스텁 응답이 고정이라 **결정적**이다
 *            (같은 빌드를 세 번 재서 0.3KB 안 — 2026-10-14 실측). ← **이것 하나로 판정한다**
 *   scriptMs · tbtMs   CPU 4배 느리게 한 상태의 스크립트 시간 · 긴 작업 합. 러너마다 2배 가까이 흔들려서
 *            (같은 빌드 809~1873ms 실측) **판정에 안 쓴다** — 기록·추세용으로 출력만 한다.
 *
 * ## 판정 (래칫 — 양방향, `check-surface-budgets` 와 같은 규칙)
 *   - 기준 + 허용오차 초과 → ❌ 회귀(어느 청크에서 실행이 늘었는지 이름으로)
 *   - 기준 − 잠금여유 미만 → ❌ "개선을 잠그라"(안 잠그면 그 여유가 다음 기능에 조용히 먹힌다)
 *   - 기준에 없는 화면 / 측정 실패 / 측정 0 → ❌ (못 잰 것은 통과가 아니다)
 *   늘려야 하면 `--rebaseline --reason "무엇을 왜"` — 사유가 history 에 남는다. 사유 없는 상향은 거부.
 *
 * ## 못 보는 것
 *   - 4초 뒤에 도는 코드(스크롤·클릭 뒤) · 외부 SDK(하네스가 차단) · **워커(서버) 실행 비용** — 그건
 *     워커 번들 예산(main.yml)과 실사용 TTFB SLO 가 본다
 *   - 같은 코드가 **더 오래** 도는 것(루프·재렌더 폭주) — 바이트가 아니라 시간이라 실사용 SLO 의 몫
 *   - 화면 목록 밖 — 손님은 아래 PAGES, 대시보드·마이는 `dashboard-surfaces.mjs` 와 같은 화면
 */
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BASELINE = path.join(ROOT, 'scripts', 'exec-cost-baseline.json')

/** 허용오차 — 같은 빌드 반복 측정의 흔들림은 0.3KB 다. 러너·크로미움 판 차이까지 감안해 넉넉히. */
export const TOLERANCE_KB = 4
/** 잠금여유 — 이만큼 줄었는데 기준을 안 내리면 실패. */
export const LOCK_SLACK_KB = 8
/**
 * 🎯 화면마다 몇 번 재나 (2026-10-14).
 *   한 번만 재면 같은 빌드가 실행마다 최대 ~9KB 흔들렸다(로컬 실측: 교환권 317↔325 · 어드민 520↔537) —
 *   허용오차(4KB)보다 커서 가드가 **아무 변화 없이** 빨간불을 낼 수 있다.
 */
export const RUNS = Math.max(1, Number(process.env.EXEC_COST_RUNS) || 3)

/**
 * 🎯 여러 번 잰 값 중 **무엇을 그 화면의 값으로 쓰나** — 바닥값(최소)이다 (2026-10-17).
 *
 * 🩸 **중앙값이던 것을 바꿨다. 근거는 라이브 CI 실측 30점이다**(main 10-15~10-17 세 회차의 3회 표본 전부):
 *   분포가 **두 갈래**이고 **위로만** 튄다 — 낮은 갈래는 서로 0.3KB 안으로 모이고(결정적),
 *   높은 갈래가 +7.5~13.7KB 로 떨어져 나온다. 중앙값은 **한 번** 튀는 것만 버리므로
 *   셋 중 **둘**이 높은 갈래에 떨어지면 그대로 채택한다 — 그게 10-15 빨간불 둘의 정체다:
 *     어드민  531.5/539.4/539.4 → 중앙값 539.4 (기준 529.8, +9.6 ❌) · 바닥값 531.5 (+1.7 ✅)
 *     에이전시 486.9/486.9/479.2 → 중앙값 486.9 (기준 478.1, +8.8 ❌) · 바닥값 479.2 (+1.1 ✅)
 *     홈     341.4/333.9/341.4 → 중앙값 341.4 (기준 333.3, +8.1 ❌) · 바닥값 333.9 (+0.6 ✅)
 *   30점 전수에서 **중앙값 최악 +9.6 · 초과 3건** ↔ **바닥값 최악 +3.2 · 초과 0건**.
 *   즉 그 세 빨간불은 코드 증가가 아니라 **추정기가 분산을 채택한 것**이었다.
 *
 * 🔑 **바닥값이 원리상 옳은 쪽이다**: 실행 커버리지는 아래에서 단조다 — 첫 화면에 **꼭 돌아야 하는 코드**는
 *   어느 표본에서도 돌고, 그 위는 창 안에 우연히 들어온 뒷일(지도 SDK 예열 · `load` 뒤 미리받기)이다.
 *   10-15 홈의 높은 갈래가 `lz-home-homePc-map.js +12.8 · react-router.js +12.0` 을 이름으로 댄 것이 그 증거다.
 *   ⇒ 바닥값은 "이 화면이 **반드시** 태우는 양"이고, 그게 이 가드가 재려던 값이다.
 *
 * 🔴 **그래도 허용오차를 올리거나 `--rebaseline` 으로 덮지 않는다** — 그러면 진짜 증가가 그만큼 조용히 샌다.
 *   바닥값은 진짜 증가를 **똑같이** 잡는다: 새 코드가 첫 화면에 꼭 돌면 모든 표본이 그걸 포함해 바닥도 같이 올라간다.
 *
 * ⚠️ **바닥값이 못 보는 것**: 표본 하나가 *덜* 돌아 낮게 찍히는 경우(끊긴 측정)는 중앙값이면 버려지는데
 *   바닥값은 채택한다. 🩸 처음 이 자리에 *"실측 30점에 그 방향 이상치는 0건"* 이라고 적었는데
 *   **시험이 그 주장을 반증했다** — `[531.5, 539.4, 539.4]` 는 "둘이 위로" 와 "하나가 아래로" 가 **같은 모양**이라
 *   3표본으로는 방향을 알 수 없다. 비대칭의 근거는 통계가 아니라 위의 ⓐ 단조성과 ⓑ 높은 갈래가 댄 청크 이름이다.
 *   낮은 쪽 위장은 ① 오류 화면 · ② 못 읽은 표본 · ③ `execKB > 100` 세 검사가 먼저 실패로 잡고,
 *   남는 것은 잠금여유(−8KB) 쪽 빨간불로 드러난다(이 가드는 양방향이다).
 *   ⇒ 그래서 세 검사를 약화하면 안 된다. 바닥값은 그 셋에 **더** 의존한다.
 */
export function pickFloor(results) {
  const ok = results.filter(Boolean)
  if (!ok.length) return null
  return [...ok].sort((a, b) => a.execKB - b.execKB)[0]
}

/** name · 하네스 인자 · 대시보드면 dashboard-surfaces 의 키(시험이 대조). */
export const PAGES = [
  { name: '홈', args: ['--route=/', '--deals'] },
  { name: '홈(PC)', args: ['--route=/', '--deals', '--pc'] },
  { name: '교환권', args: ['--route=/vouchers', '--deals'] },
  { name: '이용권 상세', args: ['--route=/group-buy/9000', '--deals'] },
  { name: '쇼핑', args: ['--route=/browse', '--deals'] },
  { name: '지도', args: ['--route=/map', '--deals'] },
  { name: '유어샵', args: ['--route=/u/jiwon1228'] },
  { name: '마이(판매 구역)', args: ['--route=/user/profile', '--auth=user', '--stores=1', '--seller-lists'], dashboard: 'my' },
  { name: '어드민', args: ['--route=/admin', '--auth=admin'], dashboard: 'admin' },
  { name: '에이전시 콘솔', args: ['--route=/agency', '--auth=agency', '--stub-file=scripts/preview-seeds/agency-console.json'], dashboard: 'agency' },
]

/** 하네스 출력에서 `CPU_RESULT {json}` 한 줄을 읽는다. 없으면 null(= 측정 실패). */
export function parse(stdout) {
  const line = String(stdout || '').split('\n').find((l) => l.startsWith('CPU_RESULT '))
  if (!line) return null
  try { return JSON.parse(line.slice('CPU_RESULT '.length)) } catch { return null }
}

/** 기준과 실측을 대조한다(순수). */
export function judge(measured, baseline, { tolerance = TOLERANCE_KB, slack = LOCK_SLACK_KB } = {}) {
  const errors = []
  for (const [name, m] of Object.entries(measured)) {
    const b = baseline.pages?.[name]
    if (!b) { errors.push({ name, kind: 'new', msg: `${name}: 기준에 없는 화면 (실행 ${m.execKB}KB) — 예산을 갖고 들어와야 한다` }); continue }
    if (m.execKB > b.execKB + tolerance) {
      const prev = Object.fromEntries(b.top || [])
      const grew = (m.top || []).map(([n, kb]) => [n, kb - (prev[n] ?? 0)]).filter(([, d]) => d > 0.5)
        .sort((x, y) => y[1] - x[1]).slice(0, 5).map(([n, d]) => `${n} +${d.toFixed(1)}`)
      errors.push({ name, kind: 'grew', msg: `${name}: 실행된 JS ${b.execKB} → ${m.execKB} KB (+${(m.execKB - b.execKB).toFixed(1)}, 허용 ${tolerance}) · 늘어난 것: ${grew.join(', ') || '(상위 청크 밖)'}` })
    } else if (m.execKB < b.execKB - slack) {
      errors.push({ name, kind: 'slack', msg: `${name}: 실행된 JS ${b.execKB} → ${m.execKB} KB 로 줄었다 — 개선을 잠그라(--rebaseline)` })
    }
  }
  for (const name of Object.keys(baseline.pages || {})) {
    if (!measured[name]) errors.push({ name, kind: 'gone', msg: `${name}: 기준엔 있는데 측정되지 않았다 — 화면이 사라졌으면 --rebaseline` })
  }
  return errors
}

function main() {
  const args = process.argv.slice(2)
  const REBASE = args.includes('--rebaseline')
  const ri = args.indexOf('--reason')
  const REASON = ri >= 0 ? (args[ri + 1] || '').trim() : ''
  const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice('--only='.length)
  if (!fs.existsSync(path.join(ROOT, 'dist/client/index.html'))) {
    console.error('❌ exec-cost: dist/client/index.html 없음 — `npm run build:client` 뒤에 돌릴 것(못 잰 것은 통과가 아니다).')
    process.exit(1)
  }
  const baseline = fs.existsSync(BASELINE) ? JSON.parse(fs.readFileSync(BASELINE, 'utf8')) : { pages: {}, history: [] }
  const measured = {}
  let failed = 0
  for (const pg of PAGES) {
    if (ONLY && !pg.name.includes(ONLY)) continue
    const runs = []
    let lastOut = ''
    for (let i = 0; i < RUNS; i++) {
      const r = spawnSync('node', ['scripts/visual-preview.mjs', ...pg.args, '--cpu', '--no-idle', '--name=exec-cost'], { cwd: ROOT, encoding: 'utf8', timeout: 180_000 })
      lastOut = r.stdout || ''
      // 오류 화면은 한 번이라도 나오면 그 화면 전체를 실패로 본다(추정기 뒤에 숨지 않게).
      if (/문제가 발생했습니다/.test(lastOut)) { runs.length = 0; runs.push('ERR'); break }
      runs.push(parse(r.stdout))
    }
    if (runs[0] === 'ERR') { console.error(`❌ ${pg.name}: 오류 화면을 쟀다 — 시드·스텁이 화면과 안 맞는다.`); failed++; continue }
    // 한 번이라도 못 읽으면 실패 — 추정기가 고장을 가리면 안 된다(바닥값은 특히 낮은 표본을 채택한다).
    if (runs.some((x) => !x)) { console.error(`❌ ${pg.name}: 측정 결과를 못 읽었다(하네스 실패·형식 변경) — 통과가 아니다.`); failed++; continue }
    const res = pickFloor(runs)
    if (!res) { console.error(`❌ ${pg.name}: 측정 결과를 못 읽었다(하네스 실패·형식 변경) — 통과가 아니다.`); failed++; continue }
    if (!(res.execKB > 100)) { console.error(`❌ ${pg.name}: 실행된 JS ${res.execKB}KB — 렌더가 깨졌거나 측정이 헛돌았다.`); failed++; continue }
    measured[pg.name] = { execKB: res.execKB, loadedKB: res.loadedKB, top: res.top }
    const b = baseline.pages?.[pg.name]
    console.log(`   ${pg.name.padEnd(12)} 실행 ${b ? String(b.execKB).padStart(6) : '     —'} → ${String(res.execKB).padStart(6)} KB (${RUNS}회 중 바닥값: ${runs.map((x) => x.execKB).join('/')}) · 받은 JS ${res.loadedKB}KB · (참고) 스크립트 ${res.scriptMs}ms · TBT ${res.tbtMs}ms @CPU×${res.cpuRate}`)
  }
  if (failed) { console.error(`\n❌ exec-cost: ${failed}개 화면을 못 쟀다.`); process.exit(1) }
  if (Object.keys(measured).length === 0) { console.error('❌ exec-cost: 측정한 화면이 0개 — 통과가 아니다.'); process.exit(1) }

  // --only 로 일부만 쟀으면 나머지 기준은 그대로 두고 판정도 잰 것만.
  const scoped = ONLY ? { ...baseline, pages: Object.fromEntries(Object.entries(baseline.pages || {}).filter(([n]) => measured[n])) } : baseline
  const errs = judge(measured, scoped)
  if (REBASE) {
    const raised = errs.filter((e) => e.kind === 'grew' || e.kind === 'new')
    if (raised.length && !REASON) {
      console.error('❌ 기준을 **올리는** rebaseline 은 사유가 필요하다: --reason "무엇을 왜 더했는가"')
      for (const e of raised) console.error(`   · ${e.msg}`)
      process.exit(1)
    }
    const history = baseline.history || []
    if (errs.length) history.push({ date: new Date().toISOString().slice(0, 10), reason: REASON || '개선 잠금(줄어든 값 반영)', changes: errs.map((e) => e.msg) })
    fs.writeFileSync(BASELINE, JSON.stringify({
      _doc: '첫 화면 실행된 JS(V8 커버리지, KB) 예산. 손으로 고치지 말 것 — scripts/check-exec-cost.mjs --rebaseline [--reason ...]',
      toleranceKB: TOLERANCE_KB, lockSlackKB: LOCK_SLACK_KB,
      pages: { ...(baseline.pages || {}), ...measured }, history: history.slice(-40),
    }, null, 2) + '\n')
    console.log(`✅ 기준 갱신 → scripts/exec-cost-baseline.json (${Object.keys(measured).length}개 화면)`)
    return
  }
  if (errs.length) {
    console.error(`\n❌ exec-cost: ${errs.length}건`)
    for (const e of errs) console.error(`   · ${e.msg}`)
    console.error('\n   늘었으면: 첫 화면에 꼭 돌아야 하는 코드인지 먼저 본다(대부분 lazy·load 뒤로 내릴 수 있다). 정말 필요하면')
    console.error('   node scripts/check-exec-cost.mjs --rebaseline --reason "…"')
    process.exit(1)
  }
  console.log(`✅ exec-cost: ${Object.keys(measured).length}개 화면 전부 예산 안 (허용 +${TOLERANCE_KB} KB · 잠금 −${LOCK_SLACK_KB} KB)`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()

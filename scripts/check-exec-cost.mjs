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
 * 🎯 화면마다 몇 번 재서 **중앙값**으로 판정하나 (2026-10-14).
 *   한 번만 재면 같은 빌드가 실행마다 최대 ~9KB 흔들렸다(로컬 실측: 교환권 317↔325 · 어드민 520↔537) —
 *   허용오차(4KB)보다 커서 가드가 **아무 변화 없이** 빨간불을 낼 수 있다. 세 번의 중앙값은 튀는 한 번을 버린다.
 */
export const RUNS = Math.max(1, Number(process.env.EXEC_COST_RUNS) || 3)

/** 측정값 여럿 중 execKB 의 중앙값인 측정을 고른다(순수). 빈 배열이면 null. */
export function pickMedian(results) {
  const ok = results.filter(Boolean)
  if (!ok.length) return null
  const sorted = [...ok].sort((a, b) => a.execKB - b.execKB)
  return sorted[Math.floor((sorted.length - 1) / 2)]
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
      // 오류 화면은 한 번이라도 나오면 그 화면 전체를 실패로 본다(중앙값 뒤에 숨지 않게).
      if (/문제가 발생했습니다/.test(lastOut)) { runs.length = 0; runs.push('ERR'); break }
      runs.push(parse(r.stdout))
    }
    if (runs[0] === 'ERR') { console.error(`❌ ${pg.name}: 오류 화면을 쟀다 — 시드·스텁이 화면과 안 맞는다.`); failed++; continue }
    // 한 번이라도 못 읽으면 실패 — 중앙값이 고장을 가리면 안 된다.
    if (runs.some((x) => !x)) { console.error(`❌ ${pg.name}: 측정 결과를 못 읽었다(하네스 실패·형식 변경) — 통과가 아니다.`); failed++; continue }
    const res = pickMedian(runs)
    if (!res) { console.error(`❌ ${pg.name}: 측정 결과를 못 읽었다(하네스 실패·형식 변경) — 통과가 아니다.`); failed++; continue }
    if (!(res.execKB > 100)) { console.error(`❌ ${pg.name}: 실행된 JS ${res.execKB}KB — 렌더가 깨졌거나 측정이 헛돌았다.`); failed++; continue }
    measured[pg.name] = { execKB: res.execKB, loadedKB: res.loadedKB, top: res.top }
    const b = baseline.pages?.[pg.name]
    console.log(`   ${pg.name.padEnd(12)} 실행 ${b ? String(b.execKB).padStart(6) : '     —'} → ${String(res.execKB).padStart(6)} KB (${RUNS}회 중앙값: ${runs.map((x) => x.execKB).join('/')}) · 받은 JS ${res.loadedKB}KB · (참고) 스크립트 ${res.scriptMs}ms · TBT ${res.tbtMs}ms @CPU×${res.cpuRate}`)
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

#!/usr/bin/env node
/**
 * 🧬 **가드가 실제로 실패할 수 있는지 기계가 확인한다** (되돌려-검증 자동화).
 *
 * ## 왜 (2026-08-01~02 하루에 **세 번** 났다)
 * 이 레포의 반복 사고는 "검사가 실패한다"가 아니라 **"검사가 실패할 수 없다"** 이다.
 * 배포는 초록불이고 아무도 모른다. 같은 날 내가 만든 가드 세 개가 전부 그랬다:
 *
 * 1. `배열을 reverse 해도 같은가` — 15개 배열의 reverse 는 인덱스 i→14−i 라 **홀짝이 보존**돼
 *    2조 분할에 영향이 0 이었다. 정렬을 통째로 지워도 초록불.
 * 2. `phase 이름이 바뀌면 조가 흔들린다` — `maintenance?…` 의 이웃이 `?` 앞에서 이미 갈려
 *    실제로는 안 일어나는 일이었다. 쿼리 제거를 무력화해도 초록불.
 * 3. `한 회차가 예산을 넘지 않는다` — 픽스처에 **일 1회 레인이 하나도 없어** `always` 가 늘
 *    빈 배열이었다. 라이브에선 예산 8 에 12개가 떠서 3개가 잘리고 있었는데도 초록불.
 *
 * 셋 다 **손으로 주입해 보고서야** 알았다. 손으로 하면 다음 세션은 안 한다.
 *
 * ## 무엇을 하는가
 * 아래 `MUTATIONS` 의 각 항목에 대해: 소스에 알려진 결함을 심고 → 지정 테스트를 돌리고 →
 * **빨간불이 안 뜨면 실패**시킨다. 그리고 원본을 복원한다.
 *
 * 두 가지를 동시에 잡는다:
 *   ① **헛도는 가드** — 결함을 심었는데 테스트가 통과 = 그 가드는 아무것도 안 지키고 있다.
 *   ② **낡은 지도** — `find` 문자열이 소스에 없음 = 코드가 옮겨갔는데 이 검증만 남았다.
 *      (이 레포가 잠금표에서 겪은 바로 그 클래스. 조용히 통과시키지 않고 **실패**로 다룬다.)
 *
 * ## ⚠️ 안전
 * 소스를 **실제로 수정**하므로 반드시 복원한다: try/finally + 프로세스 시그널 훅 + 종료 시 재확인.
 * 원본은 메모리에 담고, 어떤 경로로 끝나도 되돌린다. (그래도 중단됐다면 `git diff` 로 확인할 것.)
 *
 * ## 새 가드를 만들면 여기에 한 줄 추가하라
 * 이게 이 레포의 "깨뜨려서 확인" 규율의 **기계 버전**이다. 항목이 없는 가드는 다음 세션에
 * 조용히 헛돌 수 있다.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const STRICT = process.argv.includes('-s') || process.argv.includes('--strict')

/**
 * @typedef {{name:string, file:string, find:string, replace:string, test:string, why:string}} Mutation
 * `find` 는 소스에 **정확히 한 번** 나타나는 문자열이어야 한다(여러 번이면 첫 번째만 바뀌어
 * 의도한 결함이 아닐 수 있다 — 그래서 개수도 검사한다).
 */
/** @type {Mutation[]} */
const MUTATIONS = [
  {
    name: '예산 차감 제거(라이브 결함 재현)',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'const cap = Math.max(1, budget - always.length)',
    replace: 'const cap = budget',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '미룰 수 없는 레인이 예산 위에 얹히던 08-02 결함. 예산 8 에 12개가 떠 꼬리 3개가 CPU 한도로 잘렸다.',
  },
  {
    name: 'cap 하한 1 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'const cap = Math.max(1, budget - always.length)',
    replace: 'const cap = Math.max(0, budget - always.length)',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '0 이면 그 시간대가 반복될 때 커서가 영원히 안 움직인다(= 부재).',
  },
  {
    name: '커서 전진 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'nextCursor: (c + cap) % n',
    replace: 'nextCursor: c',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '커서가 안 움직이면 매 회차 같은 레인만 돌고 나머지는 영원히 굶는다.',
  },
  {
    name: '커서 저장 제거(배선)',
    file: 'src/worker-ads/lane-runner.ts',
    find: 'bind(DISPATCH_CURSOR_KEY, String(sel.nextCursor))',
    replace: 'bind(DISPATCH_CURSOR_KEY, "0")',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '순수 로직이 맞아도 저장을 안 하면 라운드로빈이 매번 0에서 다시 시작한다.',
  },
  {
    name: '진단 노출 제거',
    file: 'src/features/marketing/api/ads-pool-diag.ts',
    find: "    dispatch: parseJson(find('ads_dispatch_last')),",
    replace: '',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '스냅샷을 쓰기만 하고 노출을 안 해 #919 첫 판정에서 ran/deferred 를 못 봤다.',
  },
  {
    name: '일 1회 레인 보호 제거',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: '  return gap <= 60',
    replace: '  return true',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '일 1회 레인을 미루면 그 시간이 지나 영영 안 돈다 — 침묵이 아니라 부재라 경보에도 안 잡힌다.',
  },
  {
    name: '유료 확대 무력화',
    file: 'src/worker-ads/dispatch-budget.ts',
    find: 'export const PAID_LANES_PER_TICK = 64',
    replace: 'export const PAID_LANES_PER_TICK = 8',
    test: 'src/tests/unit/ads-dispatch-budget.test.ts',
    why: '대표 지시 "유료 전환 시 자연히 늘어나게" 의 실체 — 이게 죽으면 유료로 올려도 그대로다.',
  },
  {
    name: '예산 우회 래칫 무력화',
    file: 'scripts/check-ads-dispatch-bypass.mjs',
    find: "const added = found.filter(k => !baseline.includes(k))",
    replace: 'const added = []',
    test: 'src/tests/unit/ads-dispatch-bypass.test.ts',
    why: '래칫이 신규 우회를 안 잡으면 예산 밖 레인이 조용히 늘어난다(부모 CPU 직격).',
  },
  {
    name: '풀 스캔 작업 상한 제거',
    file: 'src/features/marketing/api/pool-scan-budget.ts',
    find: 'if (n >= POOL_SCAN_MAX_ROWS) return true',
    replace: 'if (false) return true',
    test: 'src/tests/unit/ads-cpu-work-cap.test.ts',
    why: '상한이 없으면 한 인보케이션이 4만 행을 훑어 CPU 한도를 넘긴다(#908).',
  },
  {
    name: '스키마 매니페스트에 로직 유입',
    file: 'src/worker/routes/repair-schema/column-repairs.ts',
    find: 'export const COLUMN_REPAIRS: ColumnRepair[] = [',
    replace: 'const mk = (t) => ({ desc: t, sql: `ALTER TABLE ${t} ADD x TEXT` })\nexport const COLUMN_REPAIRS: ColumnRepair[] = [\n    mk("zz"),',
    test: 'src/tests/unit/repair-schema-manifest.test.ts',
    why:
      '이 파일은 "순수 데이터"라는 이유로 600줄 캡을 면제받았다. 로직이 들어오면 그 근거가 사라져 ' +
      '단지 "린트를 끈 1,000줄짜리 파일"이 된다. 이 주입은 처음엔 **초록이 떴다** — 검사가 배열 ' +
      '본문만 봐서 선언 위에 심은 헬퍼를 못 봤다. 파일 전체를 보게 고친 뒤 빨강.',
  },
  {
    name: '추천 보너스 원장 폴백 제거',
    file: 'src/features/group-buy/api/referral-bonus.ts',
    find: "await recordPointTxMinimal(DB, uid, 'referral_bonus', bonus, desc)",
    replace: '/* removed */',
    test: 'src/tests/unit/point-credit-ledger-row.test.ts',
    why:
      '이 원장 행은 잔액 기록이자 **중복 방지 키**다(`alreadyRewarded` 가 description LIKE 로 읽는다). ' +
      '행이 없으면 같은 추천 조합이 매번 다시 보상받는다 — 불일치를 넘어 반복 지급.',
  },
]

/** 복원해야 할 원본들 — 어떤 경로로 끝나도 되돌린다. */
const pending = new Map()
function restoreAll() {
  for (const [abs, src] of pending) { try { fs.writeFileSync(abs, src) } catch { /* 최선 노력 */ } }
  pending.clear()
}
for (const sig of ['SIGINT', 'SIGTERM', 'uncaughtException']) {
  process.on(sig, (e) => { restoreAll(); if (e instanceof Error) console.error(e); process.exit(1) })
}
process.on('exit', restoreAll)

function runTest(testPath) {
  try {
    execFileSync('npx', ['vitest', 'run', testPath], { cwd: ROOT, stdio: 'pipe', timeout: 180_000 })
    return true   // 통과
  } catch { return false }  // 실패(= 우리가 원하는 것)
}

if (MUTATIONS.length === 0) {
  console.error('❌ guard-mutations: 등록된 주입이 0건 — 통과가 아니라 실패다.')
  process.exit(1)
}

const problems = []
console.log(`🧬 guard-mutations: ${MUTATIONS.length}개 주입 검증 (각각 소스를 잠깐 고쳤다가 되돌린다)\n`)

for (const m of MUTATIONS) {
  const abs = path.join(ROOT, m.file)
  if (!fs.existsSync(abs)) { problems.push(`${m.name}: 파일 없음 — ${m.file} (코드가 옮겨갔다)`); continue }
  const src = fs.readFileSync(abs, 'utf8')
  const count = src.split(m.find).length - 1
  if (count === 0) { problems.push(`${m.name}: 주입 대상을 못 찾음 — ${m.file} 의 \`${m.find.slice(0, 50)}…\` (낡은 지도)`); continue }
  if (count > 1) { problems.push(`${m.name}: 주입 대상이 ${count}곳 — 유일해야 한다(엉뚱한 곳을 고칠 수 있다)`); continue }

  pending.set(abs, src)
  let stillGreen
  try {
    fs.writeFileSync(abs, src.replace(m.find, m.replace))
    stillGreen = runTest(m.test)
  } finally {
    fs.writeFileSync(abs, src)
    pending.delete(abs)
  }
  if (stillGreen) problems.push(`${m.name}: 결함을 심었는데 \`${m.test}\` 가 **통과** — 이 가드는 아무것도 안 지킨다.\n      (${m.why})`)
  console.log(`   ${stillGreen ? '❌' : '✅'} ${m.name}`)
}

// 🔒 마지막 안전 확인 — 어떤 경로로든 소스가 바뀐 채 남지 않았는지.
for (const m of MUTATIONS) {
  const abs = path.join(ROOT, m.file)
  if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').includes(m.replace) && m.replace && !fs.readFileSync(abs, 'utf8').includes(m.find)) {
    problems.push(`⚠️ 복원 실패 의심: ${m.file} — \`git diff\` 로 확인할 것`)
  }
}

if (problems.length) {
  console.error(`\n❌ guard-mutations: ${problems.length}건\n`)
  for (const p of problems) console.error(`   • ${p}`)
  console.error(`
   이 검사가 실패한다는 것은 **가드가 지키는 척만 하고 있다**는 뜻이다.
   조치: 그 테스트의 픽스처가 정말 그 경우를 담고 있는지 보라(오늘 세 번 다 픽스처 문제였다).
`)
  process.exit(STRICT ? 1 : 0)
}
console.log(`\n✅ guard-mutations: ${MUTATIONS.length}개 주입 전부 빨간불 확인 — 가드가 실제로 실패할 수 있다.`)

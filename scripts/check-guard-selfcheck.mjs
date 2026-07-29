#!/usr/bin/env node
/**
 * 🔬 2026-07-29: **새 가드가 눈먼 채로 태어나는 것** 차단 (래칫).
 *
 * ## 왜 필요한가 — 오늘 하루에 실측 3건
 *
 * 이 레포의 반복 사고는 "검사가 실패한다"가 아니라 **"검사가 아무것도 안 잰다"** 이다.
 * 대상이 비면 위반도 0이라 **초록이 뜨고, 그 초록은 아무것도 보장하지 않는다.**
 *
 *   · `check-bundle-size` — `.gz` 사이드카를 읽는데 vite 가 그 파일을 안 만들어 **측정값 항상 0**.
 *     `0 > 1.5` 는 영원히 거짓이라 예산이 몇 달간 통과만 했고, 그 죽은 값이 raw 예산 상향 5번의
 *     근거로 인용됐다.
 *   · `check-wholesale-admin-nav-reachability` / `check-wholesale-admin-api-scope` — 네비 정의가
 *     `admin-nav-config.ts` 로 이사(2026-07-22)한 뒤 **허용 경로 0개 · 스캔 화면 0개**로
 *     한 달 넘게 "위반 0" 초록.
 *
 * `check-guard-registry` 는 **등록 여부만** 본다(스스로 그 한계를 적어 뒀다). 이 가드가 그 짝이다.
 *
 * ## 무엇을 요구하나
 *
 * 가드 스크립트는 **자기가 몇 개를 쟀는지 확인하고, 0이면 통과가 아니라 실패**해야 한다.
 * 정적으로는 "0 비교 + 비정상 종료" 가 같은 파일에 있는지로 근사한다.
 *
 * ## 래칫인 이유
 *
 * 기존 가드 대부분은 이 선언이 없다. 한 번에 전부 고치는 것은 위험하고(판정 로직을 잘못 건드리면
 * 오히려 오탐이 는다) 지금 필요한 것도 아니다. **오늘 상태를 동결**하고 **새로 만드는 가드와
 * 목록에서 빠진 가드**만 요구한다. 기존 가드에 선언을 넣었으면 `--rebaseline` 로 동결값을 줄인다.
 *
 * ## 못 보는 것 (과신 금지)
 *
 *   - 선언이 **맞는지**는 안 본다. `if (x === 0) process.exit(1)` 이 있어도 `x` 가 엉뚱한 값이면 못 잡는다.
 *   - **변수 이름을 고정 어휘로 알아본다**(length/size/count/total/scanned/checked/files/targets/entries/rows).
 *     `registered === 0` 처럼 어휘 밖 이름을 쓰면 **선언이 있어도 미선언으로 잡는다** — 오늘 실제로
 *     두 번 걸렸다(`files.length < 200` 을 임계값 때문에 놓친 건 고쳤고, 이건 이름 때문). 어휘를 넓히면
 *     이번엔 무관한 비교까지 인정해 반대로 헐거워진다. ⇒ **가드를 쓸 때 이 어휘를 쓰는 편이 낫다.**
 *   - 셸 가드(`check-*.sh`)는 대상이 아니다 — 형태가 제각각이라 정적 근사가 소음만 된다.
 *
 * 예외: 파일 안에 `zero-scan-ok` 주석(대상이 비는 것이 정상인 가드 — 이유를 함께 적을 것).
 * 기본 warn-only(exit 0). 차단: STRICT_GUARD_SELFCHECK=1 또는 `-s`. 동결 갱신: `--rebaseline`.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs'

const STRICT = process.env.STRICT_GUARD_SELFCHECK === '1' || process.argv.includes('-s')
const REBASE = process.argv.includes('--rebaseline')
const BASELINE = 'scripts/guard-selfcheck-baseline.json'
const ALLOW_MARK = 'zero-scan-ok'

/** "0이면 실패" 를 선언했는가 — 0 비교와 비정상 종료가 함께 있으면 인정한다. */
function declaresZeroFail(src) {
  if (src.includes(ALLOW_MARK)) return true
  // ⚠️ 처음엔 `=== 0` 만 인정했다가 **이미 선언이 있는 가드를 미선언으로 잡았다**
  //   (`check-products-column-budget` 은 `files.length < 200` 으로 훨씬 강하게 선언하고 있었다).
  //   "대상이 기대치보다 적으면 실패" 는 전부 같은 선언이므로 임계값을 가리지 않는다.
  const comparesZero = /(?:length|size|count|total|scanned|checked|files|targets|entries|rows)\s*(?:\(\))?\s*(?:===|==|<=?)\s*\d+/i.test(src)
  const exitsNonZero = /process\.exit\(1\)/.test(src)
  return comparesZero && exitsNonZero
}

const files = readdirSync('scripts')
  .filter((f) => f.startsWith('check-') && f.endsWith('.mjs'))
  .sort()

if (files.length === 0) {
  // 자기 자신에게도 같은 규칙을 적용한다.
  console.error('❌ guard-selfcheck: scripts/check-*.mjs 를 하나도 못 찾았다 — 통과가 아니다.')
  process.exit(1)
}

const missing = files.filter((f) => !declaresZeroFail(readFileSync(`scripts/${f}`, 'utf8')))

if (REBASE) {
  writeFileSync(BASELINE, JSON.stringify({ exempt: missing }, null, 2) + '\n')
  console.log(`🔬 guard-selfcheck: 동결 갱신 — 미선언 ${missing.length}건을 예외로 기록.`)
  process.exit(0)
}

let exempt = []
if (existsSync(BASELINE)) {
  try { exempt = JSON.parse(readFileSync(BASELINE, 'utf8')).exempt || [] } catch { /* 깨졌으면 빈 목록 */ }
}
const exemptSet = new Set(exempt)
const fresh = missing.filter((f) => !exemptSet.has(f))
// 동결 목록에 있는데 이제 선언을 갖춘 것 — 줄어든 건 좋은 일이라 안내만 한다.
const improved = exempt.filter((f) => !missing.includes(f))

if (fresh.length === 0) {
  console.log(`✅ guard-selfcheck: 가드 ${files.length}종 — 신규 미선언 0건 (동결 ${exemptSet.size}건).`)
  if (improved.length) {
    console.log(`   👍 ${improved.length}건이 선언을 갖췄다 — \`node scripts/check-guard-selfcheck.mjs --rebaseline\` 로 동결을 줄일 것: ${improved.join(', ')}`)
  }
  process.exit(0)
}

const say = STRICT ? console.error : console.warn
say(`${STRICT ? '❌' : '⚠️'} guard-selfcheck: "측정 0 = 실패" 선언이 없는 신규 가드 ${fresh.length}건`)
for (const f of fresh) say(`   • scripts/${f}`)
say(`
  가드는 **자기가 몇 개를 쟀는지 확인하고, 0이면 통과가 아니라 실패**해야 한다.
  대상이 비면 위반도 0이라 초록이 뜨는데, 그 초록은 아무것도 보장하지 않는다
  (오늘 실측 3건: 번들 gzip 예산 · 도매 어드민 nav/api 가드 — 한 달 넘게 눈먼 채 초록이었다).

  예:
     if (files.length === 0) {
       console.error('❌ 검사 대상이 0개다 — 경로가 낡았다(통과 아님).')
       process.exit(1)
     }

  대상이 비는 것이 정상인 가드라면 파일에 '${ALLOW_MARK}' 주석 + 이유를 적을 것.`)
process.exit(STRICT ? 1 : 0)

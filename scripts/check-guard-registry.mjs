#!/usr/bin/env node
/**
 * 🛡️ 2026-07-29: 가드를 지키는 가드 — "조용히 안 도는 검사" 차단.
 *
 * ## 왜 만들었나 (가정이 아니라 같은 날 실측으로 3건 나왔다)
 *
 * 이 레포에서 반복된 사고 모양은 **검사가 실패하는 것이 아니라, 검사가 아예 안 도는 것**이다.
 * 배포는 초록불이고 아무도 모른다. 오늘 하루에만:
 *
 *   1. `check-bundle-size.mjs` 의 gzip 총량 예산 — `.gz` 사이드카를 읽는데 vite 는 그걸 안 만든다.
 *      측정값이 **항상 0** → `0 > 1.5` 는 영원히 거짓 → 예산이 몇 달간 통과만 했다.
 *   2. `check-input-text-color.mjs` — `dark:text-white` 를 `text-white` 로 오탐해 정상 코드에
 *      빨간불을 냈고, 그래서 **audit-gate·verify·훅 어디에도 등록되지 못한 채** 남았다.
 *      파일은 존재하니 보호받는 것처럼 보였다.
 *   3. `check-linkshop-ownership.mjs` — 대상 파일이 없으면 `continue` 로 조용히 넘겼다.
 *      이름만 바뀌어도 그 불변식이 소리 없이 사라지는 구조였다.
 *
 * 셋 다 "가드가 있다"는 사실만으로는 아무것도 보장되지 않음을 보여준다. 그래서 기계가 센다.
 *
 * ## 두 가지만 본다 (둘 다 결정론적)
 *
 *   R1. `scripts/check-*.{mjs,sh}` 는 **어딘가에서 실제로 실행**돼야 한다
 *       (audit-gate.sh / .github/workflows/*.yml / git hook / package.json).
 *       → ②처럼 "만들어만 두고 안 켠" 가드를 잡는다.
 *   R2. 가드가 **코드에서 지목한 고정 파일 경로**는 존재해야 한다(주석 안의 경로는 제외).
 *       → ③처럼 경로가 낡아 검사가 비는 것을 잡는다.
 *
 * ## 이 가드가 못 막는 것 (과신 금지)
 *
 *   - 등록은 돼 있는데 **판정 로직이 틀려서** 늘 통과하는 경우(①이 정확히 그랬다). 그건 각 가드가
 *     "측정 0건이면 실패" 를 스스로 선언해야 잡힌다 — 사람이 짜야 하는 부분이다.
 *   - 디렉터리 prefix 매칭이 낡은 경우. 대안 매처가 함께 있으면 무해해서(실측: 교차역할 가드의
 *     `src/pages/agency/` 가 죽어 있었지만 정규식 매처가 40개 파일을 여전히 잡고 있었다)
 *     노이즈만 되므로 일부러 뺐다.
 *
 * 기본 warn-only(exit 0). 차단: STRICT_GUARD_REGISTRY=1 또는 `-s`.
 * 의도적 예외: 가드 파일 안에 `guard-registry-ok` 주석(미등록 허용 — 수동 전용 도구 등).
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'

const STRICT = process.env.STRICT_GUARD_REGISTRY === '1' || process.argv.includes('-s')

/**
 * 러너(가드를 **실제로 실행하는** 곳) 텍스트를 모은다.
 *
 * ⚠️ package.json 전체를 그냥 넣으면 안 된다. `"check:i18n": "node scripts/check-i18n-sync.mjs"`
 *   처럼 **정의만 돼 있고 아무도 부르지 않는** 스크립트가 "등록됨" 으로 통과한다
 *   (이 가드를 처음 돌렸을 때 실제로 그 오통과가 났다 — CI·훅·audit-gate 어디에도 `npm run check:i18n`
 *   이 없었는데 초록불이었다). 그래서 러너에서 호출된 npm 스크립트만 **전이적으로** 펼쳐 넣는다.
 */
function runnerText() {
  const parts = []
  const add = (p) => { if (existsSync(p) && statSync(p).isFile()) parts.push(readFileSync(p, 'utf8')) }
  add('scripts/audit-gate.sh')
  add('scripts/install-git-hooks.sh')
  for (const dir of ['.github/workflows', '.husky']) {
    if (!existsSync(dir)) continue
    for (const f of readdirSync(dir)) {
      const p = join(dir, f)
      if (statSync(p).isFile()) parts.push(readFileSync(p, 'utf8'))
    }
  }

  // 러너가 부른 npm 스크립트 → 그 본문 → 그 안에서 또 부른 스크립트 … 를 닫힐 때까지 펼친다.
  let pkgScripts = {}
  try { pkgScripts = JSON.parse(readFileSync('package.json', 'utf8')).scripts || {} } catch { /* 없으면 무시 */ }
  const expanded = new Set()
  const queue = []
  const collect = (text) => {
    for (const m of text.matchAll(/npm\s+run\s+([A-Za-z0-9:_-]+)/g)) {
      if (pkgScripts[m[1]] && !expanded.has(m[1])) queue.push(m[1])
    }
  }
  collect(parts.join('\n'))
  while (queue.length) {
    const name = queue.shift()
    if (expanded.has(name)) continue
    expanded.add(name)
    const body = pkgScripts[name]
    parts.push(body)
    collect(body)
  }
  return parts.join('\n')
}

/**
 * 주석을 걷어낸다. 주석 안의 경로는 *설명*이지 검사 대상이 아니다
 * (실측: 이걸 안 하면 "VideosTab 을 삭제했다"는 설명 문장 자체가 위반으로 잡혔다).
 */
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')       // 블록 주석
  .split('\n')
  .filter((l) => !/^\s*(\/\/|#|\*)/.test(l))
  .join('\n')

const FILE_LITERAL =
  /['"`]((?:src|docs|scripts|migrations|public|\.github)\/[A-Za-z0-9_./-]+\.(?:ts|tsx|mjs|cjs|js|json|md|ya?ml|sh|css|html))['"`]/g

const guards = readdirSync('scripts')
  .filter((f) => /^check-.*\.(mjs|sh)$/.test(f))
  .map((f) => `scripts/${f}`)
  .sort()

const runners = runnerText()
const unregistered = []
const danglingTargets = []

for (const g of guards) {
  const raw = readFileSync(g, 'utf8')
  const exempt = raw.includes('guard-registry-ok')

  // R1 — 어디선가 실행되는가
  if (!exempt && !runners.includes(g)) unregistered.push(g)

  // R2 — 코드가 지목한 고정 파일이 존재하는가
  const code = stripComments(raw)
  const seen = new Set()
  let m
  while ((m = FILE_LITERAL.exec(code)) !== null) {
    const target = m[1]
    if (seen.has(target)) continue
    seen.add(target)
    if (!existsSync(target)) danglingTargets.push({ guard: g, target })
  }
}

// 🛡️ 자기 자신에게도 같은 규칙을 적용한다 — 스캔 대상이 0이면 통과가 아니라 고장이다.
if (guards.length === 0) {
  console.error('❌ [guard-registry] scripts/check-*.{mjs,sh} 를 하나도 못 찾았다 — 스캔 경로가 깨졌다.')
  process.exit(1)
}

let bad = 0

if (unregistered.length) {
  bad += unregistered.length
  console.error(`\n❌ [guard-registry] 어디에서도 실행되지 않는 가드 ${unregistered.length}건:`)
  for (const g of unregistered) console.error(`   ${g}`)
  console.error(`   → audit-gate.sh 또는 .github/workflows 에 등록하세요.`)
  console.error(`     실행되지 않는 가드는 "보호받고 있다" 는 착각만 만듭니다.`)
  console.error(`     수동 전용 도구라면 파일에 \`guard-registry-ok\` 주석을 남기세요.`)
}

if (danglingTargets.length) {
  bad += danglingTargets.length
  console.error(`\n❌ [guard-registry] 존재하지 않는 파일을 검사 대상으로 지목한 가드 ${danglingTargets.length}건:`)
  for (const d of danglingTargets) console.error(`   ${d.guard}  ->  ${d.target}`)
  console.error(`   → 파일이 이동했으면 경로를 고치고, 폐기됐으면 그 검사 항목을 삭제하세요.`)
  console.error(`     경로만 낡으면 해당 불변식은 조용히 검사되지 않습니다.`)
}

if (bad) {
  console.error(`\n가드 레지스트리 ${bad}건 위반 — "가드가 있는데 안 돈다" 클래스 (2026-07-29 실측 3건에서 도출).`)
  process.exit(STRICT ? 1 : 0)
}

console.log(`✅ guard-registry: 가드 ${guards.length}개 전부 실행 경로에 등록됨 + 지목 파일 전부 존재.`)

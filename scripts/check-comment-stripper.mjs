#!/usr/bin/env node
/**
 * 🔬 **텍스트 가드는 자기 주석 제거기를 새로 쓰지 않는다** (2026-09-13 신설 · 래칫)
 *
 * ## 왜 생겼나 — 이 레포가 같은 자리에서 네 번 넘어졌다
 * 소스를 문자열로 읽어 판정하는 가드는 먼저 주석을 걷어내야 한다("주석에만 남아도 통과"). 그런데
 * 그 걷어내기를 **테스트마다 정규식으로 새로 쓰고 있었다**:
 *
 *   `.replace(/\/\*[\s\S]*?\*\//g, '')`
 *
 * 이 한 줄이 **문자열·정규식 리터럴 안의 `/*` 를 블록주석 시작으로 읽는다.** 실측 피해:
 *
 *   `worker/index.ts`        코드의 76% 증발 (라우트 패턴 `'/api/ads/*'` 때문)
 *   `wholesale-main.routes`  81% 증발
 *   `RestaurantMapPage.tsx`  주석 한 줄의 `place/*` 로 6,433자 증발
 *
 * 증발한 구간의 코드는 검사에서 사라지므로 `not.toContain(...)` 류가 **무조건 통과**한다 —
 * 빨간불이 아니라 **초록불**이라서 아무도 모른다.
 *
 * ⇒ SSOT `src/tests/helpers/source-text.ts` 의 `stripComments`(문자열·템플릿·정규식 리터럴을
 *   추적하는 스캐너)를 쓴다. 새 가드가 자체 정규식을 다시 만들지 못하게 **래칫**으로 막는다.
 *
 * ## 래칫인 이유
 * 남은 98개는 지금 당장은 안 터진다(그들이 읽는 소스에 지뢰가 없다). 잘 도는 98개를 한꺼번에
 * 흔드는 것이 가치보다 위험이 커서 **동결**만 한다 — 늘어나는 것은 막고, 줄이는 것은 환영.
 *
 * ⚠️ 이 검사가 **못 보는 것**: 다른 모양의 자체 제거기(줄 단위 필터만 쓰는 것 등). 그건 지뢰를
 *   안 밟지만 JSX 주석 둘째 줄부터를 놓친다 — 새로 쓸 거면 그냥 `stripComments` 를 쓸 것.
 *
 * 우회: 파일에 `comment-stripper-ok` 주석. 동결값 갱신: `--rebaseline`.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const BASELINE = 'scripts/comment-stripper-baseline.json'
const NEEDLE = String.raw`/\*[\s\S]*?\*\/`
const STRICT = process.env.STRICT_COMMENT_STRIPPER === '1' || process.argv.includes('-s')
const REBASE = process.argv.includes('--rebaseline')

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.test\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

const files = walk('src/tests').sort()
if (files.length < 100) {
  console.log(`❌ comment-stripper: 테스트 파일이 ${files.length}개뿐 — 경로가 낡았다(통과가 아니라 실패).`)
  process.exit(1)
}

const hits = files.filter((f) => {
  const t = readFileSync(f, 'utf-8')
  return t.includes(NEEDLE) && !t.includes('comment-stripper-ok')
})

if (REBASE) {
  writeFileSync(BASELINE, JSON.stringify({ files: hits }, null, 2) + '\n')
  console.log(`📌 comment-stripper: 동결값 갱신 — ${hits.length}개.`)
  process.exit(0)
}

let frozen = []
try { frozen = JSON.parse(readFileSync(BASELINE, 'utf-8')).files } catch { /* 최초 실행 */ }
const frozenSet = new Set(frozen)
const added = hits.filter((f) => !frozenSet.has(f))
const removed = frozen.filter((f) => !hits.includes(f))

if (added.length === 0) {
  const note = removed.length ? ` (${removed.length}개 정리됨 — --rebaseline 로 동결값 갱신 권장)` : ''
  console.log(`✅ comment-stripper: 자체 주석 제거기 신규 0 (동결 ${frozen.length}개)${note}`)
  process.exit(0)
}

console.log('⚠️  자체 주석 제거기를 새로 만든 테스트 — 문자열 안의 `/*` 에 물려 소스가 통째로 증발한다:')
for (const f of added) console.log(`   - ${f}`)
console.log('')
console.log("   고치는 법: import { stripComments } from '<상대경로>/helpers/source-text' 를 쓸 것.")
console.log('   의도적이면 파일에 `comment-stripper-ok` 주석 · 동결값 갱신은 --rebaseline.')
if (STRICT) { console.log('\n❌ STRICT_COMMENT_STRIPPER — 차단.'); process.exit(1) }
process.exit(0)

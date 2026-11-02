#!/usr/bin/env node
/**
 * 🧊 옛 인라인 주입 배열을 **이 브랜치가 늘렸는가** — 고정 숫자 대신 merge-base 와 비교한다 (2026-11-02)
 *
 * 대표 *"단발적으로 문제 해결하지 말고 교훈삼아서 근본적으로 해결할 수 있는게 있으면 해결해줘."*
 *
 * ## 무엇을 지키나
 * `scripts/check-guard-mutations.mjs` 의 `const MUTATIONS = [ … ]`(970건+ · 모든 세션이 다투는 자리)에
 * 새 주입을 더하지 못하게 한다. 새 주입은 `scripts/mutations/<시험 이름>.mjs` 에 쓴다.
 *
 * ## 왜 고정 숫자를 버렸나 (같은 날 main 이 세 번 빨갛게 됐다)
 * 첫 판은 단위 시험의 `FROZEN_INLINE = 977` 이었다 — **main 의 절대값**을 상수와 대조했다.
 *   ① 동결 *전에* Verify 를 통과한 PR(#2094)이 동결 *뒤에* 머지되자 main 이 979 가 되어 빨강
 *      (GitHub 은 "브랜치가 최신이어야 머지" 를 요구하지 않는다 — 통과한 조합과 머지된 조합이 다르다).
 *   ② 그걸 고치려고 두 세션이 **각자** 같은 2건을 다른 파일로 옮겼다 → 이름 중복으로 또 빨강.
 *   ③ 그리고 "줄였으면 상수도 내려라"(동결값 = 측정값)는 **두 PR 이 각자 줄이면** 둘 다 머지된 뒤
 *      측정값이 상수보다 작아져 또 빨강이 되는 구조였다 — 상수 자체가 새 충돌 지점이었다.
 * ⇒ 문제는 "숫자를 몇으로 둘까" 가 아니라 **main 상태를 상수와 견준 것**이다. 지켜야 하는 것은
 *   *"이 PR 이 배열을 늘리지 않는다"* 이고, 그건 **이 PR 의 차이**로만 판정된다. main 에서는 비교할
 *   차이가 없으니 경주로 머지된 조합이 main 을 막지 않는다(한두 건 새어도 다음 PR 을 막지 않는다).
 *
 * ## 판정
 *   - head 인라인 수 > base(merge-base) 인라인 수 → ❌ (새 주입을 scripts/mutations/ 로)
 *   - 재조준(같은 수 안에서 find/replace 수정) · 줄이기 → ✅
 *   - 셈이 0/실패(배열 앵커를 못 찾음) → ❌ 못 잰 것은 통과가 아니다
 *   - base 를 못 구함 → ❌ (git fetch origin main)
 *
 * ## 못 보는 것
 *   - 같은 PR 안에서 하나 지우고 하나 더하는 것(수는 그대로) — 리뷰가 본다. 이름 단위로 막으면
 *     정당한 이름 고침(재조준)까지 막게 된다.
 *   - 경주: 둘 다 base 대비 늘리지 않은 PR 끼리는 문제가 없고, 늘린 PR 은 자기 Verify 에서 걸린다.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const RUNNER = 'scripts/check-guard-mutations.mjs'

/** 인라인 배열의 주입 수. 앵커를 못 찾으면 -1. */
export function countInline(src) {
  const start = src.indexOf('\nconst MUTATIONS = [\n')
  if (start < 0) return -1
  const end = src.indexOf('\n]\n', start)
  if (end < 0) return -1
  return (src.slice(start, end).match(/^ {4}name: /gm) || []).length
}

/**
 * 순수 판정.
 * @param {{ base: number, head: number }} x
 * @returns {string[]} 위반(빈 배열 = 통과)
 */
export function judgeInlineGrowth({ base, head }) {
  if (!(base > 0) || !(head > 0)) {
    return [`인라인 배열을 못 셌다(base ${base} · head ${head}) — 러너 구조가 바뀌었으면 countInline 을 재조준할 것. 못 잰 것은 통과가 아니다.`]
  }
  if (head > base) {
    return [
      `${RUNNER} 의 인라인 배열에 주입을 ${head - base}건 더했다(${base} → ${head}). ` +
        '그 배열은 모든 세션이 다투는 자리라 늘리지 않는다 — 새 주입은 `scripts/mutations/<시험 이름>.mjs` 에 ' +
        '`export default [ … ]` 로 쓸 것(예: scripts/mutations/session-scope-2026-11-02.mjs).',
    ]
  }
  return []
}

function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

function main() {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  process.chdir(ROOT)
  const ref = process.env.INLINE_MUTATIONS_BASE || 'origin/main'
  let baseSha
  try {
    baseSha = git(['merge-base', 'HEAD', ref]).trim()
  } catch {
    console.error(`❌ inline-mutations-growth: ${ref} 와의 merge-base 를 못 구했다 — 못 잰 것은 통과가 아니다(git fetch origin main).`)
    process.exit(1)
  }
  let baseSrc = ''
  try { baseSrc = git(['show', `${baseSha}:${RUNNER}`]) } catch { baseSrc = '' }
  const base = countInline(baseSrc)
  const head = countInline(fs.readFileSync(RUNNER, 'utf8'))
  // 🛡️ 측정 0 = 실패 — 배열을 못 세면 "늘지 않았다" 가 아무것도 보장하지 않는다.
  const headCount = head
  if (headCount <= 0) {
    console.error(`❌ inline-mutations-growth: 지금 러너의 인라인 배열을 못 셌다(${headCount}) — countInline 을 재조준할 것. 못 잰 것은 통과가 아니다.`)
    process.exit(1)
  }
  const errors = judgeInlineGrowth({ base, head })
  if (errors.length) {
    console.error('❌ inline-mutations-growth:')
    for (const e of errors) console.error(`   · ${e}`)
    process.exit(1)
  }
  console.log(`✅ inline-mutations-growth: 인라인 ${base} → ${head} (늘지 않았다)`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main()

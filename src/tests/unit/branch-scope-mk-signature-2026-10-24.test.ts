/**
 * 🧪 **주입 지문이 정상 코드를 차단하지 않는가** — `scripts/check-branch-scope.mjs` (2026-10-24).
 *
 * ## 무엇이 잘못돼 있었나
 * 그 가드는 `check-guard-mutations` 가 심는 결함의 **지문**을 diff 의 `+` 줄에서 찾는다. 그중 하나가
 * `/^\+\s*const mk = \(/` 였는데, 이 레포의 **정상 가짜 D1 스텁**이 바로 그 모양으로 시작한다
 * (`company-save-count.test.ts` 가 main 에 이미 `const mk = (sql: string) => {` 로 있다).
 * 그래서 새 가짜 D1 테스트를 추가한 PR 이 **CI 에서 "주입본이 섞였다"로 차단**됐다(2026-10-24 실측).
 *
 * 더 나쁜 건 가드가 내놓은 처방이었다 — *"origin/main 으로 되돌리세요"*. 그 파일은 **이 브랜치에서
 * 새로 생긴 파일**이라 그대로 따르면 테스트가 삭제된다.
 *
 * ## 이 테스트가 지키는 것 — **양방향**
 * 지문을 좁히면 "안 잡히게" 만들기가 쉽다. 그래서 둘을 같이 고정한다:
 *   ① 실제 주입문(`column-repairs.ts` 매니페스트의 `replace` 첫 줄)을 **여전히 잡는가**
 *   ② 이 레포의 정상 헬퍼를 **통과시키는가**
 * ①만 있으면 지문을 넓혀 오탐이 돌아오고, ②만 있으면 지문을 지워도 통과한다.
 *
 * ## 못 막는 것
 * - 주입 저자가 `const mk = (t: string) => ({ ... })` 처럼 **타입을 붙여** 쓰면 지문이 놓친다.
 *   지문은 1차 안전망이고 본래 방어는 "주입은 실행 후 반드시 되돌린다" 와 pre-commit 훅이다.
 * - `src/tests/` 를 통째로 면제하는 쪽으로 '고치는' 것. 주입 대상 931개 중 **9개가 실제로 테스트
 *   파일**이라 그러면 그 9개가 통째로 눈먼다 — 아래 ③ 이 그 방향을 막는다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SCOPE = readFileSync(resolve(process.cwd(), 'scripts/check-branch-scope.mjs'), 'utf8')
const MUT = readFileSync(resolve(process.cwd(), 'scripts/check-guard-mutations.mjs'), 'utf8')

/** 가드 소스에서 `mk` 지문 정규식을 **실제로 꺼내** 쓴다(복제하면 두 벌이 갈린다). */
function mkSignature(): RegExp {
  const m = SCOPE.match(/\{ re: (\/\^\\\+[^,]*?const mk[^,]*?\/m), what: '가짜 헬퍼\(mk\) 주입' \}/)
  expect(m, "`가짜 헬퍼(mk) 주입` 지문을 찾을 수 없다 — 이름이 바뀌었으면 이 테스트도 재조준할 것").toBeTruthy()
  // eslint-disable-next-line no-eval
  return eval(m![1]) as RegExp
}

describe('branch-scope: mk 지문', () => {
  it('🔒 ① 실제 주입문을 여전히 잡는다 — 매니페스트에서 원문을 가져온다', () => {
    const m = MUT.match(/replace: '(const mk = \(t\)[^']*)'/)
    expect(m, '매니페스트의 `const mk = (t)` 주입문이 사라졌다 — 지문이 지킬 게 없으면 함께 정리할 것').toBeTruthy()
    const firstLine = m![1].split('\\n')[0]
    expect(mkSignature().test('+' + firstLine), '실제 주입문이 안 잡힌다').toBe(true)
  })

  it('🔒 ② 이 레포의 정상 가짜 D1 헬퍼는 통과시킨다 — 오탐이 CI 를 막았다', () => {
    const re = mkSignature()
    for (const line of [
      '+    const mk = (sql: string) => {',        // company-save-count.test.ts (main 에 있다)
      '+  const mk = (sql: string) => {',          // company-taxonomy-2026-10-24.test.ts
      '+  const mk = (sql) => {',                  // 타입이 없어도 블록 본문이면 주입 모양이 아니다
    ]) expect(re.test(line), `오탐: ${line}`).toBe(false)
  })

  it('🔒 ③ `src/tests/` 면제로 "고치지" 않았다 — 주입 대상 중 9개가 테스트 파일이다', () => {
    // 디렉터리 면제는 그 9개를 통째로 눈멀게 한다. 지문 목록 근처에 그런 제외가 생기면 빨간불.
    const sigBlock = SCOPE.slice(SCOPE.indexOf('INJECTION_SIGNATURES'), SCOPE.indexOf('function sh('))
    expect(sigBlock).not.toMatch(/startsWith\(['"]src\/tests/)
    expect(sigBlock).not.toMatch(/!\/\^src\\\/tests/)
  })

  it('검사 대상이 실제로 존재한다 — 0건 통과를 성공으로 오인하지 않게', () => {
    expect((SCOPE.match(/\{ re: \//g) || []).length, '지문이 하나도 없으면 가드가 헛돈다').toBeGreaterThanOrEqual(5)
  })
})

/**
 * 🧊 옛 인라인 주입 목록 동결 — 2026-11-02 (대표 *"이러니까 계속 충돌이 되었지. 또 다른 개선 뭐 있어?"* → *"모두 개선해줘"*).
 *
 * `scripts/check-guard-mutations.mjs` 안의 `const MUTATIONS = [ … ]` 는 한 파일에 970건이 넘게 쌓인
 * **10,000줄짜리 배열**이다. 2026-09-08 에 "새 주입은 `scripts/mutations/<도메인>.mjs` 에" 라는 규칙을
 * 만들었지만 **강제가 없어서** 세션들이 계속 그 배열에 덧붙였다(2026-11-02 하루에만 #2084·#2088 이 4건).
 * 모든 세션이 같은 배열을 고치니 최근 머지 200건 중 8건이 이 파일을 건드렸다.
 *
 * 이 시험이 지키는 것:
 *   ① 인라인 배열의 주입 수가 동결값을 **넘지 않는다**(줄이는 것은 환영 — 옮기거나 지우면 이 값도 내린다)
 *   ② 동결값이 측정값보다 터무니없이 크지 않다(헐거운 상한 = 다시 자라도 초록)
 *   ③ 셈이 실제로 무언가를 센다(0 은 통과가 아니라 파서가 낡았다는 뜻)
 *
 * ⚠️ **못 보는 것**: 기존 인라인 주입을 *고치는* 것(재조준)은 막지 않는다 — 그건 정당한 일이고, 막으면
 *    가드가 지키는 척만 하게 된다. 그래서 이 파일이 충돌 지점에서 *완전히* 빠지지는 않는다.
 *    통째로 옮기지 않은 이유는 러너 머리말(`📁 분할 매니페스트`)에 있다 — 열려 있는 다른 세션의
 *    브랜치가 그 배열을 고치고 있으면 전부 충돌한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/** 이 값은 내리기만 한다. 올리지 말 것 — 새 주입은 scripts/mutations/<도메인>.mjs 에. */
const FROZEN_INLINE = 979

function countInline(src: string): number {
  const start = src.indexOf('\nconst MUTATIONS = [\n')
  if (start < 0) return -1
  const end = src.indexOf('\n]\n', start)
  return (src.slice(start, end).match(/^ {4}name: /gm) || []).length
}

describe('옛 인라인 주입 목록 동결', () => {
  const n = countInline(readFileSync('scripts/check-guard-mutations.mjs', 'utf8'))

  it('③ 셈이 실제로 무언가를 센다', () => {
    expect(n, '`const MUTATIONS = [` 를 못 찾았다 — 러너 구조가 바뀌었으면 이 시험을 재조준할 것').toBeGreaterThan(100)
  })

  it('① 인라인 주입이 동결값을 넘지 않는다 — 새 주입은 scripts/mutations/ 에', () => {
    expect(
      n,
      `scripts/check-guard-mutations.mjs 의 인라인 배열에 새 주입을 더했다(${n} > ${FROZEN_INLINE}). ` +
        '그 배열은 모든 세션이 다투는 자리라 동결됐다 — 새 주입은 `scripts/mutations/<시험 이름>.mjs` 에 ' +
        '`export default [ … ]` 로 쓸 것(예: scripts/mutations/session-scope-2026-11-02.mjs).',
    ).toBeLessThanOrEqual(FROZEN_INLINE)
  })

  it('② 동결값이 헐겁지 않다 — 인라인을 줄였으면 FROZEN_INLINE 도 같이 내린다', () => {
    expect(FROZEN_INLINE - n, `인라인이 ${n} 로 줄었다 — FROZEN_INLINE(${FROZEN_INLINE}) 을 ${n} 로 내릴 것`).toBeLessThanOrEqual(0)
  })
})

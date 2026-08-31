/**
 * 🕳️ 빌드 산출 CSS 가드가 **실제로 도는 자리에 있는가** (2026-08-31 신설)
 *
 * ## 왜 이 테스트가 따로 필요한가
 *
 * `scripts/check-built-css.mjs` 는 `dist/` 를 읽으므로 **빌드 뒤에만** 판정할 수 있다.
 * 그래서 이 테스트(유닛 단계, 빌드 전)가 CSS 를 직접 보지는 못한다 — 대신 **그 가드가
 * 헛돌 수 없는 상태인지**를 본다. 두 가지다: ① 워크플로에서 빌드 **뒤에** 부르는가
 * ② 산출물이 없을 때 **조용히 통과하지 않는가**.
 *
 * ## 이게 막는 실제 사고
 *
 * 같은 판정이 원래 `button-system.test.ts` 안에 있었다. 유닛테스트는 `verify.yml` step 5,
 * `Build client` 는 step 96 — **그 시점에 `dist/` 는 존재한 적이 없다.** 코드가
 * `if (!existsSync(dir)) return` 이라 몇 달간 **아무것도 검사하지 않고 초록**만 찍었다.
 * (반대로 로컬에선 낡은 `dist/` 를 읽어 **가짜 빨간불**을 냈다.)
 *
 * ⇒ 레포가 반복해 당한 "가드가 실패할 수 없음" 클래스다. 순서가 이 가드의 전부이므로
 *   순서 자체를 고정한다.
 *
 * ## 못 막는 것
 * - 가드의 판정 내용이 옳은지(어떤 클래스를 봐야 하는지)는 안 본다. 그건 가드 자신의 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = resolve(__dirname, '../../..')
const wf = readFileSync(resolve(root, '.github/workflows/verify.yml'), 'utf-8')
const guard = readFileSync(resolve(root, 'scripts/check-built-css.mjs'), 'utf-8')

/** 두 표지 사이만 잘라 본다 — 넓게 훑으면 옆 분기의 `exit(1)` 이 들어와 가드가 헛돈다. */
function sliceBetween(src: string, from: string, to: string): string {
  const a = src.indexOf(from)
  const b = src.indexOf(to, a + 1)
  return a < 0 || b < 0 ? '' : src.slice(a, b)
}

describe('빌드 산출 CSS 가드', () => {
  it('verify.yml 이 이 가드를 부른다', () => {
    expect(wf, 'check-built-css.mjs 를 부르는 스텝이 없다 — 파일만 있고 안 도는 가드다')
      .toContain('scripts/check-built-css.mjs')
  })

  it('빌드 **뒤**에 부른다 (앞이면 dist 가 없어 판정 자체가 불가능하다)', () => {
    const build = wf.indexOf('npm run build:client')
    const call = wf.indexOf('scripts/check-built-css.mjs')
    expect(build, 'Build client 스텝을 못 찾았다 — 이 검사가 낡았다').toBeGreaterThan(-1)
    expect(call).toBeGreaterThan(-1)
    expect(call, '가드가 Build client 앞에 있다 — dist 가 없어 아무것도 검사하지 못한다').toBeGreaterThan(build)
  })

  it('산출물이 없으면 통과가 아니라 실패다', () => {
    // 🩸 첫 판은 `[\s\S]{0,400}` 로 훑었는데 그 창에 **다음 분기의** exit(1) 이 들어와,
    //   이 분기를 exit(0) 으로 바꾸는 주입에도 초록이 떴다(되돌려-검증이 잡았다).
    //   ⇒ 분기를 잘라서 본다. 넓게 훑는 정규식은 이 레포가 반복해 당한 헛도는 가드의 모양이다.
    const block = sliceBetween(guard, 'if (!existsSync(ASSETS))', 'const cssFiles')
    expect(block, '산출물 부재 분기를 못 찾았다 — 이 검사가 낡았다').not.toBe('')
    expect(block).toContain('process.exit(1)')
    expect(block, '부재를 통과로 접으면 가드가 있어도 없는 것과 같다').not.toContain('process.exit(0)')
  })

  it('판정한 대상이 0건이면 실패다 (측정 0 = 통과 아님)', () => {
    const block = sliceBetween(guard, 'if (checked === 0)', 'if (failed)')
    expect(block, '측정 0 분기를 못 찾았다 — 이 검사가 낡았다').not.toBe('')
    expect(block).toContain('process.exit(1)')
    expect(block).not.toContain('process.exit(0)')
  })

  it('유닛테스트가 다시 dist 를 읽지 않는다 (원래 자리로 되돌아가는 회귀)', () => {
    const btn = readFileSync(resolve(root, 'src/tests/unit/button-system.test.ts'), 'utf-8')
    expect(btn, '빌드 전에 도는 유닛테스트가 dist 를 읽으면 또 조용히 통과한다')
      .not.toMatch(/dist\/client\/assets/)
  })
})

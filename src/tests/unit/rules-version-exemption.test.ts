/**
 * 🐛 **`rules-version-ok` 탈출구가 처음부터 동작하지 않았다** (2026-08-04 발견·수리).
 *
 * `check-rules-version-bump.mjs` 는 안내문에서 *"규칙이 아니라 리팩토링이면 그 줄에 `rules-version-ok`
 * 주석"* 이라고 말한다. 그런데 버전 상수를 집는 정규식이 `(\d+)` 에서 끝나 **매치가 숫자까지만** 잡혔고,
 * 예외 판정은 그 매치(`cur.line`)에 문자열이 있는지로 한다 — 즉 **주석은 매치에 절대 안 들어왔다.**
 *
 * 문서에만 있고 코드에는 없는 탈출구는, 막다른 길에 몰린 세션이 **더 나쁜 선택**(불필요한 bump 로
 * 3.6만 행 재처리, 혹은 가드 자체를 끄기)을 하게 만든다. 실제로 이 세션이 그 갈림길에 섰다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 예외를 *써도 되는가*. 예외는 그 고위험 가드를 **영구히** 침묵시키므로,
 *   동작한다는 것과 써야 한다는 것은 다르다(이 세션은 예외 대신 bump 를 택했다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const SRC = readFileSync(resolve(process.cwd(), 'scripts/check-rules-version-bump.mjs'), 'utf8')

/** 가드가 쓰는 것과 **같은 방식**으로 상수 줄을 집는다(정규식 리터럴을 소스에서 그대로 읽어 온다). */
function versionLine(src: string, name: string): string | null {
  const m = /new RegExp\(`([^`]+)`, 'm'\)/.exec(SRC)
  expect(m, '버전 상수 정규식을 못 찾았다 — 가드가 옮겨갔나(낡은 지도)').not.toBeNull()
  const pattern = m![1].replace(/\$\{name\}/g, name).replace(/\\\\/g, '\\')
  const hit = new RegExp(pattern, 'm').exec(src)
  return hit ? hit[0] : null
}

describe('버전 상수 매치가 **줄 끝까지** 간다 — 예외 주석이 실제로 잡혀야 한다', () => {
  it('같은 줄의 `rules-version-ok` 주석이 매치에 포함된다', () => {
    const line = versionLine('export const CRAWL_RULES_VERSION = 7 // rules-version-ok 계측만 바뀜', 'CRAWL_RULES_VERSION')
    expect(line, '상수 줄을 못 집었다').not.toBeNull()
    expect(line, '주석이 매치 밖이다 — 문서가 안내하는 탈출구가 동작하지 않는다')
      .toContain('rules-version-ok')
  })

  it('주석이 없으면 당연히 안 잡힌다(예외가 남발되지 않는다)', () => {
    const line = versionLine('export const CRAWL_RULES_VERSION = 7', 'CRAWL_RULES_VERSION')
    expect(line).not.toBeNull()
    expect(line).not.toContain('rules-version-ok')
  })

  it('🔒 값 파싱은 그대로다 — 줄 끝까지 잡느라 숫자를 망치면 안 된다', () => {
    const m = /const\s+CRAWL_RULES_VERSION\s*=\s*(\d+)/.exec(
      versionLine('export const CRAWL_RULES_VERSION = 12 // 뒤에 12345 같은 숫자가 있어도', 'CRAWL_RULES_VERSION')!,
    )
    expect(Number(m![1]), '뒤쪽 숫자를 버전으로 오독했다').toBe(12)
  })

  it('🔌 가드가 이 매치로 예외를 판정한다 — 판정 지점이 바뀌면 이 시험은 무의미해진다', () => {
    expect(SRC).toMatch(/cur\.line\.includes\(ALLOW\)/)
  })
})

/**
 * 🔗 `check-internal-links` 의 **링크 추출 패턴**이 실제로 무엇을 보는지 고정한다.
 *
 * ## 왜 필요한가
 * 이 가드는 "죽은 링크 0" 이라고 초록을 띄우지만, 그 초록의 의미는 **정규식이 본 것 안에서 0** 이다.
 * 정규식이 어떤 표기를 안 보면 그 표기의 링크는 **검사된 적 없이 초록에 포함**된다 — 통과와 부재가
 * 구분되지 않는, 이 레포가 반복해 만난 "헛도는 가드" 클래스다.
 *
 * 실측(2026-08-12): 가드가 JSX 속성 `to=` 만 보고 **객체 리터럴 `to: '/x'` 를 안 봤다.**
 * 링크를 배열로 선언하고 `.map()` 으로 렌더하는 흔한 패턴(`NotFoundPage` 의 "인기 페이지 둘러보기",
 * 각종 칩·탭 목록)이 통째로 사각지대였고, 패턴을 더하자 검사 타깃이 **868 → 904**(+36) 로 늘었다.
 * (이 숫자는 패턴 줄을 지웠다 되살리며 실측했다 — 처음 적었던 838/+66 은 오기였다.)
 *
 * ⚠️ **이 테스트가 못 막는 것**: 라벨과 목적지가 **의미상** 안 맞는 경우.
 *   같은 파일에서 2026-08-11 에 고친 결함이 정확히 그것이다 — `label: '공동구매'` 인데
 *   `to: '/referral'`(추천 수익). 라우트는 실재하므로 어떤 정적 검사도 이걸 죽은 링크로 못 본다.
 *   사람이 읽어야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const GUARD = 'scripts/check-internal-links.mjs'
const src = readFileSync(GUARD, 'utf8')

/** TARGET_RES 배열 본문만 잘라낸다(주석 포함 — 정규식 리터럴이 주석 안에 있진 않다). */
function targetResBlock(): string {
  const start = src.indexOf('const TARGET_RES = [')
  expect(start, `${GUARD} 에서 TARGET_RES 를 못 찾았다 — 가드 구조가 바뀌었다`).toBeGreaterThan(-1)
  const end = src.indexOf('\n]', start)
  expect(end).toBeGreaterThan(start)
  return src.slice(start, end)
}

/** 주석 줄을 걷어낸 코드만 — 주석에 이름만 남아도 통과하는 함정을 막는다. */
function codeOnly(block: string): string {
  return block
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
}

describe('check-internal-links: 링크 추출 패턴', () => {
  it('JSX 속성 to= / navigate( / href= 를 본다', () => {
    const code = codeOnly(targetResBlock())
    expect(code).toMatch(/\\bto=/)
    expect(code).toMatch(/\\bnavigate\\\(/)
    expect(code).toMatch(/\\bhref=/)
  })

  it('🔑 객체 리터럴 `to: "/x"` 도 본다 (2026-08-12 사각지대)', () => {
    const code = codeOnly(targetResBlock())
    // 주석이 아니라 **정규식 리터럴 자체**에 to: 형태가 있어야 한다.
    expect(
      /\\bto:/.test(code),
      '객체 리터럴 `to:` 패턴이 사라졌다 — 배열+map 으로 렌더하는 링크가 전부 무검사가 된다',
    ).toBe(true)
  })

  it('패턴이 실제 표기를 잡는다 (문자열 존재만이 아니라 동작 확인)', () => {
    // 가드가 쓰는 것과 동일한 형태의 패턴으로 샘플을 실제로 파싱한다.
    const patterns = [
      /\bto=(?:"([^"]+)"|'([^']+)'|\{"([^"]+)"\}|\{'([^']+)'\}|\{`([^`]+)`\})/g,
      /\bnavigate\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g,
      /\bhref=(?:"([^"]+)"|'([^']+)'|\{`([^`]+)`\})/g,
      /\bto:\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g,
    ]
    const samples: Array<[string, string]> = [
      [`<Link to="/vouchers">`, '/vouchers'],
      [`navigate('/cart')`, '/cart'],
      [`<a href="/faq">`, '/faq'],
      [`{ to: '/map', label: '내 주변' }`, '/map'], // ← 이 줄이 예전엔 안 잡혔다
    ]
    for (const [line, expected] of samples) {
      const hits = patterns.flatMap((rx) =>
        [...line.matchAll(rx)].map((m) => m.slice(1).find((x) => x != null)),
      )
      expect(hits, `이 표기를 못 잡는다: ${line}`).toContain(expected)
    }
  })

  it('검사 대상 0건을 통과로 처리하지 않는다', () => {
    // 이 레포의 반복 사고 — 대상이 비면 위반도 0이라 초록이 뜨는데 아무것도 보장하지 않는다.
    expect(src).toMatch(/files\.length === 0/)
    expect(codeOnly(src)).toMatch(/process\.exit\(1\)/)
  })
})

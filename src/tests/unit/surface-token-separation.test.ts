/**
 * 🎨 표면 토큰 분리 불변식 (2026-08-30 신설)
 *
 * ■ 막으려는 사고 (실제로 났던 것)
 *   `seller-public/theme.ts` 가 라이트에서 `bg: 'bg-white'`, `card: 'bg-white'` 로
 *   **바탕과 카드가 같은 흰색**이었다. 그러면 카드를 구분할 방법이 실선(border)뿐이라
 *   화면의 모든 것에 1px 회색 테두리가 붙고, 대표가 그걸 보고 "테두리가 정말
 *   AI스럽다" 고 지적했다. 다크 모드는 이미 `#0F151D` ↔ `#1A2334` 로 분리돼
 *   있었다 — **라이트만 깨져 있었고 아무도 몰랐다.**
 *
 * ■ 왜 테스트로 박는가
 *   CLAUDE.md "규율은 문서가 아니라 테스트로": 토큰 파일은 손대기 쉽고,
 *   `bg` 를 흰색으로 되돌리면 테두리 의존이 조용히 부활한다. 에러가 안 나므로
 *   가드가 없으면 다음 세션이 그대로 되돌린다.
 *
 * ■ 이 테스트가 못 막는 것
 *   - 실제 렌더 결과(대비·가독성)는 안 본다. 토큰 값의 '분리' 만 본다.
 *   - 컴포넌트가 토큰을 무시하고 인라인으로 흰 배경을 칠하는 것은 못 잡는다.
 *   - 눈으로 보는 검증은 `scripts/visual-preview.mjs` 가 담당한다(짝이다).
 */
import { describe, it, expect } from 'vitest'
import { getThemeTokens } from '../../pages/seller-public/theme'

describe('유어샵 표면 토큰 — 바탕과 카드는 달라야 한다', () => {
  it('라이트: bg 와 card 가 같은 값이면 안 된다 (테두리 의존의 근본 원인)', () => {
    const T = getThemeTokens(false)
    expect(T.bg).not.toBe(T.card)
  })

  it('다크: bg 와 card 가 같은 값이면 안 된다', () => {
    const T = getThemeTokens(true)
    expect(T.bg).not.toBe(T.card)
  })

  it('라이트 bg 는 순수 흰색이 아니어야 한다 — 흰 카드가 떠오를 바탕이 필요하다', () => {
    const T = getThemeTokens(false)
    expect(T.bg).not.toMatch(/\bbg-white\b/)
    expect(T.bg).not.toMatch(/#(fff|ffffff)\b/i)
  })

  it('카드는 바탕보다 밝은 쪽(라이트=흰색)이어야 한다 — 위계가 뒤집히면 안 된다', () => {
    const T = getThemeTokens(false)
    expect(T.card).toMatch(/\bbg-white\b/)
  })

  it('cardAlt 도 bg·card 와 겹치지 않아야 한다 (3단 위계)', () => {
    const T = getThemeTokens(false)
    expect(T.cardAlt).not.toBe(T.bg)
    expect(T.cardAlt).not.toBe(T.card)
  })
})

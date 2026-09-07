import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 🎨 2026-09-07 (대표 승인 — 홈 개선 안 B·C)
 *
 * ## 안 B: "선택됨"은 서비스 전체에서 한 색이어야 한다
 * 지도 칩(2026-09-02 B안) · 유어샵 카테고리 · 교환권 카테고리는 전부 **브랜드 블루 면**으로
 * 통일했는데 홈만 잉크 검정으로 남아 있었다. 같은 서비스에서 "선택됨"이 두 색이면
 * 사용자가 규칙을 못 배운다.
 *
 * ⚠️ **정렬 칩과 카테고리 칩은 한 쌍이다.** 둘은 홈에서 위아래로 붙어 있어 한쪽만 바꾸면
 *    같은 화면에 선택 색이 둘이 되어 오히려 더 어긋난다. 그래서 같이 고정한다.
 *
 * ## 안 C: 더보기는 테두리 알약이 아니다
 * 표면 규칙 첫 줄이 **테두리 0**(🎫 CLAUDE.md)인데 섹션마다 붙는 더보기만 테두리를 그려,
 * 화면에서 가장 안 중요한 것이 제일 진하게 보였다.
 *
 * ## 이 테스트가 못 보는 것
 * 실제 렌더된 색(브라우저)은 안 잰다 — 이 환경은 프록시가 CONNECT 터널을 끊어 라이브 렌더를
 * 못 한다. 대비는 별도로 계산해 확인했다(블루 면 위 흰 글자 4.87:1, 다크 카드 위 5.03:1 — 둘 다 AA).
 */

const read = (p: string) => readFileSync(p, 'utf8')
/** 주석을 지운 소스 — 경위를 설명하는 주석이 판정에 걸려 늘 통과하는 것을 막는다. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const PC_HOME = 'src/pages/pc-home/PcHomePage.tsx'
const FEED = 'src/pages/main-home/GroupBuyFeed.tsx'
const SECTIONS = 'src/components/home/HomeSections.tsx'

describe('안 B — 홈에서 "선택됨"은 브랜드 블루 면', () => {
  it('정렬 칩(가까운 순 · 인기순 …)의 선택 상태가 블루 면이다', () => {
    const s = code(PC_HOME)
    // 정렬 칩은 두 벌이다(현위치 칩 + SORT_CHIPS 루프) — 둘 다여야 한다.
    const hits = s.match(/'bg-brand text-white border-brand'/g) ?? []
    expect(hits.length, '정렬 칩 두 곳 모두 블루여야 한다').toBe(2)
  })

  it('카테고리 칩의 선택 상태도 블루 면이다 (정렬 칩 바로 위에 붙어 있다)', () => {
    expect(code(FEED)).toMatch(/\? 'bg-brand text-white'/)
  })

  it('홈의 선택 상태에 잉크 검정 면이 남아 있지 않다', () => {
    // 선택 표시로서의 검정. 스크림·다크 표면은 대상이 아니라 "선택" 문맥만 본다.
    expect(code(PC_HOME)).not.toContain('bg-gray-900 text-white border-gray-900')
    expect(code(FEED)).not.toContain("? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900'")
  })

  it('블루 면 위 글자는 흰색이다 (대비 4.87:1 — AA)', () => {
    expect(code(PC_HOME)).toMatch(/bg-brand text-white/)
    expect(code(FEED)).toMatch(/bg-brand text-white/)
  })
})

describe('안 C — 섹션 더보기는 테두리 없는 블루 글자', () => {
  const moreLink = () => {
    const s = code(SECTIONS)
    const i = s.indexOf('to={more}')
    expect(i, '더보기 링크가 있어야 한다').toBeGreaterThan(-1)
    // 그 Link 의 className 한 덩어리
    return s.slice(i, s.indexOf('</Link>', i))
  }

  it('테두리를 그리지 않는다 (표면 규칙 ① 테두리 0)', () => {
    const l = moreLink()
    expect(l).not.toMatch(/\bborder\b/)
    expect(l).not.toMatch(/rounded-full/)
  })

  it('블루 글자다 — 색이 "눌러진다"를 말한다', () => {
    expect(moreLink()).toMatch(/text-brand-text/)
  })

  it('화살표가 없다 — 색과 화살표가 같은 말을 두 번 하면 안 된다', () => {
    expect(code(SECTIONS)).not.toContain('더보기 →')
    expect(moreLink()).not.toContain('ArrowRight')
  })

  it('한 줄로 유지된다 (좁은 화면에서 제목을 밀지 않게)', () => {
    expect(moreLink()).toMatch(/whitespace-nowrap/)
    expect(moreLink()).toMatch(/shrink-0/)
  })
})

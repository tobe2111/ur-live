/**
 * 📜 2026-09-03 — 스크롤바 "안 1 (얇은 잉크)" (대표 확정)
 *
 * 배경: 유어딜은 스크롤바를 **한 번도 정의한 적이 없었다**(숨김 유틸만 있었다). 지역 선택창의
 * 두꺼운 회색 막대는 우리 것이 아니라 **OS 기본값**이고, 각진 17px 이 카드·시트의 둥근 모서리와
 * 부딪쳤다(대표 신고). 시안 4안 중 안 1 확정.
 *
 * 이 검사가 고정하는 것:
 *   ① 전역 규칙이 실제로 있다(숨김 유틸만 있던 상태로 되돌아가지 않는다)
 *   ② 두께 8px — 4px 은 마우스로 끌어 잡기 어렵다(윈도우 사용자는 막대를 끈다)
 *   ③ thumb 은 **잉크**다 — 브랜드 파랑은 주 행동의 자리이고, 스크롤바는 가구다(표면 규칙 ②)
 *   ④ 다크 대응 + 늘 밝은 표면(light-island)은 다크에서도 라이트 막대
 *   ⑤ 기존 숨김 유틸(no-scrollbar / scrollbar-hide)은 그대로 살아 있다
 *
 * ⚠️ 이 검사가 못 막는 것: 실제 렌더 두께·잡히는 느낌. 파이어폭스는 px 지정 자체가 안 된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const CSS = readFileSync('src/index.css', 'utf8')

describe('스크롤바 안 1 — 얇은 잉크 (2026-09-03 대표 확정)', () => {
  it('① 전역 스크롤바 규칙이 있다', () => {
    expect(CSS).toMatch(/^::-webkit-scrollbar \{/m)
    expect(CSS).toMatch(/^::-webkit-scrollbar-thumb \{/m)
  })

  it('② 두께는 8px (4px 로 얇아지면 마우스로 못 잡는다)', () => {
    const bar = CSS.match(/^::-webkit-scrollbar \{[^}]*\}/m)?.[0] || ''
    expect(bar).toMatch(/width:\s*8px/)
    expect(bar).toMatch(/height:\s*8px/)
  })

  it('③ thumb 은 잉크다 — 브랜드 파랑을 가구에 쓰지 않는다', () => {
    const thumb = CSS.match(/^::-webkit-scrollbar-thumb \{[^}]*\}/m)?.[0] || ''
    expect(thumb).toMatch(/rgb\(22 24 28/)          // 잉크
    expect(thumb).not.toMatch(/28 105 239|#1C69EF/i) // 브랜드 블루 금지
    expect(thumb).toMatch(/border-radius:\s*99px/)
  })

  it('④ 다크 + 늘 밝은 표면(light-island) 대응', () => {
    expect(CSS).toMatch(/\.dark ::-webkit-scrollbar-thumb \{/)
    // 흰 패널 안에 흰 막대가 뜨면 안 보인다.
    expect(CSS).toMatch(/\.dark \.light-island ::-webkit-scrollbar-thumb \{/)
  })

  it('⑤ 기존 숨김 유틸은 살아 있다 (가로 레일이 다시 막대를 드러내면 안 된다)', () => {
    expect(CSS).toMatch(/\.no-scrollbar::-webkit-scrollbar/)
    expect(CSS).toMatch(/\.scrollbar-hide::-webkit-scrollbar/)
  })
})

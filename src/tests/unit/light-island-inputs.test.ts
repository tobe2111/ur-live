/**
 * 🏝️ 2026-09-03 — 늘 밝은 표면에는 `light-island` (대표 신고 "글자가 또 하얘")
 *
 * 배경(라이브 실측): `urdeal.kr/map?q=부산` 에서 검색창에 친 글자가 **흰 배경 위 흰색**이었다
 * (실측 대비 1.1:1 — 글자 rgb(243,244,246) / 배경 rgb(255,255,255)).
 *
 * 원인은 오타가 아니라 **구조**다:
 *   전역 `.dark input:not([type=checkbox])...`(특이도 0,5,1)이 다크 모드에서 모든 입력 글자를
 *   gray-100 으로 덮는다. 지도 오버레이는 `text-gray-900`(0,1,0)을 붙였지만 **클래스 유틸로는
 *   이 싸움을 절대 못 이긴다.** 그리고 지도 코드에 달린 `light-fixed` 는 **주석**이라
 *   `check-theme-consistency` 를 면제해 줄 뿐 **런타임엔 아무 일도 안 한다** — 그래서 가드는
 *   초록인데 화면은 안 보이는, 이 레포가 반복해 온 "조용한 부재" 클래스가 됐다.
 *
 * 그리고 이건 늘어날 수밖에 없는 구조였다. 2026-09-02 에 지도 위 UI·홈 패널을 "테마와 무관하게
 * 늘 흰 면"으로 바꿨는데 전역 다크 규칙은 여전히 "앱이 다크면 표면도 어둡다"를 전제한다.
 * 대표가 그걸 짚었다: *"이런 경우 지금 많은 것 같은데 전수조사 필요해"*.
 *
 * ⇒ 규칙: **늘 밝은 표면에는 `light-island` 클래스를 붙인다.** 주석은 부표일 뿐이다.
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 대비(픽셀). 그건 `scripts/check-dark-contrast.mjs` 가
 *   17개 경로를 다크로 렌더해 글자색 vs 배경색을 직접 재는 쪽이 맡는다. 여기서는 **배선**만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const MAPBAR = readFileSync('src/pages/restaurant-map/MapTopBar.tsx', 'utf8')
const CSS = readFileSync('src/index.css', 'utf8')
const TW = readFileSync('tailwind.config.js', 'utf8')

describe('늘 밝은 표면 = light-island (2026-09-03)', () => {
  it('① 지도 오버레이 컨테이너에 light-island 가 붙어 있다', () => {
    // 오버레이 분기(lg:hidden absolute …)가 light-island 를 갖는지 — 이게 빠지면 흰 검색창에 흰 글자.
    expect(MAPBAR).toMatch(/light-island lg:hidden absolute top-0/)
  })

  it('② 패널 분기는 light-island 가 아니다 (PC 리스트 패널은 테마를 따라야 한다)', () => {
    const panelBranch = MAPBAR.match(/\? 'hidden lg:block[^']*'/)?.[0] || ''
    expect(panelBranch).not.toContain('light-island')
    expect(panelBranch).toContain('dark:') // 패널은 다크 대응을 유지한다
  })

  it('③ light-island 가 전역 라이트 입력 규칙 셋에 모두 들어 있다 (색·placeholder·autofill)', () => {
    // 색 규칙 — 2026-09-02 부터 있었다.
    expect(CSS).toMatch(/\.light-island input, \.light-island textarea, \.light-island select/)
    // placeholder / autofill — 2026-09-03 에 빠져 있던 것을 채웠다. 하나라도 빠지면 그 상태만 다크색.
    expect(CSS).toMatch(/\.light-island input::placeholder, \.light-island textarea::placeholder/)
    expect(CSS).toMatch(/\.light-island input:-webkit-autofill/)
  })

  it('④ tailwind darkMode variant 의 light-island 예외가 살아 있다', () => {
    // 이게 빠지면 섬 안의 dark: 유틸이 다시 켜져 흰 면이 남색이 된다.
    expect(TW).toMatch(/darkMode:\s*\['variant',\s*'&:is\(\.dark \*\):not\(\.light-island \*\)'\]/)
  })

  it('⑤ light-fixed 가 런타임 장치가 아니라는 경고가 CSS 에 남아 있다', () => {
    // 이 사고의 재발 조건은 "주석이면 충분하다"는 오해다 — 문서로 못박는다.
    expect(CSS).toContain('런타임엔 아무 일도 안 한다')
  })
})

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const FILE = 'src/pages/pc-home/PcHomeLocationBar.tsx'
const src = () => fs.readFileSync(FILE, 'utf8')

/**
 * 📱 지역 선택 패널이 화면 밖으로 나가면 안 된다 (2026-08-27 대표 폰 스크린샷 — "화면에서 나가고 있어").
 *
 * **무엇이 문제였나**: 패널이 `absolute left-0` 로 **버튼**에 붙어 있었다. 모바일 헤더에서 그 버튼은
 * 오른쪽에 있으므로, 폭 520px 패널이 오른쪽으로 삐져나가 **문서를 화면보다 넓게** 만들었다.
 * 실측(수리 전): 360px 기기에서 문서폭 **360 → 420**, 390 → 477, 430 → 553. 그래서 페이지가
 * 가로로 밀리고 로고가 왼쪽으로 잘려 보였다.
 *
 * 🔑 **`max-w-[90vw]` 는 이걸 못 막는다** — 문서가 넓어지면 `vw` 도 같이 커져서 자기 자신을 못 잡는다.
 *   (수리 전 측정에서 "화면밖 0px" 로 나온 것이 그 함정이다. 패널은 잘리지 않았고, 대신 페이지가 커졌다.)
 *   ⇒ 좁은 화면에서는 버튼 좌표계를 벗어나 **뷰포트에 고정**해야 한다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 픽셀은 안 잰다 — 소스의 모양만 본다.
 *    좌표 회귀는 브라우저 실측이 유일한 판정이다(수리 시 360/390/430/1440 에서 확인함).
 */
describe('지역 선택 패널 — 뷰포트 밖으로 안 나간다', () => {
  it('좁은 화면에서는 버튼이 아니라 뷰포트에 고정된다', () => {
    const s = src()
    const i = s.indexOf('지역 선택')
    expect(i, '패널 헤더를 못 찾았다 — 문구가 바뀌었으면 이 테스트도 같이 고쳐라').toBeGreaterThan(-1)
    // 패널 컨테이너의 className 식(문자열 템플릿) 안에 좁은 화면 분기가 있어야 한다.
    const cls = s.match(/className=\{`z-\[10500\][\s\S]{0,400}?`\}/)
    expect(cls, '패널 className 템플릿을 못 찾았다').toBeTruthy()
    expect(cls![0]).toContain('fixed')
    expect(cls![0]).toMatch(/left-2[\s\S]*right-2/)   // 좌우 모두 뷰포트에 묶인다
  })

  /**
   * 🕳️ 2026-08-29 — 첫 수리는 게이트를 **640** 으로 잡아 640~767 구간에 구멍을 남겼다.
   *   그 구간에선 바가 아직 모바일 헤더(오른쪽)에 있는데 패널만 `absolute left-0` 로 돌아가
   *   문서가 다시 넓어졌다(실측 700px 에서 +179). 폰을 가로로 눕히면 바로 이 구간이다.
   *   ⇒ 중단점은 **레이아웃이 실제로 바뀌는 곳**(PC 헤더가 뜨는 `md` = 768px)과 같아야 한다.
   */
  it('중단점이 레이아웃 전환점(768px)과 같다 — 사이 구간 구멍 금지', () => {
    const s = src()
    expect(s).toContain("useMediaQuery('(min-width: 768px)')")
    expect(s).not.toContain("useMediaQuery('(min-width: 640px)')")
  })

  it('넓은 화면은 종전대로 버튼에 붙는다 (PC 회귀 방지)', () => {
    const cls = src().match(/className=\{`z-\[10500\][\s\S]{0,400}?`\}/)
    expect(cls![0]).toContain('absolute left-0')
    expect(cls![0]).toContain('w-[520px]')
  })

  it('좁은 화면 top 은 버튼 위치를 실제로 재서 정한다', () => {
    const s = src()
    // 뷰포트 고정이면 `top-[calc(100%+8px)]`(버튼 기준)이 의미를 잃는다 → 측정값이 필요하다.
    expect(s).toContain('getBoundingClientRect().bottom')
    expect(s).toMatch(/style=\{isWide \? undefined : \{ top: panelTop \}\}/)
  })

  it('세로로도 화면을 넘지 않는다', () => {
    // 넘치면 아래 지역을 영영 못 고른다(작은 기기·가로모드).
    expect(src()).toContain('max-h-[calc(100dvh-160px)]')
  })
})

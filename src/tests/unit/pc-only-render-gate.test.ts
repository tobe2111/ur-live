import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

const NAV = 'src/components/main/DesktopTopNav.tsx'
const src = () => fs.readFileSync(NAV, 'utf8')

/**
 * 📱 PC 전용 컴포넌트는 **CSS 로만 숨기지 말고 렌더 자체를 접는다** (2026-08-27 대표 폰 — "로딩이 심각한 문제").
 *
 * **무엇이 문제였나**: `DesktopTopNav` 의 루트가 `hidden md:block` 인데 그 숨김이 **CSS 뿐**이라,
 * 폰에서도 React 가 트리 전체를 만들고(하위 컴포넌트·훅·이펙트 포함) 화면에서만 감췄다.
 * 라이브 CPU 프로파일(390px)에서 **self 548ms 로 홈에서 가장 비쌌고**, 브라우저 실측으로
 * **DOM 노드가 539 → 308 (231개, 43%)** 줄었다. 보이지도 않는 헤더가 첫 화면을 그만큼 늦추고 있었다.
 *
 * 🔑 **`hidden` 은 페인트만 막지 렌더를 안 막는다.** 비용은 그대로 낸다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 다른 PC 전용 컴포넌트는 안 본다(각자 마운트 조건이 달라
 *    일괄 규칙으로 만들면 오탐이 난다 — 실제로 후보 6개 중 홈에 뜨는 건 이거 하나뿐이었다).
 *    같은 클래스 후보는 인계 문서에 적어 뒀다.
 */
describe('PC 전용 헤더 — 모바일에서 렌더 자체를 접는다', () => {
  it('CSS 중단점과 JS 게이트의 중단점이 같다', () => {
    const s = src()
    // 루트가 md(768px)에서 보이므로, 게이트도 768px 이어야 한다. 둘이 어긋나면
    // 사이 구간에서 헤더가 사라지거나(빈 상단) 다시 공짜로 렌더된다.
    expect(s).toMatch(/className="desktop-topnav hidden md:block/)
    expect(s).toContain("window.matchMedia('(min-width: 768px)')")
    expect(s).toMatch(/if \(!isDesktop\) return null/)
  })

  it('게이트가 훅 호출보다 뒤에 있다 (rules of hooks)', () => {
    const s = src()
    const gate = s.indexOf('if (!isDesktop) return null')
    expect(gate).toBeGreaterThan(-1)
    // 게이트 **뒤에** useState/useEffect/useMemo/useCallback 이 남아 있으면 훅 순서가 깨진다.
    const after = s.slice(gate)
    expect(after).not.toMatch(/\buseState\(|\buseEffect\(|\buseMemo\(|\buseCallback\(/)
  })

  it('창을 키우면 다시 나타난다 (matchMedia 리스너 유지)', () => {
    const s = src()
    // 초기값만 읽고 리스너가 없으면 회전·리사이즈 후 헤더가 영영 안 돌아온다.
    const i = s.indexOf("useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)')")
    expect(i).toBeGreaterThan(-1)
    const block = s.slice(i, i + 700)
    expect(block).toContain("addEventListener('change'")
  })
})

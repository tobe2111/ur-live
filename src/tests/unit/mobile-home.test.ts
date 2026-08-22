import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf8')
/** 주석을 걷어낸 코드만 본다 — "주석에만 남아도 통과"하는 헛도는 가드를 막는다. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

const ROUTE = 'src/pages/pc-home/HomeRoute.tsx'
const MOBILE = 'src/pages/mobile-home/MobileHomePage.tsx'

/**
 * 📱 모바일 메인 = 딜 피드 (2026-08-19 대표 확정 — 그루폰 모바일 홈 시안).
 *
 * 대표 지시: *"이건 그루폰 페이지인데 모바일 메인으로 해서 우리도 이걸 메인으로 해줘.
 * 지금은 맵 링크잖아. 대신 변경되는 페이지에서 맵으로 이동하기 버튼이 있어야겠지?"*
 *
 * ⚠️ 못 막는 것: 실제 렌더 결과(카드 밀도·스크롤感). 소스 배선만 본다.
 */
describe('모바일 메인은 딜 피드다 (지도 아님)', () => {
  it('홈 라우트가 모바일에서 피드 홈을 그린다', () => {
    const s = code(ROUTE)
    expect(s).toMatch(/<MobileHomePage \/>/)
    // 지도 홈으로 되돌아가면 실패 — 대표 확정을 조용히 뒤집는 변경을 막는다.
    expect(s).not.toMatch(/<RestaurantMapPage home mode="map" \/>/)
  })

  /**
   * 🗺️ **지도로 가는 길이 반드시 있어야 한다.**
   * 홈이 지도였으므로, 배너가 사라지면 사용자는 지도를 찾을 방법이 없다 — 하단 탭에도 지도가 없다
   * (대표 확정 "안 넣기 — 상단 배너만"). 이 한 줄이 지워져도 화면은 멀쩡해 보여서 리뷰로는 안 걸린다.
   */
  it('피드 상단에 지도 진입 배너가 있다', () => {
    expect(code(MOBILE)).toMatch(/to="\/map"/)
  })

  it('PC 홈과 같은 재료를 쓴다 (한쪽만 개선되는 것 차단)', () => {
    const s = code(MOBILE)
    expect(s).toMatch(/<GroupBuyFeed\b/)      // 카드
    expect(s).toMatch(/<HomeSections\b/)      // 어드민 편성 섹션
    expect(s).toMatch(/DEAL_CATS/)            // 카테고리 라벨·아이콘 SSOT (PC 헤더와 동일)
  })

  it('카테고리를 고르면 편성 섹션을 숨긴다 (PC 홈과 같은 규칙)', () => {
    // 화면 맨 위가 고른 카테고리와 무관하면 "걸러졌다"는 신호가 어디에도 없다(2026-08-08 대표 신고).
    expect(code(MOBILE)).toMatch(/category === 'all' && \(/)
  })

  it("좁은 폭에서 '현 위치로 설정' 라벨이 헤더를 무너뜨리지 않는다", () => {
    // 360px 기기에서 이 라벨이 세 줄로 터져 헤더가 깨졌다(모바일 홈이 이 바를 쓰게 되며 드러남).
    const s = code('src/pages/pc-home/PcHomeLocationBar.tsx')
    expect(s).toMatch(/hidden sm:inline whitespace-nowrap">현 위치로 설정</)
  })
})

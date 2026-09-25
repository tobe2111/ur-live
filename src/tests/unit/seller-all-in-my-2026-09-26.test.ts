/**
 * 🧰 모두 마이에서 (2026-09-26, 설계 §20) — 대표: *"모두 마이에서 하도록"*
 *
 * 셀러 화면은 65개다. 전부 시트로 복제하지 않는다 — 두 벌이 갈리는 순간 한쪽에만 고쳐진 화면이 생긴다.
 * 대신 **마이가 출발점이자 도착점**이 되게 한다. 이 파일이 지키는 것은 그 세 가지 고리다:
 *
 *   ① 목록을 손으로 적지 않는다 — 대시보드와 **같은 색인**을 읽는다(안 그러면 도구가 늘 때 한쪽을 잊는다)
 *   ② 나갈 때 **귀환 표시**를 달고, 그 띠는 레이아웃 **한 곳**에만 있다(65개 중 안 붙인 페이지가 생기지 않게)
 *   ③ 도구 목록은 **좌석을 따라간다** — 종류를 localStorage 가 아니라 토큰에서 읽는다
 *
 * ## 못 막는 것
 * - 실제로 그 화면이 폰에서 열리는지(jsdom 은 레이아웃이 없다).
 * - 65개 각 화면이 마이에서 온 사람에게 말이 되는지 — 그건 사람이 봐야 한다.
 * - 뒤로가기가 진짜 시트를 닫는지(히스토리는 실제 브라우저에서만 판정된다). 배선만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'

const TOOLS = readCode('src/pages/user-profile/seller-section/AllToolsSheet.tsx')
const SECTION = readCode('src/pages/user-profile/SellerSection.tsx')
const LAYOUT = readCode('src/components/SellerLayout.tsx')
const BAR = readCode('src/components/seller/BackToMyBar.tsx')
const RETURN = readCode('src/lib/seller-return.ts')
const SEAT = readCode('src/lib/seller-seat.ts')
const NAVMODEL = readCode('src/components/seller-layout/useSellerNavModel.ts')
const SHEET = readCode('src/pages/user-profile/seller-section/Sheet.tsx')

describe('① 도구 목록을 손으로 적지 않는다', () => {
  it('마이의 전체 도구가 대시보드와 같은 색인을 읽는다', () => {
    const code = stripComments(TOOLS)
    expect(code, '목록을 여기서 따로 적으면 도구가 늘 때 한쪽을 반드시 잊는다')
      .toContain('useSellerNavModel()')
    expect(code).toMatch(/commandItems/)
  })

  it('경로를 손으로 박아 두지 않는다', () => {
    const code = stripComments(TOOLS)
    // `/seller/...` 리터럴이 있으면 그건 색인 밖의 두 번째 목록이 자라고 있다는 뜻이다.
    const hardcoded = code.match(/'\/seller\/[a-z-]+/g) || []
    expect(hardcoded, `손으로 박은 경로: ${hardcoded.join(', ')}`).toHaveLength(0)
  })

  it('전체 도구가 마이 안에서 열린다 (대시보드로 나가지 않는다)', () => {
    const code = stripComments(SECTION)
    expect(code, "종전엔 enterSeat('/seller') 로 곧장 나갔다 — 그러면 마이가 경유지가 된다")
      .toMatch(/openTool\('tools'\)/)
    expect(code).toContain('<AllToolsSheet')
  })
})

describe('② 나갔다가 돌아온다', () => {
  it('마이에서 내보낼 때 귀환 표시를 붙인다', () => {
    const code = stripComments(SECTION)
    expect(code, '표시가 없으면 일이 끝나는 화면에서 마이로 오는 길이 없다')
      .toMatch(/location\.assign\(withMyReturn\(/)
  })

  it('귀환 띠는 레이아웃 한 곳에만 있다', () => {
    expect(stripComments(LAYOUT), '페이지마다 붙이면 안 붙인 페이지가 생긴다').toContain('<BackToMyBar />')
    // 개별 셀러 페이지가 각자 붙이기 시작하면 그 순간 규약이 갈린다.
    const pages = readCode('src/pages/SellerMorePage.tsx')
    expect(stripComments(pages)).not.toContain('BackToMyBar')
  })

  it('띠는 세션 기록으로 판정한다 — URL 파라미터만으로는 부족하다', () => {
    const bar = stripComments(BAR)
    expect(bar).toContain('noteMyReturn(')
    expect(bar).toContain('shouldOfferMyReturn()')
    // 대시보드 안에서 한 번만 이동해도 `?from=my` 는 떨어져 나간다.
    expect(stripComments(RETURN)).toContain('sessionStorage')
  })

  it('마이에 도착하면 흔적을 지운다', () => {
    expect(stripComments(SECTION), '안 지우면 다음 대시보드 방문에도 띠가 남는다')
      .toMatch(/clearMyReturn\(\)/)
    expect(stripComments(BAR), '띠를 눌러 돌아갈 때도 지운다').toMatch(/clearMyReturn\(\)/)
  })

  it('탭 수명이다 — localStorage 에 적지 않는다', () => {
    expect(stripComments(RETURN), '어제 들어간 흔적이 오늘 띠로 뜨면 안 된다')
      .not.toContain('localStorage')
  })
})

describe('③ 도구 목록이 좌석을 따라간다', () => {
  it('매장 종류를 토큰에서 읽는다', () => {
    const code = stripComments(NAVMODEL)
    expect(code, 'localStorage.seller_type 은 좌석 전환을 안 따라간다 — A 의 메뉴를 B 에서 보게 된다')
      .toMatch(/currentSeatType\(\)\s*\|\|/)
  })

  it('좌석 토큰 디코드가 한 벌이다', () => {
    const code = stripComments(SEAT)
    // 두 벌이 되면 claim 을 하나 더 읽을 때마다 세 벌, 네 벌이 된다.
    const decodes = code.match(/atob\(/g) || []
    expect(decodes, `디코드가 ${decodes.length}곳 — readSeatClaims 하나여야 한다`).toHaveLength(1)
    expect(code).toContain('export function readSeatClaims')
    expect(code).toContain('export function currentSeatType')
  })

  it('종류는 표시가 아니라 필터에 쓰이므로 폴백이 있다', () => {
    // 토큰이 없거나 옛 토큰이면 null 이다 — 그때 메뉴가 통째로 비면 안 된다.
    expect(stripComments(NAVMODEL)).toMatch(/\|\|\s*'influencer'/)
  })
})

describe('시트는 뒤로가기로 닫힌다', () => {
  it('열릴 때 히스토리 한 칸을 쌓고 popstate 에서 닫는다', () => {
    const code = stripComments(SHEET)
    expect(code, '안 쌓으면 뒤로가기가 시트가 아니라 마이를 통째로 닫는다').toContain('history.pushState')
    expect(code).toContain("'popstate'")
  })

  it('X·배경으로 닫으면 쌓아 둔 칸을 도로 뺀다', () => {
    const code = stripComments(SHEET)
    expect(code, '안 빼면 그 뒤 뒤로가기를 한 번 먹는다').toMatch(/if \(!popped\)[\s\S]{0,80}history\.back\(\)/)
  })
})

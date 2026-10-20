/**
 * 🧹 2026-09-30 (대표 "다 순서대로 이상적으로 해줘", 항목 ⑥) — **바로가기 넷 + 전체 도구.**
 *
 * ## 무엇이 문제였나 (실측 `--route=/user/profile --width=430 --height=844 --stores=1`)
 *
 * 셀러로 마이를 열면 폰 한 화면이 `전체 도구` 줄에서 **정확히 끝났다**:
 *   헤더 84 + 스탯 76 + 제목 44 + 오늘 카드 100 + 도구 9줄 432 + 하단 탭 76 ≈ 812 / 844
 * 손님 줄은 **0**, "내가 산 것" 제목조차 안 보였다.
 *
 * 2026-09-26 이 그룹 라벨을 걷을 때의 근거는 *"48px 행이면 여덟 줄이 384px 에 다 들어온다"* 였는데,
 * 그건 **이 목록만 떼어 본 계산**이다. 위아래를 같이 재면 화면이 그 목록으로 꽉 찬다.
 *
 * ## 무엇을 했나
 *
 *   · 바로가기 아홉 → **넷**(주문 · 이용권 · 정산 + 전체 도구) + 파란 사용처리 줄.
 *   · 뺀 넷(매출 분석 · 가게 · 소개 파트너 · 브랜드메시지)은 **지운 게 아니라**
 *     바로 아래 `전체 도구` 가 `COVERED_BY_SHEET` 로 **같은 시트**에 보낸다.
 *   · 매출 분석은 아예 사라지지도 않았다 — **오늘 숫자가 그 입구**가 됐다(같은 데이터의 드릴다운).
 *
 * ## 이 시험이 못 보는 것
 *
 *   · 실제 픽셀 — jsdom 엔 레이아웃이 없다. 첫 화면 판정은 브라우저 프레임 캡처가 한다.
 *   · 넷이 **옳은 넷인가** — 빈도 판단이라 사람이 본다(사용처리·주문·이용권·정산).
 */
import { describe, it, expect } from 'vitest'
import { canOpenInSheet } from '@/pages/user-profile/seller-section/tool-pages'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const SECTION = 'src/pages/user-profile/SellerSection.tsx'
const code = stripComments(readFileSync(SECTION, 'utf8'))

describe('🧹 마이 판매 바로가기 — 넷 + 전체 도구 (2026-09-30)', () => {
  it('측정이 비어 있지 않다', () => {
    expect(code.length, '소스를 못 읽었거나 주석 제거가 통째로 먹었다').toBeGreaterThan(8000)
    expect(code).toContain('const COVERED_BY_SHEET')
  })

  it('🔢 오늘 숫자가 매출 분석의 입구다', () => {
    const at = code.indexOf('오늘')
    expect(at, '오늘 카드를 못 찾았다').toBeGreaterThan(0)
    const card = code.slice(at - 400, at + 1400)
    expect(card, '오늘 카드가 눌리지 않는다 — 매출 분석에 닿는 길이 하나 줄었다').toMatch(
      // 🧹 2026-10-01 철거: `openTool('analytics')`(손수 시트) → `openPage(…)`(대시보드 화면).
      //   불변식은 그대로다 — **오늘 숫자를 누르면 매출 분석이 열린다.**
      /<button[\s\S]{0,400}openPage\('\/seller\/analytics'/,
    )
  })

  it('🔤 그 클릭면이 말을 한다 — 말 없는 클릭면을 만들지 않는다', () => {
    /**
     * 2026-07-02 상세의 *"ChevronRight 로 클릭 유도하면서 onClick 없던 dead 어포던스"* 의
     * **정반대 실수** = onClick 은 있는데 아무 표시가 없는 것. 둘 다 안 된다.
     */
    /**
     * 🩸 **2026-10-01: 이 검사가 내 재조준 때문에 헛돌았고, CI 주입이 잡았다.**
     *   철거로 입구가 `openPage('/seller/analytics', '매출 분석')` 이 되면서 그 문구가
     *   **핸들러 안에도** 생겼다. 그래서 *화면의* 라벨을 지우는 주입에도 `toContain('매출 분석')`
     *   이 통과했다 — 핸들러의 인자를 보고 "적혀 있다" 고 판정한 것이다.
     * ⇒ `onClick` 줄을 **건너뛴 뒤**(닫는 `}` 다음)부터 본다. 화면에 적힌 것만 센다.
     */
    const at = code.indexOf("openPage('/seller/analytics'")
    expect(at, 'analytics 입구가 없다').toBeGreaterThan(0)
    const afterHandler = code.indexOf('\n', at)
    expect(afterHandler, 'onClick 줄이 안 끝난다 — 앵커가 낡았다').toBeGreaterThan(at)
    const around = code.slice(afterHandler, afterHandler + 1400)
    expect(around, '누르면 무엇이 열리는지 **화면에** 적혀 있어야 한다(핸들러 인자는 화면이 아니다)')
      .toContain('매출 분석')
  })

  /**
   * 🧹 **2026-10-01 철거로 보증의 근거가 바뀌었다 — 풀지 않고 재조준했다.**
   *
   * 종전 근거: 그 넷이 `COVERED_BY_SHEET` 에 있어 전체 도구가 **손수 시트로** 보냈다.
   * 지금 근거: 손수 시트가 없어졌고, 전체 도구는 **나브 색인**을 그대로 보여 주며
   * `FULL_SCREEN_ONLY` 에 없는 주소를 `ToolPageSheet`(대시보드 화면)로 연다.
   * ⇒ 지키려던 것은 같다 — **줄을 지운 것이 기능을 지운 것이 되면 안 된다.**
   */
  it('🚪 뺀 넷이 전체 도구로 전부 닿는다 (줄을 지우는 것이 기능을 지우는 것이 되면 안 된다)', () => {
    for (const path of ['/seller/analytics', '/seller/store', '/seller/influencer-deals', '/seller/alimtalk']) {
      expect(canOpenInSheet(path), `${path} 가 시트로 안 열린다 — 바로가기에서 뺐는데 전체 도구에서도 못 열면 그냥 사라진 것이다`)
        .toBe(true)
    }
    // 열 수 있다고 선언만 하고 배선이 없으면 아무 일도 안 난다.
    expect(code, '전체 도구가 고른 화면을 시트로 안 연다')
      .toMatch(/if \(inSheet\) \{ setPage\(\{ path, title: label \}\)[\s\S]{0,120}setTool\('page'\); return \}/)
    expect(code, 'page 시트를 안 그린다').toContain("tool === 'page'")
  })

  it('📏 판 안의 누를 수 있는 줄이 다섯을 넘지 않는다 (바로가기가 아홉이면 바로가기가 아니다)', () => {
    // 🎟️ 2026-10-10 재조준(안 3): 판 안의 누르는 줄 = 사용처리 티켓 1 + `이용권 등록 · 관리` 1 + `ToolRow` 3.
    //   종전 식(`ToolRow` + 1)은 등록 줄이 ToolRow 밖으로 나가자 한 칸이 비어, 다섯째 줄을 더해도 통과했다(주입이 잡았다).
    //   ⇒ ToolRow 밖의 줄을 **고정값이 아니라 실제로 센다**.
    const rows = [...code.matchAll(/^\s*label="([^"]+)"$/gm)].map((m) => m[1])
    expect(rows.length, '도구 줄을 못 셌다 — 이 검사가 헛돌고 있다').toBeGreaterThan(0)
    const extra = ['이용권 사용처리', '이용권 등록 · 관리'].filter((t) => code.includes(`>${t}</span>`))
    expect(extra.length, 'ToolRow 밖의 두 줄(티켓·등록)을 못 찾았다 — 이 검사가 헛돌고 있다').toBe(2)
    expect(rows.length + extra.length, `판 안의 줄: ${[...extra, ...rows].join(' · ')}`).toBeLessThanOrEqual(5)
  })
})

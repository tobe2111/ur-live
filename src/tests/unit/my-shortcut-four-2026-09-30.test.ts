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
      /<button[\s\S]{0,400}openTool\('analytics'\)/,
    )
  })

  it('🔤 그 클릭면이 말을 한다 — 말 없는 클릭면을 만들지 않는다', () => {
    /**
     * 2026-07-02 상세의 *"ChevronRight 로 클릭 유도하면서 onClick 없던 dead 어포던스"* 의
     * **정반대 실수** = onClick 은 있는데 아무 표시가 없는 것. 둘 다 안 된다.
     */
    const at = code.indexOf("openTool('analytics')")
    expect(at, 'analytics 입구가 없다').toBeGreaterThan(0)
    const around = code.slice(at, at + 1400)
    expect(around, '누르면 무엇이 열리는지 화면에 적혀 있어야 한다').toContain('매출 분석')
  })

  it('🚪 뺀 넷이 전체 도구로 전부 닿는다 (줄을 지우는 것이 기능을 지우는 것이 되면 안 된다)', () => {
    const table = code.slice(code.indexOf('const COVERED_BY_SHEET'), code.indexOf('/** 묶음 한 줄'))
    for (const [path, tool] of [
      ['/seller/analytics', 'analytics'],
      ['/seller/store', 'store'],
      ['/seller/influencer-deals', 'partners'],
      ['/seller/alimtalk', 'messages'],
    ] as const) {
      expect(table, `${path} 가 표에 없다 — 바로가기에서 뺐는데 전체 도구에도 없으면 그냥 사라진 것이다`)
        .toContain(`'${path}': '${tool}'`)
      // 표에 있어도 시트를 안 그리면 아무 일도 안 난다.
      expect(code, `${tool} 시트를 안 그린다`).toContain(`tool === '${tool}'`)
    }
  })

  it('📏 판 안의 누를 수 있는 줄이 다섯을 넘지 않는다 (바로가기가 아홉이면 바로가기가 아니다)', () => {
    // 파란 사용처리 줄 1 + `ToolRow` 4. 늘어나면 첫 화면이 다시 이 목록으로 꽉 찬다.
    const rows = [...code.matchAll(/^\s*label="([^"]+)"$/gm)].map((m) => m[1])
    expect(rows.length, '도구 줄을 못 셌다 — 이 검사가 헛돌고 있다').toBeGreaterThan(0)
    expect(rows.length + 1, `판 안의 줄: ${['이용권 사용처리', ...rows].join(' · ')}`).toBeLessThanOrEqual(5)
  })
})

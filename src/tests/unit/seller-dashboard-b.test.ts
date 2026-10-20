import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🎫 2026-09-02 (대표 확정 — 셀러 대시보드 **B안** "잉크 사이드바 유지 + 콘텐츠만 체계화", "웬만해선 화이트모드 유지").
 *   화면에서 가장 큰 색 덩어리가 셋(잉크 사이드바·잉크 STEP 카드·잉크 버튼)인데 셋 다 검정이라 주 행동이 안 보였다.
 *   사이드바만 잉크로 두고(활성 = 블루 세로 막대), 콘텐츠는 흰 카드 + 블루 밴드 + 블루 주 버튼.
 *
 * 🧭 **2026-09-14 (대표 Rinda 시안) 로 일부 승계됨** — `docs/design/dashboard-rinda-2026-09.md`.
 *   대표: *"rinda처럼 보이게, 그리고 쉽게 모두 해당이야."* 위 B안의 전제 하나가 뒤집혔다:
 *   **사이드바는 더 이상 잉크가 아니라 흰 면**이고(활성 = 연파랑 알약), 대시보드 카드는
 *   **테두리 0 + 들림**이 아니라 **헤어라인 테두리**다(한 화면에 카드가 10장 넘어 그림자가 소음이 된다 —
 *   소비자 표면의 🎫 규칙 ①과 갈라지는 이유는 시안 문서 §3 에 적혀 있다).
 *   ⇒ 그 두 단언은 아래에서 **새 값으로 교체**했고, 나머지(주 버튼 블루 · `--lift` 되박기 ·
 *     카카오 노랑 0 · 빨강 로그아웃 0 · STEP 티켓 카드 · amber 정보상자 0)는 **그대로 유효**하다.
 *   ⚠️ 못 막는 것: 실제 그림은 `visual-preview --route=/seller --pc --auth=seller` 로 본다.
 */
const read = (f: string) => codeOnly(readFileSync(f, 'utf-8'))
const CSS = readFileSync('src/index.css', 'utf-8')
const LAYOUT = read('src/components/SellerLayout.tsx')
// 📱 2026-09-14 오후(홈 M2): 할 일 카드는 `seller-page/TodoRows.tsx` 로 옮겨 갔다 — 홈 본문 + 그 행을 함께 본다.

describe('셀러 대시보드 B안', () => {
  it('주 버튼(ur-btn-primary)은 브랜드 블루 — 대시보드 셋이 한 줄로 같이 바뀐다', () => {
    expect(CSS).toMatch(/\.ur-btn-primary\s*\{ background: #1C69EF; color: #fff; \}/)
  })
  it('화이트 고정 래퍼가 html.dark 아래서도 카드 들림(--lift)을 갖는다', () => {
    const i = CSS.indexOf('.seller-light-theme {')
    expect(CSS.slice(i, i + 600)).toMatch(/--lift: 0 2px 10px/)
  })
  it('대시보드 카드 부품은 헤어라인 테두리 (9-14 승계 — 소비자 🎫 규칙 ①과 의도적으로 갈라진다)', () => {
    // 근거: docs/design/dashboard-rinda-2026-09.md §3. 소비자 화면은 카드가 몇 장이라 들림이 곱지만,
    // 대시보드는 한 화면에 10장 넘게 깔려 그림자가 그대로 소음이 된다. Rinda 도 헤어라인 하나다.
    for (const f of ['src/components/dashboard/DashboardCard.tsx', 'src/components/dashboard/DashboardStatCard.tsx']) {
      const src = read(f)
      expect(src, f).toContain('border border-rule')
      expect(src, f).not.toContain('shadow-lift')
      expect(src, f).not.toMatch(/border border-gray-200/)
    }
  })
})

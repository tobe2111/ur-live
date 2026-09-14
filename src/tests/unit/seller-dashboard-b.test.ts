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
const BANNER = read('src/components/SellerKakaoLinkBanner.tsx')
const STORES = read('src/pages/seller-page/MyStoresPanel.tsx')
// 📱 2026-09-14 오후(홈 M2): 할 일 카드는 `seller-page/TodoRows.tsx` 로 옮겨 갔다 — 홈 본문 + 그 행을 함께 본다.
const PAGE = read('src/pages/SellerPage.tsx') + read('src/pages/seller-page/TodoRows.tsx')

describe('셀러 대시보드 B안', () => {
  it('주 버튼(ur-btn-primary)은 브랜드 블루 — 대시보드 셋이 한 줄로 같이 바뀐다', () => {
    expect(CSS).toMatch(/\.ur-btn-primary\s*\{ background: #1C69EF; color: #fff; \}/)
  })
  it('화이트 고정 래퍼가 html.dark 아래서도 카드 들림(--lift)을 갖는다', () => {
    const i = CSS.indexOf('.seller-light-theme {')
    expect(CSS.slice(i, i + 600)).toMatch(/--lift: 0 2px 10px/)
  })
  it('사이드바: 활성 = 연파랑 알약(9-14 승계), 로그아웃은 빨강이 아니다, 상담 FAB 은 카카오 노랑이 아니다', () => {
    // 🧭 9-14: 잉크 면 위 흰 글자 → 흰 면 위 잉크 글자 + `.ur-seller-nav-active`(= var(--brand-tint)) 알약.
    expect(LAYOUT).toContain("'font-bold text-gray-900 ur-seller-nav-active'")
    expect(LAYOUT).not.toMatch(/text-white border-brand ur-seller-nav-active/)
    expect(LAYOUT).not.toMatch(/text-red-400 hover:text-red-300/)
    expect(LAYOUT).not.toContain('#FEE500')
    expect(LAYOUT).toMatch(/rounded-full bg-brand hover:bg-\[#1557C8\] text-white/)
  })
  it('카카오 연동 배너: 노랑 원·이모지 없음, 버튼은 체계(ur-btn-primary)', () => {
    expect(BANNER).not.toContain('#FEE500')
    expect(BANNER).not.toContain('💬')
    expect(BANNER).toMatch(/className="ur-btn ur-btn-sm ur-btn-primary shrink-0"/)
  })
  it('STEP 카드는 티켓 부품(블루 밴드 + 흰 본문) — 잉크 카드가 아니다', () => {
    expect(STORES).toMatch(/h-11 px-4 text-\[14px\] text-white bg-brand tabular-nums/)
    expect(STORES).not.toMatch(/bg-gray-900 rounded-2xl p-5 text-white/)
    expect(STORES).toMatch(/className="ur-btn ur-btn-md ur-btn-primary mt-4 w-full sm:w-auto"/)
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
  it('색깔 정보상자(amber) 0 — 할 일 카드는 흰 카드 + 브랜드 틴트 칩', () => {
    // ⚠️ 부분일치 함정: `toContain('bg-amber-50')` 은 **점 색 `bg-amber-500` 에도 걸린다**(2026-09-14 실측).
    //   막으려는 건 색깔 *정보상자*(연한 앰버 면)이지 상태 점이 아니다 → 숫자 경계로 못 박는다.
    expect(PAGE).not.toMatch(/bg-amber-50(?!\d)/)
    expect(PAGE).toContain('rounded-lg bg-brand-tint px-3 py-2 text-xs font-bold text-brand-text')
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

/**
 * 🎫 2026-09-02 (대표 확정 — 셀러 대시보드 **B안** "잉크 사이드바 유지 + 콘텐츠만 체계화", "웬만해선 화이트모드 유지").
 *   화면에서 가장 큰 색 덩어리가 셋(잉크 사이드바·잉크 STEP 카드·잉크 버튼)인데 셋 다 검정이라 주 행동이 안 보였다.
 *   사이드바만 잉크로 두고(활성 = 블루 세로 막대), 콘텐츠는 흰 카드 + 블루 밴드 + 블루 주 버튼.
 *   ⚠️ 못 막는 것: 실제 그림은 `visual-preview --route=/seller --pc --auth=seller` 로 본다.
 */
const read = (f: string) => codeOnly(readFileSync(f, 'utf-8'))
const CSS = readFileSync('src/index.css', 'utf-8')
const LAYOUT = read('src/components/SellerLayout.tsx')
const BANNER = read('src/components/SellerKakaoLinkBanner.tsx')
const STORES = read('src/pages/seller-page/MyStoresPanel.tsx')
const PAGE = read('src/pages/SellerPage.tsx')

describe('셀러 대시보드 B안', () => {
  it('주 버튼(ur-btn-primary)은 브랜드 블루 — 대시보드 셋이 한 줄로 같이 바뀐다', () => {
    expect(CSS).toMatch(/\.ur-btn-primary\s*\{ background: #1C69EF; color: #fff; \}/)
  })
  it('화이트 고정 래퍼가 html.dark 아래서도 카드 들림(--lift)을 갖는다', () => {
    const i = CSS.indexOf('.seller-light-theme {')
    expect(CSS.slice(i, i + 600)).toMatch(/--lift: 0 2px 10px/)
  })
  it('사이드바: 활성 = 블루 세로 막대, 로그아웃은 빨강이 아니다, 상담 FAB 은 카카오 노랑이 아니다', () => {
    expect(LAYOUT).toContain("'text-white border-brand ur-seller-nav-active'")
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
  it('대시보드 카드 부품은 테두리 0 + 들림(표면 규칙 ①)', () => {
    for (const f of ['src/components/dashboard/DashboardCard.tsx', 'src/components/dashboard/DashboardStatCard.tsx']) {
      const src = read(f)
      expect(src, f).toContain('shadow-lift')
      expect(src, f).not.toMatch(/border border-gray-200/)
    }
  })
  it('색깔 정보상자(amber) 0 — 할 일 카드는 흰 카드 + 브랜드 틴트 칩', () => {
    expect(PAGE).not.toContain('bg-amber-50')
    expect(PAGE).toContain('bg-brand-tint rounded-lg text-xs font-bold text-brand-text')
  })
})

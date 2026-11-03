/**
 * 🎨 2026-11-03 대표 *"여기 배경 색이 왜 밝은 색이지? 색 통일이 안됐어 다크모드에서"* — 지도 목록 시트 · 홈 고정 막대.
 * 화면을 덮는 큰 면은 페이지 바탕(`bg-warm` = 라이트 #FFFFFF · 다크 #11141C)이다. `bg-surface` 는 다크에서 카드 색(#1D1F29)이라
 * 그 면만 밝게 뜬다(라이트에선 둘 다 흰색이라 아무도 못 본다 — 그래서 다크에서만 신고가 온다).
 * ⚠️ 못 보는 것: 다른 화면의 같은 실수(그건 다크 렌더로 본다).
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'

describe('다크 바탕 통일', () => {
  it('지도 목록 시트는 페이지 바탕색', () => {
    expect(stripComments(readCode('src/pages/RestaurantMapPage.tsx'))).toMatch(/absolute left-0 right-0 bottom-0 z-30 bg-warm rounded-t-3xl/)
  })
  it('홈 고정 막대는 페이지 바탕색', () => {
    expect(stripComments(readCode('src/pages/mobile-home/MobileHomePage.tsx'))).toMatch(/data-home-compact-bar className="fixed inset-x-0 top-0 z-30 bg-warm /)
  })
})

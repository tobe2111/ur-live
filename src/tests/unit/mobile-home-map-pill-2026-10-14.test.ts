/**
 * 🗺️ 모바일 홈 지도 알약 (2026-10-14 대표 확정 — 다안 · A).
 * 위쪽 [목록|지도] 전환을 걷고, 하단 탭 위에 작은 잉크 알약을 늘 띄운다.
 * ⚠️ 이 시험이 못 보는 것: 실제로 사진 위에서 잘 읽히는지 · 하단 탭과 겹치지 않는지(브라우저 판정).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const PILL = 'src/pages/mobile-home/MapPill.tsx'
const HOME = 'src/pages/mobile-home/MobileHomePage.tsx'
const SSR = 'src/worker/utils/home-first-screen.ts'

describe('모바일 홈 지도 알약', () => {
  it('홈이 알약을 그리고, 위쪽 [목록|지도] 전환은 없다 (지도 버튼이 두 개가 되지 않는다)', () => {
    const h = readCode(HOME)
    expect(h).toMatch(/<MapPill\b/)
    expect(h).not.toMatch(/role="tablist"/)
    expect(h).not.toMatch(/to="\/map"/)
  })
  it('알약은 /map 으로 간다 (하단 탭에 지도가 없어 유일한 통로)', () => {
    expect(readCode(PILL)).toMatch(/to="\/map"/)
  })
  it('작다 — 높이 32px · 13px 글자 (1차 시안 48px 은 "좀 큰데?" 로 반려)', () => {
    const p = readCode(PILL)
    expect(p).toMatch(/\bh-8\b/)
    expect(p).toMatch(/text-\[13px\]/)
  })
  it('늘 바탕의 반대 색 — 라이트 잉크 면 · 다크 흰 면', () => {
    const p = readCode(PILL)
    // `--ink` 는 라이트 #16181C · 다크 #F8F7FC, `--surface` 는 라이트 흰 · 다크 #1D1F29 — 토큰이 뒤집힌다.
    expect(p).toMatch(/\bbg-ink\b/)
    expect(p).toMatch(/\btext-surface\b/)
    expect(p).not.toMatch(/bg-gray-900/)
  })
  it('하단 탭 위에 뜨고 키보드가 뜨면 함께 숨는다', () => {
    const p = readCode(PILL)
    expect(p).toMatch(/calc\(56px \+ 12px \+ env\(safe-area-inset-bottom/)
    expect(p).toMatch(/hide-on-keyboard/)
  })
  it('서버 첫 화면도 전환을 안 그린다 (그리면 마운트 때 위치 줄이 줄어들며 튄다)', () => {
    const s = readCode(SSR)
    expect(s).not.toMatch(/viewToggle/)
    expect(s).not.toMatch(/>목록</)
  })
})

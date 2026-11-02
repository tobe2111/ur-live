/**
 * 📑 이용권 상세 C안 · ③B 가운데 팝업 (2026-11-02 대표 확정)
 *
 * 대표: *"상세페이지 전체는 C안이 좋겠어"* · *"사진 크게 보기는 B안"* ·
 * *"옆으로 넘길 때 뜨는 사진이 너무 느려"* · *"다크 모드일 때 (배경이) 연하다"*.
 *
 * 지키는 것:
 *  ① 폰 구역 탭은 PC 탭과 **같은 목록**(`sectionTabs`)에서 나온다 — 두 벌이면 언젠가 갈린다.
 *  ② 크게 보기(폰)는 1600 원본이 아니라 `MOBILE_VIEW_WIDTH`(1080)를 받고, 지금 ±1 장은 미리(eager) 받는다.
 *  ③ 크게 보기(폰)는 넘길 때 손가락을 따라 밀린다(scroll-snap) — 손을 뗀 뒤 갈아끼우는 방식으로 돌아가지 않는다.
 *
 * ⚠️ 못 보는 것: 실제 폰에서 체감 속도 · sticky 탭이 머리줄 아래 정확히 붙는지(그려서 본다 —
 *    `node scripts/visual-preview.mjs --route=/group-buy/<id> --scroll=1100`).
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { readCode } from '../helpers/source-text'
import DetailLightboxMobile, { MOBILE_VIEW_WIDTH } from '@/pages/group-buy/DetailLightboxMobile'

const PAGE = readCode('src/pages/GroupBuyDetailPage.tsx')
const LB = readCode('src/pages/group-buy/DetailLightboxMobile.tsx')

describe('① 폰 탭 = PC 탭과 같은 목록', () => {
  it('폰 탭은 sectionTabs 에서 파생되고, PC nav 도 sectionTabs 를 그린다', () => {
    expect(PAGE).toMatch(/const mobileTabs = \[\s*\.\.\.sectionTabs\./)
    expect(PAGE).toContain('{sectionTabs.map((tab) => (')
    expect(PAGE).toContain('<DetailSectionTabs tabs={mobileTabs} />')
  })
})

describe('② ③ 폰 크게 보기 — 빠르게', () => {
  const imgs = ['https://t1.kakaocdn.net/a.jpg', 'https://t1.kakaocdn.net/b.jpg', 'https://t1.kakaocdn.net/c.jpg', 'https://t1.kakaocdn.net/d.jpg']
  const seen: number[] = []
  const ui = (active: number) => (
    <DetailLightboxMobile images={imgs} active={active} alt="가게" onActive={() => {}} onClose={() => {}}
      fullUrl={(s, w) => { seen.push(w); return `${s}?w=${w}` }} placeholderUrl={(s) => `${s}?hero`} onDead={() => {}} />
  )
  it('1600 이 아니라 1080 으로 받는다', () => {
    seen.length = 0
    render(ui(0))
    expect(MOBILE_VIEW_WIDTH).toBeLessThan(1600)
    expect(new Set(seen)).toEqual(new Set([MOBILE_VIEW_WIDTH]))
  })
  it('지금 사진과 양옆만 미리 받는다(eager), 나머지는 lazy', () => {
    const { container } = render(ui(1))
    const loading = [...container.querySelectorAll('img')].map((i) => i.getAttribute('loading'))
    expect(loading).toEqual(['eager', 'eager', 'eager', 'lazy'])
  })
  it('사진이 오기 전에도 이미 받은 상세 사진을 밑그림으로 깐다', () => {
    const { container } = render(ui(0))
    const slide = container.querySelector('img')!.parentElement as HTMLElement
    expect(slide.style.backgroundImage).toContain('?hero')
  })
  it('손가락을 따라 밀린다 — 가로 스크롤 스냅', () => {
    expect(LB).toContain("scrollSnapType: 'x mandatory'")
    expect(LB).not.toMatch(/onTouchEnd/)
  })
  it('점을 누르면 그 사진으로 간다', () => {
    let got = -1
    render(<DetailLightboxMobile images={imgs} active={0} alt="가게" onActive={(i) => { got = i }} onClose={() => {}}
      fullUrl={(s) => s} placeholderUrl={(s) => s} onDead={() => {}} />)
    fireEvent.click(screen.getByLabelText('3번째 사진'))
    expect(got).toBe(2)
  })
})

/**
 * 📱 2026-10-27 (대표 "통일할 건 통일" → "모두 이상적으로 작업해줘") 통일 1단계:
 *   숙소 상세도 폰에선 사진이 맨 위 — 이용권 상세와 같다. 빵부스러기는 PC 만, 상단 버튼은 C안(overPhoto).
 *   서버 첫 화면도 같은 모양이어야 마운트 때 안 튄다.
 * 못 보는 것: 실제 프레임 밀림(브라우저로만 판정).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { buildStayDetailFirstScreen } from '@/worker/utils/stay-detail-ssr-body'

const seed = JSON.stringify({ data: { product: { id: 1, name: 'n', restaurant_name: '숙소', property_type: 'hotel', image_url: 'https://media.ur-team.com/a.jpg' } } })

describe('숙소 상세 사진 맨 위', () => {
  it('화면: 빵부스러기는 PC 만, 헤더는 overPhoto', () => {
    const src = readCode('src/pages/StayDetailPage.tsx')
    expect(src).toMatch(/<div className="hidden lg:block"><DetailBreadcrumb items=\{stayCrumbs/)
    expect(src).toMatch(/<DetailFloatingHeader[\s\S]{0,600}?\boverPhoto\b[\s\S]{0,40}?\/>/)
  })
  it('서버 첫 화면: 빵부스러기가 hidden lg:block 안에', () => {
    const html = buildStayDetailFirstScreen(seed, '<div style="min-height:100dvh">L</div>')
    expect(html).not.toBe('')
    const nav = html.indexOf('<nav')
    expect(nav).toBeGreaterThan(-1)
    expect(html.slice(Math.max(0, nav - 40), nav)).toContain('<div class="hidden lg:block">')
  })
})

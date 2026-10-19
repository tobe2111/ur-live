/**
 * 🏁 2026-10-19 (대표 *"모두 개선해줘. 특히 홈 부분이 처음 등장할테니까 최대한 신경써서 우선적으로"*)
 *
 * ① 홈 배너 — 첫 화면 밖 장(2·3장…)의 사진은 페이지가 다 뜬 뒤에 받는다.
 *    라이브 실측: 가로 캐러셀 안의 `loading="lazy"` 가 옆 장을 "곧 보일 것" 으로 보고 첫 화면과 같이 받아
 *    (장당 ~45KB) 맨 위 배너(LCP)·카드 사진과 회선을 나눠 썼다. 손이 닿거나 자동 넘김이 다가오면 즉시 받는다.
 * ② 숙소 목록 — 검색 응답이 `dominant_color` 를 안 실어서 카드가 **모든 숙소** 색을 다시 뽑아 서버로 보냈다
 *    (새 브라우저마다 POST 2회 — 서버는 이미 값이 있어 버린다). 응답에 싣고 카드에 넘긴다.
 *
 * ⚠️ 못 보는 것: 실제 회선에서 LCP 가 얼마나 당겨지는지(브라우저 실측) · 자동 넘김 직전에 받기 시작한 사진이
 *    넘기기 전에 다 오는지(회선 속도에 달렸다 — 1.5초 앞서 출발).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, act, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'

const B = [1, 2, 3].map((id, i) => ({ id, title: `배너${id}`, link_url: '/vouchers', image_url: `https://media.ur-team.com/b${id}.webp`, description: null, banner_slot: 'strip' as const, display_order: i }))

afterEach(() => { vi.useRealTimers() })

const imgs = (c: HTMLElement) => c.querySelectorAll('img').length

describe('① 홈 배너 — 옆 장 사진은 load 뒤', () => {
  it('첫 렌더에는 첫 장 사진 하나만, load 뒤 한가해지면 전부', async () => {
    vi.useFakeTimers()
    const { BannerHeroRail } = await import('@/components/home/HomeBannerStrip')
    const { container } = render(<MemoryRouter><BannerHeroRail banners={B} /></MemoryRouter>)
    expect(imgs(container)).toBe(1)
    await act(async () => { vi.advanceTimersByTime(400) })
    expect(imgs(container)).toBe(4) // 3장 + 순환 복제 1장
  })
  it('손이 닿으면 기다리지 않고 바로 받는다(빈 장을 보이지 않게)', async () => {
    vi.useFakeTimers()
    const { BannerHeroRail } = await import('@/components/home/HomeBannerStrip')
    const { container } = render(<MemoryRouter><BannerHeroRail banners={B} /></MemoryRouter>)
    expect(imgs(container)).toBe(1)
    const rail = container.querySelector('[aria-roledescription="carousel"] .relative > div') as HTMLElement
    await act(async () => { fireEvent.pointerDown(rail) })
    expect(imgs(container)).toBe(4)
  })
  it('한 장뿐이면 미룰 것이 없다(그대로 그린다)', async () => {
    const { BannerHeroRail } = await import('@/components/home/HomeBannerStrip')
    const { container } = render(<MemoryRouter><BannerHeroRail banners={B.slice(0, 1)} /></MemoryRouter>)
    expect(imgs(container)).toBe(1)
  })
  it('자동 넘김 직전에 미리 받기 시작한다', () => {
    const src = stripComments(readFileSync('src/components/home/HomeBannerStrip.tsx', 'utf8'))
    expect(src).toMatch(/setTimeout\(\(\) => setWarm\(true\), Math\.max\(0, wait - WARM_BEFORE_ADVANCE_MS\)\)/)
    expect(src).toMatch(/deferImg=\{!warm && i >= perView\}/)
  })
})

describe('② 숙소 검색 — 대표색을 싣고 카드에 넘긴다', () => {
  it('서버 SELECT 에 dominant_color', () => {
    const r = stripComments(readFileSync('src/features/group-buy/api/stays-public.routes.ts', 'utf8'))
    expect(r).toMatch(/SELECT p\.id, p\.name, p\.image_url, p\.seller_id, p\.dominant_color,/)
  })
  it.each(['src/pages/StaysSearchPage.tsx', 'src/pages/stays/StayCurations.tsx'])('%s 카드가 그 값을 넘긴다', (f) => {
    expect(stripComments(readFileSync(f, 'utf8'))).toContain('dominant_color: s.dominant_color ?? null')
  })
})

/**
 * 📋 홈 이용권 줄 카드 — 안 2 + 거리 오른쪽 위 〔2026-11-03 대표 확정〕
 *
 * 대표: *"부산 연제구 정도까지만 나오고, 업체명이랑 한줄로"* → 시안 6개
 * (https://claude.ai/artifact/B4fR2JaNUV9tfRkZJcpRrh) → *"안2 에 거리는 안 5처럼 오른쪽 상단에"*.
 *
 * 지키는 것
 *   ① 주소는 시·구까지만(`shortRegion`)
 *   ② 줄 목록(row): [제목 · 거리] 줄이 맨 위, 그 아래 [업체명 · 시·구] 한 줄
 *   ③ 거리는 제목 줄 안(오른쪽 끝)에 있다 — 아래 주소 줄로 내려가지 않는다
 *   ④ 격자(row 아님 — 숙소 목록·PC 등)는 종전 순서 그대로(업체명 → 제목)
 * 워커 첫 화면과 카드가 같은 마크업인지는 `home-ssr-first-screen-2026-10-08` 이 진짜 렌더로 대조한다.
 *
 * 못 막는 것: 글자가 실제로 한 줄에 들어가는지(픽셀) — 그건 그려서 본다.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import GroupBuyFeedCard from '@/pages/main-home/GroupBuyFeedCard'
import { shortRegion } from '@/shared/deal-card-grid'
import { cardHtml } from '@/worker/utils/home-first-screen'

const P = {
  id: 1, name: '소금빵 5개 세트', restaurant_name: '꾸꾸데쎄르',
  restaurant_address: '부산 연제구 중앙천로39번길 12', restaurant_lat: 35.18, restaurant_lng: 129.08,
  price: 9400, original_price: 13000, avg_rating: 4.8, review_count: 35, image_url: 'https://i.ibb.co/x.jpg',
}

function card(row: boolean, userLoc: { lat: number; lng: number } | null = null): HTMLAnchorElement {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const { container } = render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <GroupBuyFeedCard p={P as any} row={row} userLoc={userLoc} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return container.querySelector('a') as HTMLAnchorElement
}

describe('shortRegion — 시·구까지만', () => {
  it.each([
    ['부산 연제구 중앙천로39번길 12', '부산 연제구'],
    ['경기 성남시 분당구 판교역로 1', '경기 성남시 분당구'],
    ['세종특별자치시 한누리대로 2130', '세종특별자치시'],
    ['서울특별시 강남구 테헤란로 1', '서울특별시 강남구'],
    ['', ''],
    [null, ''],
  ])('%s → %s', (input, want) => {
    expect(shortRegion(input as string | null)).toBe(want)
  })
})

describe('줄 목록(row) — 안 2', () => {
  it('맨 위가 제목이고 그 다음 줄이 업체명 · 시·구 한 줄이다', () => {
    const body = card(true).children[1] as HTMLElement
    const [titleLine, meta] = Array.from(body.children) as HTMLElement[]
    expect(titleLine.querySelector('p')?.textContent).toBe('소금빵 5개 세트')
    expect(meta.textContent).toBe('꾸꾸데쎄르·부산 연제구')
    expect(body.textContent).not.toContain('중앙천로')
  })

  it('거리는 제목 줄 오른쪽에 붙는다(주소 줄이 아니라)', () => {
    const body = card(true, { lat: 35.18, lng: 129.09 }).children[1] as HTMLElement
    const [titleLine, meta] = Array.from(body.children) as HTMLElement[]
    expect(titleLine.lastElementChild?.textContent).toMatch(/km$/)
    expect(meta.textContent).not.toMatch(/km/)
  })

  it('워커 첫 화면도 같은 순서다(거리 없이)', () => {
    const html = cardHtml(P, true, undefined, true)
    expect(html.indexOf('소금빵 5개 세트')).toBeLessThan(html.indexOf('꾸꾸데쎄르'))
    expect(html).toContain('부산 연제구')
    expect(html).not.toContain('중앙천로')
  })
})

describe('격자(row 아님)는 종전 순서', () => {
  it('업체명이 제목보다 먼저다', () => {
    const t = card(false).textContent || ''
    expect(t.indexOf('꾸꾸데쎄르')).toBeLessThan(t.indexOf('소금빵 5개 세트'))
    expect(t).not.toContain('중앙천로')
  })
})

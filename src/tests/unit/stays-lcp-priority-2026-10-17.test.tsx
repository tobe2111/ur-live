/**
 * ⚡ 2026-10-17 숙소 목록(`/stays`) — 첫 화면 사진 한 장만 먼저 받는다.
 *
 * 라이브 실측(느린 4G·CPU 4배·글꼴 맞춤): 카드 사진이 전부 `loading=lazy` 였는데 느린 회선의 lazy 여백이
 * 커서 **15장이 같은 순간(3.36s)** 에 출발했고, 맨 위 사진(LCP)이 회선을 나눠 쓰느라 ~5.0s 에 떴다.
 * 첫 줄 첫 장을 `aboveFold`(eager + fetchpriority=high)로 둔다. 나머지는 그대로 lazy.
 *
 * ⚠️ 못 보는 것: 실제로 몇 초 당겨지는지(배포 후 라이브 실측) · 브라우저 우선순위 구현.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StayCardRow } from '@/pages/stays/StayCurations'
import { readCode } from '../helpers/source-text'

const item = (id: number) => ({ id, name: `숙소${id}`, price_from: 100000, image_url: `https://media.ur-team.com/a${id}.jpg`, region_sido: '강원' } as never)

function covers(firstAboveFold: boolean) {
  const { container } = render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <StayCardRow items={[item(1), item(2), item(3)]} checkIn="2026-10-18" checkOut="2026-10-19" guests={2} firstAboveFold={firstAboveFold} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return [...container.querySelectorAll('img')].filter(i => /a\d\.jpg/.test(i.getAttribute('src') || ''))
}

describe('숙소 목록 — 첫 화면 사진 우선순위', () => {
  it('첫 줄이면 첫 장만 eager·high, 나머지는 lazy', () => {
    const imgs = covers(true)
    expect(imgs.length).toBeGreaterThanOrEqual(3)
    expect(imgs[0].getAttribute('loading')).toBe('eager')
    expect(imgs[0].getAttribute('fetchpriority')).toBe('high')
    for (const im of imgs.slice(1)) expect(im.getAttribute('loading')).toBe('lazy')
  })
  it('첫 줄이 아니면(비슷한 스테이·둘째 줄) 전부 lazy', () => {
    for (const im of covers(false)) expect(im.getAttribute('loading')).toBe('lazy')
  })
  it('배선 — 큐레이션 첫 줄만 넘기고, 큐레이션이 없을 때만 격자 앞 두 장', () => {
    expect(readCode('src/pages/stays/StayCurations.tsx')).toMatch(/firstAboveFold=\{ri === 0\}/)
    expect(readCode('src/pages/StaysSearchPage.tsx')).toMatch(/aboveFold=\{!curated && i < 2\}/)
  })
})

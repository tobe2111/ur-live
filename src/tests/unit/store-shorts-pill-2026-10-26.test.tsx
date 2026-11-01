/**
 * 🎬 2026-10-26 (대표 "이용권 상세 갤러리에 매장 숏폼 영상"): 상세 사진 위 `▶ 매장 영상` 버튼.
 *
 * 불변식:
 *   ① 그 이용권에 연결된 영상만 고른다(유어쇼츠 공개 목록 = 뷰어와 같은 데이터)
 *   ② 영상이 없으면 아무것도 안 그린다 · 누르면 뷰어가 그 영상부터 튼다(`/videos?v=`)
 *   ③ 사진 위에 떠 있다(absolute — 늦게 와도 아래를 안 민다) · 대형 사진 버튼 **밖**(버튼 안 링크 금지)
 *   ④ 목록은 첫 화면 뒤에 받는다(runAfterLoad) · 이용권·숙소 상세 둘 다 배선
 * ⚠️ 못 보는 것: 실제 영상 재생(유튜브) · 틱톡 등 유튜브 밖 영상(유어쇼츠가 유튜브만 받는다).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { readCode } from '../helpers/source-text'
import { storeShortsFor, storeShortsHref } from '@/shared/urshorts-store'
import type { UrShortItem } from '@/shared/urshorts'

vi.mock('@/lib/after-load', () => ({ runAfterLoad: (fn: () => void) => { fn(); return () => {} } }))

const item = (id: number, product_id: number | null, video_id = `v${id}`) => ({ id, video_id, product_id } as unknown as UrShortItem)

describe('매장 영상 고르기', () => {
  it('그 이용권 영상만 · 빈 video_id 제외', () => {
    const list = [item(1, 7), item(2, 8), item(3, 7), item(4, 7, ''), item(5, null)]
    expect(storeShortsFor(list, 7).map((x) => x.id)).toEqual([1, 3])
    expect(storeShortsFor(list, 0)).toEqual([])
    expect(storeShortsFor(null, 7)).toEqual([])
  })
  it('뷰어 주소는 그 영상부터', () => {
    expect(storeShortsHref({ video_id: 'ab_C-1' })).toBe('/videos?v=ab_C-1')
  })
})

describe('사진 위 버튼', () => {
  it('영상이 있으면 뷰어 링크를 그린다 · 없으면 아무것도', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ json: async () => ({ success: true, data: [item(1, 7), item(2, 7), item(3, 9)] }) })))
    const { default: StoreShortsPill } = await import('@/pages/group-buy/StoreShortsPill')
    const { container, rerender } = render(<MemoryRouter><StoreShortsPill productId={7} /></MemoryRouter>)
    const a = await screen.findByRole('link')
    expect(a.getAttribute('href')).toBe('/videos?v=v1')
    expect(a.textContent).toContain('매장 영상 2')
    expect(a.className.split(' ')).toContain('absolute')
    rerender(<MemoryRouter><StoreShortsPill productId={123} /></MemoryRouter>)
    await waitFor(() => expect(container.querySelector('[data-store-shorts]')).toBeNull())
    vi.unstubAllGlobals()
  })
})

describe('배선', () => {
  const gal = readCode('src/pages/group-buy/DetailGallery.tsx')
  it('PC 에서 overlay 는 대형 사진 버튼 밖에 둔다', () => {
    const btnStart = gal.indexOf('aria-label={has ? \'사진 크게 보기\' : alt}')
    const btnEnd = gal.indexOf('</button>', btnStart)
    const inside = gal.slice(btnStart, btnEnd)
    expect(inside).not.toContain('{overlay}')
    expect(gal.split('{overlay}').length - 1).toBe(2)
  })
  it('목록은 첫 화면 뒤에 받는다', () => {
    const pill = readCode('src/pages/group-buy/StoreShortsPill.tsx')
    expect(pill).toMatch(/runAfterLoad\(\(\) => \{\s*loadShorts\(\)/)
  })
  it('이용권·숙소 상세 둘 다 배선', () => {
    expect(readCode('src/pages/GroupBuyDetailPage.tsx')).toContain('<StoreShortsPill productId={detail.id} />')
    expect(readCode('src/pages/StayDetailPage.tsx')).toContain('overlay={<StoreShortsPill productId={stay.id} />}')
  })
})

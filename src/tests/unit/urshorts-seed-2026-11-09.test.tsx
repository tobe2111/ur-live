/**
 * 🎬 유어쇼츠 목록 첫 화면 (2026-11-09 대표 *"유어쇼츠도 그렇고 너무 늦는데?"*).
 *   라이브 실측: 목록(`/api/urshorts?all=1`)이 앱이 켜진 뒤 2.2초에 출발 → 썸네일 4초. 워커가 가진 시드를 **버리고** 있었다.
 *   고정하는 것:
 *     ① 워커는 `/urshorts` 시드를 더 이상 버리지 않고(`ssrPayload = null` 없음) 첫 두 썸네일을 Link preload(auto)로 당긴다
 *     ② 화면은 시드를 **첫 렌더**에 그린다(fetch 가 끝나기 전에 카드가 있다)
 *     ③ 그러고도 `?all=1` 전량을 받는다 — 10편 시드가 전량을 **대체하지 않는다**(2026-10-13 규율)
 *     ④ preload 주소는 카드가 그리는 주소와 같다(다르면 버려진다)
 *   못 보는 것: 실제 네트워크 순서(라이브 실측으로 본다).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { readRaw } from '../helpers/source-text'
import { urshortsThumbPreloadHrefs, URSHORTS_CARD_THUMB_WIDTH } from '@/worker/utils/urshorts-seed'
import { readUrShortsSeed, URSHORTS_SEED_ID } from '@/shared/home-near-seed-read'
import { cfImage } from '@/utils/cf-image'

const ITEMS = [
  { id: 1, video_id: 'a', title: '싸와디 쌀국수', channel: null, thumb_url: 'https://i.ytimg.com/vi/a/hq.jpg', product_id: null, region_si: '부산' },
  { id: 2, video_id: 'b', title: '돈가스 맛집', channel: null, thumb_url: 'https://i.ytimg.com/vi/b/hq.jpg', product_id: null, region_si: '서울' },
  { id: 3, video_id: 'c', title: '제주 흑돼지', channel: null, thumb_url: null, product_image: 'https://media.ur-team.com/x.jpg', product_id: null, region_si: '제주' },
]
const PAYLOAD = JSON.stringify({ success: true, data: ITEMS })

function plantSeed(payload = PAYLOAD) {
  const s = document.createElement('script'); s.id = URSHORTS_SEED_ID; s.type = 'application/json'; s.textContent = payload; document.body.appendChild(s)
}
beforeEach(() => { document.getElementById(URSHORTS_SEED_ID)?.remove() })
afterEach(() => { vi.restoreAllMocks(); document.getElementById(URSHORTS_SEED_ID)?.remove() })

describe('① 워커 — 시드를 버리지 않고 첫 두 썸네일을 preload', () => {
  const w = readRaw('src/worker/index.ts')
  it("`/urshorts` 에서 ssrPayload = null 로 버리는 줄이 없다", () => {
    expect(w).not.toMatch(/url\.pathname === '\/urshorts'\) ssrPayload = null/)
  })
  it('폰이면 urshortsThumbPreloadHrefs 를 appendLcpLink(auto) 로 싣는다', () => {
    expect(w).toMatch(/url\.pathname === '\/urshorts' && ssrPayload && isMobileUserAgent\([^\n]*?\) for \(const th of urshortsThumbPreloadHrefs\(ssrPayload\)\) appendLcpLink\(c\.res\.headers, th, 'auto'\)/)
  })
  it('preload 주소 = 카드 주소(cfImage width 360) · 둘까지 · 잘못된 입력은 []', () => {
    expect(urshortsThumbPreloadHrefs(PAYLOAD)).toEqual([cfImage(ITEMS[0].thumb_url!, { width: URSHORTS_CARD_THUMB_WIDTH }), cfImage(ITEMS[1].thumb_url!, { width: URSHORTS_CARD_THUMB_WIDTH })])
    expect(readRaw('src/pages/urshorts/BrowseCard.tsx')).toContain('cfImage(thumb, { width: 360 })')
    expect(URSHORTS_CARD_THUMB_WIDTH).toBe(360)
    expect(urshortsThumbPreloadHrefs(null)).toEqual([]); expect(urshortsThumbPreloadHrefs('{bad')).toEqual([]); expect(urshortsThumbPreloadHrefs(JSON.stringify({ success: false, data: ITEMS }))).toEqual([])
  })
})

describe('②③ 화면 — 시드를 첫 렌더에 그리고, 그래도 전량을 받는다', () => {
  it('readUrShortsSeed 는 success+data(비어 있지 않음)만 돌려준다', () => {
    expect(readUrShortsSeed()).toBeNull()
    plantSeed(JSON.stringify({ success: true, data: [] })); expect(readUrShortsSeed()).toBeNull(); document.getElementById(URSHORTS_SEED_ID)!.remove()
    plantSeed(); expect((readUrShortsSeed() as unknown[]).length).toBe(3)
  })
  it('fetch 가 아직 안 끝났는데 카드가 있고, fetch 는 ?all=1 로 나간다', async () => {
    plantSeed()
    let resolveFetch: ((v: unknown) => void) | null = null
    const fetchMock = vi.fn(() => new Promise((res) => { resolveFetch = res }))
    vi.stubGlobal('fetch', fetchMock)
    const { default: Page } = await import('@/pages/UrShortsBrowsePage')
    render(<HelmetProvider><MemoryRouter initialEntries={['/urshorts']}><Page /></MemoryRouter></HelmetProvider>)
    expect(screen.getAllByRole('link').length).toBeGreaterThanOrEqual(3) // 시드 카드가 바로 있다
    expect(fetchMock).toHaveBeenCalledWith('/api/urshorts?all=1') // 그래도 전량을 받는다
    await act(async () => { resolveFetch!({ json: async () => ({ success: true, data: [...ITEMS, { ...ITEMS[0], id: 9, video_id: 'z', title: '열한 번째' }] }) }) })
    expect(screen.getByText('열한 번째')).toBeTruthy() // 전량으로 갈아끼운다
  })
  it('폰 첫 화면(2열×2줄) 카드 넷은 eager', () => {
    expect(readRaw('src/pages/UrShortsBrowsePage.tsx')).toMatch(/eager=\{i < 4\}/)
  })
})

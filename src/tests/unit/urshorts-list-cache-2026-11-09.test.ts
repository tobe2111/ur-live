/**
 * 🎬 유어쇼츠 전량 목록 한 벌 (2026-11-09) — 목록 화면·상세 알약·뷰어가 같은 요청을 각자 받지 않는다.
 *   실측: 목록 → 카드 누름 → 뷰어가 `?all=1` 을 다시 받고(≈0.5s) 그 뒤에야 재생기 — 첫 프레임 1.4s.
 *   고정: ① 동시 호출은 요청 1회 ② 받은 뒤엔 요청 0·peek 로 동기 접근 ③ 실패는 캐시하지 않는다 ④ 세 소비자가 전부 이 모듈을 쓴다
 *   ⑤ 뷰어는 첫 렌더에 peek 로 영상 자리를 찾는다. 못 보는 것: 실제 체감(배포 뒤 trans2.cjs 로 재실측).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { loadShortsAll, peekShortsAll, __resetShortsAllForTest } from '@/shared/urshorts-list-cache'
import { readRaw } from '../helpers/source-text'

const ok = (data: unknown) => ({ json: async () => ({ success: true, data }) })
beforeEach(() => __resetShortsAllForTest())
afterEach(() => vi.restoreAllMocks())

describe('①②③ 캐시 동작', () => {
  it('동시에 둘이 불러도 요청은 한 번 · 그 뒤엔 요청 0 · peek 가 같은 배열', async () => {
    const f = vi.fn(async () => ok([{ id: 1, video_id: 'a' }]))
    vi.stubGlobal('fetch', f)
    expect(peekShortsAll()).toBeNull()
    const [a, b] = await Promise.all([loadShortsAll(), loadShortsAll()])
    expect(f).toHaveBeenCalledTimes(1); expect(f).toHaveBeenCalledWith('/api/urshorts?all=1')
    expect(a).toBe(b); expect(peekShortsAll()).toBe(a)
    await loadShortsAll(); expect(f).toHaveBeenCalledTimes(1)
  })
  it('실패(네트워크·success:false·빈 목록)는 캐시하지 않는다 — 다음 호출이 다시 받는다', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ json: async () => ({ success: false }) }).mockResolvedValueOnce(ok([{ id: 2, video_id: 'b' }]))
    vi.stubGlobal('fetch', f)
    expect(await loadShortsAll()).toEqual([]); expect(peekShortsAll()).toBeNull()
    expect(await loadShortsAll()).toEqual([]); expect(peekShortsAll()).toBeNull()
    expect((await loadShortsAll()).length).toBe(1); expect(f).toHaveBeenCalledTimes(3)
  })
})

describe('④⑤ 세 소비자', () => {
  it('목록 화면·상세 알약·뷰어가 전부 한 벌을 쓰고, 자기 fetch 를 갖지 않는다', () => {
    for (const f of ['src/pages/UrShortsBrowsePage.tsx', 'src/pages/group-buy/StoreShortsPill.tsx', 'src/pages/VideosPage.tsx']) {
      const src = readRaw(f)
      expect(src, f).toContain('loadShortsAll')
      expect(src, f).not.toContain("fetch('/api/urshorts")
    }
  })
  it('뷰어는 첫 렌더에 peek 로 목록·영상 자리를 잡는다(목록에서 넘어오면 0 왕복)', () => {
    const v = readRaw('src/pages/VideosPage.tsx')
    expect(v).toMatch(/useState<UrShortItem\[\] \| null>\(\(\) => peekShortsAll\(\)\)/)
    expect(v).toMatch(/useState\(\(\) => \{ const v = new URLSearchParams\(window\.location\.search\)\.get\('v'\); const l = peekShortsAll\(\)/)
  })
  it('목록 화면은 전량이 손에 있으면 시드보다 그것을 먼저 쓴다', () => {
    expect(readRaw('src/pages/UrShortsBrowsePage.tsx')).toContain('useState<UrShortItem[] | null>(() => peekShortsAll() ?? readUrShortsSeed<UrShortItem>())')
  })
})

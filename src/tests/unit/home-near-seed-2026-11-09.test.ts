/**
 * 📍 홈 거리순 피드 시드 (2026-11-09 대표 *"아직 많이 느리네"* — 위치 저장 손님 화면이 '불러오는 중').
 *   ① 위치 쿠키가 있으면 같은 격자 키로 거리순 피드를 별도 슬롯에 싣는다(없으면 아무것도 안 한다)
 *   ② 시드 경로가 화면 요청과 글자 하나 다르지 않다(다르면 엣지 캐시·시드가 따로 논다)
 *   ③ 화면은 키가 같을 때만 쓴다
 *   ④ 마감을 넘기면 버린다(HTML 을 붙잡지 않는다)
 *   ⚠️ 못 보는 것: 실제 라이브에서 시드가 마감 안에 오는 비율(라이브 실측 몫).
 * @vitest-environment jsdom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { homeNearSeedTarget, homeNearSeedScript, homeNearSeedPath, withSeedDeadline, homeShortsSeedScript, HOME_SHORTS_SEED_TARGET, homeBannersSeedScript, HOME_BANNERS_SEED_TARGET } from '@/worker/utils/home-near-seed'
import { readHomeNearSeed, HOME_NEAR_SEED_ID, readHomeShortsSeed, readHomeBannersSeed } from '@/shared/home-near-seed-read'

afterEach(() => { document.body.innerHTML = '' })

describe('홈 거리순 피드 시드', () => {
  it('① 위치 쿠키가 있을 때만 대상이 된다', () => {
    expect(homeNearSeedTarget(null)).toBeNull()
    expect(homeNearSeedTarget('a=1')).toBeNull()
    const t = homeNearSeedTarget('x=1; ur_loc=37.566_126.978')!
    expect(t.key).toBe('37.56,126.98')
    expect(t.target.path).toBe('/api/group-buy/products?status=active&category=all&near=37.56,126.98')
  })
  it('② 화면 요청 문자열과 같다', () => {
    const feed = readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8')
    expect(feed).toContain('`/api/group-buy/products?status=active&category=${category}${feedParams}`')
    expect(feed).toContain("const serverSort = nearKey ? '' : sort")
    expect(homeNearSeedPath('1.00,2.00')).toBe('/api/group-buy/products?status=active&category=all&near=1.00,2.00')
  })
  it('③ 키가 같을 때만 읽는다', () => {
    document.body.innerHTML = homeNearSeedScript('37.56,126.98', JSON.stringify({ success: true, data: [{ id: 1 }] }))
    expect(readHomeNearSeed('37.56,126.98')).toEqual([{ id: 1 }])
    expect(readHomeNearSeed('37.58,126.98')).toBeUndefined()
    expect(document.getElementById(HOME_NEAR_SEED_ID)).not.toBeNull()
  })
  it('③ 이상한 키는 속성에 넣지 않는다', () => {
    expect(homeNearSeedScript('"><x', '{}')).toBe('')
  })
  it('④ 마감을 넘기면 null', async () => {
    const slow = new Promise<{ payload: string; status: string; timings: string[] }>((r) => setTimeout(() => r({ payload: '{}', status: 'x', timings: [] }), 50))
    expect(await withSeedDeadline(slow, 10)).toBeNull()
    const fast = Promise.resolve({ payload: '{}', status: 'x', timings: [] })
    expect((await withSeedDeadline(fast, 50))?.payload).toBe('{}')
  })
  it('⑤ 화면이 거리순일 때 그 시드를 initialData 로 쓴다', () => {
    const feed = readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8')
    expect(feed).toMatch(/initialData: nearKey \? nearSeed : ssrInitial/)
    const w = readFileSync('src/worker/index.ts', 'utf8')
    expect(w).toMatch(/if \(homeNearSeedHtml\) el\.append\(homeNearSeedHtml/)
  })
  it('⑥ 유어쇼츠 줄 시드 — 화면 요청과 같은 경로 · 한 번만 읽힌다', () => {
    const rail = readFileSync('src/components/home/UrShortsRail.tsx', 'utf8')
    expect(rail).toContain("fetch('/api/urshorts')")
    expect(HOME_SHORTS_SEED_TARGET.path).toBe('/api/urshorts')
    expect(rail).toMatch(/function freshRailList\(\)[\s\S]{0,200}readHomeShortsSeed/)
    document.body.innerHTML = homeShortsSeedScript(JSON.stringify({ success: true, data: [{ id: 7 }] }))
    expect(readHomeShortsSeed()).toEqual([{ id: 7 }])
    expect(readHomeShortsSeed()).toBeNull()
    const w = readFileSync('src/worker/index.ts', 'utf8')
    expect(w).toMatch(/isMainPage \? withSeedDeadline\(fetchSsrPayload\(HOME_SHORTS_SEED_TARGET/)
  })
  it('⑦ 배너 전체 시드 — 화면 요청과 같은 경로 · 화면이 첫 렌더에 쓴다', () => {
    expect(HOME_BANNERS_SEED_TARGET.path).toBe('/api/banners')
    const hook = readFileSync('src/components/home/useHomeBanners.ts', 'utf8')
    expect(hook).toContain("'/api/banners',")
    expect(hook).toMatch(/const all = readHomeBannersSeed<HomeBanner>\(\)/)
    document.body.innerHTML = homeBannersSeedScript(JSON.stringify({ success: true, data: [{ id: 3, banner_slot: 'hero' }] }))
    expect(readHomeBannersSeed()).toEqual([{ id: 3, banner_slot: 'hero' }])
    const w = readFileSync('src/worker/index.ts', 'utf8')
    expect(w).toMatch(/isMainPage \? withSeedDeadline\(fetchSsrPayload\(HOME_BANNERS_SEED_TARGET/)
  })
})

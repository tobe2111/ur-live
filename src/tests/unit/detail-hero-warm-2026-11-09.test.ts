/**
 * 👆 2026-11-09 대표 *"눌렀을 때 반응하는 속도"* — 이용권 카드에 손가락이 닿는 순간 상세 큰 사진을 받기 시작한다.
 * 실측(폰 흉내 · CPU 4배 · 느린 4G): 누른 뒤 0.34초에야 큰 사진이 출발했고 아래쪽 15건과 회선을 나눴다.
 * ⚠️ 못 보는 것: 실제로 몇 초 줄었는지(배포 뒤 라이브) · 화면이 그 요청을 재사용하는지는 주소 대조로만 본다.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { detailGalleryImages, detailHeroMobileUrl } from '@/shared/detail-hero-image'

const read = (p: string) => fs.readFileSync(path.join(__dirname, '../../..', p), 'utf8')

describe('warmDetailHero', () => {
  let made: string[]
  beforeEach(() => {
    made = []
    vi.resetModules()
    class FakeImage { decoding = ''; set src(v: string) { made.push(v) } }
    vi.stubGlobal('Image', FakeImage as never)
  })
  it('폰 배치: 화면과 같은 주소(갤러리 첫 장 → 모바일 히어로)를 한 번만', async () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    window.matchMedia = (() => ({ matches: false })) as never
    const { warmDetailHero } = await import('@/lib/detail-hero-warm')
    const p = { image_url: 'https://media.ur-team.com/uploads/demo/a.jpg' }
    warmDetailHero(p); warmDetailHero(p)
    expect(made).toEqual([detailHeroMobileUrl(detailGalleryImages(p)[0])])
  })
  it('넓은 화면(PC 주소가 다르다)에선 안 받는다', async () => {
    window.matchMedia = (() => ({ matches: true })) as never
    const { warmDetailHero } = await import('@/lib/detail-hero-warm')
    warmDetailHero({ image_url: 'https://media.ur-team.com/uploads/demo/b.jpg' })
    expect(made).toEqual([])
  })
})

describe('카드 배선', () => {
  const card = read('src/pages/main-home/GroupBuyFeedCard.tsx')
  it('터치 시작에서만(이용권 상세로 가는 카드만) — 보이기만 한 카드는 안 받는다', () => {
    expect(card).toMatch(/onTouchStart=\{\(\) => \{ prefetch\(p\.id\); prefetchDetailChunk\(\); if \(isPassDetail\) warmDetailHero\(p as never\) \}\}/)
    expect(card).toContain("const isPassDetail = /^\\/(?:pass|group-buy)\\/\\d+/.test(canonicalDetailPath(p) ?? '')")
    expect((card.match(/warmDetailHero\(/g) || []).length).toBe(1)
  })
  it('화면 갤러리가 같은 함수로 주소를 만든다', () => {
    expect(read('src/pages/group-buy/DetailGallery.tsx')).toContain('const heroUrl = detailHeroMobileUrl')
  })
})

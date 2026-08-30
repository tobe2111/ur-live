import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { buildHomeHeroPreloadLink } from '@/worker/utils/home-card-preload'
import { pickHeroPhotoFrom, pickHeroPhotoFromSeedJson, isOwnMedia } from '@/shared/home-hero-photo'
import { HOME_HERO_REQUEST_WIDTH, HOME_HERO_QUALITY, HOME_HERO_MEDIA_QUERY } from '@/shared/home-hero-image'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { BANNER_SLOT_SPECS } from '@/shared/constants/home-showcase'

const HERO = 'src/components/home/HomeHeroDefault.tsx'
const seed = (products: unknown[]) => JSON.stringify({ success: true, data: products })

/**
 * 🏔️ 홈 히어로 사진 preload (2026-08-29 대표 — "히어로에 나올 사진이 가장 늦긴 해").
 *
 * **실측한 문제**: 카드 4장은 워커가 preload 를 넣어 주는데 **그 위의 히어로만 못 받고 있었다.**
 * 라이브 PC 3회에서 히어로 다운로드가 카드보다 **일관되게 ~630ms 늦게 시작**했다(631/648/632ms).
 * 히어로는 이미 `loading="eager" fetchPriority="high"` 인데 그건 **발견된 뒤**의 우선순위이고,
 * 발견 자체가 React 렌더 뒤라서 늦었다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 다운로드 시각은 안 잰다(HTMLRewriter 는 Workers 런타임 전용).
 *    배포 후 브라우저 실측이 유일한 판정이다.
 */
describe('홈 히어로 preload', () => {
  it('시드에서 실상품을 우선 고른다 (데모는 마지막)', () => {
    const pick = pickHeroPhotoFrom([
      { image_url: 'https://media.ur-team.com/a.jpg', slug: 'demo-deal-1', id: 1 },
      { image_url: 'https://media.ur-team.com/real.jpg', slug: 'real-shop', id: 2 },
    ])
    expect(pick?.src).toBe('https://media.ur-team.com/real.jpg')
    expect(pick?.href).toBe('/group-buy/2')
  })

  /** 2026-08-04 사고: 데모에 타사 워터마크 보도사진이 섞여 홈 최상단에 오를 뻔했다. */
  it('남의 호스트 데모 사진은 절대 안 쓴다', () => {
    expect(pickHeroPhotoFrom([{ image_url: 'https://yonhap.example/x.jpg', slug: 'demo-deal-9', id: 9 }])).toBeNull()
    expect(isOwnMedia('https://media.ur-team.com/x.jpg')).toBe(true)
    expect(isOwnMedia('/api/media/x.jpg')).toBe(true)
    expect(isOwnMedia('https://ldb-phinf.pstatic.net/x.jpg')).toBe(false)
  })

  it('실상품이 없으면 우리 호스트 데모로 폴백한다 (히어로를 빈 색면으로 두지 않는다)', () => {
    const pick = pickHeroPhotoFrom([{ image_url: '/api/media/d.jpg', slug: 'demo-deal-3', id: 3 }])
    expect(pick?.src).toBe('/api/media/d.jpg')
  })

  it('깨진 시드는 null — 홈이 안 뜨면 안 된다', () => {
    expect(pickHeroPhotoFromSeedJson('{{{')).toBeNull()
    expect(pickHeroPhotoFromSeedJson(JSON.stringify({ success: false }))).toBeNull()
    expect(buildHomeHeroPreloadLink('{{{')).toBeNull()
    expect(buildHomeHeroPreloadLink(seed([]))).toBeNull()
  })

  /**
   * 🔑 **이 프로젝트에서 가장 중요한 불변식** — preload 는 URL 이 byte-일치할 때만 쓰인다.
   *   한 글자만 달라도 브라우저는 그걸 버리고 96KB 를 **두 번** 받는다. 에러도 없고 화면도
   *   멀쩡한데 더 느려진다 — 고치려던 것보다 나쁜 회귀이고, 눈으로는 절대 안 보인다.
   */
  it('워커 preload URL = 클라이언트가 렌더할 URL (글자 그대로)', () => {
    // 클라이언트(`HomeHeroDefault`)가 만드는 것과 **같은 함수·같은 인자**로 기대값을 세운다.
    // 이 두 줄이 컴포넌트의 실제 호출과 어긋나면 아래 소스 검사가 잡는다.
    const src = 'https://media.ur-team.com/uploads/demo/hero.jpg'
    const expectedHref = cfImage(src, { width: HOME_HERO_REQUEST_WIDTH, quality: HOME_HERO_QUALITY })
    const expectedSet = cfSrcSet(src, BANNER_SLOT_SPECS.hero.srcSetBase!)
    const link = buildHomeHeroPreloadLink(seed([{ image_url: src, slug: 'real', id: 1 }]))!
    expect(link).toContain(`href="${expectedHref!.replace(/"/g, '&quot;')}"`)
    expect(link).toContain(`imagesrcset="${expectedSet.replace(/"/g, '&quot;')}"`)
  })

  it('클라이언트 렌더와 같은 폭·품질 상수를 쓴다 (byte-일치)', () => {
    const src = fs.readFileSync(HERO, 'utf8')
    expect(src).toContain('HOME_HERO_REQUEST_WIDTH')
    expect(src).toContain('HOME_HERO_QUALITY')
    // 상수를 놔두고 리터럴을 다시 박아 넣는 회귀 차단
    expect(src).not.toMatch(/cfImage\(photoSrc,\s*\{\s*width:\s*\d+/)
    // srcSet 도 같은 SSOT(BANNER_SLOT_SPECS.hero.srcSetBase)를 양쪽이 쓴다.
    expect(src).toContain('BANNER_SLOT_SPECS.hero.srcSetBase')
    const link = buildHomeHeroPreloadLink(seed([{ image_url: '/api/media/h.jpg', slug: 'real', id: 7 }]))!
    expect(link).toContain(`width=${HOME_HERO_REQUEST_WIDTH}`)
    expect(link).toContain(`quality=${HOME_HERO_QUALITY}`)
  })

  /**
   * ⚠️ 히어로 사진은 `hidden md:block` 이라 768px 미만에서 **보이지 않는다.**
   *    media 로 막지 않으면 폰이 96KB 를 헛되이 받는다 — 고치려던 것보다 나쁜 회귀다.
   */
  it('보이지 않는 폭에서는 안 받는다 (media 게이트 + 컨테이너 중단점 일치)', () => {
    const link = buildHomeHeroPreloadLink(seed([{ image_url: '/api/media/h.jpg', slug: 'real', id: 7 }]))!
    expect(link).toContain(`media="${HOME_HERO_MEDIA_QUERY}"`)
    expect(HOME_HERO_MEDIA_QUERY).toBe('(min-width: 768px)')
    // 컨테이너가 md 를 벗어나면 이 상수도 같이 고쳐야 한다.
    expect(fs.readFileSync(HERO, 'utf8')).toMatch(/hidden md:block absolute inset-y-0 right-0/)
  })

  it('첫 화면 최상단이므로 우선순위를 높인다', () => {
    const link = buildHomeHeroPreloadLink(seed([{ image_url: '/api/media/h.jpg', slug: 'real', id: 7 }]))!
    expect(link).toContain('rel="preload"')
    expect(link).toContain('as="image"')
    expect(link).toContain('fetchpriority="high"')
  })
})

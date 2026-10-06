import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { buildHomeHeroPreloadLink } from '@/worker/utils/home-card-preload'
import { pickHeroPhotoFrom, pickHeroPhotoFromSeedJson, isOwnMedia } from '@/shared/home-hero-photo'
import { HOME_HERO_REQUEST_WIDTH, HOME_HERO_QUALITY, HOME_HERO_MEDIA_QUERY } from '@/shared/home-hero-image'
import { HERO_STRIP_PRELOAD, heroTileUrl } from '@/shared/home-hero-strip'

const HERO = 'src/components/home/HomeHeroDefault.tsx'
const STRIP = 'src/components/home/HeroDealStrip.tsx'
const seed = (products: unknown[]) => JSON.stringify({ success: true, data: products })
/** 띠는 앞 5개를 건너뛰므로(아래 매대 첫 줄과 겹치지 않게) 시드에 그만큼 채워 준다. */
const pad = (n = 5) => Array.from({ length: n }, (_, i) => ({ image_url: `/api/media/pad${i}.jpg`, slug: 'real', id: 900 + i }))

/**
 * 🏔️ 홈 히어로 preload (2026-08-29 대표 — "히어로에 나올 사진이 가장 늦긴 해").
 *
 * **실측한 문제**: 카드 4장은 워커가 preload 를 넣어 주는데 **그 위의 히어로만 못 받고 있었다.**
 * 라이브 PC 3회에서 히어로 다운로드가 카드보다 **일관되게 ~630ms 늦게 시작**했다(631/648/632ms).
 * 히어로는 이미 `loading="eager" fetchPriority="high"` 인데 그건 **발견된 뒤**의 우선순위이고,
 * 발견 자체가 React 렌더 뒤라서 늦었다.
 *
 * 🎞️ 2026-09-28: 당기는 대상이 **큰 사진 한 장 → 띠의 앞 타일 둘**로 바뀌었다(대표 확정 시안 ②).
 *    예전 대상을 계속 당기면 아무도 안 쓰는 55KB 를 매번 받는다 — 이 파일이 경고하는 바로 그 클래스.
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
    expect(pick?.href).toBe('/pass/2')
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
   *   한 글자만 달라도 브라우저는 그걸 버리고 같은 사진을 **두 번** 받는다. 에러도 없고 화면도
   *   멀쩡한데 더 느려진다 — 고치려던 것보다 나쁜 회귀이고, 눈으로는 절대 안 보인다.
   */
  it('워커 preload URL = 클라이언트가 렌더할 타일 URL (글자 그대로)', () => {
    const src = 'https://media.ur-team.com/uploads/demo/tile.jpg'
    const expectedHref = heroTileUrl(src)
    expect(expectedHref).toBeTruthy()
    // 앞 5개는 아래 매대 첫 줄이라 띠가 건너뛴다 → 6번째가 띠의 첫 타일이다.
    const link = buildHomeHeroPreloadLink(seed([...pad(), { image_url: src, slug: 'real', id: 1 }, ...pad(4)]))!
    expect(link).toContain(`href="${expectedHref.replace(/"/g, '&quot;')}"`)
  })

  it('양쪽이 같은 SSOT 함수를 쓴다 (리터럴 URL 을 다시 박는 회귀 차단)', () => {
    expect(fs.readFileSync(STRIP, 'utf8')).toContain('heroTileUrl(tile.src)')
    expect(fs.readFileSync('src/worker/utils/home-card-preload.ts', 'utf8')).toContain('heroTileUrl(tile.src)')
    // 어드민 배너 한 장 경로는 종전 상수를 그대로 쓴다(그쪽도 byte-일치 대상이다).
    const heroSrc = fs.readFileSync(HERO, 'utf8')
    expect(heroSrc).toContain('HOME_HERO_REQUEST_WIDTH')
    expect(heroSrc).toContain('HOME_HERO_QUALITY')
    expect(heroSrc).not.toMatch(/cfImage\(photoSrc,\s*\{\s*width:\s*\d+/)
    expect(HOME_HERO_REQUEST_WIDTH).toBeGreaterThan(0)
    expect(HOME_HERO_QUALITY).toBeGreaterThan(0)
  })

  it('첫 화면에 보이는 앞 몇 장만 당긴다 (띠 전체를 당기지 않는다)', () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ image_url: `/api/media/t${i}.jpg`, slug: 'real', id: i + 1 }))
    const link = buildHomeHeroPreloadLink(seed(many))!
    expect(link.match(/rel="preload"/g)?.length).toBe(HERO_STRIP_PRELOAD)
    expect(HERO_STRIP_PRELOAD).toBeLessThanOrEqual(3)
  })

  /**
   * ⚠️ 띠는 `hidden md:block` 이라 768px 미만에서 **보이지 않는다.**
   *    media 로 막지 않으면 폰이 안 쓰는 바이트를 받는다 — 고치려던 것보다 나쁜 회귀다.
   */
  it('보이지 않는 폭에서는 안 받는다 (media 게이트 + 컨테이너 중단점 일치)', () => {
    const link = buildHomeHeroPreloadLink(seed([...pad(), { image_url: '/api/media/h.jpg', slug: 'real', id: 7 }]))!
    expect(link).toContain(`media="${HOME_HERO_MEDIA_QUERY}"`)
    expect(HOME_HERO_MEDIA_QUERY).toBe('(min-width: 768px)')
    // 띠 컨테이너가 md 를 벗어나면 이 상수도 같이 고쳐야 한다.
    expect(fs.readFileSync(STRIP, 'utf8')).toMatch(/hidden md:block absolute z-20/)
  })

  it('첫 화면 최상단이므로 우선순위를 높인다', () => {
    const link = buildHomeHeroPreloadLink(seed([...pad(), { image_url: '/api/media/h.jpg', slug: 'real', id: 7 }]))!
    expect(link).toContain('rel="preload"')
    expect(link).toContain('as="image"')
    expect(link).toContain('fetchpriority="high"')
  })
})

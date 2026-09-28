/**
 * 🎞️ 히어로 **이용권 띠** 〔2026-09-28 대표 확정 — 시안 ② + "좌우로 자연스럽게 계속 이동"〕
 *
 * ## 무엇이었나
 * 대표: *"여기 지금 들어있는 사진 비율이나 너무 마음에 안드는데? 이거 그냥 확대해서 올라가버리는거잖아"*
 *
 * 크롭 설정이 아니라 **틀과 내용의 불일치**였다 — 틀 1037×190(5.46:1) vs 라이브 사진 540×720(3:4)
 * ⇒ 세로의 14%만 보였다. 우리 사진 70장의 비율 **중앙값이 정확히 1:1** 이라 "더 좋은 한 장"으로는
 * 못 고친다. 그래서 4:3 타일 여러 장을 흘린다.
 *
 * ## 이 시험이 **못** 하는 것
 * jsdom 은 레이아웃도 애니메이션도 없다 — 실제로 흐르는지·이음매가 벌어지는지·타일이 카피와
 * 부딪히는지는 **브라우저 프레임 캡처**가 판정한다. 여기서는 *숫자가 서로 모순되지 않는가*와
 * *배선이 붙어 있는가*만 본다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import HeroDealStrip from '@/components/home/HeroDealStrip'
import {
  buildHeroStripLoop,
  heroTileUrl,
  pickHeroStripFrom,
  HERO_STRIP_BAND_MAX_PX,
  HERO_STRIP_EAGER,
  HERO_STRIP_MAX,
  HERO_STRIP_MIN_AFTER_SKIP,
  HERO_STRIP_MIN_PER_LOOP,
  HERO_STRIP_SKIP,
  HERO_STRIP_SPEED_PX_PER_SEC,
  HERO_TILE_REQUEST_HEIGHT,
  HERO_TILE_REQUEST_WIDTH,
  HERO_TILE_QUALITY,
  HERO_TILE_STEP,
  type HeroTile,
} from '@/shared/home-hero-strip'

const src = (p: string) => fs.readFileSync(p, 'utf8')
const STRIP_TSX = 'src/components/home/HeroDealStrip.tsx'
const HERO_TSX = 'src/components/home/HomeHeroDefault.tsx'
const CSS = 'src/index.css'

const rows = (n: number, from = 1) =>
  Array.from({ length: n }, (_, i) => ({
    id: from + i,
    name: `딜 ${from + i}`,
    restaurant_name: `가게 ${from + i}`,
    price: 10000,
    original_price: 20000,
    image_url: `/api/media/p${from + i}.jpg`,
    dominant_color: '#a57c5b',
  }))

const draw = (tiles: HeroTile[]) =>
  render(<MemoryRouter><HeroDealStrip tiles={tiles} /></MemoryRouter>).container

describe('① 띠에 태울 딜 고르기', () => {
  it('🔴 아래 매대 첫 줄과 **겹치지 않는다** (같은 딜이 40px 간격으로 두 번 나오면 매대가 좁아 보인다)', () => {
    /* 🩸 처음엔 `id <= HERO_STRIP_SKIP` 로 썼는데, 그 상수를 0 으로 바꾸면 조건이 **저절로 참**이 돼
       주입이 통과했다(가드가 자기 자신을 기준으로 삼은 셈). 기준은 **진짜 매대의 열 수**여야 한다. */
    const feed = fs.readFileSync('src/pages/main-home/GroupBuyFeed.tsx', 'utf8')
    const cols = Number(feed.match(/md:grid-cols-(\d+)/)?.[1])
    expect(cols, '매대 그리드 열 수를 못 읽었다 — 검사가 헛돌고 있다').toBeGreaterThan(0)
    expect(HERO_STRIP_SKIP).toBeGreaterThanOrEqual(cols)

    const tiles = pickHeroStripFrom(rows(20))
    expect(tiles.length).toBe(HERO_STRIP_MAX)
    // 첫 줄에 뜨는 id 가 하나라도 섞이면 실패 — 시안 1차에서 실제로 그랬다.
    expect(tiles.map(t => Number(t.id)).some(id => id <= cols)).toBe(false)
  })

  it('🔴 딜이 적으면 건너뛰기를 **포기한다** (빈 띠가 되는 것보다 겹치는 게 낫다)', () => {
    const tiles = pickHeroStripFrom(rows(6))
    expect(tiles.length).toBeGreaterThanOrEqual(HERO_STRIP_MIN_AFTER_SKIP)
    expect(Number(tiles[0].id)).toBe(1)
  })

  /** 2026-08-04 사고: 데모에 타사 워터마크 보도사진이 섞여 홈 최상단에 오를 뻔했다. */
  it('🔴 남의 호스트 데모 사진은 띠에도 안 태운다 (여러 장을 크게 흘리므로 위험이 더 크다)', () => {
    const tiles = pickHeroStripFrom([
      { id: 1, image_url: 'https://yonhap.example/x.jpg', slug: 'demo-deal-1' },
      { id: 2, image_url: '/api/media/ours.jpg', slug: 'demo-deal-2' },
    ])
    expect(tiles.map(t => t.src)).toEqual(['/api/media/ours.jpg'])
  })

  it('깨진 입력에도 안 터진다', () => {
    expect(pickHeroStripFrom(null)).toEqual([])
    expect(pickHeroStripFrom([{ id: 1 }, { image_url: '/a.jpg' }])).toEqual([])
  })
})

describe('② 루프 — 이음매가 벌어지지 않는 수', () => {
  it('🔴 한 벌이 **밴드보다 넓다** (좁으면 미는 동안 오른쪽에 빈 칸이 보인다)', () => {
    expect(HERO_STRIP_MIN_PER_LOOP * HERO_TILE_STEP).toBeGreaterThanOrEqual(HERO_STRIP_BAND_MAX_PX)
  })

  it('🔴 딜이 한 장뿐이어도 한 벌을 최소 장수까지 채운다 (같은 URL 이라 트래픽 0)', () => {
    const loop = buildHeroStripLoop(pickHeroStripFrom(rows(1)))!
    expect(loop.strip.length).toBeGreaterThanOrEqual(HERO_STRIP_MIN_PER_LOOP)
    expect(loop.loopPx).toBe(loop.strip.length * HERO_TILE_STEP)
  })

  it('🔴 속도는 장수와 **무관하게 일정**하다 (지속시간을 고정하면 딜 수에 따라 널뛴다)', () => {
    for (const n of [1, 5, 8]) {
      const loop = buildHeroStripLoop(pickHeroStripFrom(rows(n + HERO_STRIP_SKIP)))!
      expect(Math.abs(loop.loopPx / loop.durationSec - HERO_STRIP_SPEED_PX_PER_SEC)).toBeLessThan(2)
    }
  })

  it('타일이 없으면 null — 띠를 안 그린다', () => {
    expect(buildHeroStripLoop([])).toBeNull()
  })
})

describe('③ 트래픽 — 타일은 전용 작은 크롭이다', () => {
  /**
   * 실측(딜 8개): 카드 공유 width=400 → 228KB · width=800 → 652KB · 전용 384×288 q62 → **106KB**.
   * 참고로 오늘의 히어로 한 장이 55KB 다. 이 숫자가 커지면 히어로가 매대보다 비싸진다.
   */
  it('🔴 카드(400/800)와 같은 URL 을 쓰지 않는다 — 전용 폭·품질', () => {
    expect(HERO_TILE_REQUEST_WIDTH).toBeLessThanOrEqual(400)
    expect(HERO_TILE_QUALITY).toBeLessThan(85)
    const url = heroTileUrl('/api/media/x.jpg')
    expect(url).toContain(`width=${HERO_TILE_REQUEST_WIDTH}`)
    expect(url).toContain(`quality=${HERO_TILE_QUALITY}`)
  })

  /** 🎯 이게 빠지면 세로 사진(우리 카탈로그의 37%)이 다시 가운데로 잘린다 = 대표가 신고한 그 증상. */
  it('🔴 4:3 로 **피사체를 찾아** 자른다 (gravity 가 빠지면 원래 불만으로 되돌아간다)', () => {
    const url = heroTileUrl('/api/media/x.jpg')
    expect(url).toContain(`height=${HERO_TILE_REQUEST_HEIGHT}`)
    expect(url).toContain('fit=cover')
    expect(url).toContain('gravity=auto')
    expect(HERO_TILE_REQUEST_WIDTH / HERO_TILE_REQUEST_HEIGHT).toBeCloseTo(4 / 3, 2)
  })

  it('🔴 앞 몇 장만 먼저 받고 나머지는 미룬다 · 둘째 벌은 전부 미룬다(같은 URL = 캐시 적중)', () => {
    const tiles = pickHeroStripFrom(rows(20))
    const imgs = [...draw(tiles).querySelectorAll('img')]
    expect(imgs.length).toBe(tiles.length * 2)
    expect(imgs.filter(i => i.getAttribute('loading') === 'eager').length).toBe(HERO_STRIP_EAGER)
    expect(imgs.slice(tiles.length).every(i => i.getAttribute('loading') === 'lazy')).toBe(true)
  })
})

describe('④ 배선 — 눈으로는 안 보이는 것들', () => {
  it('🔴 둘째 벌은 스크린리더·탭 이동에서 뺀다 (안 그러면 목록이 두 번 읽힌다)', () => {
    const tiles = pickHeroStripFrom(rows(12))
    const links = [...draw(tiles).querySelectorAll('a')]
    const clones = links.slice(tiles.length)
    expect(clones.length).toBe(tiles.length)
    // 한 쌍이어야 한다 — 한쪽만 두면 "숨겨졌는데 포커스는 가는" 더 나쁜 상태가 된다.
    expect(clones.every(a => a.getAttribute('aria-hidden') === 'true' && a.getAttribute('tabindex') === '-1')).toBe(true)
    expect(links.slice(0, tiles.length).every(a => !!a.getAttribute('aria-label'))).toBe(true)
  })

  it('🔴 커서를 올리면 멈추고, 모션을 줄인 사람에겐 안 움직인다', () => {
    const css = src(CSS)
    expect(css).toMatch(/\.ur-hero-band:hover \.ur-hero-marquee/)
    expect(css).toMatch(/\.ur-hero-band:focus-within \.ur-hero-marquee/)
    expect(css).toMatch(/prefers-reduced-motion: reduce\)\s*\{\s*\n?\s*\.ur-hero-marquee \{ animation: none/)
  })

  it('🔴 미는 거리를 CSS 에 **박지 않는다** (장수에 따라 달라지므로 박으면 이음매가 벌어진다)', () => {
    expect(src(CSS)).toContain('translateX(calc(-1 * var(--ur-hero-loop, 0px)))')
    expect(src(STRIP_TSX)).toContain("'--ur-hero-loop'")
    expect(src(STRIP_TSX)).toContain("'--ur-hero-dur'")
  })

  /**
   * 🩸 2026-09-06 에 똑같이 당했다 — 사진이 `pointer-events-none` 배경 래퍼 안에 있어
   *    **클릭이 구조적으로 불가능**했고, 그걸 안내 문구로 때우고 있었다.
   */
  it('🔴 띠가 배경 래퍼(pointer-events-none) 밖에 있고 콘텐츠 층 위에 있다', () => {
    const s = src(HERO_TSX)
    const bg = s.indexOf('overflow-hidden isolate pointer-events-none')
    const bgEnd = s.indexOf('← 배경 래퍼 끝')
    const strip = s.indexOf('<HeroDealStrip')
    expect(bg).toBeGreaterThan(-1)
    expect(strip).toBeGreaterThan(bgEnd)
    expect(src(STRIP_TSX)).toContain('absolute z-20')
  })

  it('🔴 어드민 히어로 배너가 있으면 그게 이긴다 (띠가 배너를 덮지 않는다)', () => {
    const s = src(HERO_TSX)
    expect(s).toMatch(/const adminMedia = !!content\?\.photo \|\| !!content\?\.videoUrl/)
    expect(s).toMatch(/const showStrip = !adminMedia && tiles\.length > 0/)
    // 띠가 뜨면 한 장짜리 사진과 그 클릭 오버레이는 안 그린다(두 겹이 되면 클릭이 엇갈린다).
    expect(s.match(/hasMedia && !showStrip/g)?.length).toBe(2)
  })
})

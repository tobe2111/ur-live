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
import { stripComments } from '../helpers/source-text'
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
  HERO_STRIP_WARM_TIMEOUT_MS,
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
    // 🏪 2026-10-07: 라이브 피드의 실제 모양 — 주소는 **한 줄 전체**이고 종류는 원시 키다.
    restaurant_address: '전북특별자치도 전주시 덕진구 가리내10길 10',
    category: 'meal_voucher',
  }))

const draw = (tiles: HeroTile[]) =>
  render(<MemoryRouter><HeroDealStrip tiles={tiles} /></MemoryRouter>).container

/**
 * 🧊 **아직 한가해지지 않은** 상태 — `requestIdleCallback` 도 타이머도 안 돈다.
 * jsdom 에는 `requestIdleCallback` 이 없어 컴포넌트가 타이머로 떨어지는데, 테스트는 그 타이머를
 * 돌리지 않으므로 첫 페인트 상태 그대로 남는다.
 */
const drawCold = draw

/**
 * 🔥 **한가해진 뒤** — `requestIdleCallback` 을 즉시 실행으로 바꿔 끼우고(effect 안에서 동기 호출되어
 * `render()` 의 act 안에서 끝난다) `new Image()` 가 실제로 받으러 간 URL 을 모은다.
 * `connection.saveData` 도 여기서 흉내 낸다.
 */
function drawWarm(tiles: HeroTile[], opts: { saveData?: boolean } = {}) {
  const w = window as unknown as Record<string, unknown>
  const prevRic = w.requestIdleCallback
  const prevCic = w.cancelIdleCallback
  const prevConn = Object.getOwnPropertyDescriptor(navigator, 'connection')
  const warmed: string[] = []
  /* 🔎 **`new Image()` 만** 센다 — markup 의 `<img src>` 도 React 가 프로퍼티로 쓰므로
     `HTMLImageElement.prototype.src` 를 감시하면 둘이 섞여 시험이 통째로 헛돈다(실제로 그랬다). */
  const g = globalThis as unknown as Record<string, unknown>
  const RealImage = g.Image as typeof Image
  /**
   * 🔎 **`new Image()` 가 받으러 간 URL 만** 센다.
   * 🩸 두 번 헛돌고 나온 방법이다: ① `HTMLImageElement.prototype.src` 만 감시했더니 markup 의
   *   `<img src>` 까지 섞여(React 가 프로퍼티로 쓴다) 시험이 통째로 무의미해졌다 ② 그래서 `Image`
   *   를 **subclass** 로 바꿨더니 0건 — jsdom 의 `Image` 는 생성자가 `document.createElement('img')`
   *   를 **반환**해서 서브클래스 프로토타입이 안 붙는다. ⇒ 생성자가 만든 것에 **표식**을 달고,
   *   프로토타입 setter 는 그 표식이 있을 때만 센다.
   */
  const MARK = '__urWarmProbe'
  const realSrc = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src')!
  Object.defineProperty(HTMLImageElement.prototype, 'src', {
    configurable: true,
    get(this: HTMLImageElement) { return realSrc.get!.call(this) as string },
    set(this: HTMLImageElement, v: string) {
      if ((this as unknown as Record<string, unknown>)[MARK]) warmed.push(v)
      realSrc.set!.call(this, v)
    },
  })
  g.Image = function () {
    const el = new RealImage()
    ;(el as unknown as Record<string, unknown>)[MARK] = true
    return el
  }
  w.Image = g.Image
  w.requestIdleCallback = (cb: () => void) => { cb(); return 1 }
  w.cancelIdleCallback = () => {}
  Object.defineProperty(navigator, 'connection', {
    value: { saveData: !!opts.saveData }, configurable: true,
  })
  try {
    const container = draw(tiles)
    return { container, warmed }
  } finally {
    Object.defineProperty(HTMLImageElement.prototype, 'src', realSrc)
    g.Image = RealImage
    w.Image = RealImage
    if (prevRic === undefined) delete w.requestIdleCallback; else w.requestIdleCallback = prevRic
    if (prevCic === undefined) delete w.cancelIdleCallback; else w.cancelIdleCallback = prevCic
    if (prevConn) Object.defineProperty(navigator, 'connection', prevConn)
    else Reflect.deleteProperty(navigator, 'connection')
  }
}

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

  /**
   * 🔴 2026-10-10 — 이 자리의 시험을 **지우지 않고 재조준했다.**
   *
   * 종전 단언은 *"앞 N장만 eager, 나머지는 영원히 lazy"* 였다. 그 lazy 가 바로 대표가 신고한
   * **"메인에서 이용권 사진이 안 나온다"** 의 원인이다 — 마퀴는 모든 타일을 데려오는데 `lazy` 는
   * *화면에 들어온 뒤에야* 받으므로 그 타일은 반드시 대표색 사각형으로 먼저 보인다
   * (브라우저 실측 800kbps/500ms: 140프레임 중 118프레임에 빈 타일, **동시 최대 4장**).
   *
   * 그 시험이 **지키려던 것은 그대로다**: 첫 페인트 바이트를 늘리지 않는다. 그래서 불변식을
   * 두 쪽으로 나눈다 — ⓐ 첫 페인트에는 종전과 똑같이 앞 N장만 · ⓑ 한가해지면 **하나도 안 남는다**.
   */
  it('🔴 첫 페인트에는 앞 몇 장만 먼저 받는다 (유휴 전 임계 경로는 종전과 byte-동일)', () => {
    const tiles = pickHeroStripFrom(rows(20))
    const imgs = [...drawCold(tiles).querySelectorAll('img')]
    expect(imgs.length).toBe(tiles.length * 2)
    expect(imgs.filter(i => i.getAttribute('loading') === 'eager').length).toBe(HERO_STRIP_EAGER)
    expect(imgs.slice(tiles.length).every(i => i.getAttribute('loading') === 'lazy')).toBe(true)
  })

  it('🔴 한가해지면 **나머지 타일을 미리 받아 둔다** — 화면에 들어온 뒤 받으면 반드시 빈 칸이 먼저 보인다', () => {
    const tiles = pickHeroStripFrom(rows(20))
    const { container, warmed } = drawWarm(tiles)
    const shown = [...container.querySelectorAll('img')].map(i => i.getAttribute('src') || '')
    const lazyUrls = new Set(
      [...container.querySelectorAll('img')]
        .filter(i => i.getAttribute('loading') === 'lazy')
        .map(i => i.getAttribute('src') || ''),
    )
    const eagerUrls = new Set(
      [...container.querySelectorAll('img')]
        .filter(i => i.getAttribute('loading') === 'eager')
        .map(i => i.getAttribute('src') || ''),
    )
    expect(shown.length).toBe(tiles.length * 2)
    expect(lazyUrls.size).toBeGreaterThan(0)
    /* 미룬 타일의 URL 은 **하나도 빠짐없이** 화면에 들어오기 전에 받아져 있다 —
       앞 N장이 이미 받은 URL(둘째 벌이 재사용)이거나, 유휴 워밍이 받아 둔 URL 이거나. */
    for (const u of lazyUrls) expect(warmed.includes(u) || eagerUrls.has(u)).toBe(true)
    // 그리고 워밍이 **실제로 일을 한다** — 0건이면 통과가 아니라 고장이다.
    expect(warmed.length).toBe(tiles.length - HERO_STRIP_EAGER)
  })

  it('🔴 먼저 받은 앞 N장은 **다시 안 받는다** (유휴 워밍이 중복 요청을 만들면 안 된다)', () => {
    const tiles = pickHeroStripFrom(rows(20))
    const { container, warmed } = drawWarm(tiles)
    const eagerUrls = [...container.querySelectorAll('img')]
      .filter(i => i.getAttribute('loading') === 'eager')
      .map(i => i.getAttribute('src') || '')
    expect(eagerUrls.length).toBe(HERO_STRIP_EAGER)
    for (const u of eagerUrls) expect(warmed).not.toContain(u)
    // 둘째 벌은 같은 URL 이라 중복으로 받지 않는다.
    expect(new Set(warmed).size).toBe(warmed.length)
  })

  it('🔴 데이터 절약 모드면 **안 받는다** (cf-image 가 이미 존중하는 신호와 같은 판단)', () => {
    const tiles = pickHeroStripFrom(rows(20))
    const { warmed } = drawWarm(tiles, { saveData: true })
    expect(warmed).toEqual([])
  })

  it('🔴 유휴 예약은 **0ms 가 아니다** (첫 페인트와 경쟁하면 LCP 를 밀어낸다)', () => {
    expect(HERO_STRIP_WARM_TIMEOUT_MS).toBeGreaterThanOrEqual(500)
    const code = stripComments(src(STRIP_TSX))
    // 상수를 베껴 적으면 두 벌이 갈린다 — 소스가 그 상수를 실제로 쓰는지 본다.
    expect(code).toMatch(/requestIdleCallback\([\s\S]{0,120}HERO_STRIP_WARM_TIMEOUT_MS/)
  })

  /**
   * 🩸 **크로미움 실측으로 뒤집힌 가정** — 이 줄이 그 교훈을 지킨다.
   *
   * 처음 처방은 `loading` 을 lazy→eager 로 접는 것이었는데, 실제로 재 보니 크로미움은
   * **보류된 lazy 로드를 다시 시작하지 않는다**(프로퍼티·`setAttribute`·`removeAttribute`·
   * 같은 값 `src` 재대입 넷 다 요청 0건). 그 길로 되돌아가면 markup 만 바뀌고 증상은 그대로다.
   */
  it('🔴 워밍을 **속성 뒤집기로 하지 않는다** (크로미움은 보류된 lazy 로드를 재개하지 않는다)', () => {
    const code = stripComments(src(STRIP_TSX))
    expect(code).not.toMatch(/loading=\{[^}]*warm/)
    expect(code).toMatch(/new Image\(\)/)
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

describe('④-B 캡션이 "어디서 · 무엇을 · 얼마나 싸게" 에 답한다 (2026-10-07 대표 B안)', () => {
  it('🔴 매장명·지역·종류·정가가 **실제로 그려진다** (타일에 와 있는데 안 그리던 것이 이 사고였다)', () => {
    const c = draw(pickHeroStripFrom(rows(20)))
    const txt = c.textContent ?? ''
    expect(txt, '매장명').toContain('가게 ')
    expect(txt, '주소에서 뽑은 지역').toContain('전북 전주시')
    expect(txt, '종류 라벨(SSOT)').toContain('식사')
    expect(txt, '정가 취소선').toContain('20,000')
    expect(txt, '판매가').toContain('10,000원')
    // 할인율은 정가·판매가에서 계산된다(피드의 discount_rate 는 라이브 50건 전부 0이다).
    expect(txt, '계산된 할인율').toContain('50%')
    expect(c.querySelector('s'), '정가는 취소선 요소로 그린다').not.toBeNull()
  })

  it('🔴 종류 라벨을 **베끼지 않는다** — SSOT 에서 가져온다', () => {
    const t = fs.readFileSync(STRIP_TSX, 'utf8')
    expect(t, 'CATEGORY_META 를 쓰지 않는다').toContain('CATEGORY_META[tile.category]')
    // 라벨 문자열을 이 파일에 손으로 적으면 SSOT 와 갈린다.
    expect(t, "'식사' 를 손으로 적었다").not.toContain("'식사'")
  })

  it('🔴 워커가 import 하는 공유 모듈에 **아이콘이 새지 않는다**', () => {
    // `shared/home-hero-strip` 은 `worker/utils/home-card-preload` 가 import 한다.
    // 라벨 SSOT 둘(deal-category-icon · voucher-types)은 lucide 를 들고 있어, 거기서 쓰면
    // 워커 번들에 React 아이콘이 끌려 들어간다. 그래서 공유 모듈은 **원시 키만** 싣는다.
    // 🩸 처음엔 원문을 통째로 검사했더니 **주석에 걸려** 빨간불이 났다(그 모듈의 설명문이
    //    왜 그 SSOT 를 못 쓰는지 적고 있다). 지키려는 것은 *import* 이므로 주석을 먼저 걷는다
    //    — 제거기는 레포 SSOT 를 쓴다(테스트마다 새로 쓰면 문자열·정규식 안의 `/*` 를 먹는다).
    const shared = stripComments(fs.readFileSync('src/shared/home-hero-strip.ts', 'utf8'))
    expect(shared, '공유 모듈이 라벨 SSOT 를 import 했다').not.toMatch(/deal-category-icon|voucher-types/)
    expect(shared, '공유 모듈이 lucide 를 끌어왔다').not.toContain('lucide-react')
    expect(fs.readFileSync('src/worker/utils/home-card-preload.ts', 'utf8'), '배선 전제')
      .toContain('home-hero-strip')
  })

  it('🔴 빈 값이면 **줄을 안 그린다** (빈 자리를 남기지 않는다)', () => {
    const bare = pickHeroStripFrom(
      Array.from({ length: 12 }, (_, i) => ({
        id: i + 1, name: `딜 ${i + 1}`, price: 10000, original_price: 10000,
        image_url: `/api/media/q${i + 1}.jpg`,
      })),
    )
    const c = draw(bare)
    const txt = c.textContent ?? ''
    expect(txt, '매장명이 없으면 상품명으로 떨어진다').toContain('딜 ')
    expect(txt, '지역·종류가 없으면 가운뎃점만 남으면 안 된다').not.toMatch(/·\s*$/)
    expect(c.querySelector('s'), '정가 = 판매가 면 취소선을 안 그린다').toBeNull()
    expect(txt, '할인 0% 배지는 안 그린다').not.toContain('0%')
  })
})

/**
 * ⑤ 🩸 2026-09-28 — **캡션 글자가 밝은 타일에서 안 보였다**(다크 대비 가드가 잡았다).
 *
 * 타일 바탕은 딜의 **대표색**(`tile.color`)이라 사진이 밝으면 그 색도 밝다. 라이브 실측에
 * `rgb(243,243,243)`·`rgb(221,221,221)` 타일이 있었고, 종전 두 스톱 그라디언트
 * (`rgba(0,0,0,0.8) → transparent`)는 0.8 을 **밴드 맨 아래 한 줄에서만** 내므로
 * 글자가 앉는 줄의 실효 알파가 0.5 였다 → 할인율 `#7FB0FF` 가 **2.04:1**.
 *
 * ⚠️ 이 시험은 **문자열을 안 본다** — 그라디언트 스톱을 파싱해 *글자가 닿는 가장 밝은 지점*의
 *    알파를 구하고, **순백(255) 사진**이라는 최악의 바탕에 합성해 WCAG 대비를 실제로 계산한다.
 *    그래야 스톱을 어떻게 다시 쓰든 *결과*가 지켜진다(색 이름 매칭은 재작성에 뚫린다).
 *
 * 📐 기하: 밴드 `pt-5 pb-2` + 글자 블록. 글자가 닿는 **가장 밝은 지점**(= 블록 상단)의 알파를 본다.
 *    ⇒ 아래 `TEXT_TOP_PCT` 는 그 계산값이고, 패딩·글자 크기가 바뀌면 전제가 깨지므로
 *      그 토큰들이 그대로인지 **함께** 단언한다.
 *
 * 🔀 **2026-10-07 재조준 (대표 "B안으로 진행") — 캡션이 한 줄에서 세 줄이 됐다.**
 *    이 시험이 *"세로 값이나 글자 크기가 바뀌면 그때는 실측부터 해야 한다"* 고 적어 둔 그 경우다.
 *    실제로 **이 시험이 먼저 빨간불을 내서** 재측정하게 만들었고, 종전 램프로는 못 쓴다는 것이 나왔다:
 *    ```
 *      종전 1줄  밴드 48px · 글자 상단 60%  · 종전 스톱 알파 0.75 → 할인율 5.83:1  ✅
 *      B안 3줄   밴드 86px · 글자 상단 76.7% · 종전 스톱 알파 0.436 → 할인율 1.06:1 ❌ (안 보인다)
 *      ⇒ 스톱을 (0.92 / 0.84@78 / 0)로. 그 지점 알파 0.841 → 할인율 4.87:1 ✅
 *    ```
 *    밴드 86 = pb-2(8) + 가격행 13px(16) + mt-1(4) + 지역 12px(15) + mt-1(4) + 매장 15px(19) + pt-5(20).
 *    글자 상단 66/86 = 76.7%.
 *
 * 이 시험이 **못** 하는 것: 실제 픽셀은 `check-dark-contrast`(브라우저)가 잰다. 여기는 *수학*만 본다.
 */
describe('⑤ 캡션 바탕 — 밝은 대표색 타일에서도 글자가 보인다', () => {
  const TEXT_TOP_PCT = 76.7

  /** `linear-gradient(0deg, rgba(0,0,0,a) p%, …)` 의 스톱을 [비율, 알파] 로. 0% = 밴드 맨 아래. */
  const stops = () => {
    const s = src(STRIP_TSX)
    const m = s.match(/background:\s*'linear-gradient\(0deg,([^']+)\)'/)
    if (!m) return null
    const parts = m[1].split(/,(?![^()]*\))/).map((x) => x.trim())
    const out: Array<{ pct: number; a: number }> = []
    parts.forEach((p, i) => {
      const col = p.match(/rgba?\(\s*0\s*,\s*0\s*,\s*0\s*(?:,\s*([\d.]+))?\s*\)/)
      if (!col) return
      const a = col[1] === undefined ? 1 : Number(col[1])
      const pm = p.match(/\)\s*([\d.]+)%/)
      const pct = pm ? Number(pm[1]) : (i === 0 ? 0 : 100)
      out.push({ pct, a })
    })
    return out.length >= 2 ? out : null
  }

  const alphaAt = (pct: number, list: Array<{ pct: number; a: number }>) => {
    if (pct <= list[0].pct) return list[0].a
    for (let i = 1; i < list.length; i++) {
      if (pct <= list[i].pct) {
        const lo = list[i - 1], hi = list[i]
        const t = hi.pct === lo.pct ? 1 : (pct - lo.pct) / (hi.pct - lo.pct)
        return lo.a + (hi.a - lo.a) * t
      }
    }
    return list[list.length - 1].a
  }

  const lum = (r: number, g: number, b: number) => {
    const f = (v: number) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
  }
  const ratio = (a: number, b: number) => { const [x, y] = [a, b].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

  it('기하 전제가 그대로다 (세로 패딩·글자 크기가 바뀌면 위 실측을 다시 해야 한다)', () => {
    // 🔀 2026-10-07: 캡션이 세 줄이 되면서 크기가 바깥 div 에서 각 줄로 내려갔다.
    //    위 대비 계산은 **세로 기하**(pt-5 · pb-2 · 15/12/13px 세 줄 + mt-1 두 번)에서 나온다.
    //    ⚠️ 하나라도 바뀌면 `TEXT_TOP_PCT` 가 틀려지므로 **실측부터** 다시 할 것.
    const t = src(STRIP_TSX)
    expect(t, '밴드 패딩').toContain('px-2 pt-5 pb-2 text-white')
    expect(t, '매장명 15px').toContain("text-[15px] font-bold leading-tight truncate")
    expect(t, '지역·종류 12px').toContain("mt-1 text-[12px] text-white/70 truncate")
    expect(t, '가격 행 13px').toContain("mt-1 text-[13px] font-extrabold whitespace-nowrap")
  })

  it('그라디언트를 실제로 읽어 낸다 — 못 읽으면 통과가 아니라 실패다', () => {
    const list = stops()
    // 파싱이 깨진 채 초록을 내면 이 시험은 아무것도 안 지킨다(이 레포가 반복해 당한 헛도는 가드).
    expect(list, '캡션 그라디언트 스톱 파싱').not.toBeNull()
    expect(list!.length).toBeGreaterThanOrEqual(3)
    expect(list![0].pct).toBe(0)
  })

  it('🔴 글자가 닿는 가장 밝은 지점에서도 **순백 사진** 위 할인율이 4.5:1 이상이다', () => {
    const list = stops()!
    const a = alphaAt(TEXT_TOP_PCT, list)
    // 대표색은 라이브에서 243 까지 봤다. 최악은 255(순백)이므로 그것으로 잰다.
    const bg = 255 * (1 - a)
    /* 🔗 2026-10-07: 토큰이 `var(--sale-on-media)` 로 바뀌었다(할인 빨강 한 벌로 모았다).
       그래서 **한 단계 따라가** 실제로 칠해지는 hex 를 구한다 — 못 구하면 통과가 아니라 실패다
       (여기서 멈추면 이 시험은 아무 색도 안 재게 된다). */
    const css = src(CSS)
    const resolve = (name: string, depth = 0): string | null => {
      if (depth > 3) return null
      const m = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
      if (!m) return null
      const v = m[1].trim()
      const hexM = v.match(/^#([0-9A-Fa-f]{6})$/)
      if (hexM) return hexM[1]
      const varM = v.match(/^var\(\s*--([\w-]+)\s*\)$/)
      return varM ? resolve(varM[1], depth + 1) : null
    }
    const hex = resolve('hero-tile-accent')
    expect(hex, '--hero-tile-accent 가 실제로 칠하는 hex 를 못 구했다').not.toBeNull()
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex!.slice(i, i + 2), 16))
    const cr = ratio(lum(r, g, b), lum(bg, bg, bg))
    expect(a, `글자 줄 알파 (${TEXT_TOP_PCT}%)`).toBeGreaterThanOrEqual(0.7)
    /* 🔴 2026-10-07: 바닥을 3.0 → **4.5** 로 올렸다. 할인율은 **13px bold** 라 WCAG 의 '큰 글자'
       (18.66px bold / 24px regular)가 아니다 ⇒ 보통 글자의 AA 바닥은 4.5:1 이다. 3.0 은 처음부터
       틀린 바닥이었고, 밴드를 B안에서 더 어둡게 만든 뒤로는 **아무 색이나 통과시키는** 값이 됐다
       (실측: 브랜드 블루 3.01 · `--sale`(#DC2626) 3.03 — 둘 다 3.0 을 넘는다). 그래서 색을 바꾸는
       주입이 통째로 샜다. 지금 색 `--sale-on-media`(#FF5C69)는 4.88 로 새 바닥을 넘는다. */
    expect(cr, `순백 위 할인율 대비 (알파 ${a.toFixed(2)} → 배경 ${Math.round(bg)})`).toBeGreaterThanOrEqual(4.5)
  })

  it('🔴 맨 위는 여전히 투명하다 — 평면 판이 되면 위쪽에 경계선이 보인다', () => {
    const list = stops()!
    expect(alphaAt(100, list), '밴드 맨 위').toBeLessThanOrEqual(0.02)
  })
})

/**
 * 🧵 상세 사진 — 한 사진은 한 번만 받고, 클릭 즉시 보인다 (2026-09-02 대표 "사진 로딩이 느리다 · 클릭하면 반응이 늦다").
 *
 * ## 라이브 워터폴 실측 (iPhone 에뮬, /group-buy/2887)
 *     496ms  link  width=900                     111KB   ← 워커 preload            ┐
 *     842ms  img   width=1200                    179KB   ← 갤러리 감시 <img>(PC 폭)  ├ 같은 사진 세 벌
 *     857ms  css   width=900,height=600,gravity  131KB   ← 실제 모바일 슬라이드     ┘
 *     857ms  css   ×4                        136~220KB   ← 나머지 슬라이드 넷이 **동시에**(콜드 2.3~4.4s)
 *
 * 08-31 에 슬라이드만 3:2 크롭으로 바꾸고 preload·감시 <img> 는 옛 폭에 남아 셋이 갈렸다. 에러가 없어
 * 아무도 몰랐다 — preload 는 URL 이 한 글자만 달라도 버려진다. 그리고 SPA 클릭 뒤 히어로는 **카드가
 * 이미 받아 둔 사진**을 안 쓰고 새 변형을 콜드로 기다렸다(데이터는 0ms 인데 사진만 늦었다).
 *
 * ## 이 테스트가 지키는 것
 *   1. 워커 preload · 감시 <img> · 슬라이드가 **같은 함수**(`shared/detail-hero-image`)로 URL 을 만든다.
 *   2. 모바일에서 PC 폭(1200)·썸네일(600) 감시 <img> 를 받지 않는다(`isDesktop` 게이트).
 *   3. 슬라이드는 보이는 장면 ±1 만 받는다.
 *   4. 카드가 받은 변형을 상세가 밑에 깐다(`image-warm` — 기억 ↔ 사용 **쌍**. 한쪽만 빠져도 조용히 무효).
 *
 * ## 못 막는 것
 *   - 실제 브라우저가 preload 를 재사용했는지(배포 후 워터폴로 본다: `link` 뒤에 같은 URL 의 `img` 가 0ms).
 *   - 콜드 콜로의 리사이즈 시간 자체(Cloudflare 쪽).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildDetailHeroPreloadLink } from '../../worker/utils/home-card-preload'
import { DETAIL_HERO_MOBILE_WIDTH, DETAIL_HERO_RATIO, detailHeroMobileUrl, isMobileUserAgent } from '@/shared/detail-hero-image'
import { getWarmImage, rememberWarmImage } from '@/utils/image-warm'

const read = (p: string) => readFileSync(p, 'utf-8')
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !l.trim().startsWith('//')).join('\n')

const GALLERY = code(read('src/pages/group-buy/DetailGallery.tsx'))
const CARD = code(read('src/components/deal/DealCardMedia.tsx'))
// ⚠️ 워커 파일은 `code()` 를 거치지 않는다 — 주석 속 `/api/media/*` 의 `/*` 가 블록주석 시작으로 오인돼 코드가 통째로 잘린다
//    (detail-hero-crop.test 가 같은 함정을 먼저 밟았다).
const WORKER = read('src/worker/index.ts')

describe('① 히어로 URL 은 한 함수에서 나온다', () => {
  it('모바일 슬라이드와 감시 <img> 가 같은 heroUrl(=SSOT) 을 같은 폭으로 부른다', () => {
    expect(GALLERY).toMatch(/const heroUrl = detailHeroMobileUrl/)
    const calls = GALLERY.match(/heroUrl\((?:src|main), DETAIL_HERO_MOBILE_WIDTH\)/g) || []
    expect(calls.length, '슬라이드·감시 두 곳이 같은 호출이어야 한다').toBeGreaterThanOrEqual(2)
    expect(GALLERY, '옛 숫자 리터럴 폭이 남아 있다 — SSOT 와 갈린다').not.toMatch(/heroUrl\(\w+, \d+\)/)
  })

  it('워커 preload(폰) === 슬라이드 URL, 그리고 3:2 크롭이 실려 있다', () => {
    const src = '/api/media/uploads/demo/2026-09/hero.jpg'
    const link = buildDetailHeroPreloadLink(JSON.stringify({ data: { image_url: src } }), false, true)
    expect(link).toContain(`href="${detailHeroMobileUrl(src)}"`)
    const h = Math.round(DETAIL_HERO_MOBILE_WIDTH / DETAIL_HERO_RATIO)
    expect(link).toContain(`width=${DETAIL_HERO_MOBILE_WIDTH}`)
    expect(link).toContain(`height=${h}`)
    expect(link).toMatch(/fit=cover/)
    expect(link).toMatch(/gravity=auto/)
  })

  it('워커가 UA 로 폰/PC 를 갈라 넘긴다 (기본값에 기대지 않는다)', () => {
    expect(WORKER).toMatch(/buildDetailHeroPreloadLink\([\s\S]{0,160}?isMobileUserAgent\(c\.req\.header\('user-agent'\)\)/)
    expect(isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')).toBe(true)
    expect(isMobileUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/126 Mobile Safari/537.36')).toBe(true)
    expect(isMobileUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/126 Safari/537.36')).toBe(false)
    expect(isMobileUserAgent(null)).toBe(false)
  })
})

describe('② 폰은 화면에 없는 PC 폭을 받지 않는다', () => {
  it('감시 <img> 목록이 isDesktop 으로 갈리고, 모바일 분기는 히어로 한 장뿐이다', () => {
    const at = GALLERY.indexOf('const probes = useMemo(')
    expect(at).toBeGreaterThan(0)
    const body = GALLERY.slice(at, GALLERY.indexOf('}, [', at))
    expect(body, 'isDesktop 게이트가 없다 — 폰이 1200·600×2 를 받는다').toMatch(/if \(!isDesktop\) \{/)
    const mobile = body.slice(body.indexOf('if (!isDesktop) {'), body.indexOf('return list', body.indexOf('if (!isDesktop) {')))
    expect(mobile).toMatch(/heroUrl\(main, DETAIL_HERO_MOBILE_WIDTH\)/)
    expect(mobile).not.toMatch(/DETAIL_HERO_DESKTOP_WIDTH|DETAIL_THUMB_WIDTH/)
    expect(GALLERY).toMatch(/useMediaQuery\(DETAIL_DESKTOP_QUERY\)/)
  })
})

describe('③ 슬라이드는 보이는 장면 ±1 만 받는다', () => {
  it('near 게이트가 배경 URL 생성 앞에 있다', () => {
    const at = GALLERY.indexOf("scrollSnapType: 'x mandatory'")
    const win = GALLERY.slice(at, at + 900)
    expect(win).toMatch(/const near = Math\.abs\(i - active\) <= 1/)
    expect(win, '게이트가 URL 생성에 안 걸려 있다').toMatch(/src && near \? heroUrl\(/)
  })
})

describe('④ 카드가 받은 변형을 상세가 밑에 깐다 (쌍)', () => {
  it('카드 커버 onLoad 가 currentSrc 를 기억한다', () => {
    expect(CARD).toMatch(/rememberWarmImage\(src, el\.currentSrc\)/)
  })
  it('갤러리가 기억된 변형을 두 번째 배경 겹으로 쓴다 (앞이 위 — 고해상이 먼저)', () => {
    expect(GALLERY).toMatch(/getWarmImage\(src\)/)
    expect(GALLERY).toMatch(/`url\("\$\{hi\}"\), url\("\$\{lo\}"\)`/)
    // 모바일 슬라이드·PC bg 둘 다 layered 를 거친다
    expect((GALLERY.match(/layered\((?:hi|detailPlainUrl)/g) || []).length).toBe(2)
  })
  it('기억 모듈 — 같은 원본이면 돌려주고, 없으면 null, 빈 값은 저장하지 않는다', () => {
    rememberWarmImage('/api/media/a.jpg', 'https://urdeal.kr/cdn-cgi/image/width=600/https://media.ur-team.com/a.jpg')
    expect(getWarmImage('/api/media/a.jpg')).toContain('width=600')
    expect(getWarmImage('/api/media/none.jpg')).toBeNull()
    rememberWarmImage('/api/media/b.jpg', '')
    expect(getWarmImage('/api/media/b.jpg')).toBeNull()
    expect(getWarmImage(null)).toBeNull()
  })
})

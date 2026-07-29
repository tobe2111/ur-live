/**
 * 🔎 2026-07-29 정적 소비자 표면 SEO 메타 — 불변식 고정.
 *
 * 이 테스트가 지키는 것은 **라이브에서 실제로 깨져 있던 두 가지**다:
 *   ① `/`·`/vouchers`·`/browse` 가 서빙 HTML 에서 홈 메타를 그대로 내보내고 canonical 이 없었다.
 *   ② `<title>` 이 `교환권 - 유어딜 - 유어딜` 이었다(접미사 이중 부착).
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 워커의 HTMLRewriter 배선이 빠지는 경우. 여기서 검증하는 건 순수함수의
 *    출력뿐이고, `worker/index.ts` 가 그 값을 실제로 `.on('title'|'head')` 에 흘리는지는 보지 않는다.
 *    (HTMLRewriter 는 Workers 런타임 전용이라 이 환경에서 실행할 수 없다.) 배선 회귀는 배포 후
 *    `curl https://urdeal.kr/vouchers | grep canonical` 로 확인할 것.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveConsumerSurfaceSeo,
  withSiteName,
  buildCanonical,
  escapeAttr,
} from '@/shared/seo/consumer-surfaces'

const ORIGIN = 'https://urdeal.kr'

describe('withSiteName — 접미사는 정확히 한 번', () => {
  it('접미사가 없으면 붙인다', () => {
    expect(withSiteName('교환권')).toBe('교환권 - 유어딜')
  })

  it('호출부가 이미 붙여 보낸 제목에 또 붙이지 않는다 (라이브 버그: `교환권 - 유어딜 - 유어딜`)', () => {
    expect(withSiteName('교환권 - 유어딜')).toBe('교환권 - 유어딜')
    expect(withSiteName('서비스 소개 - 유어딜')).toBe('서비스 소개 - 유어딜')
  })

  it('사이트명이 앞에 오는 제목(홈·랜딩)에도 붙이지 않는다', () => {
    expect(withSiteName('유어딜 - 돈버는 쇼핑, 이용권·교환권·동네딜')).toBe('유어딜 - 돈버는 쇼핑, 이용권·교환권·동네딜')
    expect(withSiteName('유어딜 인플루언서 — 팔로워가 곧 수익이 됩니다')).toBe('유어딜 인플루언서 — 팔로워가 곧 수익이 됩니다')
  })

  it('도매(유통스타트)도 같은 규칙을 쓴다', () => {
    expect(withSiteName('카탈로그', '유통스타트')).toBe('카탈로그 - 유통스타트')
    expect(withSiteName('카탈로그 - 유통스타트', '유통스타트')).toBe('카탈로그 - 유통스타트')
  })

  it('빈 제목이면 사이트명만', () => {
    expect(withSiteName('  ')).toBe('유어딜')
  })
})

describe('buildCanonical — 추적 파라미터는 canonical 에 남기지 않는다', () => {
  it('허용 목록이 없으면 경로만', () => {
    expect(buildCanonical(ORIGIN, '/browse', '?utm_source=x', undefined)).toBe('https://urdeal.kr/browse')
  })

  it('허용 파라미터만 보존하고 나머지는 버린다', () => {
    expect(buildCanonical(ORIGIN, '/vouchers', '?category=편의점&utm_source=kakao&fbclid=1', ['category', 'brand']))
      .toBe('https://urdeal.kr/vouchers?category=%ED%8E%B8%EC%9D%98%EC%A0%90')
  })

  it('파라미터 순서가 달라도 같은 canonical (중복 URL 방지)', () => {
    const a = buildCanonical(ORIGIN, '/vouchers', '?brand=스타벅스&category=커피/음료', ['category', 'brand'])
    const b = buildCanonical(ORIGIN, '/vouchers', '?category=커피/음료&brand=스타벅스', ['category', 'brand'])
    expect(a).toBe(b)
  })

  it('후행 슬래시는 정규화하되 루트는 보존', () => {
    expect(buildCanonical(ORIGIN, '/browse/', '', undefined)).toBe('https://urdeal.kr/browse')
    expect(buildCanonical(ORIGIN, '/', '', undefined)).toBe('https://urdeal.kr/')
  })
})

describe('resolveConsumerSurfaceSeo — 표면마다 다른 메타 + canonical', () => {
  it('표에 없는 경로는 null (상세는 각자 빌더가 담당 — 여기서 가로채면 안 된다)', () => {
    expect(resolveConsumerSurfaceSeo('/group-buy/2847', '', ORIGIN)).toBeNull()
    expect(resolveConsumerSurfaceSeo('/blog/what-is-urdeal', '', ORIGIN)).toBeNull()
    expect(resolveConsumerSurfaceSeo('/wholesale', '', ORIGIN)).toBeNull()
  })

  it('세 표면이 서로 다른 title/description 을 갖는다 (라이브 버그: 셋 다 홈 메타)', () => {
    const home = resolveConsumerSurfaceSeo('/', '', ORIGIN)!
    const vouchers = resolveConsumerSurfaceSeo('/vouchers', '', ORIGIN)!
    const browse = resolveConsumerSurfaceSeo('/browse', '', ORIGIN)!
    const titles = [home.pageTitle, vouchers.pageTitle, browse.pageTitle]
    expect(new Set(titles).size).toBe(3)
    const descs = [home.description, vouchers.description, browse.description]
    expect(new Set(descs).size).toBe(3)
  })

  it('canonical 이 자기 URL 을 가리킨다 (라이브 버그: og:url 이 전부 https://urdeal.kr)', () => {
    expect(resolveConsumerSurfaceSeo('/vouchers', '', ORIGIN)!.canonical).toBe('https://urdeal.kr/vouchers')
    expect(resolveConsumerSurfaceSeo('/browse', '', ORIGIN)!.canonical).toBe('https://urdeal.kr/browse')
    expect(resolveConsumerSurfaceSeo('/', '', ORIGIN)!.canonical).toBe('https://urdeal.kr/')
  })

  it('sitemap 이 제출하는 카테고리 URL 은 제목이 분화된다 (같은 title 로 여러 URL = 중복 신호)', () => {
    const plain = resolveConsumerSurfaceSeo('/vouchers', '', ORIGIN)!
    const cat = resolveConsumerSurfaceSeo('/vouchers', '?category=편의점', ORIGIN)!
    expect(cat.pageTitle).not.toBe(plain.pageTitle)
    expect(cat.pageTitle).toContain('편의점')
    expect(cat.canonical).toContain('category=')
  })

  it('브랜드 필터가 카테고리보다 우선한다 (브랜드가 더 구체적)', () => {
    const r = resolveConsumerSurfaceSeo('/vouchers', '?category=커피/음료&brand=스타벅스', ORIGIN)!
    expect(r.pageTitle).toContain('스타벅스')
  })

  it('랜딩 4종도 서버 메타를 갖는다 (sitemap 이 제출하는데 제네릭 홈이었다)', () => {
    for (const p of ['/about', '/creators', '/creators/apply', '/partners']) {
      const r = resolveConsumerSurfaceSeo(p, '', ORIGIN)
      expect(r, p).not.toBeNull()
      expect(r!.canonical, p).toBe(`https://urdeal.kr${p}`)
      expect(r!.description.length, p).toBeGreaterThan(20)
    }
  })

  it('sitemap 이 제출하는 정적 경로는 전부 메타를 갖는다 (선언과 구현이 갈리지 않게)', () => {
    // sitemap.routes.ts 의 정적 목록과 같은 집합. 여기에 추가하면 저기도 추가할 것.
    for (const p of ['/', '/browse', '/vouchers', '/map', '/about', '/creators', '/creators/apply', '/partners']) {
      expect(resolveConsumerSurfaceSeo(p, '', ORIGIN), p).not.toBeNull()
    }
  })

  it('어떤 표면도 제목에 사이트명을 두 번 담지 않는다', () => {
    for (const [path, search] of [['/', ''], ['/vouchers', ''], ['/vouchers', '?category=편의점'], ['/browse', ''], ['/map', ''], ['/about', ''], ['/creators/apply', ''], ['/partners', '']] as const) {
      const r = resolveConsumerSurfaceSeo(path, search, ORIGIN)!
      expect(r.pageTitle.split('유어딜').length - 1, `${path}${search}`).toBe(1)
    }
  })
})

describe('escapeAttr — 문자열로 마크업을 만드는 자리의 최소 방어', () => {
  it('속성 경계를 깨는 문자를 이스케이프한다', () => {
    expect(escapeAttr('https://x.kr/a"><script>alert(1)</script>')).toBe(
      'https://x.kr/a&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;'
    )
  })

  it('& 를 먼저 치환해 이중 이스케이프가 되지 않는다', () => {
    expect(escapeAttr('?a=1&b=2')).toBe('?a=1&amp;b=2')
  })
})

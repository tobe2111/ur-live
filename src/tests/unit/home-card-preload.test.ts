import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import {
  HOME_CARD_IMG_WIDTH_LG, HOME_CARD_IMG_WIDTH_BASE,
  HOME_CARD_LG_QUERY, HOME_CARD_BASE_QUERY, HOME_CARD_ABOVE_FOLD,
} from '@/shared/home-card-image'
import { buildHomeCardPreloadLinks, buildDetailHeroPreloadLink } from '@/worker/utils/home-card-preload'

/**
 * 🖼️ 홈 첫 화면 카드 사진 preload (2026-08-27 대표 신고 — "메인페이지 로딩 자체도 느려").
 *
 * ## 무엇을 고치는가
 * 사진 URL 은 이미 HTML 안(SECTIONS 시드)에 있는데 `<img>` 를 React 가 만들기 때문에
 * **JS 마운트 뒤에야** 다운로드가 시작됐다. 실측(모바일): 마운트 1341ms → 첫 사진 표시 2221ms.
 * 워커가 `<link rel="preload" as="image">` 를 넣으면 HTML 파싱 즉시 JS 와 **병렬로** 받는다.
 *
 * ## 이 테스트가 지키는 것 — "조용한 이중 다운로드"
 * preload 의 URL 이 실제 렌더 URL 과 **한 글자라도 다르면** 브라우저는 그걸 안 쓰고 같은 사진을
 * 다시 받는다. 에러도 없고 화면도 멀쩡한데 **더 느려지고 트래픽만 두 배**가 된다 —
 * 이 레포가 반복해 만난 "실패가 아니라 조용한 낭비" 클래스다.
 * 폭이 뷰포트로 갈리므로(2·3열 200 ↔ 4열 400) 특히 어긋나기 쉽다.
 *
 * ## 못 막는 것
 * HTMLRewriter 는 Workers 런타임 전용이라 **주입이 실제로 나가는지**는 여기서 못 본다.
 * 그건 배포 후 `curl … | grep 'rel="preload" as="image"'` 가 유일한 판정이다.
 */

const root = process.cwd()
const code = (p: string) =>
  fs.readFileSync(path.join(root, p), 'utf8')
    .split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n')

describe('홈 카드 사진 preload — 클라와 워커가 같은 URL 을 만든다', () => {
  const worker = code('src/worker/index.ts')
  const sections = code('src/components/home/HomeSections.tsx')

  it('🔴 폭·중단점·개수를 양쪽이 SSOT 에서 읽는다 (손으로 적으면 반드시 갈린다)', () => {
    // 🔁 2026-08-27: 워커는 이제 헬퍼에 위임한다 — SSOT 를 읽는 쪽이 헬퍼다.
    const helper = code('src/worker/utils/home-card-preload.ts')
    for (const [label, src] of [['helper', helper], ['HomeSections', sections]] as const) {
      expect(src, label).toMatch(/home-card-image/)
    }
    // 워커가 헬퍼를 거치지 않고 직접 조립하면(문자열 리터럴 복붙) SSOT 가 무의미해진다.
    expect(worker).toMatch(/buildHomeCardPreloadLinks/)
    expect(worker).not.toMatch(/rel="preload" as="image" fetchpriority="high" media=/)
    // 클라: 렌더 폭과 eager 개수가 상수여야 한다(리터럴 200/400/4 로 되돌아가면 워커와 갈린다).
    expect(sections).toMatch(/useMediaQuery\(HOME_CARD_LG_QUERY\)/)
    expect(sections).toMatch(/HOME_CARD_IMG_WIDTH_LG\s*:\s*HOME_CARD_IMG_WIDTH_BASE/)
    expect(sections).toMatch(/i < HOME_CARD_ABOVE_FOLD/)
    expect(sections).not.toMatch(/useMediaQuery\('\(min-width: 1024px\)'\)/)
  })

  it('🔴 워커가 MAIN 슬롯에서 헬퍼로 카드 사진을 preload 한다', () => {
    expect(worker).toMatch(/ssrSlot === 'MAIN' && ssrExtraPayload/)
    expect(worker).toMatch(/buildHomeCardPreloadLinks\(ssrExtraPayload\)/)
  })

  it('🔴 실제 시드로 링크를 만든다 — 사진 4장 × 뷰포트 2 = 8개', () => {
    const seed = JSON.stringify({
      success: true,
      data: [{ products: [1, 2, 3, 4, 5, 6].map((n) => ({ image_url: `/api/media/uploads/demo/p${n}.jpg` })) }],
    })
    const links = buildHomeCardPreloadLinks(seed)
    expect(links).toHaveLength(HOME_CARD_ABOVE_FOLD * 2)   // 5·6번째는 안 당긴다(eager 개수와 동일)
    for (const l of links) {
      expect(l).toMatch(/^<link rel="preload" as="image" fetchpriority="high" media="/)
    }
    // 뷰포트별로 갈라 붙는다 — 하나로 합치면 한쪽이 반드시 어긋난다.
    expect(links.filter((l) => l.includes(HOME_CARD_BASE_QUERY))).toHaveLength(HOME_CARD_ABOVE_FOLD)
    expect(links.filter((l) => l.includes(HOME_CARD_LG_QUERY))).toHaveLength(HOME_CARD_ABOVE_FOLD)
  })

  it('시드가 깨져도 홈이 죽지 않는다 (fail-soft)', () => {
    expect(buildHomeCardPreloadLinks('not json')).toEqual([])
    expect(buildHomeCardPreloadLinks('{}')).toEqual([])
    expect(buildHomeCardPreloadLinks(JSON.stringify({ data: [{ products: [{}] }] }))).toEqual([])
  })

  /**
   * 🔁 상세 히어로 preload 를 같은 헬퍼로 옮겼다(2026-08-27, 출력 불변). 표면별 형태가 갈리므로
   *   여기서 **그 차이 자체**를 고정한다 — 형태가 어긋나면 이중 다운로드다.
   */
  it('🔴 상세 히어로: 공구는 단일 URL, 교환권은 srcSet 까지', () => {
    const seed = JSON.stringify({ data: { image_url: '/api/media/uploads/demo/hero.jpg' } })
    const gb = buildDetailHeroPreloadLink(seed, false)
    const vc = buildDetailHeroPreloadLink(seed, true)
    expect(gb).toMatch(/rel="preload" as="image" fetchpriority="high"/)
    expect(gb).not.toMatch(/imagesrcset=/)      // 공구 상세는 단일 URL
    expect(vc).toMatch(/imagesrcset=/)          // 교환권 상세는 밀도 srcSet
    expect(buildDetailHeroPreloadLink('not json', false)).toBeNull()
    expect(buildDetailHeroPreloadLink('{}', false)).toBeNull()
  })

  it('🔴 preload URL 이 카드가 실제로 요청할 URL 과 같다 (이중 다운로드 0)', () => {
    // DealCardMedia 가 쓰는 형태와 **같은 인자**로 만들어 비교한다.
    const media = code('src/components/deal/DealCardMedia.tsx')
    expect(media).toMatch(/cfImage\(src, \{ width, format: 'auto' \}\)/)
    expect(media).toMatch(/cfSrcSet\(src, width\)/)

    for (const src of [
      '/api/media/uploads/demo/2026-08/a8818855-f067-4e32-bf0f-f54d6d3f3626.jpg',
      'https://media.ur-team.com/uploads/demo/2026-07/40535721.jpg',
      'https://t1.daumcdn.net/local/kakaomapPhoto/review/abc?original',
    ]) {
      for (const w of [HOME_CARD_IMG_WIDTH_BASE, HOME_CARD_IMG_WIDTH_LG]) {
        // 카드가 만드는 것 === preload 가 만드는 것 (같은 함수·같은 인자라 항등이어야 한다)
        expect(cfImage(src, { width: w, format: 'auto' })).toBe(cfImage(src, { width: w, format: 'auto' }))
        expect(cfSrcSet(src, w)).toBe(cfSrcSet(src, w))
      }
      // 두 폭이 실제로 **다른** URL 을 낸다 — 같다면 media 로 가른 의미가 없다(가드가 헛돈다).
      const a = cfImage(src, { width: HOME_CARD_IMG_WIDTH_BASE, format: 'auto' })
      const bb = cfImage(src, { width: HOME_CARD_IMG_WIDTH_LG, format: 'auto' })
      if (a && bb && a.includes('/cdn-cgi/image/')) expect(a).not.toBe(bb)
    }
  })

  it('중단점 두 개가 서로 여집합이다 (틈이 생기면 그 폭에서 preload 가 없다)', () => {
    expect(HOME_CARD_LG_QUERY).toBe('(min-width: 1024px)')
    expect(HOME_CARD_BASE_QUERY).toBe('(max-width: 1023px)')
  })
})

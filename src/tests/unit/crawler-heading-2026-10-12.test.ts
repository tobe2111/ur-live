/**
 * 🏷️ 크롤러 문서의 **제목 한 줄(`<h1>`)** (2026-10-12)
 *
 * **왜 있나(라이브 실측 — Googlebot UA 로 서버 HTML 을 받아 heading 을 셌다)**: 색인 대상 23표면 중
 * `<h1>` 이 있는 것은 **여섯**뿐이고 **17개가 heading 0** 이었다.
 *
 *     h1 있음   /blog · /pass/:id · /stays/:id · /vouchers/:id · /u/:handle   ← 서버 첫 화면이 제목을 그린다
 *     h1 0      /vouchers /browse /map /stays /faq /about /terms /privacy
 *               /region /region/서울 /region/서울/종로구 /products/:id
 *               /experience /new-openings /creators /partners /join
 *
 * 즉 **첫 화면 빌더가 있는 표면만** 제목이 있었고, `<noscript>` 본문만 있는 표면은 본문이
 * `<ul>`·`<p>` 뿐이라 "이 페이지가 무엇인가" 를 말하는 요소가 문서에 하나도 없었다. 언어모델도
 * 검색엔진도 heading 으로 주제를 잡으므로, 글자는 있는데 구조가 없는 상태였다.
 *
 * **처방**: `buildStaticSurfaceNoscript` 의 일곱 분기가 `h1Of(...)` 로 제목을 낸다. 값은
 * **그 표면의 마지막 빵부스러기 단계**(`CONSUMER_SURFACE_SEO.crumb` · 지역 허브는
 * `REGION_HUB_CRUMB` · 지역 잎은 그 분기가 이미 계산하던 라벨 · 쇼핑 상세는 상품명)이고,
 * 목록·지역에서는 **이미 본문 머리줄로 떠 있던 같은 글자**다 ⇒ 단어는 한 글자도 안 바뀐다.
 *
 * ⚠️ **이 시험이 못 보는 것**: 구글·네이버가 그 heading 을 실제로 쓰는지(색인 수일~수주 ·
 * 서치콘솔은 대표만 본다) · 사람 화면(그 블록은 `<noscript>` 라 JS 가 돌면 렌더조차 안 된다 —
 * **byte-동일**) · 홈(`/`)과 `/privacy`(아래 ❌ 참조).
 *
 * ❌ **일부러 안 한 것**
 * - **홈(`/`)** — 그 첫 화면(`home-first-screen.ts`)은 React 와 **박스를 맞춘** 빌더다(가드가
 *   픽셀로 대조). h1 을 끼우면 레이아웃이 움직여 밀림 0 계약을 깬다.
 * - **`/privacy`·`/refund`** — 본문이 아직 JSX 안에만 있어 `<noscript>` 자체가 없다(별건).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import { buildStaticSurfaceNoscript, buildDetailNoscript, buildStayNoscript, buildCuratorNoscript } from '../../worker/utils/crawler-noscript'
import { CONSUMER_SURFACE_SEO } from '@/shared/seo/consumer-surfaces'
import { SURFACE_COPY } from '@/shared/seo/surface-copy'
import { REGION_HUB_CRUMB } from '../../worker/utils/surface-list-jsonld'

const SRC = 'src/worker/utils/crawler-noscript.ts'

/** 탐침 시드 — 라이브 응답 모양(`/api/products` · MAIN 시드)에서 확인한 필드만 쓴다. */
const MIXED = JSON.stringify({
  success: true,
  data: [
    { id: 1, category: 'meal_voucher', restaurant_name: '달빛한스푼', restaurant_address: '서울 종로구 1', name: '닭도리탕', price: 31000, deal_only: 0 },
    { id: 2, category: 'meal_voucher', restaurant_name: '가게둘', restaurant_address: '서울 종로구 2', name: '메뉴둘', price: 9000, deal_only: 0 },
    { id: 3, category: 'meal_voucher', restaurant_name: '가게셋', restaurant_address: '서울 종로구 3', name: '메뉴셋', price: 9000, deal_only: 0 },
    { id: 4, category: 'stay_voucher', restaurant_name: '글램핑', restaurant_address: '강원 속초시 1', name: '1박', price: 149000, deal_only: 0 },
    { id: 5, category: 'convenience', brand_name: 'GS25', name: '츄파춥스', price: 300, deal_only: 1 },
  ],
})
const h1s = (html: string) => [...html.matchAll(/<h1>(.*?)<\/h1>/g)].map((m) => m[1])
const prodSeed = (d: Record<string, unknown>) => JSON.stringify({ data: { category: 'lifestyle', deal_only: 0, price: 39000, ...d } })

describe('① 제목이 있다 — 정확히 하나, 본문 맨 앞', () => {
  const cases: Array<[string, string | null]> = [
    ['/faq', null], ['/about', null], ['/terms', null], ['/terms/seller', null],
    ...Object.keys(SURFACE_COPY).map((p) => [p, MIXED] as [string, string]),
    ['/vouchers', MIXED], ['/browse', MIXED], ['/map', MIXED], ['/stays', MIXED],
    ['/region/서울', MIXED], ['/region/서울/종로구', MIXED],
    ['/products/2917', prodSeed({ name: '프리미엄 백팩' })],
  ]

  // 🩸 표가 비면 "검사했다" 는 거짓이 된다 — 하한을 둔다(실측 17표면이 결함이었다).
  it('검사 대상이 17표면 이상이다', () => {
    expect(cases.length).toBeGreaterThanOrEqual(17)
  })

  it.each(cases)('%s 에 제목이 정확히 하나 있고 본문 맨 앞이다', (path, seed) => {
    const html = buildStaticSurfaceNoscript(path, seed)
    expect(html, `${path} 본문이 비었다`).not.toBe('')
    expect(h1s(html), `${path} h1 개수`).toHaveLength(1)
    expect(html.startsWith(`<noscript><h1>`), `${path} 제목이 맨 앞이 아니다`).toBe(true)
  })
})

describe('② 제목 글자는 SSOT 에서 온다 — 손으로 적지 않는다', () => {
  it('목록·정적 표면은 그 표면의 마지막 빵부스러기 단계와 같다', () => {
    for (const p of ['/vouchers', '/browse', '/map', '/stays', '/faq', '/about', ...Object.keys(SURFACE_COPY)]) {
      if (p === '/region') continue // 허브는 동적 경로라 `CONSUMER_SURFACE_SEO` 에 항목이 없다(③ 참조)
      const crumb = CONSUMER_SURFACE_SEO[p]?.crumb
      expect(crumb, `${p} crumb 가 없다 — 제목으로 쓸 SSOT 가 사라졌다`).toBeTruthy()
      expect(h1s(buildStaticSurfaceNoscript(p, MIXED))[0], `${p} 제목이 crumb 와 갈렸다`).toBe(crumb)
    }
  })

  it('지역 잎은 그 분기가 이미 계산하던 라벨이다', () => {
    expect(h1s(buildStaticSurfaceNoscript('/region/서울', MIXED))[0]).toBe('서울 이용권')
    expect(h1s(buildStaticSurfaceNoscript('/region/서울/종로구', MIXED))[0]).toBe('서울 종로구 이용권')
  })

  it('쇼핑 상세는 그 화면의 상품명이다', () => {
    expect(h1s(buildStaticSurfaceNoscript('/products/2917', prodSeed({ name: '프리미엄 백팩' })))[0]).toBe('프리미엄 백팩')
  })

  it('약관은 그 문서 자체의 제목이고, 시행일·판 번호는 제목이 아니다', () => {
    const html = buildStaticSurfaceNoscript('/terms', null)
    expect(h1s(html)[0]).toBe(CONSUMER_SURFACE_SEO['/terms']?.crumb ? h1s(html)[0] : '')
    expect(h1s(html)[0]).toContain('이용약관')
    expect(h1s(html)[0]).not.toContain('시행')
    expect(html).toContain('<p>시행 ')
  })
})

describe('③ 지역 허브는 빵부스러기와 같은 상수를 쓴다', () => {
  it('허브 제목이 REGION_HUB_CRUMB 다 — 리터럴을 두 벌로 적지 않는다', () => {
    expect(h1s(buildStaticSurfaceNoscript('/region', MIXED))[0]).toBe(REGION_HUB_CRUMB)
    // 그 상수는 빵부스러기 빌더가 쓰는 바로 그것이어야 한다(export 가 사라지면 컴파일이 막는다).
    expect(REGION_HUB_CRUMB.length).toBeGreaterThan(0)
  })
})

describe('④ 🔴 첫 화면이 제목을 그리는 표면에는 넣지 않는다 — 한 문서에 h1 이 둘이 되는 쪽', () => {
  it('상세·숙소·유어샵 요약은 제목을 내지 않는다', () => {
    expect(h1s(buildDetailNoscript({ name: '닭도리탕', price: 31000, restaurant_address: '서울 종로구 1' }))).toHaveLength(0)
    // 🩸 픽스처 모양을 손으로 지어 쓰지 않는다 — tsc 가 첫 판의 `price`·`name` 을 잡았다
    //    (숙소는 `{product, rooms}`, 유어샵은 `{curator, pins}` 다. 이 레포가 반복해 밟은 자리).
    expect(h1s(buildStayNoscript({ product: { name: '1박', restaurant_name: '글램핑', region_sido: '강원' }, rooms: [{ base_price_weekday: 149000 }] }))).toHaveLength(0)
    expect(h1s(buildCuratorNoscript({ curator: { name: '정지원', bio: '전국의 맛집을 소개합니다.' }, pins: [{ product_name: '닭도리탕', price: 31000, restaurant_name: '달빛한스푼' }] }))).toHaveLength(0)
  })
})

describe('⑤ 안전 — 빈 라벨·탈출', () => {
  it('이름이 없으면 제목을 만들지 않는다 — 빈 제목을 남기지 않는다', () => {
    const html = buildStaticSurfaceNoscript('/products/2917', prodSeed({ name: '' }))
    expect(h1s(html)).toHaveLength(0)
    expect(html).not.toContain('<h1>')
    expect(html).toContain('판매가 39,000원') // 나머지 본문은 그대로
  })

  it('시드 값을 그대로 제목에 넣지 않는다 — HTML 탈출', () => {
    const html = buildStaticSurfaceNoscript('/products/2917', prodSeed({ name: 'a&b </script><b>x' }))
    expect(html).not.toContain('</script><b>')
    expect(html).toContain('&amp;')
  })

  it('조립은 한 곳에서만 한다 — `<h1>` 을 손으로 쓰지 않는다', () => {
    // 🩸 두 자리에서 각자 쓰면 한쪽이 `esc()` 를 빠뜨린다(이 레포가 반복해 밟은 클래스 —
    //    `childLinksHtml` 이 같은 이유로 한 곳에 모여 있다).
    const src = readCode(SRC)
    expect([...src.matchAll(/<h1>/g)], 'h1 마크업을 쓰는 자리').toHaveLength(1)
    expect(src).toContain('function h1Of(')
  })
})

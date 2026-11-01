/**
 * 🏁 화면의 가장 큰 그림(LCP)을 응답 헤더로 미리 받는다 — 2026-10-19
 *
 * 불변식
 *  ① 헤더에 싣는 주소는 서버 첫 화면이 `<img src>` 에 쓰는 주소와 **byte-일치**한다
 *     (한 글자만 달라도 브라우저는 그 preload 를 버리고 같은 사진을 다시 받는다 — 에러 0).
 *  ② 그릴 사진이 없으면 아무것도 싣지 않는다.
 *  ③ 같은 출처 경로만 — 외부 주소·Link 문법을 깨는 문자가 섞인 값은 버린다.
 *  ④ 워커는 서버 첫 화면을 **실제로 그렸을 때만**(빌더 결과가 비지 않을 때) 싣는다.
 *
 * ⚠️ 못 보는 것: 브라우저가 그 헤더를 실제로 쓰는지(배포 후 라이브 폭포로 판정) · HTMLRewriter 런타임.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { appendLcpLink, homeLcpImage, vouchersLcpImage, stayLcpImage, hrefOfPreloadTag } from '@/worker/utils/lcp-image-link'
import { buildHomeFirstScreen } from '@/worker/utils/home-first-screen'
import { buildVouchersFirstScreen } from '@/worker/utils/vouchers-first-screen'
import { buildStayDetailFirstScreen } from '@/worker/utils/stay-detail-ssr-body'
import { buildDetailFirstScreen } from '@/worker/utils/detail-ssr-body'
import { buildDetailHeroPreloadLink } from '@/worker/utils/home-card-preload'
import { stripComments } from '../helpers/source-text'

const LOADER = '<div>loader</div>'
/** 첫 화면 HTML 안의 `<img src>` 전부(속성 값의 &amp; 를 되돌린다). */
const imgSrcs = (html: string) => [...html.matchAll(/<img src="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'))

const HOME = JSON.stringify({
  success: true,
  data: [{ id: 2, title: '이런 이용권은 어떠세요?', products: [{ id: 2915, name: '돈가스 세트', image_url: 'https://media.ur-team.com/x.jpg', price: 7500, category: 'meal_voucher', deal_only: 0 }] }],
  strip_banners: [
    { id: 11, title: '서울 이용권', description: null, image_url: 'https://media.ur-team.com/uploads/b/seoul.jpg?a=1&b=2', link_url: null, banner_slot: 'strip' },
    { id: 12, title: '둘째 장', description: null, image_url: 'https://media.ur-team.com/uploads/b/two.jpg', link_url: null, banner_slot: 'strip' },
  ],
})
const VOUCHERS = JSON.stringify({ success: true, data: [{ id: 2192, name: '츄파춥스', brand_name: 'GS25', image_url: 'https://bizimg.giftishow.com/a.jpg', price: 300 }] })
const BANNERS = JSON.stringify({ success: true, data: [
  { id: 7, title: '교환권 머리', image_url: 'https://media.ur-team.com/uploads/b/head.jpg', link_url: null, banner_slot: 'vouchers' },
  { id: 8, title: '홈 띠', image_url: 'https://media.ur-team.com/uploads/b/strip.jpg', link_url: null, banner_slot: 'strip' },
] })
const STAY = JSON.stringify({ data: { product: { id: 2887, name: '평일 1박', restaurant_name: '그랑블루', property_type: 'glamping', image_url: 'https://media.ur-team.com/stay.jpg' }, rooms: [] } })
const PASS = JSON.stringify({ data: { id: 2919, name: '닭도리탕', restaurant_name: '달빛한스푼', image_url: 'https://media.ur-team.com/pass.jpg', price: 31000 } })

describe('① 헤더 주소 = 서버 첫 화면의 <img src> (byte-일치)', () => {
  it('홈 — 맨 위 배너 첫 장', () => {
    const href = homeLcpImage(HOME)
    expect(href).toMatch(/^\/cdn-cgi\/image\//)
    expect(href).toContain('seoul.jpg')
    expect(imgSrcs(buildHomeFirstScreen(HOME, LOADER))).toContain(href)
  })
  // 🔀 2026-11-01 뒤집음 — 대표 확정 A안으로 **교환권 머리에서 배너가 걷혔다**. 서버 첫 화면이 배너를
  //   그리지 않으므로 그 화면의 LCP 는 더 이상 배너가 아니고, 워커도 preload 를 안 붙인다.
  //   `vouchersLcpImage` 자체는 남겨 둔다(순수 함수 · 배너가 돌아오면 그대로 쓴다) — 여기서는
  //   **워커가 그것을 쓰지 않는다**와 **첫 화면에 배너 사진이 없다**를 잠근다.
  it('교환권 — 머리에 배너가 없어 LCP preload 를 안 붙인다 (A안)', () => {
    expect(vouchersLcpImage(BANNERS), '함수 자체는 살아 있다(배너 복원용)').toContain('head.jpg')
    const first = buildVouchersFirstScreen(VOUCHERS, LOADER, 'n')
    expect(first, '첫 화면 자체가 비면 아무것도 판정하지 못한다').toBeTruthy()
    expect(imgSrcs(first)).not.toContain(vouchersLcpImage(BANNERS))
  })
  it('숙소 상세 — 히어로', () => {
    const href = stayLcpImage(STAY)
    expect(href).toContain('stay.jpg')
    expect(imgSrcs(buildStayDetailFirstScreen(STAY, LOADER))).toContain(href)
  })
  it('이용권 상세 — <head> preload 와 같은 값이고, 그 값이 첫 화면 히어로다', () => {
    const href = hrefOfPreloadTag(buildDetailHeroPreloadLink(PASS, false, true))
    expect(href).toContain('pass.jpg')
    expect(imgSrcs(buildDetailFirstScreen(PASS, LOADER))).toContain(href)
  })
})

describe('② 그릴 사진이 없으면 싣지 않는다', () => {
  it('배너가 없거나 시드가 깨지면 빈 문자열', () => {
    expect(homeLcpImage(JSON.stringify({ success: true, data: [] }))).toBe('')
    expect(homeLcpImage('{')).toBe('')
    expect(homeLcpImage(null)).toBe('')
    expect(vouchersLcpImage(JSON.stringify({ success: true, data: [{ id: 8, title: 'x', image_url: 'https://a/b.jpg', banner_slot: 'strip' }] }))).toBe('')
    expect(stayLcpImage(JSON.stringify({ data: { product: { name: 'x' } } }))).toBe('')
  })
})

describe('③ 헤더 값 검증', () => {
  const links = (href: string) => { const h = new Headers(); appendLcpLink(h, href); return h.get('Link') }
  it('같은 출처 경로는 preload 헤더가 된다', () => {
    expect(links('/cdn-cgi/image/width=1100/https://x/a.jpg')).toBe('</cdn-cgi/image/width=1100/https://x/a.jpg>; rel=preload; as=image; fetchpriority=high')
  })
  it.each(['', 'https://evil.example/a.jpg', '//evil.example/a.jpg', '/a.jpg>; rel=preload', '/a b.jpg', '/a;b.jpg'])('버린다: %s', (v) => {
    expect(links(v)).toBeNull()
  })
  it('🩸 실제 사진 주소(옵션을 쉼표로 잇는 cdn-cgi)가 헤더가 된다 — 첫 판은 이걸 전부 버렸다', () => {
    // 픽스처를 손으로 짓지 않는다 — 진짜 빌더가 내는 주소로 잰다(옵션 하나짜리 픽스처라 첫 판이 초록이었다).
    const seed = JSON.stringify({ success: true, strip_banners: [{ id: 1, title: 'x', image_url: 'https://media.ur-team.com/uploads/a.webp', banner_slot: 'strip' }] })
    const href = homeLcpImage(seed)
    expect(href, '빌더가 빈 값을 냈다 — 픽스처 모양을 확인할 것').not.toBe('')
    expect(href).toContain(',')
    expect(links(href)).toBe(`<${href}>; rel=preload; as=image; fetchpriority=high`)
  })
})

describe('④ 워커 배선 — 첫 화면을 그렸을 때만', () => {
  const src = stripComments(fs.readFileSync('src/worker/index.ts', 'utf8'))
  it.each([
    ['홈', /const homeFirst = buildHomeFirstScreen\([^\n]*?\); if \(homeFirst\) appendLcpLink\(c\.res\.headers, homeLcpImage\(ssrExtraPayload\)\)/],
    ['숙소', /const stayFirst = buildStayDetailFirstScreen\([^\n]*?\); if \(stayFirst && isMobileUserAgent\([^\n]*?\)\) appendLcpLink\(c\.res\.headers, stayLcpImage\(ssrPayload\)\)/],
    ['이용권', /const firstScreen = buildDetailFirstScreen\([^\n]*?\); if \(firstScreen\) appendLcpLink\(c\.res\.headers, hrefOfPreloadTag\(buildDetailHeroPreloadLink\(ssrPayload, false, isMobileUserAgent\(/],
  ])('%s', (_n, re) => {
    expect(src).toMatch(re)
  })
  // 🔀 2026-11-01 — 교환권은 목록에서 빠졌다. 대표 확정 A안으로 **머리에 배너가 없어져** 그 화면의
  //   가장 큰 그림이 더는 배너가 아니다(배너 보조 시드 자체를 안 받는다). 같은 자리를 **반대 방향**으로
  //   잠근다 — 되살아나면 self-fetch 하나와 쓰이지 않는 preload 가 조용히 돌아온다.
  it('교환권은 LCP preload 를 붙이지 않는다 (A안 — 머리에 배너가 없다)', () => {
    expect(src).not.toMatch(/vouchersLcpImage/)
    expect(src, '배너 보조 시드가 되살아났다').not.toMatch(/ssrExtra = \{ slot: 'BANNERS'/)
  })
  it('헤더는 응답을 변환하기 전에 붙는다(변환 뒤엔 이미 나갔다)', () => {
    expect(src.indexOf('appendLcpLink(c.res.headers, homeLcpImage')).toBeLessThan(src.indexOf('const rewritten = rb.transform(c.res)'))
  })
})

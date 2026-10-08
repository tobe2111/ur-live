/**
 * 🎁 교환권 상세(`/vouchers/:id`)의 서버 첫 화면 — 2026-10-08 대표 *"모두 다 하자"*.
 *
 * 지키는 것은 하나다: **서버가 그린 것과 React 첫 렌더가 같은 자리에 같은 모양으로 온다.**
 * 갈리면 마운트 때 화면이 튀고, 그건 대표가 2026-07-01 에 금지한 "로딩 화면 2~3개" 로 되돌아가는 길이다.
 *
 * ⚠️ **이 테스트가 못 하는 것**: jsdom 은 레이아웃이 없어 *실제로 안 밀리는지*는 못 잰다 —
 *    여기서는 **치수·URL 을 정하는 값이 페이지와 같은지**만 대조하고, 최종 판정은 프레임 캡처다
 *    (`node out/firstpaint.mjs /vouchers/:id` 처럼 JS 를 끄고 서버 HTML 을 그대로 찍는 방법).
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'
import {
  buildVoucherDetailFirstScreen,
  VOUCHER_FS_CLASS,
  VOUCHER_PHOTO_WIDTH,
  VOUCHER_PHOTO_SIZES,
} from '@/worker/utils/voucher-detail-ssr-body'
import { cfImage, cfSrcSet } from '@/utils/cf-image'

const LOADER = '<div style="min-height:100dvh;display:flex">urdeal</div>'
const SEED = JSON.stringify({
  success: true,
  data: {
    id: 2192,
    name: '치즈롤 존스 페이버릿(L)',
    image_url: 'https://bizimg.giftishow.com/Resource/goods/x.jpg',
    category: '피자',
    deal_only: 1,
    price: 41760,
    original_price: 46400,
  },
})

describe('교환권 상세 — 서버가 그리는 첫 화면', () => {
  const page = readCode('src/pages/VoucherDetailPage.tsx')

  it('① 클래스가 페이지와 같다 — 갈리면 마운트 때 그 자리가 튄다', () => {
    // 페이지 소스에 **그대로** 있어야 한다. 한 토막이라도 바뀌면 여기가 빨간불이고,
    // 그때 고칠 것은 이 테스트가 아니라 `VOUCHER_FS_CLASS` 다(둘이 같아야 하는 것이 요점).
    expect(page.length, '페이지 소스를 못 읽었다').toBeGreaterThan(5000)
    for (const [key, cls] of Object.entries(VOUCHER_FS_CLASS)) {
      expect(page, `${key} 클래스가 페이지와 갈렸다`).toContain(cls)
    }
  })

  it('② 사진 URL 3종(src·srcSet·sizes)이 페이지와 같다 — 하나만 달라도 마운트 때 다시 받는다', () => {
    expect(page).toContain(`width: ${VOUCHER_PHOTO_WIDTH}, format: 'auto'`)
    expect(page).toContain(`cfSrcSet(product.image_url, ${VOUCHER_PHOTO_WIDTH})`)
    expect(page).toContain(VOUCHER_PHOTO_SIZES)

    const raw = 'https://bizimg.giftishow.com/Resource/goods/x.jpg'
    const html = buildVoucherDetailFirstScreen(SEED, LOADER)
    expect(html).toContain(`src="${cfImage(raw, { width: VOUCHER_PHOTO_WIDTH, format: 'auto' })}"`)
    const ss = cfSrcSet(raw, VOUCHER_PHOTO_WIDTH)
    expect(ss.length, 'srcSet 이 비면 이 단언은 아무것도 안 지킨다').toBeGreaterThan(10)
    expect(html).toContain('srcset="')
    expect(html).toContain(`sizes="${VOUCHER_PHOTO_SIZES}"`)
  })

  it('③ 경계 — 제목(h1)까지만. 가격·잔액은 서버가 그리지 않는다', () => {
    const html = buildVoucherDetailFirstScreen(SEED, LOADER)
    expect(html).toContain('<h1')
    expect(html).toContain('치즈롤 존스 페이버릿(L)')
    // 로그인 여부로 달라지는 것들 — 서버가 그리면 마운트 때 바뀐다.
    expect(html, '가격을 그렸다').not.toContain('41,760')
    expect(html, '정가를 그렸다').not.toContain('46,400')
    expect(html, '딜 잔액 문구를 그렸다').not.toMatch(/잔액|보유/)
  })

  it('④ 분류 칩 라벨 규칙이 페이지와 같다', () => {
    expect(page).toContain("product.deal_only === 1 ? '교환권' : getVoucherShortLabel(product.category)")
    expect(buildVoucherDetailFirstScreen(SEED, LOADER)).toContain('>교환권<')
    const notDeal = SEED.replace('"deal_only":1', '"deal_only":0')
    expect(notDeal, '픽스처 치환이 안 먹었다 — 이 단언이 헛돈다').not.toBe(SEED)
    expect(buildVoucherDetailFirstScreen(notDeal, LOADER)).not.toContain('>교환권<')
  })

  it('⑤ 첫 화면 노드 id 와 로더 높이 — 부팅 장치가 이 노드를 들고 다닌다', () => {
    const html = buildVoucherDetailFirstScreen(SEED, LOADER)
    expect(html).toContain('id="ur-first-screen"')
    expect(html, '로더가 100dvh 그대로면 사진 때문에 문서가 화면보다 길어진다').toContain('min-height:34dvh')
    expect(html).not.toContain('min-height:100dvh')
  })

  it('⑥ 못 그리면 빈 문자열 — 호출부가 종전 로더로 폴백한다(무회귀)', () => {
    expect(buildVoucherDetailFirstScreen('{{{', LOADER)).toBe('')
    expect(buildVoucherDetailFirstScreen('{"data":{}}', LOADER)).toBe('')
    expect(buildVoucherDetailFirstScreen(JSON.stringify({ data: { name: '이름만' } }), LOADER)).toBe('')
    expect(buildVoucherDetailFirstScreen(JSON.stringify({ data: { name: 'n', image_url: '  ' } }), LOADER)).toBe('')
  })

  it('⑦ 사용자 입력은 이스케이프된다', () => {
    const evil = JSON.stringify({
      data: { name: '<img src=x onerror=alert(1)>"&', image_url: 'https://bizimg.giftishow.com/a.jpg', deal_only: 1 },
    })
    const html = buildVoucherDetailFirstScreen(evil, LOADER)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('⑧ 워커 배선 — 이용권 상세 분기 **뒤**, catch-all 로더 **앞**', () => {
    const worker = readCode('src/worker/index.ts')
    // 🩸 `url.pathname.startsWith('/vouchers/')` 만으로 앵커하면 **히어로 preload 의 같은 표현**
    //    (`buildDetailHeroPreloadLink(…, url.pathname.startsWith('/vouchers/'), …)`)에 먼저 걸려
    //    순서 판정이 뒤집힌다 — 첫 판이 실제로 그래서 빨간불이 났다. 분기 조건 전체로 앵커한다.
    const passAt = worker.indexOf("ssrSlot === 'DETAIL' && ssrPayload && (url.pathname.startsWith('/pass/')")
    const vAt = worker.indexOf("ssrSlot === 'DETAIL' && ssrPayload && url.pathname.startsWith('/vouchers/')")
    expect(passAt, '이용권 상세 분기를 못 찾았다').toBeGreaterThan(0)
    expect(vAt, '교환권 상세 분기가 배선되지 않았다').toBeGreaterThan(passAt)
    expect(worker).toContain('buildVoucherDetailFirstScreen(ssrPayload, urdealLoaderHtml)')
    // 실패하면 로더로 — 이 `||` 가 빠지면 빈 화면이 된다.
    expect(worker).toContain('voucherFirst || urdealLoaderHtml')
  })

  it('⑨ 히어로 preload 와 **같은 URL** — 다르면 preload 가 통째로 버려진다', () => {
    // `buildDetailHeroPreloadLink` 는 교환권 표면에서 이미 `width: 800, format: 'auto'` + `cfSrcSet(…, 800)`
    // 으로 사진을 당겨 놓는다(2026-09-02). 첫 화면이 다른 폭을 그리면 그 preload 를 못 쓰고 **같은 사진을
    // 다시 받는다** — 09-02 에 이용권 상세에서 실제로 111KB 를 그렇게 버렸다.
    const preload = readCode('src/worker/utils/home-card-preload.ts')
    expect(preload).toContain("isVoucherSurface\n      ? cfImage(heroSrc, { width: 800, format: 'auto' })")
    expect(preload).toContain('isVoucherSurface ? cfSrcSet(heroSrc, 800)')
    expect(VOUCHER_PHOTO_WIDTH, 'preload 와 첫 화면의 폭이 갈렸다').toBe(800)
  })
})

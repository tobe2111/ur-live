import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { stripComments } from '../helpers/source-text'
import {
  OG_CARD_W, OG_CARD_H, OG_CARD_BG, ogAbsHttps, ogCardUrl, productShareImage,
} from '@/shared/og-share-image'
import { SHARE_CARD_W, SHARE_CARD_H } from '@/shared/ushop-share-card'
import { buildDetailMeta, buildStayDetailMeta, buildProductMeta } from '@/worker/utils/detail-ssr-meta'
import { buildBlogPostMeta } from '@/features/blog/api/blog-ssr-meta'

const read = (p: string) => fs.readFileSync(p, 'utf8')
const code = (p: string) => stripComments(read(p))
const O = 'https://urdeal.kr'

/**
 * 🖼️ **소셜 카드 그림은 1200×630 한 장이고, JSON-LD 상품 사진은 원본이다** (2026-10-12)
 *
 * ## 무엇이 문제였나 (라이브 실측 — UA `KakaoTalk-Scrap`, 서버 HTML 의 `og:image` 를 쟀다)
 * 상세마다 공유 그림의 성질이 갈려 있었다:
 *
 *     /pass/:id      1200×630 카드      ✅ (우리가 그린다)
 *     /u/:handle     1200×630 cdn-cgi   ✅ (2026-10-12 에 옮겼다)
 *     /stays/2887    **원본 1397×748 · 530,546B**        ← 비율 1.867 · 530KB
 *     /stays/2773    **원본 PNG**
 *     /vouchers/:id  **남의 CDN 원본 500×500 · 258,475B** ← 정사각 → small card
 *     /products/:id  같음
 *     /{몰}/p/:id     원본 + 폴백이 **SVG**
 *
 * 그리고 **봇 셸에 `og:image:width/height` 가 0건**이었다(카톡·페북·트위터·슬랙·디스코드·
 * 텔레그램·왓츠앱이 전부 그 셸을 받는다 — `BOT_UA_REGEX`). 사람이 받는 `index.html` 엔 있다.
 * ⇒ 2026-10-11 브랜드 JSON-LD 와 **같은 비대칭 클래스**다.
 *
 * ## 🔑 두 수정은 쌍이다
 * 치수를 선언하려면 **그 치수가 참이어야** 한다. 숙소가 1397×748 인 채로 1200×630 을 선언하면
 * 거짓이다 ⇒ 먼저 그림을 1200×630 으로 만들고, 그 다음 선언한다. 한쪽만 하면 안 된다.
 *
 * ## 🔬 `fit` 은 실측으로 골랐다 (giftishow 500×500 원본 258,475B)
 *
 *     cover,gravity=auto → 1200×630  112,028B   정사각을 잘라 **세로 44% 손실**
 *     contain            →  **630×630**  52,269B  1200×630 을 **안 만든다**
 *     pad,background=…   → 1200×630   54,819B   ✅ 잘림 0 · 원본의 1/5
 *
 * 수정 후 라이브 실측: 숙소 530,546 → **197,972B**(1200×630) · 교환권 258,475 → **54,819B**.
 * R2 직접이 워커 경유보다 **1.9배 빠르다**(1.57s ↔ 3.02s, 같은 바이트).
 *
 * ## ⚠️ 이 시험이 **못 보는 것**
 * 카드를 그리는 주체는 카카오·페북·슬랙이다 — 비율·바이트를 맞춘 것이 "예쁘다" 를 말해 주지
 * 않는다. 실제 카톡방에서 봐야 한다(E4). 그리고 렌더러가 선언 치수를 실제로 쓰는지도 외부 판정이다.
 */
describe('🖼️ 공유 카드 — 1200×630 한 장 + 봇 셸 치수 선언', () => {
  // ─── ① 카드 주소를 **돌려서** 판정한다(문자열 검사 아님) ───
  it('①-1 상품 공유 그림은 1200×630 · pad · 배경 · jpeg · onerror=redirect', () => {
    const u = productShareImage('https://cdn.example.com/a.jpg', O)
    expect(u).toContain(`width=${OG_CARD_W},height=${OG_CARD_H}`)
    expect(u, 'jpeg 고정 — 그림을 굽는 것은 남의 렌더러다').toContain('format=jpeg')
    expect(u, '리사이저 실패 시 원본으로 302(종전 동작)').toContain('onerror=redirect')
    expect(u, '상품은 pad — cover 면 정사각이 44% 잘린다(실측)').toContain('fit=pad')
    expect(u, 'jpeg 는 투명을 못 담는다 — 배경이 없으면 뒤가 검정이 된다').toContain('background=')
    expect(u, '생 # 은 fragment 로 잘린다').toContain(encodeURIComponent(OG_CARD_BG))
    expect(u.startsWith(`${O}/cdn-cgi/image/`), '우리 오리진이어야 남의 CDN 핫링크 차단과 무관해진다').toBe(true)
  })

  it('①-2 `fit=contain` 을 쓰지 않는다 — 1200×630 을 안 만든다(실측 630×630)', () => {
    expect(productShareImage('https://cdn.example.com/a.jpg', O)).not.toContain('fit=contain')
  })

  it('①-3 상품에 `cover` 를 쓰지 않는다 (얼굴 사진만 cover 다)', () => {
    expect(productShareImage('https://cdn.example.com/a.jpg', O)).not.toContain('fit=cover')
    // 얼굴용 분기는 **살아 있어야** 한다 — 유어샵 프로필은 꽉 채우는 게 맞다(대표 확정).
    expect(ogCardUrl('https://cdn.example.com/f.jpg', O, { fit: 'cover' })).toContain('fit=cover,gravity=auto')
  })

  it('①-4 `/api/media/` 는 **절대·상대 두 모양 모두** R2 공개 도메인으로', () => {
    // 🩸 처음엔 상대 모양만 봤다 — 호출부(`absImage`)가 먼저 origin 을 붙여서 **전부 놓쳤다**
    //    (실측: 숙소 데모 사진이 모두 이 형태). 워커 경유는 같은 결과에 1.9배 느리다.
    expect(ogAbsHttps('/api/media/uploads/x.jpg', O)).toBe('https://media.ur-team.com/uploads/x.jpg')
    expect(ogAbsHttps(`${O}/api/media/uploads/x.jpg`, O)).toBe('https://media.ur-team.com/uploads/x.jpg')
    expect(productShareImage(`${O}/api/media/uploads/x.jpg`, O)).toContain('media.ur-team.com')
    expect(productShareImage(`${O}/api/media/uploads/x.jpg`, O)).not.toContain(`${O}/api/media`)
  })

  it('①-5 원본의 `%` 를 한 번 더 감싼다 (한글 파일명 404 — 2026-08-11)', () => {
    const u = productShareImage('https://x.test/%B8%DE%B4%BA.jpg', O)
    expect(u).toContain('%25B8%25DE%25B4%25BA')
  })

  it('①-6 감쌀 수 없으면 **원본을 그대로** — 그림 없는 카드보다 낫다', () => {
    expect(ogCardUrl('', O, { fit: 'pad' })).toBe('')
    expect(ogCardUrl('data:image/png;base64,AAA', O, { fit: 'pad' })).toBe('')
    expect(productShareImage('relative-no-scheme.jpg', O)).toBe('relative-no-scheme.jpg')
    expect(productShareImage('', O)).toBe('')
  })

  // ─── ② 진짜 빌더를 돌려 **두 축**을 판정한다 ───
  // 🩸 모양을 손으로 지어 쓰지 말 것 — 숙소는 `{ data: { product, rooms } }` 다(첫 판은 평평하게
  //    써서 빌더가 **null** 을 돌려줬고, 그러면 이 시험이 아무것도 판정하지 못한다).
  const stay = JSON.stringify({ success: true, data: {
    product: {
      id: 2887, restaurant_name: '그랑블루', image_url: '/api/media/uploads/demo/a.jpg',
      region_sido: '강원', property_type: 'glamping', avg_rating: 4.6, review_count: 9,
    },
    rooms: [{ base_price_weekday: 149000 }],
  } })
  const prod = JSON.stringify({ success: true, data: {
    id: 2192, name: 'CU 상품권', price: 600, deal_only: 1,
    image_url: 'https://bizimg.giftishow.com/g/x.jpg', category: '편의점',
  } })
  const pass = JSON.stringify({ success: true, data: {
    id: 2919, name: '닭도리탕', price: 31000, restaurant_name: '달빛한스푼', category: 'meal_voucher',
  } })

  it('②-1 숙소·교환권·쇼핑의 `og:image` 가 1200×630 카드다', () => {
    for (const [label, m] of [
      ['/stays', buildStayDetailMeta(stay, O, '/stays/2887')],
      ['/vouchers', buildDetailMeta(prod, O, '/vouchers/2192')],
      ['/products', buildProductMeta(prod, O, '/products/2192')],
    ] as const) {
      expect(m, `${label} 메타가 null`).not.toBeNull()
      expect(m!.ogImage, `${label} og:image 가 원본이다`).toContain(`width=${OG_CARD_W},height=${OG_CARD_H}`)
      expect(m!.ogImage, `${label}`).toContain('fit=pad')
    }
  })

  it('②-2 🔴 JSON-LD `Product.image` 는 **원본**이다 (카드 주소가 새면 구글 상품 사진이 깎인다)', () => {
    for (const [label, m] of [
      ['/stays', buildStayDetailMeta(stay, O, '/stays/2887')],
      ['/products', buildProductMeta(prod, O, '/products/2192')],
    ] as const) {
      const ld = String(m!.jsonLd)
      expect(ld.length, `${label} JSON-LD 가 비었다 — 이 검사가 헛돈다`).toBeGreaterThan(50)
      const imgs = [...ld.matchAll(/"image":\s*(\[[^\]]*\]|"[^"]*")/g)].map(x => x[1])
      expect(imgs.length, `${label} JSON-LD 에 image 가 없다 — 이 검사가 헛돈다`).toBeGreaterThan(0)
      for (const i of imgs) {
        expect(i, `${label} JSON-LD image 에 카드 주소가 샜다`).not.toContain('/cdn-cgi/image/')
        expect(i, `${label} JSON-LD image 에 카드 치수가 샜다`).not.toContain(`width=${OG_CARD_W}`)
      }
    }
  })

  // 🔁 2026-10-13 재조준(대표 확정 안 1-가 — *"안 1-가로 하고"*): 사진이 있으면 **가득(cover)**, 여백(pad) 아님.
  //   사진이 없으면 종전 카드 주소 그대로(이미 공유된 링크·사진 없는 상품).
  it('②-3 `/pass/:id` — 사진 있으면 가득 채운 카드(cover), 없으면 종전 카드', () => {
    const m = buildDetailMeta(pass, O, '/pass/2919')
    expect(m!.ogImage).toBe(`${O}/api/og/group-buy/2919?v=1`)
    const withPhoto = JSON.stringify({ success: true, data: { ...JSON.parse(pass).data, image_url: 'https://media.ur-team.com/u/a.jpg' } })
    const p = buildDetailMeta(withPhoto, O, '/pass/2919')!.ogImage
    expect(p).toContain(`width=${OG_CARD_W},height=${OG_CARD_H}`)
    expect(p).toContain('fit=cover,gravity=auto')
    expect(p).not.toContain('fit=pad')
    expect(p.endsWith('/https://media.ur-team.com/u/a.jpg')).toBe(true)
  })

  it('②-4 네 빌더 전부 배선 — 몰(공구 서비스)까지', () => {
    const d = code('src/worker/utils/detail-ssr-meta.ts')
    expect((d.match(/productShareImage\(/g) || []).length, '상세 빌더 셋이 다 안 쓴다').toBeGreaterThanOrEqual(4)
    expect(code('src/worker/utils/mall-ssr-meta.ts'), '몰 상품 카드가 원본 그대로다').toContain('productShareImage(')
  })

  it('②-5 몰 폴백이 **라스터**이고 그 파일이 실재한다', () => {
    const m = code('src/worker/utils/mall-ssr-meta.ts')
    expect(m, 'SVG og:image 는 렌더러마다 갈린다(트위터 문서상 미지원)').not.toContain('/og-image.svg')
    expect(m).toContain('/og-image.png')
    expect(fs.existsSync('public/og-image.png'), '폴백 그림이 레포에 없다 — 404 를 가리킨다').toBe(true)
  })

  // ─── ③ 봇 셸의 치수 선언 ───
  it('③-1 봇 셸이 `og:image:width/height` 를 선언한다 (카톡·페북·슬랙이 받는 문서)', () => {
    const w = code('src/worker/index.ts')
    expect(w, '봇 셸에 og:image:width 가 없다').toContain('og:image:width')
    expect(w, '봇 셸에 og:image:height 가 없다').toContain('og:image:height')
  })

  it('③-2 선언값을 **손으로 적지 않는다** — SSOT 상수에서 온다', () => {
    const w = code('src/worker/index.ts')
    expect(w, '치수를 하드코딩하면 그림만 바뀌는 날 선언이 거짓이 된다')
      .toMatch(/og:image:width" content="\$\{OG_CARD_W\}/)
    expect(w).toMatch(/og:image:height" content="\$\{OG_CARD_H\}/)
  })

  it('③-3 유어샵 카드 치수가 **파생**이다 — 숫자 비교로는 못 잡는다', () => {
    // 🩸 첫 판은 `expect(SHARE_CARD_W).toBe(OG_CARD_W)` 였고 되돌려-검증이 **통과**시켰다 —
    //    하드코딩 값이 마침 같으면(1200 === 1200) 그 단언은 **늘 참**이라 아무것도 안 지킨다.
    //    지키려는 것은 "같은 값" 이 아니라 **파생**이다: `OG_CARD_W` 를 고치면 유어샵 카드와
    //    봇 셸 선언이 **따라와야** 한다. 그래서 소스를 본다.
    const u = code('src/shared/ushop-share-card.ts')
    expect(u, '유어샵 카드가 치수를 손으로 적는다 — SSOT 를 고쳐도 안 따라온다')
      .toMatch(/export const SHARE_CARD_W = OG_CARD_W\b/)
    expect(u).toMatch(/export const SHARE_CARD_H = OG_CARD_H\b/)
    expect(u, '숫자를 다시 박아 넣었다').not.toMatch(/SHARE_CARD_[WH] = \d/)
    // 값도 함께 본다(파생이 끊기지 않았는지 — 위 소스 검사와 짝이다).
    expect(SHARE_CARD_W).toBe(OG_CARD_W)
    expect(SHARE_CARD_H).toBe(OG_CARD_H)
    expect(OG_CARD_W / OG_CARD_H, '소셜 large card 비율 1.91:1').toBeCloseTo(1.905, 2)
  })

  it('③-4 사람 셸(`index.html`)의 선언과 같은 값이다', () => {
    const h = read('index.html')
    expect(h).toContain(`<meta property="og:image:width" content="${OG_CARD_W}" />`)
    expect(h).toContain(`<meta property="og:image:height" content="${OG_CARD_H}" />`)
  })
})

/**
 * ─── ④ **SVG 를 og:image 로 주지 않는다** (2026-10-12 후속 — 전수 쓸기에서 둘 더 나왔다)
 *
 * 카카오·페이스북·트위터 스크래퍼는 **SVG 를 안 읽는다.** 그런데 이 레포엔 og:image 가 SVG 인
 * 자리가 셋 더 있었다(실측):
 *
 *     /blog/:slug   og:image = /blog/og/:slug  →  `content-type: image/svg+xml` · 853B
 *                   ⇒ 발행 글 **23편**이 전부 빈 카드로 공유됐다
 *     /{몰슬러그}    로고 없으면 `og-image.svg`  ⇒ 그 몰 입구도 빈 카드
 *     SEO.tsx       `WHOLESALE_DEFAULT_IMAGE`  ⇒ 도매 철거(2026-10-11)로 **소비처 0** — 무접촉
 *
 * 🩸 **근본 원인은 낡은 전제였다.** `blog-seo.routes.ts` 머리말이 SVG 배너의 근거로
 *   *"사이트 기본 OG 가 이미 SVG(og-image.svg)라 SVG 배너는 동일 호환"* 이라 적어 뒀는데,
 *   그 사이 기본 OG 가 **`og-image.png`(실측 1200×630 라스터 44,972B)** 로 바뀌었다.
 *   전제가 사라졌는데 결론만 남아 있었고, 에러가 없어 아무도 몰랐다.
 *
 * ⚠️ 이 시험이 **못** 보는 것: 카카오가 실제로 어떤 카드를 그리는지(대표만 판정) ·
 *   `/blog/og/:slug` 라우트 자체(**살려 둔다** — 이전에 스크랩된 카드가 그 주소를 물고 있다).
 */
describe('④ og:image 는 라스터다 — 스크래퍼가 SVG 를 안 읽는다', () => {
  const origin = 'https://urdeal.kr'
  const post = (extra: Record<string, unknown> = {}) => JSON.stringify({
    data: { title: '유어딜이란?', summary: '동네 할인권', slug: 'what-is-urdeal', author: '유어딜', published_at: '2026-07-01 00:00:00', ...extra },
  })

  it('④-1 블로그 글이 SVG 배너를 가리키지 않는다', () => {
    const m = buildBlogPostMeta(post(), origin)!
    expect(m.ogImage, 'SVG 배너로 되돌아갔다 — 카톡 카드가 빈다').not.toContain('/blog/og/')
    expect(m.ogImage).not.toContain('.svg')
    expect(m.ogImage, '라스터 폴백이 아니다').toContain('/og-image.png')
  })

  it('④-2 썸네일이 있으면 1200×630 카드 — 없으면 기본 라스터', () => {
    const withThumb = buildBlogPostMeta(post({ thumbnail_url: 'https://cdn/x.jpg' }), origin)!
    expect(withThumb.ogImage).toContain('/cdn-cgi/image/')
    expect(withThumb.ogImage).toContain(`width=${OG_CARD_W}`)
    expect(withThumb.ogImage).toContain(`height=${OG_CARD_H}`)
    expect(withThumb.ogImage).toContain('https://cdn/x.jpg')
    // 썸네일이 비면 카드를 만들지 않는다(감쌀 원본이 없다).
    expect(buildBlogPostMeta(post({ thumbnail_url: '' }), origin)!.ogImage).toContain('/og-image.png')
  })

  it('④-3 JSON-LD `image` 는 **절대 URL 원본** — 상대 경로면 구글이 버린다', () => {
    // 🩸 첫 판이 `/api/media/...` 를 그대로 흘렸다. 2026-10-11 유어샵 핀에서 값을 치른 그 자리이고,
    //    **빌더를 돌려 눈으로 보고서야** 잡았다(소스 문자열 검사로는 안 보인다).
    const art = (payload: string) => {
      const g = JSON.parse(buildBlogPostMeta(payload, origin)!.jsonLd.replace(/<\\\//g, '</'))
      return (g['@graph'] as Array<Record<string, unknown>>).find((n) => n['@type'] === 'BlogPosting')!
    }
    expect(art(post({ thumbnail_url: '/api/media/u/1/a.webp' })).image, '상대 경로가 샜다').toBe('https://media.ur-team.com/u/1/a.webp')
    expect(art(post({ thumbnail_url: 'https://cdn/x.jpg' })).image, 'JSON-LD 에 카드를 넣었다 — 구글 글 사진은 원본이다').toBe('https://cdn/x.jpg')
  })

  it('④-4 사진이 없으면 JSON-LD `image` 를 **아예 안 낸다**', () => {
    // 브랜드 기본 카드를 "이 글의 사진" 이라고 말하는 것은 지어내기다
    // (이 레포가 `aggregateRating`·`Offer` 에서 지키는 것과 같은 규율).
    const g = JSON.parse(buildBlogPostMeta(post(), origin)!.jsonLd.replace(/<\\\//g, '</'))
    const a = (g['@graph'] as Array<Record<string, unknown>>).find((n) => n['@type'] === 'BlogPosting')!
    expect('image' in a, '사진이 없는데 image 를 냈다').toBe(false)
  })

  it('④-5 몰 입구(MALL 슬롯)도 라스터 — 로고는 pad 카드로', () => {
    const w = code('src/worker/index.ts')
    const line = w.split('\n').find((l) => l.includes('const mImg'))
    expect(line, 'MALL 슬롯 og:image 배선이 사라졌다').toBeTruthy()
    expect(line!, 'SVG 폴백으로 되돌아갔다').not.toContain('og-image.svg')
    expect(line!).toContain('og-image.png')
    expect(line!, '로고를 원본 그대로 — 1.91:1 이 아니라 잘리거나 작은 카드가 된다').toContain('ogCardUrl(')
    expect(line!, '로고를 cover 로 자르면 글자가 날아간다').toContain("fit: 'pad'")
  })

  it('④-6 낡은 전제를 되살리지 않는다 — 사이트 기본 OG 는 라스터다', () => {
    // 이 단언이 깨지는 날이 오면, 그때는 `/blog/og/:slug` 의 SVG 근거가 **되살아난 것**이 아니라
    // 기본 OG 가 퇴행한 것이다 — 그쪽을 고칠 것.
    const h = read('index.html')
    const og = /property="og:image" content="([^"]+)"/.exec(h)?.[1] || ''
    expect(og, '기본 OG 가 SVG 로 돌아갔다').not.toContain('.svg')
    expect(fs.existsSync('public/og-image.png')).toBe(true)
  })
})

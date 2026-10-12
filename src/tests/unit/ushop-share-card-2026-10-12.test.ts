/**
 * 🛍️ 유어샵 공유 카드 — 가드 (2026-10-12)
 *
 * 대표 *"유어샵 링크 공유했는데 이렇게 보이면 너무 투박하잖아. 방법 제안해봐"* → *"가장 이상적으로 진행해줘"*.
 *
 * ## 이 가드가 지키는 것
 *   ① **얼굴은 비활성 핀을 쓰지 않는다** — 라이브 실측(2026-10-12 `product_pins`)에서 핀 10개 중
 *      4개가 `is_active=0` 이고, **대표 계정의 1번 핀이 그중 하나**였다("프리미엄 백팩" — 판매도
 *      안 하는 쇼핑 데모). "1번 핀을 쓴다" 로 짜면 그게 공유 카드의 얼굴이 된다.
 *   ② 🔴 **딜 결제(`deal_only=1`)는 커머스 카드에 안 올린다** — 카카오 커머스는 '원' 표기 전용이라
 *      `600딜` 이 **"600원"** 으로 뜬다(거짓 가격). 그림으로는 쓴다(가격이 안 붙는다).
 *   ③ **착지가 카드와 맞는다** — 첫 버튼이 카드가 보여준 그 상품의 **귀속 경로**(`/u/:h/p/:id`).
 *   ④ **할인율은 정가·판매가로 계산**한다 — 선언된 `discount_rate` 가 어긋나도 카드가 거짓을 말하지 않는다.
 *   ⑤ **og:image 는 글자 없는 실사진** — 글자는 카톡·슬랙이 제목·설명으로 쓰므로 중복을 안 만든다.
 *   ⑥ **`sendDefault` 는 `lib/kakao-share.ts` 한 곳에서만** 부른다(사본 셋 방지).
 *   ⑦ **배선** — 유어샵 공유가 네이티브 시트보다 **먼저** 카카오를 시도한다 · 워커가 `ushopOgImage` 를 쓴다.
 *
 * ## 이 가드가 **못 하는 것**
 *   - 카드가 **예쁜가** — 그리는 주체는 카카오다. 실제 카톡방에서 봐야 한다(E4).
 *   - 카카오가 템플릿·필드를 바꾸는 것(외부 계약).
 *   - SDK 가 실제로 로드·init 되는지(브라우저 밖).
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'
import {
  buildUShopShareCard, isShareFacePin, isShareImagePin, pickShareFacePin, pickShareImagePin,
  pinPhoto, shareCardPhoto, ushopOgImage, ushopOgCardUrl, USHOP_OG_CARD_V,
  SHARE_CARD_W, SHARE_CARD_H, type UShopSharePin,
} from '@/shared/ushop-share-card'
import { KAKAO_SHARE_FALLBACK_IMAGE, buildCommerce, commercePayload, feedPayload, ushopCardPayload } from '@/lib/kakao-share'
import fs from 'node:fs'

const ORIGIN = 'https://urdeal.kr'
const FB = KAKAO_SHARE_FALLBACK_IMAGE

/**
 * 🔬 라이브 실측을 그대로 옮긴 픽스처 — **대표 계정(`users.id=3`)의 핀 6개**.
 * 순서·`is_active`·가격은 2026-10-12 D1 조회값이다(상품명만 줄였다).
 * ⚠️ 1번·2번이 비활성이라는 게 이 픽스처의 요점이다 — 바꾸면 ①이 헛돈다.
 */
const LIVE_PINS: UShopSharePin[] = [
  { product_id: 3, product_name: '프리미엄 백팩', image_url: 'https://img/bag.jpg', price: 79000, original_price: 99000, is_active: 0, category: 'general' },
  { product_id: 19, product_name: '국민 참치 대뱃살', image_url: 'https://img/tuna.jpg', price: 45000, original_price: null, is_active: 0, category: 'general' },
  { product_id: 2862, product_name: '순대국 2인 + 모둠순대', image_url: 'https://img/sundae.jpg', price: 21700, original_price: 26000, is_active: 1, category: 'meal_voucher' },
  { product_id: 2835, product_name: '곱창전골 2인', image_url: 'https://img/gopchang.jpg', price: 35100, original_price: 41000, is_active: 1, category: 'meal_voucher' },
  { product_id: 2887, product_name: '평일 1박 숙박권', image_url: 'https://img/stay.jpg', price: 209000, original_price: 272000, is_active: 1, category: 'stay_voucher' },
  { product_id: 2919, product_name: '달빛한스푼 닭도리탕', image_url: 'https://img/dak.jpg', price: 31000, original_price: 35000, is_active: 1, category: 'meal_voucher' },
]

function card(pins: UShopSharePin[] | null, extra: Partial<Parameters<typeof buildUShopShareCard>[0]> = {}) {
  return buildUShopShareCard({ handle: 'jiwon1228', name: '정지원', pins, origin: ORIGIN, fallbackImage: FB, ...extra })
}

describe('① 얼굴은 비활성 핀을 쓰지 않는다 (라이브 실측 모양)', () => {
  it('픽스처가 실측 모양을 유지한다 — 1번 핀이 비활성이어야 ①이 판정된다', () => {
    expect(LIVE_PINS.length, '핀 수가 줄면 이 검사가 헛돈다').toBeGreaterThanOrEqual(6)
    expect(LIVE_PINS[0].is_active, '1번 핀이 활성이면 "1번을 쓴다" 와 구분이 안 된다').toBe(0)
    expect(LIVE_PINS.filter((p) => Number(p.is_active) === 1).length).toBeGreaterThan(0)
  })

  it('고른 얼굴은 활성이고, **1번 핀이 아니다**', () => {
    const face = pickShareFacePin(LIVE_PINS)
    expect(face, '쓸 수 있는 핀이 있는데 null 이면 결함').not.toBeNull()
    expect(Number(face!.is_active)).toBe(1)
    expect(face!.product_id, '1번 핀(비활성)을 그대로 쓰면 안 된다').not.toBe(LIVE_PINS[0].product_id)
  })

  it('비활성·사진없음은 얼굴 후보가 아니다', () => {
    expect(isShareFacePin(LIVE_PINS[0])).toBe(false)
    expect(isShareImagePin(LIVE_PINS[0])).toBe(false)
    expect(isShareFacePin({ product_id: 1, image_url: null, price: 1000, is_active: 1 })).toBe(false)
    expect(isShareFacePin({ product_id: 1, image_url: 'https://img/a.jpg', price: 0, is_active: 1 })).toBe(false)
  })

  it('활성 핀이 하나도 없으면 커머스가 아니라 가게 카드로 떨어진다 (라이브 user 31)', () => {
    const only = [{ product_id: 2, product_name: '스마트 워치', image_url: 'https://img/w.jpg', price: 159000, original_price: 219000, is_active: 0 }]
    expect(pickShareFacePin(only)).toBeNull()
    expect(card(only).kind).toBe('feed')
  })
})

describe('② 딜 결제(교환권)는 커머스 카드에 올리지 않는다', () => {
  const dealPin: UShopSharePin = { product_id: 7, product_name: 'CU 쥬시쿨', image_url: 'https://img/juice.jpg', price: 600, deal_only: 1, is_active: 1, category: 'etc_voucher' }

  it('얼굴 후보에서 빠진다 — 600딜이 "600원" 으로 뜨는 것을 막는다', () => {
    expect(isShareFacePin(dealPin)).toBe(false)
    expect(pickShareFacePin([dealPin])).toBeNull()
    const c = card([dealPin])
    expect(c.kind).toBe('feed')
    expect(JSON.stringify(c), '카드 어디에도 가격 숫자가 실리지 않는다').not.toContain('600')
  })

  it('그림으로는 쓴다 — 가격이 안 붙으므로 함정이 없다', () => {
    expect(isShareImagePin(dealPin)).toBe(true)
    expect(pickShareImagePin([dealPin])?.product_id).toBe(7)
    expect(card([dealPin]).imageUrl).toContain('juice.jpg')
  })

  it('딜 핀이 섞여 있어도 얼굴은 원화 핀이 된다', () => {
    const mixed = [dealPin, ...LIVE_PINS]
    const face = pickShareFacePin(mixed)
    expect(Number(face!.deal_only) === 1).toBe(false)
    expect(Number(face!.price)).toBeGreaterThan(0)
  })
})

describe('③ 착지가 카드와 맞는다 (귀속 경로)', () => {
  it('첫 버튼이 카드가 보여준 그 상품의 `/u/:h/p/:id` — 소개비가 붙는 경로', () => {
    const c = card(LIVE_PINS)
    expect(c.kind).toBe('commerce')
    const face = pickShareFacePin(LIVE_PINS)!
    expect(c.buttons.length, '버튼 둘(상품 · 가게 전체)').toBe(2)
    expect(c.buttons[0].link).toBe(`${ORIGIN}/u/jiwon1228/p/${face.product_id}`)
    expect(c.buttons[1].link).toBe(`${ORIGIN}/u/jiwon1228`)
  })

  it('이용권이면 라벨이 "이용권", 쇼핑이면 "상품"', () => {
    const voucher = card(LIVE_PINS)
    expect(voucher.buttons[0].title).toContain('이용권')
    const shop = card([{ product_id: 6, product_name: 'Canvas Tote Bag', image_url: 'https://img/t.jpg', price: 45000, original_price: 70000, is_active: 1, category: 'general' }])
    expect(shop.buttons[0].title).toContain('상품')
  })

  it('가게 카드(폴백)도 버튼이 있다 — 스크래퍼 경로엔 버튼이 아예 없었다', () => {
    const c = card([])
    expect(c.kind).toBe('feed')
    expect(c.buttons.length).toBeGreaterThanOrEqual(1)
    expect(c.buttons[0].link).toBe(`${ORIGIN}/u/jiwon1228`)
  })
})

describe('④ 할인율은 정가·판매가로 계산한다', () => {
  it('선언된 discount_rate 가 거짓이어도 카드는 계산값을 쓴다', () => {
    const c = card([{ product_id: 9, product_name: '닭도리탕', image_url: 'https://img/d.jpg', price: 31000, original_price: 35000, discount_rate: 90, is_active: 1, category: 'meal_voucher' }])
    expect(c.kind).toBe('commerce')
    if (c.kind !== 'commerce') return
    expect(c.commerce.regularPrice).toBe(35000)
    expect(c.commerce.discountPrice).toBe(31000)
    expect(c.commerce.discountRate, '선언값 90 을 믿으면 거짓 배지가 나간다').toBe(11)
  })

  it('정가가 없으면 할인 필드를 만들지 않는다 (라이브 user 40)', () => {
    const c = card([{ product_id: 2917, product_name: '프리미엄 무선아이폰', image_url: 'https://img/p.jpg', price: 10000, original_price: null, is_active: 1, category: 'general' }])
    expect(c.kind).toBe('commerce')
    if (c.kind !== 'commerce') return
    expect(c.commerce.regularPrice).toBe(10000)
    expect(c.commerce.discountPrice).toBeUndefined()
    expect(c.commerce.discountRate).toBeUndefined()
  })
})

describe('⑤ 그림 — 글자 없는 실사진, 1200×630', () => {
  /**
   * 🩸 이 검사의 첫 판은 `cfImage()` 를 쓰는 구현을 검사했고, **라이브 호스트 분포를 재 보니
   *   그 구현이 틀렸다.** 핀 사진 호스트는 `images.unsplash.com` 5 · 상대경로 3 ·
   *   `media.ur-team.com` 1 · `i.ibb.co` 1 — 절반이 `cfImage` 의 보수적 분기(워커 프록시)로 간다.
   *   그 경로를 두드려 보니 **3,152,465B**(리사이즈 0) ↔ cdn-cgi 직접 **196,260B**.
   *   ⇒ **호스트와 무관하게** 크롭 인자가 붙는지를 본다(그게 그 수리의 요지다).
   */
  it('호스트와 무관하게 공유 카드 비율로 자른다 (피사체는 gravity=auto)', () => {
    for (const src of [
      'https://img.youtube.com/vi/x/hq.jpg',   // CDN_CGI_VERIFIED
      'https://images.unsplash.com/photo-1',   // 프록시로 가던 호스트 — 라이브 최다
      'https://i.ibb.co/a/b.jpg',              // 〃
      'https://처음보는호스트.example/a.jpg',   // 미지 호스트
    ]) {
      const u = shareCardPhoto(src, ORIGIN)
      expect(u, src).toContain(`width=${SHARE_CARD_W}`)
      expect(u, src).toContain(`height=${SHARE_CARD_H}`)
      expect(u, src).toContain('fit=cover')
      expect(u, src).toContain('gravity=auto')
      // 남의 렌더러가 굽는 그림이다 — AVIF/WebP 로 주면 안 보일 수 있다.
      expect(u, src).toContain('format=jpeg')
      expect(u, src).not.toContain('/api/image/resize')
      expect(u.startsWith(`${ORIGIN}/cdn-cgi/image/`), src).toBe(true)
    }
    expect(SHARE_CARD_W / SHARE_CARD_H, '소셜 카드 1.91:1').toBeGreaterThan(1.8)
  })

  it('상대 경로 사진도 절대 URL 로 나간다 — 스크래퍼는 상대 경로를 못 받는다', () => {
    const u = shareCardPhoto('/api/media/abc.jpg', ORIGIN)
    expect(u.startsWith('https://')).toBe(true)
    expect(u).toContain(`${ORIGIN}/api/media/abc.jpg`)
  })

  it('퍼센트 인코딩된 원본은 한 번 더 감싼다 (한글 파일명 네이버 사진 404 클래스)', () => {
    const u = shareCardPhoto('https://pstatic.net/%B8%DE%B4%BA.jpg', ORIGIN)
    expect(u).toContain('%25B8%25DE%25B4%25BA.jpg')
  })

  it('공유할 주소가 없는 것은 빈 문자열 — 폴백이 받는다', () => {
    for (const bad of ['', '   ', 'data:image/png;base64,AAAA', 'blob:http://x/y', 'ftp://x/y.jpg', 'javascript:alert(1)']) {
      expect(shareCardPhoto(bad, ORIGIN), bad).toBe('')
    }
  })

  it('og:image — 사진이 있으면 합성 카드가 아니라 사진', () => {
    const got = ushopOgImage(JSON.stringify({ pins: LIVE_PINS }), ORIGIN, 'jiwon1228')
    expect(got).not.toContain('/api/og/curator/')
    expect(got).toContain(`width=${SHARE_CARD_W}`)
  })

  it('og:image — 쓸 사진이 없으면 합성 카드로 떨어지고 판 번호가 붙는다', () => {
    const noPhoto = JSON.stringify({ pins: [{ product_id: 1, image_url: null, is_active: 1 }] })
    expect(ushopOgImage(noPhoto, ORIGIN, 'abc')).toBe(ushopOgCardUrl('abc', ORIGIN))
    expect(ushopOgImage('{bad json', ORIGIN, 'abc')).toBe(ushopOgCardUrl('abc', ORIGIN))
    expect(ushopOgImage(JSON.stringify({}), ORIGIN, 'abc')).toContain(`?v=${USHOP_OG_CARD_V}`)
  })

  it('판 번호는 3 보다 크다 — #1725 가 고친 카드를 카카오가 다시 긁어야 한다', () => {
    expect(USHOP_OG_CARD_V).toBeGreaterThan(3)
  })

  it('핀 사진이 없으면 프로필 사진, 그것도 없으면 기본 그림', () => {
    expect(card([], { profileImage: 'https://img/me.jpg' }).imageUrl).toContain('me.jpg')
    expect(card([]).imageUrl).toBe(FB)
  })

  it('사진 주소가 http(s)·절대경로가 아니면 안 쓴다', () => {
    expect(pinPhoto({ product_id: 1, image_url: 'javascript:alert(1)' })).toBe('')
    expect(pinPhoto({ product_id: 1, image_url: 'r2://bucket/a.jpg' })).toBe('')
    expect(pinPhoto({ product_id: 1, thumbnail: '/api/media/a.jpg' })).toBe('/api/media/a.jpg')
  })
})

describe('⑥ `sendDefault` 는 한 곳에서만 부른다', () => {
  /**
   * 🩸 이 검사의 첫 두 판이 **둘 다 헛돌았다**(그 과정이 이 검사의 모양을 정했다):
   *   ① 패턴을 `Share.sendDefault` 로 썼는데 SSOT 자신은 `Share!.sendDefault`(옵셔널 단정)라
   *      **한 건도 안 맞았다** — `git grep` 은 0건에 **exit 1** 이라 `execFileSync` 가 던지고,
   *      바로 아래 *"0건이면 헛돈다"* 단언에 **도달조차 못 했다**.
   *   ② `git grep` 은 **추적된 파일만** 본다. 새 SSOT 는 그 시점에 untracked 라 스캔에서 통째로
   *      빠졌고, 그래서 "밖에 사본이 있다" 로 읽혔다(CLAUDE.md 가 적어 둔 바로 그 함정).
   *   ⇒ **작업트리를 직접 걷고**, 주석을 걷어낸 뒤 센다(위 둘은 주석 안의 설명까지 셌다).
   */
  it('`lib/kakao-share.ts` 밖에서 직접 호출이 없다', () => {
    const walk = (dir: string, out: string[] = []): string[] => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = `${dir}/${e.name}`
        if (e.isDirectory()) walk(f, out)
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(f)
      }
      return out
    }
    const callers = walk('src')
      .filter((f) => !f.startsWith('src/tests/'))
      // 주석 안의 "`sendDefault` 를 옮겼다" 설명은 호출이 아니다.
      .filter((f) => /\bsendDefault\s*\(/.test(stripComments(fs.readFileSync(f, 'utf8'))))
    expect(callers.length, '한 파일도 못 찾았다 — 이 검사가 헛돈다(메서드 이름이 바뀌었나?)').toBeGreaterThan(0)
    expect(callers).toEqual(['src/lib/kakao-share.ts'])
  })

  /**
   * 🩸 이 검사의 첫 판은 *종전 값과 같은가* 였는데, 모으면서 **네 번째 사본**이 드러나며
   *   전제가 무너졌다 — 두 사본의 값이 서로 달랐고(`og-default.png` ↔ `icons/og-default.png`)
   *   라이브로 찔러 보니 **둘 다 404** 였다. 즉 "종전과 같다" 를 지켜도 그림은 안 뜬다.
   *   ⇒ 문자열 비교를 버리고 **`public/` 에 파일이 실재하는가**를 본다(404 는 이제 빨간불).
   */
  it('기본 그림이 `public/` 에 실재한다 — 없는 그림을 가리키면 카톡이 그 자리를 그냥 비운다', () => {
    const path = KAKAO_SHARE_FALLBACK_IMAGE.replace(/^https?:\/\/[^/]+\//, '')
    expect(path, '절대 URL 이어야 한다 — 상대 경로는 스크래퍼가 조용히 버린다').not.toBe(KAKAO_SHARE_FALLBACK_IMAGE)
    expect(fs.existsSync(`public/${path}`), `public/${path} 가 없다`).toBe(true)
    // `index.html` 의 og:image 와 같은 파일을 쓴다(두 벌이면 한쪽이 404 로 썩는다 — 실제로 그랬다).
    expect(fs.readFileSync('index.html', 'utf8')).toContain(KAKAO_SHARE_FALLBACK_IMAGE)
  })

  it('payload 모양 — 템플릿은 카드가 정하고 여기서 다시 판정하지 않는다', () => {
    const commerce = ushopCardPayload(card(LIVE_PINS)) as { objectType: string; commerce?: unknown; content: { description?: string } }
    expect(commerce.objectType).toBe('commerce')
    expect(commerce.commerce).toBeTruthy()
    expect(commerce.content.description, '커머스 카드엔 설명 자리가 없다').toBeUndefined()
    const feed = ushopCardPayload(card([])) as { objectType: string }
    expect(feed.objectType).toBe('feed')
  })

  it('옮겨 온 `buildCommerce` 가 종전 규칙 그대로다', () => {
    expect(buildCommerce(0, 0, 0)).toBeNull()
    expect(buildCommerce(10000, 8000)).toEqual({ regularPrice: 10000, discountPrice: 8000, discountRate: 20 })
    expect(buildCommerce(undefined, 8000)).toEqual({ regularPrice: 8000 })
    expect(buildCommerce(undefined, 8000, 20)?.discountPrice).toBe(8000)
  })

  it('버튼 link 를 안 주면 카드 주소를 쓴다(카카오는 버튼마다 link 가 필요하다)', () => {
    const p = feedPayload({ title: 't', url: 'https://u/x', buttons: [{ title: 'b' }] }) as { buttons: Array<{ link: { webUrl: string } }> }
    expect(p.buttons[0].link.webUrl).toBe('https://u/x')
    const c = commercePayload({ title: 't', url: 'https://u/x', commerce: { regularPrice: 1 }, buttons: [{ title: 'b', url: 'https://u/y' }] }) as { buttons: Array<{ link: { webUrl: string } }> }
    expect(c.buttons[0].link.webUrl).toBe('https://u/y')
  })
})

describe('⑦ 배선', () => {
  const page = stripComments(readCode('src/pages/CuratorPage.tsx'))

  /**
   * 🩸 이 단언의 첫 판은 네이티브 시도를 `page.indexOf('nav.share(')` 로 찾았다. 주입이 잡았다 —
   *   카카오 **위**에 `navigator.share(…)` 를 **다른 표기로** 끼워 넣으면 그 인덱스는 안 움직이고
   *   (여전히 종전 줄을 가리킨다) 순서가 뒤집혔는데도 **통과**했다.
   *   ⇒ 식별자 하나가 아니라 **표기 무관 첫 네이티브 시도**를 찾는다.
   */
  it('유어샵 공유가 네이티브 시트보다 **먼저** 카카오를 시도한다', () => {
    const kakaoAt = page.indexOf('shareViaKakao(ushopCardPayload(')
    // `nav.share(` · `navigator.share(` · 캐스트를 거친 `(navigator as …).share(` 전부 센다.
    const navAt = Math.min(...[...page.matchAll(/\.share\(\s*\{/g)].map((m) => m.index ?? Infinity))
    expect(kakaoAt, '카카오 경로가 없다 — 그러면 스크래퍼 카드로 되돌아간다').toBeGreaterThan(-1)
    expect(Number.isFinite(navAt), '네이티브 시도를 한 건도 못 찾았다 — 이 검사가 헛돈다').toBe(true)
    expect(kakaoAt, '네이티브 시트가 먼저면 카톡이 주소만 받아 중복 카드가 된다').toBeLessThan(navAt)
  })

  it('카드 내용을 화면이 지어내지 않는다 — SSOT 함수를 쓴다', () => {
    expect(page).toContain('buildUShopShareCard(')
    expect(page, "objectType 을 화면이 직접 쓰면 사본이 네 번째가 된다").not.toContain("objectType")
  })

  it('복사 폴백은 남아 있다 — 한국 밖·PC 는 카카오가 없다', () => {
    expect(page).toContain('clipboard.writeText')
  })

  it('워커 og:image 가 SSOT 를 거친다', () => {
    const w = stripComments(readCode('src/worker/index.ts'))
    expect(w).toContain('ushopOgImage(ssrPayload, origin2,')
    expect(w, '손으로 조립한 옛 카드 주소가 남아 있으면 판 번호가 갈린다').not.toContain('/api/og/curator/${encodeURIComponent(')
  })

  /**
   * 🎁 선물 시트는 **동기**여야 한다 — 그 파일 머리말이 이유를 적어 뒀다: 공유창은 누른 순간에
   *   열어야 폰 브라우저가 "사용자가 누르지 않은 이동" 으로 보고 막지 않는다. 모으면서 그 성질을
   *   잃기 쉬운 자리가 됐다(`shareViaKakao` 는 `await` 가 붙는다) → 가드가 방향을 고정한다.
   *   🩸 주입이 먼저 알려 줬다 — 이 단언이 **아예 없었고**, 그래서 defect 를 심어도 초록이었다.
   */
  it('선물 시트는 동기로 보낸다 — await 를 끼우면 폰이 공유창을 막는다', () => {
    const sheet = stripComments(readCode('src/pages/my-vouchers/GiftVoucherSheet.tsx'))
    expect(sheet, '동기 전송 함수를 써야 한다').toContain('return sendKakaoShare(feedPayload({')
    expect(sheet, 'SDK 를 기다리는 비동기 전송은 클릭 제스처를 잃는다').not.toContain('shareViaKakao(')
    // 동기 함수는 `boolean` 을 돌려주고, 실패하면 호출부가 복사로 떨어진다.
    expect(sheet).toMatch(/if \(!sendKakao\([^)]*\)\)\s*void copy\(/)
    const lib = stripComments(readCode('src/lib/kakao-share.ts'))
    expect(lib, '동기 경로가 사라지면 선물 시트가 쓸 것이 없다').toMatch(/export function sendKakaoShare\(/)
  })

  it('SDK 로더는 동적 import 로 둔다 — 정적이면 첫 페인트에 실린다', () => {
    const lib = stripComments(readCode('src/lib/kakao-share.ts'))
    // 상대 경로여야 한다 — `src/lib/` 의 `@/` 동적 import 는 런타임에 안 풀려 crash 한다(2026-04-22).
    expect(lib).toContain("await import('./kakao-sdk')")
    expect(lib, "@/ 동적 import 는 워커 런타임에서 문자열로 남는다").not.toContain("import('@/lib/kakao-sdk')")
    expect(lib, "정적 import 면 app-kakao-sdk 가 첫 페인트 봉투로 들어온다").not.toMatch(/^import .*kakao-sdk/m)
  })
})

/**
 * 🛍️ 유어샵 공유 카드 — 가드 (2026-10-12)
 *
 * 대표 *"유어샵 링크 공유했는데 이렇게 보이면 너무 투박하잖아"* → *"가장 이상적으로 진행해줘"*
 * → 그 결과를 보고 ***"차라리 유어샵 프로필 유저 프로필 사진이 뜨면 좋을 것 같은데?
 *   없으면 유달이 사진이 뜨고?"***
 *
 * ## 🔄 설계가 한 번 바뀌었고, 이 가드가 그 결정을 지킨다
 * 첫 판은 *"쓸 수 있는 첫 핀의 사진"* 을 카드 얼굴로 썼다. 그 설계는 결함 셋을 **각각 막아야** 했다:
 * 비활성 핀(10개 중 4개) · `deal_only` 의 '원' 표기(`600딜`→"600원") · 거짓 `discount_rate`(90 vs 11).
 * 대표 지시로 얼굴이 **프로필 → 유달이**가 되면서 **셋 다 생기지 않는다** — 남의 물건을 가게 간판으로
 * 세우지 않기 때문이다. 그래서 이 파일의 단언 18개가 교체됐고, 그 자리에 **되돌아오지 않게 하는**
 * 단언이 들어왔다(①).
 *
 * ## 이 가드가 지키는 것
 *   ① 🔴 **핀을 카드 얼굴로 쓰지 않는다** — 카드가 특정 핀의 사진·가격·할인율을 말하지 않는다.
 *      (되돌리면 위 결함 셋이 한꺼번에 돌아온다.)
 *   ② **얼굴은 합성 카드가 정한다**(프로필 → 유달이). og:image 와 SDK 카드가 **같은 그림**을 쓴다.
 *   ③ 🖼️ **프로필 *파일* 을 og:image 로 쓰지 않는다** — 정사각에 가까워 1200×630 으로 자르면
 *      얼굴이 잘린다. 합성 카드는 그걸 원형으로 담는다.
 *   ④ **합성 카드의 얼굴 우선순위** — 프로필 → 유달이 → (둘 다 못 받으면) 이니셜. 카드는 늘 나온다.
 *   ⑤ **`?v` 가 올라간다** — 카카오는 주소 단위로 카드를 캐시해서, 안 올리면 옛 카드가 계속 나간다.
 *   ⑥ **`sendDefault` 는 `lib/kakao-share.ts` 한 곳에서만** 부른다(사본 넷을 모았다).
 *   ⑦ **배선** — 유어샵 공유가 네이티브 시트보다 **먼저** 카카오를 시도한다 · 워커가 `ushopOgImage` 를
 *      쓴다 · 선물 시트는 **동기** · SDK 로더는 **상대 경로 동적 import**.
 *
 * ## 이 가드가 **못 하는 것**
 *   - 카드가 **예쁜가** — 그리는 주체는 카카오다. 실제 카톡방에서 봐야 한다(E4).
 *   - 합성 카드 안에서 유달이가 **잘려 보이는지** — 그건 그려 봐야 안다(렌더로 확인했다).
 *   - 카카오가 템플릿·필드를 바꾸는 것(외부 계약) · SDK 가 실제로 로드·init 되는지(브라우저 밖).
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'
import {
  buildUShopShareCard, isShareImagePin, pinPhoto, ushopOgImage, ushopOgCardUrl,
  USHOP_OG_CARD_V, SHARE_CARD_W, SHARE_CARD_H, type UShopSharePin,
} from '@/shared/ushop-share-card'
import { KAKAO_SHARE_FALLBACK_IMAGE, buildCommerce, commercePayload, feedPayload, ushopCardPayload } from '@/lib/kakao-share'
import fs from 'node:fs'

const ORIGIN = 'https://urdeal.kr'
const FB = KAKAO_SHARE_FALLBACK_IMAGE

/**
 * 🔬 라이브 실측을 그대로 옮긴 픽스처 — **대표 계정(`users.id=3`)의 핀 6개**.
 * 순서·`is_active`·가격은 2026-10-12 D1 조회값이다(상품명만 줄였다).
 * ⚠️ 1번·2번이 **비활성**이고 1번이 "프리미엄 백팩"(판매 안 하는 쇼핑 데모)이라는 게 요점이다.
 *    첫 판은 이 픽스처로 *"1번 핀을 쓰면 안 된다"* 를 지켰는데, 지금은 **어느 핀도 안 쓴다** —
 *    그래서 카드 어디에도 이 상품명·가격·할인율이 **나타나지 않아야** 한다(①).
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

describe('① 🔴 핀을 카드 얼굴로 쓰지 않는다 (되돌리면 결함 셋이 한꺼번에 돌아온다)', () => {
  it('카드에 어느 핀의 이름·사진·가격·할인율도 나타나지 않는다', () => {
    const c = card(LIVE_PINS)
    const blob = JSON.stringify(c)
    for (const p of LIVE_PINS) {
      expect(blob, `핀 이름이 샜다: ${p.product_name}`).not.toContain(String(p.product_name))
      expect(blob, `핀 사진이 샜다: ${p.image_url}`).not.toContain(String(p.image_url).replace(/^https?:\/\//, ''))
      expect(blob, `핀 가격이 샜다: ${p.price}`).not.toContain(String(p.price))
    }
    // 비활성 1번 핀("프리미엄 백팩")은 특히 — 첫 판이 막아야 했던 바로 그 자리다.
    expect(blob).not.toContain('프리미엄 백팩')
  })

  it('카드에 가격·할인 필드 자체가 없다 — `600딜`이 "600원"이 될 자리가 사라졌다', () => {
    const c = card(LIVE_PINS) as unknown as Record<string, unknown>
    for (const k of ['commerce', 'kind', 'regularPrice', 'discountPrice', 'discountRate']) {
      expect(c[k], `${k} 가 되살아났다 — 커머스 카드는 상품 페이지의 일이다`).toBeUndefined()
    }
    const payload = ushopCardPayload(card(LIVE_PINS)) as { objectType: string; commerce?: unknown }
    expect(payload.objectType, '유어샵 카드는 feed 다').toBe('feed')
    expect(payload.commerce).toBeUndefined()
  })

  it('핀 선정 함수가 SSOT 에 되살아나지 않는다', () => {
    const src = stripComments(readCode('src/shared/ushop-share-card.ts'))
    for (const dead of ['pickShareFacePin', 'isShareFacePin', 'shareCardPhoto', 'curatorHomePins']) {
      expect(src, `${dead} 가 되살아났다 — 핀을 간판으로 세우는 설계로 되돌아간다`).not.toContain(dead)
    }
  })

  it('핀은 **개수**에만 쓰인다 — 설명 한 줄', () => {
    // 🔬 6개가 아니라 **4개**다 — 비활성 핀 2개는 진열대에 없으니 세지 않는다
    //   (제가 처음에 6 으로 적었고 시험이 바로잡았다. 세는 기준은 `isShareImagePin` 하나다).
    expect(card(LIVE_PINS, { bio: null }).description).toBe('이용권 4개를 모아 뒀어요')
    expect(card([], { bio: null }).description).toBe('유어딜에서 모은 이용권')
    // 사진 없는 핀은 안 센다(카드 타일에 못 올라간다).
    const noPhoto = [{ product_id: 1, image_url: null, is_active: 1 }]
    expect(card(noPhoto, { bio: null }).description).toBe('유어딜에서 모은 이용권')
    // 소개가 있으면 그게 이긴다(사람이 쓴 말이 우선).
    expect(card(LIVE_PINS, { bio: '전국의 맛집을 소개합니다.' }).description).toBe('전국의 맛집을 소개합니다.')
  })
})

describe('②③ 얼굴은 합성 카드가 정한다 — 프로필 *파일* 이 아니다', () => {
  it('og:image 와 SDK 카드가 **같은 그림**을 쓴다', () => {
    const og = ushopOgImage(JSON.stringify({ pins: LIVE_PINS }), ORIGIN, 'jiwon1228')
    expect(card(LIVE_PINS).imageUrl, '두 경로가 갈리면 받는 사람마다 다른 카드를 본다').toBe(og)
    expect(og).toBe(ushopOgCardUrl('jiwon1228', ORIGIN))
  })

  it('시드 내용과 무관하게 합성 카드다 — 얼굴을 두 곳에서 정하지 않는다', () => {
    const a = ushopOgImage(JSON.stringify({ pins: LIVE_PINS }), ORIGIN, 'jiwon1228')
    const b = ushopOgImage('{bad json', ORIGIN, 'jiwon1228')
    const c = ushopOgImage(JSON.stringify({}), ORIGIN, 'jiwon1228')
    expect(new Set([a, b, c]).size, '시드를 다시 들여다보면 얼굴이 두 곳에서 정해진다').toBe(1)
  })

  it('프로필 사진 URL 을 카드 그림으로 직접 쓰지 않는다 (1200×630 으로 자르면 얼굴이 잘린다)', () => {
    const c = card(LIVE_PINS, { bio: null })
    expect(c.imageUrl).not.toContain('/cdn-cgi/image/')
    expect(c.imageUrl).toContain('/api/og/curator/')
    expect(SHARE_CARD_W / SHARE_CARD_H, '소셜 카드 1.91:1').toBeGreaterThan(1.8)
  })

  it('핸들이 없으면 폴백 그림 — 합성 카드 주소를 못 만든다', () => {
    expect(card(LIVE_PINS, { handle: '' }).imageUrl).toBe(FB)
    expect(card(LIVE_PINS, { handle: '   ' }).imageUrl).toBe(FB)
  })

  it('핸들은 URL 로 탈출된다 — 한글·공백 핸들이 주소를 깨지 않는다', () => {
    const u = ushopOgCardUrl('정지원 샵', ORIGIN)
    expect(u).toContain(encodeURIComponent('정지원 샵'))
    expect(u.startsWith('https://')).toBe(true)
  })

  it('착지는 유어샵 — 카드가 가게를 보여주고 버튼도 가게로 간다', () => {
    const c = card(LIVE_PINS)
    expect(c.link).toBe(`${ORIGIN}/u/jiwon1228`)
    expect(c.buttons.length, '스크래퍼 경로엔 버튼이 아예 없었다').toBeGreaterThan(0)
    for (const b of c.buttons) expect(b.link).toBe(c.link)
    expect(c.title).toBe('정지원의 유어샵')
  })

  it('이름이 없으면 핸들로 — 빈 제목을 내보내지 않는다', () => {
    expect(card(LIVE_PINS, { name: null }).title).toBe('@jiwon1228의 유어샵')
    expect(card(LIVE_PINS, { name: '   ' }).title).toBe('@jiwon1228의 유어샵')
  })
})

describe('④ 합성 카드의 얼굴 — 프로필 → 유달이 → 이니셜', () => {
  const cardSrc = stripComments(readCode('src/worker/utils/og-curator-card.ts'))
  const routeSrc = stripComments(readCode('src/worker/routes/og-image.routes.ts'))

  it('프로필이 없으면 유달이를 쓴다 (종전은 파란 원 + 이름 첫 글자였다)', () => {
    expect(cardSrc, '유달이 자리가 없다').toContain('udalUri')
    expect(cardSrc).toMatch(/const face = profileUri \|\| udalUri/)
    expect(routeSrc, '라우트가 유달이를 안 받아 오면 카드가 못 그린다').toContain('OG_UDAL_SRC')
  })

  it('유달이 그림은 **해시 없는 안정 경로** — 워커는 번들 해시를 모른다', () => {
    const src = readCode('src/worker/utils/og-curator-card.ts')
    const m = src.match(/OG_UDAL_SRC = '([^']+)'/)
    expect(m, 'OG_UDAL_SRC 가 없다').toBeTruthy()
    expect(fs.existsSync(`public${m![1]}`), `public${m![1]} 가 없다 — 404 면 얼굴이 빈다`).toBe(true)
    expect(m![1], '번들 자산(src/assets)은 파일명에 해시가 붙어 워커가 주소를 모른다').not.toContain('/src/')
  })

  it('🔴 유달이는 `contain` + 원 색 배경으로 받는다 — jpeg 는 투명을 못 담는다', () => {
    // `cover` 면 몸이 잘리고, 배경을 안 주면 원 안에 검정 상자가 생긴다(2026-10-12 실측).
    expect(routeSrc).toMatch(/fit: 'contain'/)
    expect(routeSrc).toContain('OG_AVATAR_TINT')
    const tint = readCode('src/worker/utils/og-curator-card.ts').match(/OG_AVATAR_TINT = '(#[0-9A-Fa-f]{6})'/)
    expect(tint, '원 색 상수가 없다').toBeTruthy()
    // 원과 여백이 같은 색이어야 이음매가 안 보인다 — 색을 두 벌로 적지 않는다.
    expect(cardSrc, '원 색을 상수가 아니라 손으로 적으면 유달이 여백과 어긋난다').toMatch(/fill="\$\{OG_AVATAR_TINT\}"/)
  })

  it('프로필이 있으면 유달이를 **받지도 않는다** (쓸모없는 subrequest 0)', () => {
    expect(routeSrc).toMatch(/hasProfile[\s\S]{0,120}Promise\.resolve\(null\)/)
  })

  it('둘 다 못 받아도 카드는 나온다 — 이니셜 폴백', () => {
    expect(cardSrc).toMatch(/if \(!face\)/)
    expect(cardSrc).toContain('initial')
  })
})

describe('⑤ 판 번호 — 안 올리면 옛 카드가 계속 나간다', () => {
  it('v4 보다 크다 — 얼굴이 바뀌었으니 카카오가 다시 긁어야 한다', () => {
    expect(USHOP_OG_CARD_V).toBeGreaterThan(4)
    expect(ushopOgCardUrl('abc', ORIGIN)).toContain(`?v=${USHOP_OG_CARD_V}`)
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

  /**
   * 🔄 첫 판은 *"핀이 있으면 commerce, 없으면 feed"* 를 단언했다. 대표 재지시로 유어샵은
   *   **feed 하나**가 됐다(①). `commercePayload` 자체는 **상품 페이지**(`KakaoShareButton`)가
   *   계속 쓰므로 죽은 코드가 아니고, 그래서 아래 `buildCommerce` 규칙 시험은 그대로 둔다.
   */
  it('payload 모양 — 유어샵은 핀 유무와 무관하게 feed 하나다', () => {
    for (const pins of [LIVE_PINS, [], null]) {
      const p = ushopCardPayload(card(pins)) as { objectType: string; commerce?: unknown; content: { description?: string } }
      expect(p.objectType).toBe('feed')
      expect(p.commerce, '커머스가 되살아나면 가격 거짓말이 돌아온다').toBeUndefined()
      expect(p.content.description, 'feed 는 설명 줄을 쓴다').toBeTruthy()
    }
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

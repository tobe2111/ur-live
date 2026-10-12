/**
 * 🛍️ 유어샵 공유 카드 — 가드 (2026-10-12)
 *
 * 대표 *"유어샵 링크 공유했는데 이렇게 보이면 너무 투박하잖아"* → *"가장 이상적으로 진행해줘"*
 * → 그 결과를 보고 ***"차라리 유어샵 프로필 유저 프로필 사진이 뜨면 좋을 것 같은데?
 *   없으면 유달이 사진이 뜨고?"***
 *
 * → 그걸 본 대표가 한 번 더 바로잡았다: ***"아니 이게 아니야, 그냥 사각형 전체를 사진 및 이미지로
 *   가득채워줘 이해했을까?"***
 *
 * ## 🔄 설계가 **두 번** 바뀌었고, 이 가드가 마지막 결정을 지킨다
 * 1판 — *"쓸 수 있는 첫 핀의 사진"* 을 얼굴로. 결함 셋을 **각각 막아야** 했다: 비활성 핀(10개 중 4개) ·
 *   `deal_only` 의 '원' 표기(`600딜`→"600원") · 거짓 `discount_rate`(90 vs 실제 11).
 * 2판 — 대표 지시로 **합성 카드**(흰 판 + 프로필 원 + 이름 + 소개 + 핀 타일). 결함 셋은 사라졌지만
 *   **카드 안에 또 카드**였다 — 카톡이 제목·설명을 자기 영역에 붙이는데 그림에도 같은 글자가 있었다
 *   (대표가 처음 신고한 **중복** 그대로).
 * 3판(지금) — **1200×630 을 가득 채운 사진 한 장.** 틀도 글자도 없다. 글자는 카톡이 붙인다.
 *
 * ## 이 가드가 지키는 것
 *   ① 🔴 **핀을 카드 얼굴로 쓰지 않는다** — 카드가 특정 핀의 사진·가격·할인율을 말하지 않는다.
 *      (되돌리면 1판의 결함 셋이 한꺼번에 돌아온다.)
 *   ② 🖼️ **그림 = `/cdn-cgi/image` 로 받은 1200×630 사진 한 장.** 합성 카드 주소를 공유 그림으로
 *      쓰지 않는다(2판 회귀 차단) · 그림 주소에 제목·설명 글자가 들어가지 않는다.
 *   ③ **프로필 → 없으면 유달이.** 프로필은 `fit=cover,gravity=auto`, 유달이는 `fit=pad` + 브랜드 블루.
 *      🔴 유달이에 `cover`(머리가 잘린다)·`contain`(584×630 이 온다) 금지 — 둘 다 실측이다.
 *      🔴 배경 색은 **퍼센트 인코딩**해야 한다 — 생 `#` 은 fragment 로 잘리고 `1C69EF` 는 err=9401(실측).
 *   ④ **합성 카드 라우트(`/api/og/curator/:handle`)는 살아 있다** — 이전에 스크랩된 카드가 그 주소를
 *      물고 있다. 그 안의 얼굴 우선순위(프로필 → 유달이 → 이니셜)도 그대로 지킨다.
 *   ⑤ **유달이 그림이 `public/` 에 실재한다** — 404 면 카드 자리가 통째로 빈다.
 *   ⑥ **`sendDefault` 는 `lib/kakao-share.ts` 한 곳에서만** 부른다(사본 넷을 모았다).
 *   ⑦ **배선** — 유어샵 공유가 네이티브 시트보다 **먼저** 카카오를 시도한다 · 워커가 `ushopOgImage` 를
 *      쓴다 · 화면 `<SEO image>` 도 **같은 함수**를 쓴다 · 선물 시트는 **동기** · SDK 로더는 동적 import.
 *
 * ## 이 가드가 **못 하는 것**
 *   - 카드가 **예쁜가** — 그리는 주체는 카카오다. 실제 카톡방에서 봐야 한다(E4).
 *   - 사진이 **잘 잘렸는지** — `gravity=auto` 가 피사체를 찾는 것은 리사이저의 몫이고, 그 결과는
 *     그려 봐야 안다(대표 프로필·유달이 둘 다 눈으로 확인했다).
 *   - 카카오가 템플릿·필드를 바꾸는 것(외부 계약) · SDK 가 실제로 로드·init 되는지(브라우저 밖).
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'
import {
  buildUShopShareCard, isShareImagePin, pinPhoto, ushopOgImage, ushopShareImage,
  SHARE_CARD_W, SHARE_CARD_H, SHARE_MASCOT_BG, SHARE_MASCOT_SRC, type UShopSharePin,
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

describe('② 🖼️ 그림 = 1200×630 을 가득 채운 사진 한 장', () => {
  const PROF = 'https://media.ur-team.com/u/3/avatar.jpg'

  it('og:image 와 SDK 카드가 **같은 함수**로 같은 그림을 만든다', () => {
    const og = ushopOgImage(JSON.stringify({ curator: { profile_image: PROF }, pins: LIVE_PINS }), ORIGIN, 'jiwon1228')
    expect(card(LIVE_PINS, { profileImage: PROF }).imageUrl,
      '두 경로가 갈리면 받는 사람이 어디서 받느냐에 따라 다른 카드를 본다').toBe(og)
  })

  it('`/cdn-cgi/image` 로 1200×630 을 요청한다 — 원본을 그대로 넘기지 않는다', () => {
    const u = card(LIVE_PINS, { profileImage: PROF }).imageUrl
    expect(u).toContain(`${ORIGIN}/cdn-cgi/image/`)
    expect(u).toContain(`width=${SHARE_CARD_W}`)
    expect(u).toContain(`height=${SHARE_CARD_H}`)
    // 🔴 굽는 것은 **남의 렌더러**다 — AVIF/WebP 를 못 읽을 수 있어 jpeg 고정.
    expect(u, 'format=auto 면 카톡·슬랙 중 하나가 그 자리를 비운다').toContain('format=jpeg')
    expect(u).toContain('onerror=redirect')
    expect(SHARE_CARD_W / SHARE_CARD_H, '소셜 카드 1.91:1').toBeGreaterThan(1.8)
  })

  it('🔴 합성 카드 주소를 공유 그림으로 쓰지 않는다 (2판 회귀 차단)', () => {
    for (const c of [card(LIVE_PINS, { profileImage: PROF }), card(LIVE_PINS), card(null)]) {
      expect(c.imageUrl, '카드 안에 또 카드가 들어가면 글자가 중복된다').not.toContain('/api/og/curator')
    }
    const src = stripComments(readCode('src/shared/ushop-share-card.ts'))
    for (const dead of ['ushopOgCardUrl', 'USHOP_OG_CARD_V', '/api/og/curator']) {
      expect(src, `${dead} 가 되살아났다 — 공유 그림이 합성 카드로 되돌아간다`).not.toContain(dead)
    }
  })

  it('🔴 그림 주소에 제목·설명 글자가 들어가지 않는다', () => {
    const c = card(LIVE_PINS, { profileImage: PROF, name: '정지원', bio: '전국의 맛집을 소개합니다.' })
    expect(c.imageUrl).not.toContain('정지원')
    expect(c.imageUrl).not.toContain(encodeURIComponent('정지원'))
    expect(c.imageUrl).not.toContain('맛집')
    expect(c.title, '글자는 **카톡이** 제목으로 붙인다').toBe('정지원의 유어샵')
  })

  it('착지는 유어샵 — 카드가 가게를 보여주고 버튼도 가게로 간다', () => {
    const c = card(LIVE_PINS, { profileImage: PROF })
    expect(c.link).toBe(`${ORIGIN}/u/jiwon1228`)
    expect(c.buttons.length, '스크래퍼 경로엔 버튼이 아예 없었다').toBeGreaterThan(0)
    for (const b of c.buttons) expect(b.link).toBe(c.link)
  })

  it('이름이 없으면 핸들로 — 빈 제목을 내보내지 않는다', () => {
    expect(card(LIVE_PINS, { name: null }).title).toBe('@jiwon1228의 유어샵')
    expect(card(LIVE_PINS, { name: '   ' }).title).toBe('@jiwon1228의 유어샵')
  })

  it('핸들이 없어도 **그림은 나온다** — 유달이는 핸들과 무관하다', () => {
    // 🔁 2판에서는 핸들이 없으면 합성 카드 주소를 못 만들어 폴백 그림이었다. 3판은 그림이 가게
    //   이름과 무관하므로 그 폴백이 필요 없다(폴백은 origin 이 비는 비정상 경로에만 남는다).
    const c = card(LIVE_PINS, { handle: '' })
    expect(c.imageUrl).toContain('/cdn-cgi/image/')
    expect(c.imageUrl).not.toBe(FB)
  })
})

describe('③ 프로필 → 없으면 유달이', () => {
  const PROF = 'https://media.ur-team.com/u/3/avatar.jpg'

  it('프로필이 있으면 그 사진을 `cover,gravity=auto` 로 꽉 채운다', () => {
    const u = card(LIVE_PINS, { profileImage: PROF }).imageUrl
    expect(u).toContain('fit=cover')
    expect(u, '피사체 찾기를 리사이저에 맡긴다 — 가운데 자르면 얼굴이 잘린다').toContain('gravity=auto')
    expect(u.endsWith(PROF), '원본이 경로 끝에 그대로 박힌다').toBe(true)
    expect(u).not.toContain(SHARE_MASCOT_SRC)
  })

  it('프로필이 없으면 유달이 — `fit=pad` + 딥 네이비', () => {
    for (const prof of [undefined, null, '', '   ']) {
      const u = card(LIVE_PINS, { profileImage: prof }).imageUrl
      expect(u, `프로필=${JSON.stringify(prof)} 일 때 유달이가 안 나왔다`).toContain(SHARE_MASCOT_SRC)
      // 🔴 `cover` 면 전신 포즈라 **머리가 잘린다**. `contain` 은 패딩을 안 해서 1200×630 을 달라
      //   해도 **584×630** 이 온다(둘 다 2026-10-12 라이브 실측). `pad` 만 정확한 크기를 만든다.
      expect(u).toContain('fit=pad')
      expect(u).not.toContain('fit=cover')
      expect(u).not.toContain('fit=contain')
    }
  })

  it('🔴 배경 색은 퍼센트 인코딩된다 — 생 `#` 은 fragment 로 잘리고 `1C69EF` 는 err=9401(실측)', () => {
    const u = card(LIVE_PINS).imageUrl
    expect(u).toContain(`background=${encodeURIComponent(SHARE_MASCOT_BG)}`)
    expect(u, '생 # 이면 리사이저가 옵션을 못 읽는다').not.toContain(`background=${SHARE_MASCOT_BG}`)
    // jpeg 는 투명을 못 담으므로 배경을 안 주면 유달이 뒤가 검정이 된다.
    // 🎨 2026-10-12 대표 *"유달이 때는 배경색 딥 네이비"* — 종전 브랜드 블루(`#1C69EF`)에서 바뀌었다.
    //   유달이가 든 이용권도 파랑이라 밝은 파랑 위에서는 피사체와 바탕이 경쟁했다.
    expect(SHARE_MASCOT_BG, '딥 네이비(대표 확정)').toBe('#0F1A33')
    expect(SHARE_MASCOT_BG, '브랜드 블루로 되돌아갔다').not.toBe('#1C69EF')
  })

  it('상대 경로 프로필은 절대 URL 로 — 스크래퍼는 상대 경로를 조용히 버린다', () => {
    const u = card(LIVE_PINS, { profileImage: '/u/3/avatar.jpg' }).imageUrl
    expect(u.endsWith(`${ORIGIN}/u/3/avatar.jpg`)).toBe(true)
  })

  /**
   * 🔬 `/api/media/<key>` 는 **워커를 거치지 말고** R2 공개 도메인으로 보낸다.
   *   2026-10-12 실측(같은 사진·같은 옵션·결과 둘 다 18,760B / 1200×630): 워커 경유 `n=1203ms` ↔
   *   R2 직접 `n=343ms`. 스크래퍼는 느리면 **기다려 주지 않고 포기**한다.
   *   라이브 프로필 8건 중 1건이 이 모양이다(옛 업로드 — 지금은 절대 URL 로 저장된다).
   */
  it('`/api/media/` 프로필은 R2 공개 도메인으로 — 워커를 다시 부르지 않는다', () => {
    const u = card(LIVE_PINS, { profileImage: '/api/media/uploads/user/24/x.png' }).imageUrl
    expect(u.endsWith('https://media.ur-team.com/uploads/user/24/x.png')).toBe(true)
    expect(u, '워커 경유면 리사이저 원본 fetch 가 3.5배 느려진다').not.toContain(`${ORIGIN}/api/media/`)
  })

  it('https 가 아닌 프로필은 **버린다**(유달이로) — 혼합 콘텐츠·내부 주소 차단', () => {
    for (const bad of ['http://evil/a.jpg', 'data:image/png;base64,AAA', 'blob:http://x/1', 'javascript:alert(1)']) {
      const u = card(LIVE_PINS, { profileImage: bad }).imageUrl
      expect(u, `${bad} 가 그림 주소에 박혔다`).toContain(SHARE_MASCOT_SRC)
      expect(u).not.toContain(bad)
    }
  })

  it('`%` 를 한 번 더 감싼다 — 2026-08-11 한글 파일명 404 클래스', () => {
    const u = card(LIVE_PINS, { profileImage: 'https://x/%B8%DE%B4%BA.jpg' }).imageUrl
    expect(u).toContain('%25B8%25DE%25B4%25BA.jpg')
  })

  it('시드에서 프로필 **하나만** 읽는다 — 파싱 실패·프로필 없음은 유달이', () => {
    const withProf = ushopOgImage(JSON.stringify({ curator: { profile_image: PROF } }), ORIGIN, 'h')
    expect(withProf).toContain(PROF)
    for (const seed of ['{bad json', '{}', JSON.stringify({ curator: {} }), JSON.stringify({ pins: LIVE_PINS })]) {
      expect(ushopOgImage(seed, ORIGIN, 'h'), `시드=${seed} 에서 유달이로 안 떨어졌다`).toContain(SHARE_MASCOT_SRC)
    }
    // 🔬 CURATOR 시드는 `{ success, curator, pins }` 다 — `data` 중첩이 아니다(라이브 실측).
    expect(ushopOgImage(JSON.stringify({ data: { curator: { profile_image: PROF } } }), ORIGIN, 'h'))
      .toContain(SHARE_MASCOT_SRC)
  })
})

describe('④ 합성 카드 라우트는 살아 있다 — 얼굴 우선순위(프로필 → 유달이 → 이니셜)', () => {
  const cardSrc = stripComments(readCode('src/worker/utils/og-curator-card.ts'))
  const routeSrc = stripComments(readCode('src/worker/routes/og-image.routes.ts'))

  it('라우트가 마운트돼 있다 — 이전에 스크랩된 카드가 그 주소를 물고 있다', () => {
    expect(stripComments(readCode('src/worker/index.ts'))).toContain('/api/og')
  })

  it('프로필이 없으면 유달이를 쓴다 (종전은 파란 원 + 이름 첫 글자였다)', () => {
    expect(cardSrc, '유달이 자리가 없다').toContain('udalUri')
    expect(cardSrc).toMatch(/const face = profileUri \|\| udalUri/)
    expect(routeSrc, '라우트가 유달이를 안 받아 오면 카드가 못 그린다').toContain('OG_UDAL_SRC')
  })

  it('🔴 합성 카드 안의 유달이는 `contain` + 원 색 배경 — 여기선 원 안에 들어가야 한다', () => {
    // ⚠️ 공유 그림(③)의 `pad` 와 **다르다**: 저쪽은 1200×630 을 채우는 일이고 이쪽은 232px 원
    //   안에 담는 일이다. 같은 값으로 통일하지 말 것.
    expect(routeSrc).toMatch(/fit: 'contain'/)
    expect(routeSrc).toContain('OG_AVATAR_TINT')
    const tint = readCode('src/worker/utils/og-curator-card.ts').match(/OG_AVATAR_TINT = '(#[0-9A-Fa-f]{6})'/)
    expect(tint, '원 색 상수가 없다').toBeTruthy()
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

describe('⑤ 유달이 그림이 `public/` 에 실재한다', () => {
  it('해시 없는 안정 경로이고 파일이 있다 — 워커는 번들 해시를 모른다', () => {
    expect(SHARE_MASCOT_SRC, '번들 자산(src/assets)은 파일명에 해시가 붙어 워커가 주소를 모른다')
      .not.toContain('/src/')
    expect(fs.existsSync(`public${SHARE_MASCOT_SRC}`),
      `public${SHARE_MASCOT_SRC} 가 없다 — 404 면 카드 자리가 통째로 빈다`).toBe(true)
  })

  it('합성 카드의 유달이도 실재한다(같은 자산을 쓰고 있다)', () => {
    const m = readCode('src/worker/utils/og-curator-card.ts').match(/OG_UDAL_SRC = '([^']+)'/)
    expect(m, 'OG_UDAL_SRC 가 없다').toBeTruthy()
    expect(fs.existsSync(`public${m![1]}`), `public${m![1]} 가 없다`).toBe(true)
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

  /**
   * 🖼️ 화면의 `<SEO image>`(react-helmet)와 워커가 주입하는 og:image 는 **다른 층**이다 —
   *   JS 를 돌리는 크롤러는 앞을 보고 안 돌리는 크롤러는 뒤를 본다. 한쪽만 고치면 같은 링크가
   *   받는 쪽에 따라 다른 그림을 낸다(에러는 0이다). 그래서 **같은 함수**를 쓰게 고정한다.
   */
  it('화면 `<SEO image>` 도 같은 함수를 쓴다 — 합성 카드 주소를 직접 적지 않는다', () => {
    expect(page).toMatch(/image=\{ushopShareImage\(/)
    expect(page, '손으로 적은 합성 카드 주소가 남아 있으면 크롤러별로 그림이 갈린다')
      .not.toContain('/api/og/curator/')
  })

  it('유어샵 공유가 프로필 사진을 넘긴다 — 안 넘기면 모두가 유달이를 받는다', () => {
    expect(page).toMatch(/profileImage:\s*data\?\.curator\?\.profile_image/)
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

/**
 * 🛍️ 유어샵 공유 카드 — **무엇을 보낼지** 정하는 단일 소스 (2026-10-12)
 *
 * ## 왜 생겼나 (대표 *"유어샵 링크 공유했는데 이렇게 보이면 너무 투박하잖아"* → *"가장 이상적으로"*)
 * 유어샵 공유가 `navigator.share({ url })` 로 **주소만** 넘기고 있었다. 그러면 카드를 만드는 주체가
 * **카톡 스크래퍼**가 되어 셋이 동시에 나빠진다:
 *   ① 우리가 그린 SVG(`/api/og/curator/:handle`) 안의 글자 + 카톡이 또 쓰는 제목·설명 → **중복**
 *   ② **버튼이 없다** — 스크래퍼 경로엔 버튼 개념이 아예 없다
 *   ③ 그림이 합성 카드라 **먹음직스럽지 않다**
 * 같은 레포의 선물 카드(`my-vouchers/GiftVoucherSheet`)는 멀쩡했는데, 그건 카카오 SDK 로
 * **우리가 카드를 지정**하고 `imageUrl` 에 **실제 상품 사진**을 넣기 때문이다.
 * ⇒ 고칠 것은 카드 그림이 아니라 **공유하는 길**이었다. 이 파일은 그 길에 실을 내용을 정한다.
 *
 * ## 🔄 2026-10-12 대표 재지시로 **얼굴이 바뀌었다**
 * 처음 판은 *"쓸 수 있는 첫 핀의 사진"* 을 카드 얼굴로 썼다. 그걸 본 대표:
 * *"차라리 유어샵 프로필 유저 프로필 사진이 뜨면 좋을 것 같은데? 없으면 유달이 사진이 뜨고?"*
 *
 * **그게 맞다. 그리고 제가 애써 막던 결함 셋을 아예 없앤다**:
 *   ① 핀 10개 중 **4개가 `is_active=0`** 이라 "쓸 수 있는 첫 핀" 규칙이 필요했다
 *      (안 그러면 대표 계정 얼굴이 "프리미엄 백팩" — 지금 안 파는 쇼핑 데모가 된다)
 *   ② `deal_only=1` 을 커머스 카드에 올리면 `600딜` 이 **"600원"** 으로 뜬다(거짓 가격)
 *   ③ 라이브에 `discount_rate=90` 인데 실제 11% 인 핀이 있어 **선언값을 못 믿는다**
 * 셋 다 *"가게 카드에 남의 물건을 간판으로 세운 탓"* 이었다. 그리고 더 근본적으로 —
 * **핀 순서가 바뀌면 간판도 바뀌었다**(`curatorHomePins` 는 딜 보유 여부로 정렬한다).
 * 유어샵은 *정지원의 가게*이고, 그 얼굴은 **정지원**이어야 안 흔들린다.
 *
 * ## 규칙
 *   1. **얼굴 = 프로필 사진 → 유달이**. 라이브 실측 `프로필 있음 8 / 없음 9`(17곳)이라
 *      절반에 유달이가 뜬다 — 종전은 그 절반이 **파란 원 + 이름 첫 글자**였다(브랜드 0).
 *   2. 🖼️ **그 그림은 프로필 *파일* 이 아니라 합성 카드(`/api/og/curator/:handle`)다.**
 *      프로필은 정사각에 가까워 1200×630 으로 자르면 **얼굴이 잘린다**. 합성 카드는 이미
 *      1200×630 조판에 프로필을 **원형**으로 담고 이름·소개·핀 타일까지 보여준다.
 *      (#1725 가 그 카드 **안** 사진이 실제로 박히게 고쳐 둔 것이 여기서 값을 한다.)
 *   3. **스크래퍼 경로와 SDK 경로가 같은 그림을 쓴다** — 보는 사람이 어디서 받든 같은 카드다.
 *      SDK 경로에만 **버튼**이 붙는다(스크래퍼는 버튼을 못 만든다).
 *   4. 🔴 **커머스 카드(물건 + 가격)는 유어샵 공유의 일이 아니다.** 유어샵 링크는 *가게*를
 *      공유하는 것이고 특정 물건이 아니다. 물건을 공유하는 길은 **상품 페이지의
 *      `KakaoShareButton`** 이고 그쪽은 종전대로 커머스 카드를 쓴다(`lib/kakao-share.ts` 의
 *      `commercePayload` 는 그 호출부가 계속 쓰므로 죽은 코드가 아니다).
 *
 * ## 이 파일이 못 하는 것
 * 카드를 **그리는** 것은 카카오다 — 우리는 무엇을 넘길지만 정한다. 그래서 "예쁜가" 는
 * 유닛테스트로 판정할 수 없고 실제 카톡방에서 봐야 한다(E4).
 *
 * ⚠️ **워커가 import 한다**(`worker/index.ts` 의 og:image 한 줄) — React·lucide·i18n 을 끌어오지 말 것.
 *    `cf-image`·`curator-pin-order` 는 이미 워커가 쓰는 순수 모듈이라 안전하다.
 */

/** 공유 카드가 보는 핀 필드만. `CuratorPin` 의 부분집합이라 그대로 넘겨도 된다. */
export interface UShopSharePin {
  product_id: number
  product_name?: string | null
  image_url?: string | null
  thumbnail?: string | null
  price?: number | null
  original_price?: number | null
  discount_rate?: number | null
  restaurant_name?: string | null
  category?: string | null
  deal_only?: number | null
  deal_pct?: number | null
  is_active?: number | null
}

/** 핀의 사진 한 장(둘 중 있는 것). 없으면 `''`. */
export function pinPhoto(p: UShopSharePin | null | undefined): string {
  const s = String(p?.image_url || p?.thumbnail || '').trim()
  return /^https?:\/\//.test(s) || s.startsWith('/') ? s : ''
}

/**
 * **그림**으로 쓸 수 있는 핀인가 — 활성 + 사진.
 * 교환권(`deal_only=1`)도 통과한다: 그림엔 가격이 안 붙으므로 '원' 표기 함정이 없다.
 */
export function isShareImagePin(p: UShopSharePin): boolean {
  return Number(p?.is_active) === 1 && !!pinPhoto(p)
}

/** 카카오 공유 카드 그림 크기 — 소셜 카드 비율(1.91:1). */
export const SHARE_CARD_W = 1200
export const SHARE_CARD_H = 630

/**
 * 🖼️ 공유 카드 그림 — **스크래퍼 경로와 SDK 경로가 같은 것을 쓴다.**
 *
 * 합성 카드가 얼굴(프로필 → 유달이)·이름·소개·핀 타일을 1200×630 으로 조판한다. 여기서
 * 핀 사진을 직접 고르지 않는 이유는 위 머리말 ①~④ 에 있다(핀을 간판으로 세우면 비활성·
 * 거짓가격·순서변동이 따라온다).
 *
 * `?v` = 카카오 스크랩 캐시 무효화(`og-curator-card.ts` 머리말). **카드 그림을 바꿀 때마다 올린다.**
 * 🔢 **v5 (2026-10-12)**: 얼굴이 프로필 → 유달이로 바뀌었다(v4 는 핀 사진을 og:image 로 내보냈다).
 */
export const USHOP_OG_CARD_V = 5
export function ushopOgCardUrl(handle: string, origin: string): string {
  return `${origin}/api/og/curator/${encodeURIComponent(handle || '')}?v=${USHOP_OG_CARD_V}`
}

/**
 * 스크래퍼 경로의 `og:image`. 시드를 안 보고 합성 카드로 고정한다 — 그 카드가 얼굴을 정한다.
 *
 * ⚠️ 인자(`ssrPayload`)는 **의도적으로 안 쓴다**. 워커 호출부를 그대로 두기 위한 것이고,
 *    여기서 시드를 다시 들여다보면 "얼굴을 두 곳에서 정하는" 상태로 되돌아간다.
 */
export function ushopOgImage(_ssrPayload: string, origin: string, handle: string): string {
  return ushopOgCardUrl(handle, origin)
}

/**
 * 🛍️ 유어샵 카드 — **한 가지 모양**이다(가게 카드).
 *
 * 처음 판엔 `kind: 'commerce' | 'feed'` 두 가지가 있었다. 대표 재지시로 커머스가 빠졌고
 * (머리말 규칙 4 — 물건+가격은 **상품 페이지**의 일이다) 그래서 판정할 것이 없어졌다.
 * ⚠️ `kind` 를 되살리지 말 것: 유어샵 링크는 *가게*를 가리키는데 카드가 특정 물건을 말하면
 *    착지가 어긋나고, 그 물건을 고르는 순간 비활성·거짓가격·순서변동이 전부 따라온다.
 */
export interface UShopShareCard {
  title: string
  description: string
  imageUrl: string
  link: string
  buttons: Array<{ title: string; link: string }>
}

export interface UShopShareInput {
  handle: string
  name?: string | null
  bio?: string | null
  pins?: readonly UShopSharePin[] | null
  origin: string
  /** 합성 카드를 못 만들 때의 최후 그림(`lib/kakao-share.ts` 의 공용 값). */
  fallbackImage: string
}

export function buildUShopShareCard(input: UShopShareInput): UShopShareCard {
  const { handle, pins, origin, fallbackImage } = input
  const h = String(handle || '').trim()
  const shopLink = `${origin}/u/${encodeURIComponent(h)}`
  const name = String(input.name || '').trim() || `@${h}`
  const bio = String(input.bio || '').trim()
  // 핀 수는 **설명 한 줄**에만 쓴다 — 어느 핀인지는 고르지 않는다(그게 이 수정의 요지다).
  const count = Array.isArray(pins) ? pins.filter(isShareImagePin).length : 0
  return {
    title: `${name}의 유어샵`,
    description: bio || (count > 0 ? `이용권 ${count}개를 모아 뒀어요` : '유어딜에서 모은 이용권'),
    // 얼굴(프로필 → 유달이)은 합성 카드가 정한다. 핸들이 없으면 그 주소를 만들 수 없다.
    imageUrl: h ? ushopOgCardUrl(h, origin) : fallbackImage,
    link: shopLink,
    buttons: [{ title: '유어샵 열기', link: shopLink }],
  }
}

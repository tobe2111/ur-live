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
 * ## 규칙 (라이브 실측이 정한 것 — 2026-10-12 `product_pins` 전수)
 * ```
 * 핸들 17곳 · 핀 있는 곳 4곳 (1개 2곳 · 2개 1곳 · 6개 1곳)
 * 핀 10개 중 is_active=0 이 4개 ← 1번 핀을 그냥 쓰면 대표 계정 카드 얼굴이
 *                                "프리미엄 백팩"(판매 안 하는 쇼핑 데모)이 된다
 * deal_only=1 핀 0건          ← 오늘은 없지만 담을 수 있다(아래 🔴)
 * ```
 *   1. **얼굴은 "1번 핀" 이 아니라 "쓸 수 있는 첫 핀"** — `is_active=1` · 사진 있음.
 *      순서는 `curatorHomePins`(진열 순서 SSOT)를 그대로 쓴다. 그 순서가 이미
 *      *딜 있는 핀 → 교환권/이용권 → 그 외* 라서, 얼굴이 자연히 이용권 쪽으로 간다.
 *      ⚠️ 카드엔 **순번을 쓰지 않는다** — 2번을 보여줘도 SNS 의 *"N번 이용권"* 주소 규약과 안 부딪친다.
 *   2. 🔴 **딜 결제(`deal_only=1`)는 커머스 카드에 절대 올리지 않는다** — 카카오 커머스는 **'원' 표기
 *      전용**이라 `600딜` 이 카드에 **"600원"** 으로 뜬다(거짓 가격). 그림으로는 써도 된다(가격이 안 뜬다).
 *   3. **착지가 카드와 맞아야 한다** — 닭도리탕을 보여주고 버튼이 가게 목록으로 가면 미끼다.
 *      커머스 카드는 버튼 2개를 지원하므로 `[이용권 보기]`(→ `/u/:handle/p/:id` **귀속 경로** —
 *      그 경로가 클릭을 기록하고 소개비를 붙인다) + `[유어샵 전체]`.
 *   4. **쓸 핀이 없으면(오늘 14곳) 가게 카드로 떨어진다** — 커머스와 가게 카드는 양자택일이 아니라
 *      **폴백 관계**다. 폴백에서도 SDK 경로라 중복 텍스트가 없고 버튼이 있다.
 *
 * ## 이 파일이 못 하는 것
 * 카드를 **그리는** 것은 카카오다 — 우리는 무엇을 넘길지만 정한다. 그래서 "예쁜가" 는
 * 유닛테스트로 판정할 수 없고 실제 카톡방에서 봐야 한다(E4).
 *
 * ⚠️ **워커가 import 한다**(`worker/index.ts` 의 og:image 한 줄) — React·lucide·i18n 을 끌어오지 말 것.
 *    `cf-image`·`curator-pin-order` 는 이미 워커가 쓰는 순수 모듈이라 안전하다.
 */
import { curatorHomePins, isVoucherPin } from './curator-pin-order'

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

/**
 * **커머스 카드의 얼굴**로 쓸 수 있는 핀인가 — 그림 조건 + 원화 결제 + 가격이 있다.
 * 🔴 `deal_only === 1` 은 여기서 막는다(위 규칙 2).
 */
export function isShareFacePin(p: UShopSharePin): boolean {
  return isShareImagePin(p) && Number(p?.deal_only) !== 1 && Number(p?.price) > 0
}

/** 진열 순서(`curatorHomePins`)에서 조건을 만족하는 첫 핀. 없으면 null. */
function pickBy(pins: readonly UShopSharePin[] | null | undefined, ok: (p: UShopSharePin) => boolean): UShopSharePin | null {
  if (!Array.isArray(pins) || pins.length === 0) return null
  return curatorHomePins(pins).find(ok) || null
}

/** 커머스 카드의 얼굴(없으면 null). */
export function pickShareFacePin(pins: readonly UShopSharePin[] | null | undefined): UShopSharePin | null {
  return pickBy(pins, isShareFacePin)
}

/** 카드 그림으로 쓸 핀(없으면 null) — 얼굴이 없을 때도 사진은 쓸 수 있다. */
export function pickShareImagePin(pins: readonly UShopSharePin[] | null | undefined): UShopSharePin | null {
  return pickBy(pins, isShareImagePin)
}

/** 카카오 공유 카드 그림 크기 — 소셜 카드 비율(1.91:1). */
export const SHARE_CARD_W = 1200
export const SHARE_CARD_H = 630

/**
 * 사진 한 장을 공유 카드 비율로 자른 **절대** URL. 피사체는 `gravity=auto` 가 찾는다.
 *
 * ## 🔴 왜 `cfImage()` 를 쓰지 않는가 (2026-10-12 실측 — 처음엔 썼고, 재 보니 틀렸다)
 * `cfImage` 는 **화면용**이라 일부러 보수적이다: 검증 안 된 호스트는 워커 프록시
 * (`/api/image/resize`)나 원본으로 보낸다. 그 파일 주석이 이유를 적어 뒤 — 화면에서 리사이즈가
 * 실패하면 감시 `<img>` 가 그 사진을 **죽은 것으로 보고 목록에서 빼** 사용자에겐 사진이 사라진다.
 *
 * 그런데 **공유 카드에선 그 보수성이 더 나쁘다.** 라이브 핀 사진 호스트를 세 보니
 * `images.unsplash.com` 5 · 상대경로 3 · `media.ur-team.com` 1 · `i.ibb.co` 1 — 즉 **절반**이
 * 프록시로 가는 호스트다. 그 경로를 실제로 두드려 봤다:
 *
 *     cdn-cgi 직접   200 · `cf-resized: internal=ok` · **196,260B**
 *     워커 프록시     200 · **3,152,465B** ← 리사이즈 **0** (2026-06-11 실측 그대로)
 *
 * 3MB 는 스크래퍼가 **포기하는** 크기다 — 그러면 카드에 사진이 아예 안 뜬다. 반대로 cdn-cgi 가
 * 못 가져오면 `onerror=redirect` 가 원본으로 302 하고, 그조차 실패해도 결과는 "사진 없는 카드"
 * = 오늘의 최악과 같다. ⇒ **여기선 손해가 한쪽으로만 크다.** 화면의 규율은 화면에 그대로 둔다.
 *
 * `format=jpeg` 고정: `format=auto` 는 Accept 를 보고 AVIF/WebP 를 주는데, 이 그림을 굽는 것은
 * 우리 화면이 아니라 **남의 렌더러**다(`og-inline-image.ts` 가 같은 이유로 jpeg 를 쓴다).
 */
export function shareCardPhoto(photo: string, origin: string): string {
  const src = String(photo || '').trim()
  // 인라인 데이터는 공유할 주소가 없다.
  if (!src || src.startsWith('data:') || src.startsWith('blob:')) return ''
  const abs = src.startsWith('/') ? `${origin}${src}` : src
  if (!/^https:\/\//i.test(abs)) return ''
  // `%` 는 한 번 더 감싼다 — 경로에 박히는 원본 URL 이 이미 퍼센트 인코딩이면 리사이저가 풀어
  // 다른 주소를 가져간다(2026-08-11 에 한글 파일명 네이버 사진 134개가 그래서 404 였다).
  const inner = abs.replace(/%/g, '%25')
  const opts = `width=${SHARE_CARD_W},height=${SHARE_CARD_H},fit=cover,gravity=auto,quality=85,format=jpeg,onerror=redirect`
  return `${origin}/cdn-cgi/image/${opts}/${inner}`
}

/**
 * 합성 SVG 카드 주소 — **쓸 사진이 한 장도 없을 때만** 쓴다(이름·아바타가 들어가므로
 * 브랜드 기본 그림보다는 낫다). `?v` = 카카오 스크랩 캐시 무효화(`og-curator-card.ts` 머리말).
 *
 * 🔢 **v4 (2026-10-12)**: 직전 배포(#1725)가 카드 안 사진을 실제로 박히게 고쳤는데(`cf.image`)
 *    주소가 그대로여서 카카오가 **옛 까만 카드**를 계속 내보내고 있었다. 번호를 올려야 전달된다.
 */
export const USHOP_OG_CARD_V = 4
export function ushopOgCardUrl(handle: string, origin: string): string {
  return `${origin}/api/og/curator/${encodeURIComponent(handle || '')}?v=${USHOP_OG_CARD_V}`
}

/**
 * 🖼️ 스크래퍼 경로(주소 복사·문자·슬랙·DM)의 `og:image`.
 * 사진이 있으면 **글자 없는 실사진**을 준다 — 글자는 카톡·슬랙이 제목·설명으로 쓰므로
 * 그림에 또 넣으면 그게 대표가 신고한 **중복**이다. 사진이 없으면 합성 카드로 떨어진다.
 *
 * `ssrPayload` 는 CURATOR SSR 시드(JSON 문자열). 파싱 실패·핀 없음은 조용히 합성 카드.
 */
export function ushopOgImage(ssrPayload: string, origin: string, handle: string): string {
  try {
    const pins = (JSON.parse(ssrPayload) as { pins?: UShopSharePin[] })?.pins
    const photo = pinPhoto(pickShareImagePin(pins))
    if (photo) return shareCardPhoto(photo, origin) || ushopOgCardUrl(handle, origin)
  } catch { /* 시드 파싱 실패 — 합성 카드 */ }
  return ushopOgCardUrl(handle, origin)
}

/** 카카오 공유에 넘길 카드. `kind` 가 템플릿을 고른다. */
export type UShopShareCard =
  | {
      kind: 'commerce'
      /** 커머스 카드는 제목 자리에 **상품 이름**이 온다(가게 이름은 설명이 아니라 버튼·착지가 말한다). */
      title: string
      imageUrl: string
      link: string
      commerce: { regularPrice: number; discountPrice?: number; discountRate?: number }
      buttons: Array<{ title: string; link: string }>
    }
  | {
      kind: 'feed'
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
  profileImage?: string | null
  pins?: readonly UShopSharePin[] | null
  /** `https://urdeal.kr` 같은 오리진(끝에 `/` 없이). */
  origin: string
  /** 사진이 하나도 없을 때 쓰는 기본 그림(절대 URL). */
  fallbackImage: string
}

/**
 * 유어샵 공유 카드 하나를 만든다 — **커머스(얼굴 있음) 또는 가게 카드(폴백)**.
 * 순수 함수다: 네트워크·DOM·전역을 보지 않으므로 시험이 값으로 판정한다.
 */
export function buildUShopShareCard(input: UShopShareInput): UShopShareCard {
  const { handle, pins, origin, fallbackImage } = input
  const shopLink = `${origin}/u/${encodeURIComponent(handle || '')}`
  const name = String(input.name || '').trim() || `@${handle}`
  const face = pickShareFacePin(pins)

  if (face) {
    const price = Math.round(Number(face.price) || 0)
    const orig = Math.round(Number(face.original_price) || 0)
    const commerce: { regularPrice: number; discountPrice?: number; discountRate?: number } = {
      regularPrice: orig > price ? orig : price,
    }
    if (orig > price) {
      commerce.discountPrice = price
      // 할인율은 선언값을 믿지 않고 **정가·판매가로 계산**한다 — 둘이 어긋나면 카드가 거짓을 말한다.
      const rate = Math.round((1 - price / orig) * 100)
      if (rate > 0) commerce.discountRate = rate
    }
    return {
      kind: 'commerce',
      title: String(face.product_name || name).slice(0, 100),
      imageUrl: shareCardPhoto(pinPhoto(face), origin) || fallbackImage,
      link: shopLink,
      commerce,
      // 🔗 규칙 3 — 첫 버튼은 **카드가 보여준 그 상품**으로(귀속 경로), 둘째가 가게 전체.
      buttons: [
        { title: isVoucherPin(face) ? '이용권 보기' : '상품 보기', link: `${shopLink}/p/${face.product_id}` },
        { title: '유어샵 전체', link: shopLink },
      ],
    }
  }

  // 🏪 폴백 — 얼굴이 없다(활성 핀 0 또는 가격 없음). 가게 카드로 보낸다.
  const imgPin = pickShareImagePin(pins)
  const profile = String(input.profileImage || '').trim()
  const imageUrl =
    shareCardPhoto(pinPhoto(imgPin), origin) ||
    (profile ? shareCardPhoto(profile, origin) : '') ||
    fallbackImage
  const bio = String(input.bio || '').trim()
  const count = Array.isArray(pins) ? pins.filter(isShareImagePin).length : 0
  return {
    kind: 'feed',
    title: `${name}의 유어샵`,
    // 설명은 소개글이 있으면 그걸, 없으면 **센 것만** 말한다(없는 것을 지어내지 않는다).
    description: bio || (count > 0 ? `이용권 ${count}개를 모아 뒀어요` : '유어딜에서 모은 이용권'),
    imageUrl,
    link: shopLink,
    buttons: [{ title: '유어샵 열기', link: shopLink }],
  }
}

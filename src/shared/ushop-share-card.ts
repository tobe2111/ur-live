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
 * ## 🔄 그리고 대표가 한 번 더 바로잡았다 — *"그냥 사각형 전체를 사진 및 이미지로 가득채워줘"*
 * 두 번째 판은 **합성 카드**(흰 판에 프로필 원 + 이름 + 소개 + 핀 타일)를 그림으로 썼다.
 * 그건 "프로필이 보인다" 는 요구는 채웠지만 **카드 안에 또 카드**였다 — 카톡이 제목·설명을 자기
 * 영역에 붙이는데 우리 그림에도 같은 글자가 들어가 있었다(대표가 처음 신고한 **중복** 그대로).
 *
 * ## 규칙
 *   1. **그림 = 1200×630 을 가득 채운 사진 한 장.** 흰 판·글자·타일 없음. 글자는 **카톡이** 제목·
 *      설명으로 붙인다(그래서 중복이 안 생긴다 — 그게 이 세 번째 판의 요지다).
 *   2. **프로필 사진 → 없으면 유달이.** 프로필은 `fit=cover,gravity=auto` 로 꽉 채우고(피사체를
 *      리사이저가 찾는다), 유달이는 `fit=pad` + **딥 네이비** 배경으로 정확히 1200×630 을 만든다.
 *      🔴 유달이에 `cover` 를 쓰지 말 것 — 전신 포즈라 **머리가 잘린다**(실측으로 확인했다).
 *      🔴 `contain` 은 **패딩을 안 한다** — 1200×630 을 달라고 해도 584×630 이 온다(실측).
 *   3. **합성 카드(`/api/og/curator/:handle`)는 더 이상 공유 그림이 아니다.** 라우트는 살려 둔다 —
 *      이전에 스크랩된 카드가 그 주소를 물고 있고, 그 카드 자체도 유달이로 개선해 뒀다.
 *   4. **글자를 그림에 넣지 않는다.** 넣는 순간 1번의 이유가 무너진다.
 *
 * ## 이 파일이 못 하는 것
 * 카드를 **그리는** 것은 카카오다 — 우리는 무엇을 넘길지만 정한다. 그래서 "예쁜가" 는
 * 유닛테스트로 판정할 수 없고 실제 카톡방에서 봐야 한다(E4).
 *
 * ⚠️ **워커가 import 한다**(`worker/index.ts` 의 og:image 한 줄) — React·lucide·i18n 을 끌어오지 말 것.
 *    `cf-image`·`curator-pin-order` 는 이미 워커가 쓰는 순수 모듈이라 안전하다.
 */

import { OG_CARD_W, OG_CARD_H } from './og-share-image'

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
 * 카카오 공유 카드 그림 크기 — 소셜 카드 비율(1.91:1).
 * 🔗 2026-10-12: 값을 `og-share-image.ts`(상품 카드 SSOT)에서 받는다 — **봇 셸이 선언하는
 *    `og:image:width/height` 가 그 상수를 읽으므로**, 여기만 바꾸면 선언이 거짓이 된다.
 */
export const SHARE_CARD_W = OG_CARD_W
export const SHARE_CARD_H = OG_CARD_H

/**
 * 유달이 폴백의 바탕 — **딥 네이비**(2026-10-12 대표 *"유달이 때는 배경색 딥 네이비"*).
 * 종전 브랜드 블루(`#1C69EF`)에서 바뀌었다 — 유달이가 들고 있는 이용권도 파랑 계열이라
 * 같은 밝은 파랑 위에 얹으면 피사체와 바탕이 서로 경쟁했다.
 * 🎫 디자인 시스템의 다크 바탕(`#11141C` — 남색 기운 **근검정**)보다 파랑을 살린 값이고,
 * 그 가족 안에 있다(명도는 다크 카드 `#1D1F29` 와 비슷하고 색조만 네이비).
 * ⚠️ 투명 PNG 를 jpeg 로 굽기 때문에 배경이 **필수**다(없으면 유달이 뒤가 검정이 된다).
 */
export const SHARE_MASCOT_BG = '#0F1A33'
/** 해시 없는 **안정 경로**. 번들 마스코트(`src/assets`)는 파일명에 해시가 붙어 워커가 주소를 모른다. */
export const SHARE_MASCOT_SRC = '/assets/mascot/udal-loader-v2.webp'

/**
 * R2 공개 도메인 — `/api/media/<key>` 는 **워커를 거치지 말고** 여기로 바로 간다.
 * `og-inline-image.ts` 가 같은 상수를 같은 이유로 갖고 있다(그쪽은 워커 안에서 자기 자신을
 * 다시 부르는 것을 피하려고). 여기서는 리사이저가 원본을 **더 빨리** 가져오게 하는 일이다 —
 * 2026-10-12 실측(같은 사진·같은 옵션·같은 결과 18,760B): 워커 경유 **n=1203ms** ↔ R2 직접 **n=343ms**.
 * 스크래퍼는 느리면 **기다려 주지 않고 포기**하므로 3.5배는 그림이 뜨고 안 뜨는 차이가 된다.
 */
const R2_PUBLIC_HOST = 'https://media.ur-team.com'

/** 절대 https URL 로 — 스크래퍼는 상대 경로를 조용히 버린다. 아니면 빈 문자열. */
function absHttps(src: string, origin: string): string {
  const t = String(src || '').trim()
  if (!t || t.startsWith('data:') || t.startsWith('blob:')) return ''
  // 라이브 실측(2026-10-12): 프로필 8건 중 1건이 이 모양이다(옛 업로드 — 지금은 절대 URL 로 저장된다).
  const m = /^\/api\/media\/(.+)$/.exec(t)
  const abs = m ? `${R2_PUBLIC_HOST}/${m[1]}` : t.startsWith('/') ? `${origin}${t}` : t
  return /^https:\/\//i.test(abs) ? abs : ''
}

/**
 * 🖼️ 공유 그림 — **1200×630 을 가득 채운 사진 한 장**(머리말 규칙 1~2).
 *
 * `format=jpeg` 고정: 이 그림을 굽는 것은 우리 화면이 아니라 **남의 렌더러**다
 * (`og-inline-image.ts` 가 같은 이유로 jpeg 를 쓴다 — AVIF/WebP 를 못 읽을 수 있다).
 * `%` 한 번 더 감싸기: 경로에 박히는 원본이 이미 퍼센트 인코딩이면 리사이저가 풀어 다른 주소를
 * 가져간다(2026-08-11 에 한글 파일명 네이버 사진 134개가 그래서 404 였다).
 */
export function ushopShareImage(profileImage: string | null | undefined, origin: string): string {
  const prof = absHttps(String(profileImage || ''), origin)
  const base = `${origin}/cdn-cgi/image`
  const common = `width=${SHARE_CARD_W},height=${SHARE_CARD_H},quality=85,format=jpeg,onerror=redirect`
  if (prof) return `${base}/${common},fit=cover,gravity=auto/${prof.replace(/%/g, '%25')}`
  // 🦦 유달이는 `pad` 다 — `cover` 면 머리가 잘리고 `contain` 은 1200×630 을 안 만든다(둘 다 실측).
  const mascot = `${origin}${SHARE_MASCOT_SRC}`
  return `${base}/${common},fit=pad,background=${encodeURIComponent(SHARE_MASCOT_BG)}/${mascot}`
}

/**
 * 스크래퍼 경로(주소 복사·문자·슬랙·DM)의 `og:image`. SDK 카드와 **같은 함수**를 쓴다 —
 * 받는 사람이 어디서 받든 같은 그림이다.
 *
 * `ssrPayload` 는 CURATOR SSR 시드(JSON). 모양은 `{ success, curator: {...}, pins: [...] }` 이고
 * 여기서 쓰는 것은 `curator.profile_image` **하나**다. 파싱 실패·프로필 없음은 유달이로 떨어진다.
 */
export function ushopOgImage(ssrPayload: string, origin: string, _handle: string): string {
  let profile = ''
  try {
    profile = String((JSON.parse(ssrPayload) as { curator?: { profile_image?: string } })?.curator?.profile_image || '')
  } catch { /* 시드 파싱 실패 — 유달이 */ }
  return ushopShareImage(profile, origin)
}

/**
 * 🛍️ 유어샵 카드 — **한 가지 모양**이다(가게 카드).
 *
 * 처음 판엔 `kind: 'commerce' | 'feed'` 두 가지가 있었다. 대표 재지시로 커머스가 빠졌고
 * (머리말 규칙 4 — 물건+가격은 **상품 페이지**의 일이다) 그래서 판정할 것이 없어졌다.
 * ⚠️ `kind` 를 되살리지 말 것: 유어샵 링크는 *가게*를 가리키는데 카드가 특정 물건을 말하면
 *    착지가 어긋나고, 그 물건을 고르는 순간 비활성·거짓가격·순서변동이 전부 따라온다.
 */
/**
 * 소개글이 없는 유어샵의 검색·공유 설명 — **한 벌**(2026-10-18 대표 결재 `2026-10-14-locked-emdash` 안 1).
 * 종전엔 워커 두 자리가 따로 적어 문구가 갈려 있었다(`…교환권·이용권 모음` ↔ 죽은 봇 블록의 `…교환권·공구 모음`)
 * 그리고 둘 다 줄표를 썼다. 서빙 메타(`applySurfaceMeta`)와 봇 셸이 이 함수 하나를 부른다.
 */
export function ushopDescFallback(name: string): string {
  return `${name}님이 고른 교환권·이용권 모음`
}

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
  /** 가게 얼굴. 없으면 유달이로 떨어진다(머리말 규칙 2). */
  profileImage?: string | null
  pins?: readonly UShopSharePin[] | null
  origin: string
  /** 그림 주소를 아예 못 만들 때의 최후 값(`lib/kakao-share.ts` 의 공용 값). */
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
    // 얼굴 = 1200×630 을 가득 채운 사진(프로필 → 유달이). 카드 틀도 글자도 없다.
    imageUrl: ushopShareImage(input.profileImage, origin) || fallbackImage,
    link: shopLink,
    buttons: [{ title: '유어샵 열기', link: shopLink }],
  }
}

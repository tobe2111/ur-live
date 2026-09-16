/**
 * 🖼️ 이용권·숙소 상세 **히어로 사진 URL 의 SSOT** (2026-09-02 대표 "사진 불러오는 속도가 느리다 · 클릭하면 반응이 늦다").
 *
 * ## 왜 이 파일이 생겼나 — 같은 사진을 세 벌 받고 있었다 (라이브 워터폴 실측, iPhone 에뮬)
 *
 *     496ms  link  width=900                      111KB   ← 워커 preload (2026-07-02 형태)
 *     842ms  img   width=1200                     179KB   ← 갤러리의 감시용 1px <img> (PC 대형 폭)
 *     857ms  css   width=900,height=600,…gravity  131KB   ← 실제로 화면에 그려지는 모바일 슬라이드
 *
 * 세 요청이 **같은 원본**이다. 2026-08-31 에 모바일 히어로를 3:2 스마트 크롭으로 바꿨는데, preload 와
 * 감시 <img> 는 옛 폭 그대로라 셋이 전부 갈렸다 — preload 는 버려지고(브라우저는 URL 이 한 글자만
 * 달라도 안 쓴다), 감시 <img> 는 PC 폭(1200)을 폰에서도 받았다. 에러가 없어 아무도 몰랐다.
 * 그 위에 갤러리 5장이 **한꺼번에** 내려와(각 136~220KB, 콜드 2.3~4.4s) 첫 사진과 대역폭을 나눴다.
 *
 * ⇒ 폭·비율·크롭을 **한 곳**에서 정하고, 워커 preload · 감시 <img> · 슬라이드 셋이 **같은 함수**로
 *   URL 을 만든다. 함수가 하나면 갈릴 수가 없다.
 *
 * ⚠️ 워커도 이 파일을 import 한다 — `@/` 별칭이 아니라 상대경로만 쓴다.
 */
import { cfImage } from '../utils/cf-image'

/** 모바일 히어로 프레임 3:2 (2026-08-31 대표 승인 — 네이버 사진 70장 실측 근거). */
export const DETAIL_HERO_RATIO = 3 / 2
/** 모바일 히어로 요청 폭. 430px 프레임 ×2 배율 ≈ 860 → 900. */
export const DETAIL_HERO_MOBILE_WIDTH = 900
/** PC 대형 사진 요청 폭(그루폰식 좌 대형). */
export const DETAIL_HERO_DESKTOP_WIDTH = 1200
/** PC 우측 썸네일 폭. */
export const DETAIL_THUMB_WIDTH = 600
/** 갤러리 PC 분기와 같은 중단점(`lg:`). 갤러리의 `lg:hidden`/`lg:block` 과 짝이다. */
export const DETAIL_DESKTOP_QUERY = '(min-width: 1024px)'

/**
 * PC 대형 프레임 — 사진이 여러 장이면 4:3, 한 장이면 16:9.
 * ⚠️ `DetailGallery` 의 `style={{ aspectRatio: multi ? '4 / 3' : '16 / 9' }}` 와 **같은 값**이어야 한다.
 *   갈리면 서버가 자른 비율과 화면 칸이 어긋나 브라우저가 한 번 더 자른다(= 피사체가 다시 밀려난다).
 *   `detail-hero-crop.test.ts` 가 두 값을 대조한다.
 */
export const DETAIL_PC_HERO_RATIO_MULTI = 4 / 3
export const DETAIL_PC_HERO_RATIO_SINGLE = 16 / 9
/**
 * PC 우측 썸네일 프레임 ≈ 5:4. 레이아웃에서 유도한 값이다 —
 * 대형이 `2.1fr` 폭에 4:3 이므로 높이 = 1.575u, 오른쪽 칸은 `1fr` 폭에 그 높이를 둘로 나눠 ≈ 0.79u
 * ⇒ 1 : 0.79 ≈ 1.27. 5:4(1.25)로 자르면 남는 오차는 cover 가 흡수할 만큼 작다.
 */
export const DETAIL_PC_THUMB_RATIO = 5 / 4

/**
 * 🎯 **프레임에 채우고(cover) 피사체를 찾아 자른다**(`gravity=auto`) — 모바일·PC 공용.
 *
 * 2026-08-31 에 모바일만 이렇게 바꾸고 PC 는 폭만 줄여 보냈다(브라우저가 가운데를 잘랐다).
 * 그때 미룬 이유는 *"PC 는 감시 `<img>` 와 URL 을 공유해 트래픽 0 을 유지하는 구조라, 한쪽만
 * 바꾸면 요청이 두 배가 된다"* 였는데 — 그건 **한쪽만** 바꿀 때의 이야기다. 배경·감시 둘 다
 * 이 함수를 부르면 URL 이 같아 요청은 그대로 하나다(2026-09-06).
 *
 * 부수 효과로 **바이트가 준다**(라이브 실측 8장 합계 1,568KB → 1,155KB, **−26%**): 평면 리사이즈는
 * 어차피 잘려 나갈 부분까지 보내고 브라우저가 버린다. 서버가 미리 자르면 그만큼 안 받는다.
 *
 * ⚠️ **재려면 그 상품의 진짜 비율로 재라.** 2026-09-06 에 사진 1장짜리(=16:9 프레임) 상품들에
 *   4:3 을 재고 "바이트가 두 배로 는다"는 반대 결론을 낼 뻔했다. 장수에 따라 프레임이 갈리므로
 *   비교 대상을 틀리면 부호까지 뒤집힌다.
 */
export function detailCropUrl(src: string, w: number, ratio: number): string {
  return cfImage(src, { width: w, height: Math.round(w / ratio), fit: 'cover', gravity: 'auto', format: 'auto' }) || src
}

/** 모바일 슬라이드 = 3:2 프레임에 채우고(cover) 피사체를 찾아 자른다(gravity=auto). */
export function detailHeroMobileUrl(src: string, w: number = DETAIL_HERO_MOBILE_WIDTH): string {
  return detailCropUrl(src, w, DETAIL_HERO_RATIO)
}

/** 크롭 없는 폭 리사이즈(비율을 유지해야 하는 자리 — 예: 전체보기 모달). */
export function detailPlainUrl(src: string, w: number): string {
  return cfImage(src, { width: w, format: 'auto' }) || src
}

/**
 * 🖼️ **상세 갤러리 목록의 SSOT** — `image_url` + `images`/`image_urls`/`detail_images`(JSON) 병합·중복제거.
 *
 * ⚠️ 워커도 이걸 쓴다. PC 대형 프레임이 **사진 장수에 따라 4:3 / 16:9 로 갈리기** 때문에,
 *   워커가 preload 할 URL 을 고르려면 장수를 화면과 **똑같이** 세야 한다. 세는 방법이 두 벌이면
 *   경계(정확히 2장인데 한쪽만 중복을 제거하는 경우 등)에서 갈리고, 그러면 preload 가 버려진다 —
 *   2026-09-02 에 실제로 났던 사고와 같은 클래스라 아예 함수를 하나로 둔다.
 */
export function detailGalleryImages(src: {
  image_url?: string | null
  images?: string | null
  image_urls?: string | null
  detail_images?: string | null
} | null | undefined): string[] {
  if (!src) return []
  const out: string[] = []
  if (src.image_url) out.push(src.image_url)
  for (const raw of [src.images, src.image_urls, src.detail_images]) {
    if (!raw) continue
    try {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) for (const u of arr) if (typeof u === 'string' && u) out.push(u)
    } catch { /* JSON 아님 — 건너뛴다 */ }
  }
  return Array.from(new Set(out)).slice(0, 8)
}

/** 워커 UA 판정 — 폰이면 모바일 히어로 URL 을, 아니면 PC 대형 URL 을 preload 한다. */
export function isMobileUserAgent(ua: string | null | undefined): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua || '')
}

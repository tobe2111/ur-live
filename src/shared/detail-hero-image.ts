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

/** 모바일 슬라이드 = 3:2 프레임에 채우고(cover) 피사체를 찾아 자른다(gravity=auto). */
export function detailHeroMobileUrl(src: string, w: number = DETAIL_HERO_MOBILE_WIDTH): string {
  return cfImage(src, { width: w, height: Math.round(w / DETAIL_HERO_RATIO), fit: 'cover', gravity: 'auto', format: 'auto' }) || src
}

/** PC 대형·썸네일 = 크롭 없는 폭 리사이즈(프레임은 CSS aspect-ratio 가 잡고 cover 로 채운다). */
export function detailPlainUrl(src: string, w: number): string {
  return cfImage(src, { width: w, format: 'auto' }) || src
}

/** 워커 UA 판정 — 폰이면 모바일 히어로 URL 을, 아니면 PC 대형 URL 을 preload 한다. */
export function isMobileUserAgent(ua: string | null | undefined): boolean {
  return /Mobi|Android|iPhone|iPad|iPod/i.test(ua || '')
}

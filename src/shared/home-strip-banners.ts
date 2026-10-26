/**
 * 🎫 홈 상단 배너(strip)의 SSR 시드 — `/api/sections` 응답의 `strip_banners` (2026-10-14).
 *
 * 왜 섹션 응답에 실리나: 서버가 그리는 홈 첫 화면(`worker/utils/home-first-screen.ts`)은 섹션 응답
 * 하나만 시드로 받는다. 배너가 따로 오면 마운트 뒤 첫 섹션 **위**에 끼어들어 카드를 197px 밀었다
 * (라이브 첫 방문 CLS 0.197). 서버 첫 화면·앱 첫 렌더·`/api/banners` 가 **같은 배너**를 봐야 안 튄다.
 */

import { cfImage } from '../utils/cf-image'
import { BANNER_SLOT_SPECS } from './constants/home-showcase'

/** 상단 배너 최대 장수 — `HomeBannerStrip` 의 `StripRail` 이 `slice(0, 5)` 로 자른다. 같은 값이어야 한다. */
export const STRIP_BANNER_MAX = 5

export interface SeededStripBanner {
  id: number
  title: string
  image_url: string
  link_url?: string | null
  description?: string | null
  banner_slot: 'strip'
  display_order: number
}

/** 섹션 응답(JSON 객체)에서 상단 배너를 꺼낸다. 모양이 이상한 행은 버린다(깨진 시드가 홈을 못 열게 하면 안 된다). */
export function stripBannersOf(raw: unknown): SeededStripBanner[] {
  const arr = (raw as { strip_banners?: unknown } | null | undefined)?.strip_banners
  if (!Array.isArray(arr)) return []
  return arr
    .filter((b): b is SeededStripBanner =>
      !!b && typeof (b as SeededStripBanner).id === 'number' && typeof (b as SeededStripBanner).title === 'string')
    .map(b => ({ ...b, banner_slot: 'strip' as const }))
    .slice(0, STRIP_BANNER_MAX)
}

/**
 * 🔒 상단 배너의 **치수를 정하는 클래스** — `HomeBannerStrip`(StripRail·StripCard)과 서버 첫 화면이 **같은 상수**를
 *   import 한다. 손으로 두 벌을 적으면 언젠가 갈리고, 갈린 만큼 마운트 때 첫 섹션이 튄다(`PASS_HEAD` 와 같은 처방).
 *   카드 높이는 내용이 아니라 **폭 × 2:1** 로만 정해진다(390px 폰: 362 × 181 + 아래 16 = 197px).
 */
export const STRIP_CLS = {
  root: 'pb-4',
  rail: 'flex gap-7 px-[14px]',
  railMany: 'overflow-x-auto snap-x snap-mandatory scroll-px-[14px] scroll-smooth overscroll-x-contain scrollbar-hide',
  /** shape-lock-ok — 14px 는 `.ur-home-panel`(모바일) 의 radius 와 **같은 값**이다. */
  card: 'overflow-hidden rounded-[14px] isolate aspect-[2/1] flex flex-col justify-end px-5 pt-4 pb-4 transition-transform active:scale-[.995]', // shape-lock-ok
  cardMany: 'snap-start shrink-0 w-full',
  cardOne: 'flex-1',
  /** PC(lg+) 한 줄 세 장 = (칸 − 간격 28 × 2) ÷ 3. */
  pcCardW: 'lg:w-[calc((100%-56px)/3)]',
  img: 'absolute inset-0 -z-10 w-full h-full object-cover',
  scrim: 'absolute inset-x-0 bottom-0 h-[70%] -z-10 bg-gradient-to-t from-black/70 via-black/30 to-transparent',
  /** 끊는 자리는 어드민 제목의 줄바꿈이 정한다(`whitespace-pre-line`) — 폭이 끊으면 '부산 / 합리적으로' 처럼 구 가운데서 잘린다(2026-10-15 실측). */
  title: 'block max-w-[64%] text-[17px] font-bold leading-[1.25] tracking-[-.02em] whitespace-pre-line [word-break:keep-all] line-clamp-2 text-white dark:text-white [text-shadow:0_1px_8px_rgba(0,0,0,.25)]',
  desc: 'block max-w-[64%] mt-1 text-[12px] line-clamp-1 text-white/90 dark:text-white/90',
} as const

/**
 * 🖼️ 배너 사진 주소 — 화면(`HomeBannerStrip`)·홈 서버 첫 화면·교환권 서버 첫 화면이 **같은 함수**를 쓴다.
 *   주소가 한 글자라도 다르면 브라우저가 서버가 받아 둔 사진을 못 쓰고 다시 받는다.
 */
export function stripBannerImageUrl(imageUrl: string | null | undefined, slot: 'strip' | 'vouchers'): string {
  return imageUrl ? cfImage(imageUrl, { width: BANNER_SLOT_SPECS[slot].requestWidth, quality: 76 }) : ''
}

/**
 * 🎟️ 교환권 **머리 배너**(모바일, 2026-10-14 안 C)의 치수 클래스 — `StripCard`/`StripRail` 의 `hero` 덮어쓰기와
 *   교환권 서버 첫 화면이 같은 상수를 쓴다. 196 은 `VOUCHERS_HERO_CLS.hero`(예약 판)와 같아야 한다(시험이 대조).
 */
export const HERO_CARD_CLS = '!aspect-auto !h-[196px] !rounded-none !justify-start !pt-[60px] [&>img]:!inset-auto [&>img]:!right-0 [&>img]:!bottom-7 [&>img]:!w-auto [&>img]:!max-w-none [&>img]:!h-[62%] [&>div]:!h-full [&>div]:!bg-gradient-to-r [&>strong]:!max-w-[46%] [&>strong]:!leading-[1.35] [&>strong]:!whitespace-pre-line [&>strong]:![word-break:keep-all] [&>span]:hidden'
/**
 * 🦦 2026-10-24 대표 신고 *"배너 속 글자랑 배너 유달이랑 위치도 겹치잖아"* — 교환권 배너는 4:1(PC) 그림이라
 *   폰 머리(2:1, 196px)에 꽉 채우면 오른쪽 절반만 남고, 그림의 주인공(유달이 · 상품, 오른쪽 45%)이
 *   **제목 아래로** 들어왔다. 그래서 머리에서는 사진을 꽉 채우지 않는다:
 *   - 사진은 높이 62% 로 줄여 **오른쪽 아래**에 붙인다(잔액 카드가 걸치는 28px 위 — `bottom-7`).
 *   - 남은 왼쪽은 **그 사진의 왼쪽 끝 색**으로 채운다 — 같은 사진을 배경으로 크게 늘려 왼쪽 가장자리만 보이게 한다
 *     (배너 바탕이 평평한 색이라는 규칙이 전제 — 어드민 안내문). 같은 주소라 다시 받지 않는다.
 *   - 제목 폭은 46% — 그림이 시작되는 자리(약 175px)에서 멈춘다.
 *   화면(`StripCard`)과 서버 첫 화면이 이 함수를 같이 쓴다(갈리면 마운트 때 바탕이 바뀐다).
 */
export function heroEdgeFillStyle(bg: string): Record<string, string> | undefined {
  if (!bg) return undefined
  return { backgroundImage: `url("${bg}")`, backgroundSize: '4000% 100%', backgroundPosition: 'left center', backgroundRepeat: 'no-repeat' }
}
/** 서버 첫 화면용 — 같은 값을 `style` 속성 문자열로. */
export function heroEdgeFillCss(bg: string): string {
  const st = heroEdgeFillStyle(bg)
  if (!st) return ''
  return `background-image:${st.backgroundImage};background-size:${st.backgroundSize};background-position:${st.backgroundPosition};background-repeat:${st.backgroundRepeat}`
}
export const HERO_RAIL_CLS = '!gap-0 !px-0 !scroll-px-0'

/** `/api/banners` 응답 — 교환권 페이지 SSR 보조 시드(`__SSR_INITIAL_BANNERS__`)와 같은 키다(cron 예열 키). */
export const BANNERS_SEED_PATH = '/api/banners'

export interface SeededBanner {
  id: number
  title: string
  image_url: string
  link_url?: string | null
  description?: string | null
  banner_slot: string | null
  display_order: number
}

/** `/api/banners` 응답(JSON 객체)에서 자리(`slot`)의 배너만. 모양이 이상한 행은 버린다. 화면과 같은 규칙: 자리를 안 고른 배너는 어디에도 안 뜬다. */
export function bannersOfSlot(raw: unknown, slot: string): SeededBanner[] {
  const r = raw as { success?: boolean; data?: unknown } | null | undefined
  if (!r?.success || !Array.isArray(r.data)) return []
  return (r.data as SeededBanner[])
    .filter(b => !!b && typeof b.id === 'number' && typeof b.title === 'string' && b.banner_slot === slot)
    .slice(0, STRIP_BANNER_MAX)
}

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
export const HERO_CARD_CLS = '!aspect-auto !h-[196px] !rounded-none !justify-start !pt-[60px] [&>img]:object-right [&>div]:!h-full [&>div]:!bg-gradient-to-r [&>strong]:!max-w-[60%] [&>strong]:!leading-[1.35] [&>strong]:!whitespace-pre-line [&>strong]:![word-break:keep-all] [&>span]:hidden'
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

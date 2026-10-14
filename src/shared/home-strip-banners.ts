/**
 * 🎫 홈 상단 배너(strip)의 SSR 시드 — `/api/sections` 응답의 `strip_banners` (2026-10-14).
 *
 * 왜 섹션 응답에 실리나: 서버가 그리는 홈 첫 화면(`worker/utils/home-first-screen.ts`)은 섹션 응답
 * 하나만 시드로 받는다. 배너가 따로 오면 마운트 뒤 첫 섹션 **위**에 끼어들어 카드를 197px 밀었다
 * (라이브 첫 방문 CLS 0.197). 서버 첫 화면·앱 첫 렌더·`/api/banners` 가 **같은 배너**를 봐야 안 튄다.
 */

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

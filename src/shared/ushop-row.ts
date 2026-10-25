/**
 * 🛍️ 2026-10-25 (대표 *"유어샵은 D 대로 해줘"*) — `plain`(유어샵 줄)의 D안 값.
 *   사진 88px · 줄 위아래 20px · 상품명 15px **중간 굵기**(한 덩어리에 굵은 제목은 하나 — 굵기 ⑨) ·
 *   가게 줄은 보통 굵기 회색. 워커 첫 화면(`curator-ssr-body.ts`)이 이 상수를 그대로 쓴다 — 따로 적으면 갈린다.
 *   ⚠️ 기본값(`card`)은 무접촉 — 다른 다섯 화면은 그대로다.
 */
export const PLAIN_CLS = {
  skin: 'px-0 py-5',
  eyebrow: 'text-[12px] leading-none mb-1 text-gray-500 dark:text-gray-400 truncate',
  title: 'text-[15px] leading-snug line-clamp-2 font-medium text-gray-900 dark:text-white',
  priceLine: 'flex items-baseline gap-1 mt-2',
} as const

/** 사진 칸 — 88px 정사각. */
export const PLAIN_THUMB_CLS = 'w-[88px] h-[88px]'

/** 분류 탭 — 교환권 밑줄 탭과 같은 문법(선택만 굵게·잉크 밑줄, 나머지 보통 굵기 회색). 간격은 탭 사이 20px. */
export const USHOP_TAB_CLS = 'shrink-0 inline-flex items-center gap-1 h-11 mr-5 last:mr-0 -mb-px border-b-2 text-[15px] whitespace-nowrap active:opacity-60 transition-colors'

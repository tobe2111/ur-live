/**
 * 🎟️ 이용권 상세(`/pass/:id`) **머리 카드** 클래스 SSOT (2026-10-11 대표 확정 "D안")
 *
 * 사진 위로 겹쳐 올라오는 흰 카드 — [가게 · 제목 · 가격]. 모바일 전용(`lg:hidden`).
 *
 * ## 왜 클래스를 여기 두나
 * 워커가 이 카드의 위쪽(가게 · 제목)을 **서버에서 먼저 그린다**(`worker/utils/detail-ssr-body.ts`).
 * React 가 마운트 때 `#root` 를 갈아엎으므로 둘이 한 글자라도 다르면 제목이 튄다. 종전엔 inline style 을
 * 두 벌 손으로 맞추고 시험이 대조했는데, 이제는 **같은 문자열을 import** 해서 갈릴 수가 없다.
 *
 * ⚠️ 이 파일은 워커 번들에도 들어간다 — React·아이콘을 import 하지 말 것(문자열만).
 */
export const PASS_PAGE_BG = 'bg-[var(--gbd-bg)] lg:bg-[var(--gbd-card)]'

export const PASS_HEAD = {
  /** 사진 아래 가장자리 28px 를 덮고 올라온다. 사진의 아래 스크림이 그 밑에 깔린다. */
  card: 'lg:hidden relative mx-3 -mt-7 mb-3 rounded-2xl bg-[var(--gbd-card)] shadow-lift px-5 pt-5 pb-5',
  merchant: 'text-[13px] font-semibold text-[var(--gbd-ink2)]',
  prelaunch: 'inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full bg-[var(--gbd-ink)] text-[var(--gbd-card)] text-[12px] font-bold',
  /** 온누리 뱃지 — 한 줄을 두 줄로 밀 수 있어 서버·클라가 모양까지 같아야 한다. */
  onnuri: 'ml-2 px-2 py-[1px] rounded bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[12px] font-bold align-middle',
  h1: 'm-0 mt-1 text-[24px] leading-[1.3] font-bold tracking-[-.02em] text-[var(--gbd-ink)]',
} as const

/** 섹션 카드 — 모바일은 회색 바탕 위 흰 판, PC 는 종전처럼 평면. */
export const PASS_CARD = 'mx-3 mb-3 rounded-2xl bg-[var(--gbd-card)] shadow-lift overflow-hidden lg:mx-0 lg:mb-0 lg:rounded-none lg:shadow-none lg:overflow-visible'

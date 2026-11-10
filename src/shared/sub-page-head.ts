/**
 * ← 소비자 하위 화면 머리줄(`components/ui/sub-page-header.tsx`)의 **클래스 SSOT** (2026-11-10).
 *
 * 서버 첫 화면(FAQ `worker/utils/faq-first-screen.ts` 부터)이 같은 머리줄을 그린다. 두 벌로 적으면 하나만 고치는 날
 * 서버 화면과 앱 화면이 갈려 마운트 때 머리줄이 튄다(에러 0) — 그래서 부품과 워커가 **이 파일 하나**를 읽는다.
 * 들어온 직후(스크롤 0)의 모양만 서버가 그린다: 머리줄 h1 은 숨김(`h1Hidden`), 큰 제목은 원래 크기(`subPageTitleTransform(0)`).
 */
export const SUB_PAGE_CLS = 'min-h-[100dvh] bg-warm'
export const SUB_PAGE_HEADER_CLS = 'sticky top-0 md:top-14 z-40 bg-warm'

export const SUB_PAGE_HEAD = {
  header: `${SUB_PAGE_HEADER_CLS} transition-shadow`,
  headerCollapsed: 'shadow-[0_1px_0_var(--rule)]',
  row: 'ur-content-narrow grid',
  rowCols: 'grid-cols-[44px_1fr_44px]',
  rowColsWide: 'grid-cols-[88px_1fr_88px]',
  rowTail: 'items-center h-[52px] px-1',
  back: 'w-11 h-11 flex items-center justify-center rounded-full active:bg-wash',
  backIcon: 'w-5 h-5 text-gray-900 dark:text-white',
  h1: 'text-center text-[16px] font-semibold text-gray-900 dark:text-white truncate transition-[opacity,transform] duration-200',
  h1Shown: 'opacity-100',
  h1Hidden: 'opacity-0 translate-y-2',
  right: 'h-11 flex items-center',
  rightNarrow: 'w-11 justify-center',
  rightWide: 'justify-end pr-3',
  titleWrap: 'ur-content-narrow px-4 pt-1 pb-3 overflow-hidden',
  title: 'origin-left text-[24px] font-bold tracking-[-0.02em] text-gray-900 dark:text-white truncate',
} as const

/** 큰 제목의 스크롤 변형 — `k`(0~1)로 작아지며 올라간다. 서버는 k=0 만 그린다. */
export function subPageTitleTransform(k: number): { transform: string; opacity: number } {
  return { transform: `scale(${1 - k * 0.35}) translateY(${-k * 10}px)`, opacity: 1 - k }
}

/**
 * 🧭 2026-11-18 시트 자리 상수 — `useSheetDrag.ts`(React 훅)에서 떼어 냈다.
 *   워커(`worker/utils/map-first-screen.ts`)가 서버 첫 화면을 같은 자리에 그리려고 이 값을 읽는데,
 *   훅 파일을 import 하면 DOM·React 타입까지 워커 타입검사에 딸려 들어왔다. 값은 그대로 — 훅이 다시 내보낸다.
 */
export type SheetSnap = 'peek' | 'mid' | 'full'

/** peek 시트가 화면 아래에서 덮는 높이(px). 아래 peek translate·useKakaoMap(가려진 타일 미루기)이 같은 값을 쓴다. */
export const SHEET_PEEK_VISIBLE_PX = 240
/** 시트 top 고정값 = full 위치. 이동은 전부 transform 으로(레이아웃 불변 → 컴포지터 애니메이션). */
export const SHEET_BASE_TOP = 'calc(env(safe-area-inset-top, 0px) + 104px)'
export const SHEET_SNAP_TRANSLATE: Record<SheetSnap, string> = {
  full: 'translateY(0px)',
  mid: 'translateY(calc(40dvh - env(safe-area-inset-top, 0px) - 104px))',
  peek: `translateY(calc(100dvh - ${SHEET_PEEK_VISIBLE_PX}px - env(safe-area-inset-top, 0px) - 104px))`,
}

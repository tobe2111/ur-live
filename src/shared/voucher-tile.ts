/**
 * 🎟️ 교환권 타일 클래스 SSOT — 2026-10-14 대표 확정 *"교환권은 b 시안으로"*.
 *
 * 모바일 `/vouchers` 목록이 한 줄 행(`VoucherRow`) → **3열 타일**이 됐다(카카오 선물하기 모양):
 *   [사진] · [브랜드 ›] · [이름 두 줄] · [할인율 가격] · [구매 N].
 *
 * 왜 따로 두나: 같은 타일을 **React(`VoucherTile`)와 워커 첫 화면(`vouchers-first-screen.ts`)이
 *   둘 다** 그린다. 클래스가 한 글자라도 갈리면 마운트 때 첫 화면이 밀린다 — 그래서 두 곳이 이 상수를
 *   import 하고, 시험이 진짜 컴포넌트를 렌더해 워커 HTML 과 모양을 대조한다.
 *   (React 를 import 하면 워커 번들에 섞이므로 이 파일은 순수 상수만 갖는다.)
 */
export const VOUCHER_TILE_CLASS = {
  /** 3열 격자 — 4px 격자(가로 8 · 세로 24). 태블릿 폭은 4열. */
  grid: 'grid grid-cols-3 sm:grid-cols-4 gap-x-2 gap-y-6',
  root: 'ur-cv-card min-w-0 flex flex-col text-left cursor-pointer active:opacity-70 transition-opacity',
  thumb: 'relative aspect-square w-full overflow-hidden rounded-xl bg-wash',
  img: 'w-full h-full object-cover',
  /** 브랜드 줄 — 누르면 그 브랜드로 거른다(카카오 선물하기의 `브랜드 ›`). */
  brand: 'mt-2 max-w-full inline-flex items-center gap-1 self-start text-[13px] font-medium text-gray-900 dark:text-white',
  brandName: 'truncate',
  chev: 'shrink-0 text-gray-400 dark:text-gray-500',
  /** 이름 두 줄 — 한 줄짜리 이름도 같은 높이를 차지해 아래 가격 줄이 열마다 맞는다. */
  title: 'mt-1 text-[13px] leading-snug line-clamp-2 min-h-[36px] text-gray-600 dark:text-gray-300',
  priceRow: 'mt-1 flex items-baseline gap-1 min-w-0',
  discount: 'text-[15px] font-bold text-sale tracking-tight',
  price: 'text-[15px] font-bold text-gray-900 dark:text-white tracking-tight',
  unit: 'text-[12px] font-medium text-gray-900 dark:text-white',
  meta: 'mt-1 text-[12px] text-gray-400 dark:text-gray-500',
} as const

/** 첫 화면에서 eager 로 받는 타일 수 — 폰 한 화면에 보이는 두 줄(3 × 2). */
export const VOUCHER_TILE_ABOVE_FOLD = 6
/** 사진 칸 폭(2x). 3열이면 폰에서 칸이 ~114px 이라 240 이면 충분하다. */
export const VOUCHER_TILE_IMG_W = 240
export const VOUCHER_TILE_SIZES = '(max-width: 640px) 33vw, 160px'

/** 구매수 표기 — `VoucherCard`·`VoucherRow` 와 같은 규칙. */
export function voucherSoldLabel(n: number): string {
  return n >= 10000 ? `${(n / 10000).toFixed(1).replace(/\.0$/, '')}만`
    : n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}천`
    : String(n)
}

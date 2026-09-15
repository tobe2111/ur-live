/**
 * 🏨 숙소 상세 하단 구매 바 (2026-09-14 대표 확정 "안 B")
 *
 * ## 왜 생겼나
 * 시안을 실제 화면으로 떠 보니 **숙소 상세에서 가격이 한 번도 안 보였다.** 공구 상세에는 하단 바가
 * 늘 있는데 숙소에는 없었고, 없는 게 아니라 **`cartItems.length > 0` 일 때만** 뜨는 바가 있었다 —
 * 즉 *담아야 가격이 보이는* 구조라 담기 전 방문자는 얼마인지 모른 채 객실 카드를 훑어야 했다.
 *
 * ⇒ 조건을 연다. 담기 전에는 **1박 최저가**를 말하고(객실마다 값이 다르므로 "부터"), 담으면 종전처럼
 * 담은 객실 수와 합계를 말한다. 두 상태가 같은 자리에서 이어진다.
 *
 * ## 규칙
 *   - 📱 모바일 전용(`lg:hidden`) — PC 는 우측 sticky 예약 패널이 담당한다. 두 곳에 두면 어느 쪽이
 *     진짜 합계인지 흐려진다.
 *   - ⚠️ `app-frame-bar` 미사용 — 이 페이지는 `pc-fullbleed` 등재라 그 클래스를 쓰면 PC 에서 숨는다.
 *   - 팔 수 있는 객실이 하나도 없으면 **바를 안 그린다**(만실 카드가 그 말을 대신한다).
 */
import { formatNumber } from '@/utils/format'

export default function StayStickyBar({
  minPrice, nightsLabel, cartCount, cartTotalQty, cartSubtotal, onClear, onBook, onPickRoom,
}: {
  /** 팔 수 있는 객실 중 최저 총액. 없으면 null → 바를 안 그린다. */
  minPrice: number | null
  /** "2박 총액" 처럼 무엇의 값인지 — 기간·이용권 모드에 따라 호출부가 정한다. */
  nightsLabel: string
  cartCount: number
  cartTotalQty: number
  cartSubtotal: number
  onClear: () => void
  onBook: () => void
  onPickRoom: () => void
}) {
  const hasCart = cartCount > 0
  if (!hasCart && minPrice == null) return null

  return (
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 dark:bg-[#1D1F29]/95 backdrop-blur border-t border-rule px-3 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 truncate">
            {hasCart ? `${cartCount}종 객실 / ${cartTotalQty}객실` : nightsLabel}
          </p>
          <p className="mt-0.5 text-[19px] font-extrabold tracking-[-0.02em] tabular-nums text-gray-900 dark:text-white leading-none">
            ₩{formatNumber(hasCart ? cartSubtotal : (minPrice ?? 0))}
            {!hasCart && <span className="ml-1 text-[13px] font-bold text-gray-500 dark:text-gray-400">부터</span>}
          </p>
        </div>
        {hasCart && (
          <button type="button" onClick={onClear} className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            비우기
          </button>
        )}
        <button
          type="button"
          onClick={hasCart ? onBook : onPickRoom}
          className="shrink-0 px-5 py-3 bg-brand text-white text-sm font-bold rounded-xl hover:bg-brand-dark"
        >
          {hasCart ? '묶음 예약 →' : '객실 고르기'}
        </button>
      </div>
    </div>
  )
}

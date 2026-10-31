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
import { BuyBarFrame, BuyBarPrice, BuyBarCta } from '@/components/deal/BuyBar'

export default function StayStickyBar({
  minPrice, nightsLabel, cartCount, cartTotalQty, cartSubtotal, onClear, onBook, onPickRoom, raffle,
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
  /** 🎯 2026-10-27: 추첨 상품(당첨 전)이면 예약 대신 응모 — 이용권 하단 바와 같은 `useFcfsDetail` 값. */
  raffle?: { label: string; disabled: boolean; onApply: () => void } | null
}) {
  const hasCart = cartCount > 0
  if (!hasCart && minPrice == null && !raffle) return null

  return (
    /* 🩸 2026-10-25: 종전 `z-50` 이라 하단 탭 뒤에 깔렸다 — 이제 틀(`BuyBarFrame`)이 이용권 바와 같은 층을 쓴다.
       🧾 2026-10-27: 틀·가격 칸·주 버튼을 이용권 바와 **같은 부품**으로(대표 "통일할 건 통일"). */
    <BuyBarFrame>
      <div className="flex items-center gap-3">
        <BuyBarPrice
          caption={hasCart ? `${cartCount}종 객실 / ${cartTotalQty}객실` : nightsLabel}
          amount={hasCart ? cartSubtotal : (minPrice ?? 0)}
          suffix={hasCart ? undefined : '부터'}
        />
        {hasCart && (
          <button type="button" onClick={onClear} className="shrink-0 px-2 py-2 text-[12px] text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
            비우기
          </button>
        )}
        {raffle ? (
          <BuyBarCta on={!raffle.disabled} onClick={raffle.onApply} disabled={raffle.disabled}>
            {raffle.label}
          </BuyBarCta>
        ) : (
          <BuyBarCta on onClick={hasCart ? onBook : onPickRoom}>
            {hasCart ? (cartTotalQty === 1 ? '예약하기' : '묶음 예약 →') : '객실 고르기'}
          </BuyBarCta>
        )}
      </div>
    </BuyBarFrame>
  )
}

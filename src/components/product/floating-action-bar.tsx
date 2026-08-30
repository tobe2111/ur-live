import { Heart } from 'lucide-react'

interface FloatingActionBarProps {
  onAddToCart: () => void;
  onBuyNow: () => void;
  disabled?: boolean;
  isWishlisted?: boolean;
  onToggleWishlist?: () => void;
  price?: number;
  originalPrice?: number;
  // 🛡️ 2026-05-19: 딜 교환 전용 — 장바구니 숨김 + 라벨 변경.
  dealOnly?: boolean;
  /**
   * 🏬 2026-08-02 시안 A-2 — **픽업 상품**용 두 줄 바(요약 줄 + 버튼 그리드).
   * `default` 는 이전과 **byte-동등**이다(본진 쇼핑 전체가 쓰는 바라 손대지 않는다).
   */
  variant?: 'default' | 'pickup';
  /** `pickup` 전용 요약 줄. 왼쪽엔 `1개 · 8월 10일 픽업`, 오른쪽엔 합계. */
  summaryLeft?: string;
  summaryTotal?: number;
}

export function FloatingActionBar({
  onAddToCart,
  onBuyNow,
  disabled = false,
  isWishlisted = false,
  onToggleWishlist,
  price,
  originalPrice,
  dealOnly = false,
  variant = 'default',
  summaryLeft,
  summaryTotal,
}: FloatingActionBarProps) {
  const discount = originalPrice && originalPrice > (price || 0)
    ? Math.round((1 - (price || 0) / originalPrice) * 100)
    : 0

  if (variant === 'pickup') {
    return (
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] lg:max-w-screen-md app-frame-bar bg-white dark:bg-[#0D0F12] border-t border-[#EAE5E7] dark:border-[#2C2F35]"
        style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 12, paddingBottom: 'max(28px, env(safe-area-inset-bottom))' }}
      >
        {/* 🔴 `수량 · 픽업일` 을 여기 한 번 더 적는 이유: 손님이 스크롤을 끝까지 내려온 뒤 결제한다.
            그 시점에 화면에서 사라져 있는 두 값이 **틀리면 그대로 노쇼가 된다**〔시안 3.6〕. */}
        {summaryLeft && (
          <div className="flex items-baseline justify-between mb-[11px]">
            <span className="text-[12.5px] font-bold tracking-[-0.025em] text-[#6B6469] dark:text-[#A29A9F] truncate">{summaryLeft}</span>
            <span className="shrink-0 ml-2 text-[19px] font-extrabold tracking-[-0.04em] text-[#1A1719] dark:text-[#F3EFF1]">
              {(summaryTotal ?? 0).toLocaleString('ko-KR')}원
            </span>
          </div>
        )}
        <div className="flex items-stretch gap-2">
          {/* ⚠️ 시안엔 찜 하트가 없다. 그래도 **지운다는 판단은 따로 내려야 하는 것**이라
              (기능 제거는 시안의 권한 밖이다) 자리만 좁혀 남겼다 — 호출부가 안 넘기면 안 뜬다. */}
          {onToggleWishlist && (
            <button onClick={onToggleWishlist} aria-label="찜"
              className="w-14 h-14 shrink-0 rounded-[14px] bg-[#F1EDEF] dark:bg-[#1A1C21] flex items-center justify-center active:scale-95 transition-transform">
              <Heart className={`h-[19px] w-[19px] ${isWishlisted ? 'text-red-500 fill-red-500' : 'text-[#8A8288]'}`} />
            </button>
          )}
          <button
            className="h-14 flex-[1] rounded-[14px] bg-[#F1EDEF] text-[#3F383C] dark:bg-[#1A1C21] dark:text-[#DAD4D7] text-[15.5px] font-bold tracking-[-0.03em] active:scale-[0.98] transition-transform disabled:opacity-40"
            onClick={onAddToCart} disabled={disabled}
          >
            {disabled ? '품절' : '장바구니'}
          </button>
          <button
            className="h-14 flex-[1.6] rounded-[14px] bg-[#1A1719] text-white dark:bg-[#F3EFF1] dark:text-[#1A1719] text-[16.5px] font-extrabold tracking-[-0.03em] active:scale-[0.98] transition-transform disabled:opacity-40"
            onClick={onBuyNow} disabled={disabled}
          >
            {disabled ? '품절' : '바로구매'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed bottom-0 left-1/2 -translate-x-1/2 z-50 w-full max-w-[430px] lg:max-w-screen-md app-frame-bar bg-white dark:bg-[#0D0F12] border-t border-gray-100 dark:border-[#2C2F35]"
      style={{
        paddingLeft: 14,
        paddingRight: 14,
        paddingTop: 10,
        // iOS safe-area: ensure content clears the home indicator
        paddingBottom: 'max(22px, env(safe-area-inset-bottom))',
      }}
    >
      <div className="flex items-center gap-2">
        {onToggleWishlist && (
          <button
            onClick={onToggleWishlist}
            className="flex flex-col items-center justify-center w-12 h-12 rounded-xl border border-gray-200 dark:border-[#2C2F35] transition-all active:scale-95"
          >
            <Heart
              className={`h-[18px] w-[18px] transition-colors ${
                isWishlisted ? 'text-red-500 fill-red-500' : 'text-gray-400 dark:text-gray-500'
              }`}
            />
          </button>
        )}

        {!dealOnly && (
          <button
            className="flex items-center justify-center gap-1 h-12 flex-1 rounded-xl bg-gray-100 dark:bg-[#1A1C21] transition-all active:scale-[0.98] disabled:opacity-40"
            onClick={onAddToCart}
            disabled={disabled}
          >
            <span className="text-[13px] font-bold text-gray-900 dark:text-white">{disabled ? '품절' : '장바구니'}</span>
          </button>
        )}

        <button
          /* 🧭 2026-06-22: 주요 CTA — 일반 상품은 잉크 그라데이션(B&W 컨슈머 톤, 본문 담기 CTA 와 동톤),
             딜은 앰버. 이전엔 같은 색 2번(#6b7280)이라 사실상 평평한 회색 → 위계 약함. */
          className="flex flex-col items-center justify-center h-12 flex-1 rounded-xl transition-all active:scale-[0.98] disabled:opacity-40"
          style={{ background: dealOnly ? 'linear-gradient(135deg, #fbbf24, #f59e0b)' : 'linear-gradient(135deg, #1f2937, #111827)' }}
          onClick={onBuyNow}
          disabled={disabled}
        >
          {dealOnly ? (
            <>
              <span className="text-[8px] font-bold text-white/80">딜 결제 전용 · 30일 유효</span>
              <span className="text-[13px] font-extrabold text-white">🎁 딜로 교환</span>
            </>
          ) : (
            <span className="text-[14px] font-extrabold text-white">{disabled ? '품절' : '바로 구매'}</span>
          )}
        </button>
      </div>
    </div>
  )
}

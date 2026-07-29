/**
 * 🖥️ 2026-07-20 (장바구니 PC 2단): 주문하기 CTA — 모바일 하단 고정바와 PC 우측 sticky 요약 카드가 공유.
 *   (파일크기 래칫 — CartPage 중복 버튼 추출.)
 */
export function CartCtaButton({ onClick, disabled, label, className = '' }: {
  onClick: () => void
  disabled: boolean
  label: string
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full py-3.5 bg-brand hover:bg-brand-dark text-white text-[15px] font-bold rounded-xl disabled:opacity-40 active:scale-[0.98] transition-all ${className}`}
    >
      {label}
    </button>
  )
}

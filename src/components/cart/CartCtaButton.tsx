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
      // 🔘 2026-08-30 버튼 체계 적용 (index.css `.ur-btn`).
      //   이전: py-3.5 text-[15px] font-bold rounded-xl — 이 버튼만의 값이었다.
      //   높이(48)·모서리(12)·굵기(semibold)·글자(15px)는 체계가 정하고 채움색만 여기서 준다.
      //   `active:scale`/`transition` 은 전역 button 규칙이 이미 준다(중복 제거).
      className={`ur-btn ur-btn-lg ur-btn-block bg-brand hover:bg-brand-dark text-white ${className}`}
    >
      {label}
    </button>
  )
}

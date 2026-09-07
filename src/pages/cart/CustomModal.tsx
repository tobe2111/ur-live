/**
 * 🛡️ 2026-05-02: TD-018 분할 — CartPage 의 alert/confirm/error/success 공용 모달.
 */
import { useEscapeKey } from '@/hooks/useEscapeKey'
import { Z } from '@/constants/z-index'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title?: string
  message: string
  type?: 'alert' | 'confirm' | 'error' | 'success'
}

export default function CustomModal({ isOpen, onClose, onConfirm, title, message, type = 'alert' }: ModalProps) {
  useEscapeKey(onClose)
  if (!isOpen) return null

  // 🎫 2026-09-02 (대표 "이 팝업들도 디자인 시스템에 맞게"): 큰 색깔 아이콘(초록 체크 원·파란 i) 제거 — 규칙 ⑥ "체크 원 0".
  //   말은 제목·본문이 하고, 오류만 제목을 빨강으로 구분한다. 카드는 surface + `shadow-lift`, 테두리 0, 모서리 16.
  //   z-index 는 표준 스케일(모달 백드롭 10500) — `z-50` 이면 하단 네비(9999) 뒤로 숨는다.
  const titleTone = type === 'error' ? 'text-red-500' : 'text-gray-900 dark:text-white'

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 p-4" style={{ zIndex: Z.MODAL_BACKDROP }} onClick={onClose} role="presentation">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#1D1F29] p-6 shadow-lift" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={title ? 'cart-modal-title' : undefined}>
        {title && <h2 id="cart-modal-title" className={`mb-2 text-center text-[17px] font-bold ${titleTone}`}>{title}</h2>}
        <p className="mb-6 text-center text-sm text-gray-600 dark:text-gray-300">{message}</p>
        <div className="flex gap-2">
          {type === 'confirm' && (
            <button
              onClick={onClose}
              className="flex-1 rounded-xl border border-rule-strong bg-transparent px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
            >
              취소
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm()
              onClose()
            }}
            className="flex-1 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-dark"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

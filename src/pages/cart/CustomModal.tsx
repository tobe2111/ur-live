/**
 * 🛡️ 2026-05-02: TD-018 분할 — CartPage 의 alert/confirm/error/success 공용 모달.
 */
import { AlertCircle, CheckCircle, Info } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

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

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-12 w-12 text-green-500" />
      case 'error':
        return <AlertCircle className="h-12 w-12 text-red-500" />
      case 'confirm':
        return <Info className="h-12 w-12 text-blue-500" />
      default:
        return <Info className="h-12 w-12 text-gray-400 dark:text-gray-500" />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose} role="presentation">
      <div className="w-full max-w-sm rounded-lg bg-white dark:bg-[#0A0A0A] p-6 shadow-xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={title ? 'cart-modal-title' : undefined}>
        <div className="mb-4 flex justify-center">{getIcon()}</div>
        {title && <h2 className="mb-2 text-center text-lg font-bold text-gray-900 dark:text-white">{title}</h2>}
        <p className="mb-6 text-center text-sm text-gray-400 dark:text-gray-500">{message}</p>
        <div className="flex gap-2">
          {type === 'confirm' && (
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 dark:border-[#3A3A3A] bg-white dark:bg-[#0A0A0A] px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 transition-colors hover:bg-gray-50 dark:hover:bg-[#121212]"
            >
              취소
            </button>
          )}
          <button
            onClick={() => {
              if (onConfirm) onConfirm()
              onClose()
            }}
            className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  )
}

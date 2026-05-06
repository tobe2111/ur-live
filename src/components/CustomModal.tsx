import { AlertCircle, CheckCircle, Info, AlertTriangle, X } from 'lucide-react'
import { ReactNode, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useBackButton } from '@/hooks/useBackButton'
import { useTranslation } from 'react-i18next'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title?: string
  message?: string
  children?: ReactNode
  type?: 'alert' | 'confirm' | 'error' | 'success' | 'info' | 'warning' | 'custom'
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl'
}

export function CustomModal({
  isOpen,
  onClose,
  onConfirm, 
  title, 
  message, 
  children,
  type = 'alert',
  maxWidth = 'sm'
}: ModalProps) {
  const { t } = useTranslation()
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  // Android/mobile 하드웨어 뒤로가기 버튼으로 모달 닫기
  useBackButton(isOpen, onClose)

  if (!isOpen) return null

  const isConfirm = type === 'confirm'
  const isCustom = type === 'custom'

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-12 h-12 text-green-500" strokeWidth={1.5} />
      case 'error':
        return <AlertCircle className="w-12 h-12 text-red-500" strokeWidth={1.5} />
      case 'warning':
        return <AlertTriangle className="w-12 h-12 text-yellow-500" strokeWidth={1.5} />
      case 'info':
        return <Info className="w-12 h-12 text-blue-500" strokeWidth={1.5} />
      default:
        return null
    }
  }

  const getMaxWidth = () => {
    switch (maxWidth) {
      case 'md': return 'max-w-md'
      case 'lg': return 'max-w-lg'
      case 'xl': return 'max-w-xl'
      default: return 'max-w-sm'
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={(e) => {
        // Only close modal if clicking the overlay (not the modal content)
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        className={`bg-white dark:bg-[#0A0A0A] rounded-3xl shadow-2xl ${getMaxWidth()} w-full ${isCustom ? 'p-0' : 'p-6'} animate-slideUp relative`}
        onClick={(e) => e.stopPropagation()}
      >
        {isCustom ? (
          <>
            {/* Custom Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-[#2A2A2A]">
              <h3 id="modal-title" className="text-[17px] font-bold text-gray-900 dark:text-white">
                {title}
              </h3>
              <button
                onClick={onClose}
                aria-label={t('common.close')}
                className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-[#2A2A2A] flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
              >
                <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            {/* Custom Modal Content */}
            <div className="px-5 py-4 max-h-[70dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              {children}
            </div>
          </>
        ) : (
          <>
            {/* Icon */}
            {getIcon() && (
              <div className="flex justify-center mb-4">
                {getIcon()}
              </div>
            )}

            {/* Title */}
            {title && (
              <h3 className="text-lg font-bold text-gray-900 dark:text-white text-center mb-2">
                {title}
              </h3>
            )}

            {/* Message or Children */}
            {children ? (
              <div className="mb-6">
                {children}
              </div>
            ) : message ? (
              <p className="text-sm text-gray-600 dark:text-gray-300 text-center mb-6 leading-relaxed whitespace-pre-line">
                {message}
              </p>
            ) : null}

            {/* Buttons */}
            <div className={`flex gap-3 ${isConfirm ? 'flex-row' : 'flex-col'}`}>
              {isConfirm ? (
                <>
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 px-4 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 font-medium rounded-full hover:bg-gray-200 transition-colors text-sm"
                  >
                    취소
                  </button>
                  <button
                    onClick={() => {
                      onConfirm?.()
                      onClose()
                    }}
                    className="flex-1 py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm"
                  >
                    확인
                  </button>
                </>
              ) : (
                <button
                  onClick={onClose}
                  className="w-full py-3 px-4 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-800 transition-colors text-sm"
                >
                  확인
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fadeIn {
          animation: fadeIn 0.2s ease-out;
        }
        .animate-slideUp {
          animation: slideUp 0.3s ease-out;
        }
      `}</style>
    </div>
  )

  // Use Portal to render modal at document.body level, escaping parent overflow constraints
  return createPortal(modalContent, document.body)
}

// Custom hook for modal management
export function useModal() {
  const [modal, setModal] = useState<{
    isOpen: boolean
    title?: string
    message: string
    type?: 'alert' | 'confirm' | 'error' | 'success' | 'info' | 'warning'
    onConfirm?: () => void
  }>({
    isOpen: false,
    message: '',
  })

  const showAlert = (
    message: string, 
    type: 'alert' | 'error' | 'success' | 'info' | 'warning' = 'alert', 
    title?: string
  ) => {
    setModal({
      isOpen: true,
      title,
      message,
      type,
    })
  }

  const showConfirm = (message: string, onConfirm: () => void, title?: string) => {
    setModal({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm,
    })
  }

  const closeModal = () => {
    setModal({
      isOpen: false,
      message: '',
    })
  }

  return {
    modal,
    showAlert,
    showConfirm,
    closeModal,
  }
}


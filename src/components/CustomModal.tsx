import { AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm?: () => void
  title?: string
  message: string
  type?: 'alert' | 'confirm' | 'error' | 'success' | 'info' | 'warning'
}

export function CustomModal({ isOpen, onClose, onConfirm, title, message, type = 'alert' }: ModalProps) {
  if (!isOpen) return null

  const isConfirm = type === 'confirm'

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
        return <AlertCircle className="w-12 h-12 text-gray-400" strokeWidth={1.5} />
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn">
      <div 
        className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-6 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {getIcon()}
        </div>

        {/* Title */}
        {title && (
          <h3 className="text-lg font-bold text-gray-900 text-center mb-2">
            {title}
          </h3>
        )}

        {/* Message */}
        <p className="text-sm text-gray-600 text-center mb-6 leading-relaxed whitespace-pre-line">
          {message}
        </p>

        {/* Buttons */}
        <div className={`flex gap-3 ${isConfirm ? 'flex-row' : 'flex-col'}`}>
          {isConfirm ? (
            <>
              <button
                onClick={onClose}
                className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-medium rounded-full hover:bg-gray-200 transition-colors text-sm"
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

// Add useState import
import { useState } from 'react'

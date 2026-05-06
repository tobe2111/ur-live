import { X, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { useTranslation } from 'react-i18next'

export default function ToastContainer() {
  const { toasts, remove } = useToast()
  const { t: tl } = useTranslation()

  if (toasts.length === 0) return null

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-500 shrink-0" />,
  }

  const colors = {
    success: 'bg-green-50 border-green-200',
    error: 'bg-red-50 border-red-200',
    info: 'bg-blue-50 border-blue-200',
  }

  return (
    <div
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role={t.type === 'error' ? 'alert' : 'status'}
          className={`flex items-center gap-3 px-4 py-3 rounded-lg border shadow-lg pointer-events-auto ${colors[t.type]} animate-slide-down`}
        >
          {icons[t.type]}
          <p className="flex-1 text-sm font-medium text-gray-900">{t.message}</p>
          <button
            onClick={() => remove(t.id)}
            aria-label={tl('common.close')}
            className="text-gray-400 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  )
}

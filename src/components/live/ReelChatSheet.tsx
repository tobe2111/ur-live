import { useTranslation } from 'react-i18next'
import { X, Send } from 'lucide-react'

interface ReelChatSheetProps {
  chatMessage: string
  sendingMessage: boolean
  isSeller: boolean
  onChatMessageChange: (value: string) => void
  onClose: () => void
  onSubmit: (e: React.FormEvent) => void
}

export default function ReelChatSheet({
  chatMessage,
  sendingMessage,
  isSeller,
  onChatMessageChange,
  onClose,
  onSubmit,
}: ReelChatSheetProps) {
  const { t } = useTranslation()
  return (
    <>
      <div
        className="absolute inset-0 z-[80] bg-black/60 backdrop-blur-sm animate-overlay-in"
        onClick={onClose}
      />
      <div className="absolute inset-x-0 bottom-0 z-[90] bg-white rounded-t-3xl animate-sheet-up">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-gray-900">{t('live.sendMessageTitle', { defaultValue: '메시지 보내기' })}</h3>
              {isSeller && (
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">🎙 {t('live.sellerBadge', { defaultValue: '셀러' })}</span>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200"
            >
              <X className="h-4 w-4 text-gray-800" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="flex gap-2">
            <input
              type="text"
              value={chatMessage}
              onChange={(e) => onChatMessageChange(e.target.value)}
              placeholder={isSeller ? t('live.chatPlaceholderSeller', { defaultValue: '셀러 메시지를 입력하세요...' }) : t('live.chatPlaceholderViewer', { defaultValue: '메시지를 입력하세요...' })}
              className={`flex-1 rounded-xl border px-4 py-3 text-sm text-gray-900 focus:outline-none ${
                isSeller
                  ? 'border-indigo-300 focus:border-indigo-500 bg-indigo-50/50'
                  : 'border-gray-300 focus:border-red-500 bg-white'
              }`}
              disabled={sendingMessage}
            />
            <button
              type="submit"
              disabled={!chatMessage.trim() || sendingMessage}
              className={`flex items-center justify-center rounded-xl px-6 py-3 text-gray-900 dark:text-white font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                isSeller ? 'bg-indigo-500' : 'bg-red-500'
              }`}
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </div>
    </>
  )
}

import { useRef, useEffect } from 'react'
import { X, Send } from 'lucide-react'
import { useEscapeKey } from '@/hooks/useEscapeKey'

interface ChatInputModalProps {
  isOpen: boolean
  onClose: () => void
  chatMessage: string
  onMessageChange: (msg: string) => void
  onSend: () => void
  isSending: boolean
  isSeller: boolean
}

export default function ChatInputModal({
  isOpen,
  onClose,
  chatMessage,
  onMessageChange,
  onSend,
  isSending,
  isSeller,
}: ChatInputModalProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useEscapeKey(() => { if (isOpen) onClose() })

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end" onClick={onClose} role="presentation">
      <div className="bg-black/40 absolute inset-0" aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="채팅 입력"
        className="relative bg-gray-100 dark:bg-[#1A1A1A] border-t border-gray-200 dark:border-[#2A2A2A] px-4 py-3 flex items-center gap-2 animate-slideUp"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={chatMessage}
          onChange={(e) => onMessageChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) onSend() }}
          placeholder={isSeller ? '셀러 메시지를 입력하세요...' : '메시지를 입력하세요...'}
          aria-label={isSeller ? '셀러 메시지' : '채팅 메시지'}
          maxLength={200}
          className="flex-1 px-4 py-2.5 bg-white dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] rounded-full text-sm text-gray-900 dark:text-white placeholder:text-gray-500 focus:outline-none focus:border-pink-500/50"
        />
        <button
          onClick={onSend}
          disabled={!chatMessage.trim() || isSending}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-500 disabled:opacity-40 transition-all active:scale-95"
        >
          <Send className="h-4 w-4 text-gray-900 dark:text-white" />
        </button>
        <button onClick={onClose} className="p-2">
          <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
        </button>
      </div>
    </div>
  )
}

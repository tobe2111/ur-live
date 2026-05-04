import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/types/live-stream'

/**
 * 🛡️ 2026-04-29: ReelCard 에서 추출한 LiveChat sub-component (TD-006).
 *
 * 라이브 영상 위 floating chat stream — 최근 6개 메시지 + 시스템 메시지 강조.
 * onChatClick 으로 채팅 input 모달 토글 (chatModalOpen).
 */

interface LiveChatStreamProps {
  messages: ChatMessage[]
  onChatClick: () => void
}

export default function LiveChatStream({ messages, onChatClick }: LiveChatStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const recentMessages = messages.slice(-6)

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-1 overflow-y-auto max-h-36 cursor-pointer no-scrollbar"
      onClick={onChatClick}
    >
      {recentMessages.map((msg) => {
        const isSystemMessage = msg.userName === 'System' || msg.role === 'system'
        const isYouTube = msg.source === 'youtube'

        return (
          <div key={msg.id} className="flex items-start gap-1 animate-fade-in">
            {isYouTube && (
              <svg viewBox="0 0 24 24" fill="#FF0000" className="w-3.5 h-3.5 shrink-0 mt-0.5">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
              </svg>
            )}
            {isSystemMessage ? (
              <p className="text-[11px] leading-[1.3] text-yellow-300 font-semibold" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8)' }}>
                {msg.message}
              </p>
            ) : (
              <p className="text-[11px] leading-[1.3]" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)' }}>
                <span className="font-bold text-gray-900 dark:text-white/90">{msg.userName}</span>
                <span className="text-gray-900 dark:text-white/70"> {msg.message}</span>
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}

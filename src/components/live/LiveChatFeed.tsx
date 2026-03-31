import React, { useRef, useEffect } from 'react'
import type { ChatMessage } from '@/hooks/useFirebaseChat'

export function LiveChat({ messages, onChatClick }: { messages: ChatMessage[]; onChatClick: () => void }) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const recentMessages = messages.slice(-5)

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-0.5 overflow-y-auto max-h-32 cursor-pointer no-scrollbar"
      onClick={onChatClick}
    >
      {recentMessages.map((msg) => {
        const isSystemMessage = msg.message.includes('장바구니') ||
                                 msg.message.includes('담았습니다') ||
                                 msg.message.includes('구매했습니다') ||
                                 msg.userName === 'System' ||
                                 msg.role === 'system'

        return (
          <p
            key={msg.id}
            className="text-[11px] leading-[1.3] animate-fade-in"
            style={{
              textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)',
            }}
          >
            <span className="font-bold text-white/90">{msg.userName}</span>
            <span className={`${isSystemMessage ? 'text-yellow-300 font-semibold' : 'text-white/70'}`}>
              {' '}{msg.message}
            </span>
          </p>
        )
      })}
    </div>
  )
}

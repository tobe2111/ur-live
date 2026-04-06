import React, { useRef, useEffect, useState } from 'react'
import type { ChatMessage } from '@/hooks/useFirebaseChat'

interface LiveChatProps {
  messages: ChatMessage[]
  onChatClick: () => void
  /** For timeline sync: current video time in seconds from stream start */
  currentVideoTime?: number
  /** Stream start timestamp (ms) for calculating message offsets */
  streamStartTime?: number
  /** Whether to enable timeline sync mode (for ended/replay streams) */
  timelineSync?: boolean
}

export function LiveChat({
  messages,
  onChatClick,
  currentVideoTime,
  streamStartTime,
  timelineSync = false,
}: LiveChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([])

  // Timeline sync: filter messages based on current video time
  useEffect(() => {
    if (timelineSync && streamStartTime && currentVideoTime !== undefined) {
      const currentAbsoluteTime = streamStartTime + currentVideoTime * 1000
      const filtered = messages.filter(msg => msg.timestamp <= currentAbsoluteTime)
      setVisibleMessages(filtered.slice(-8))
    } else {
      setVisibleMessages(messages.slice(-8))
    }
  }, [messages, currentVideoTime, streamStartTime, timelineSync])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [visibleMessages])

  return (
    <div
      ref={scrollRef}
      className="flex flex-col gap-1 overflow-y-auto max-h-40 cursor-pointer no-scrollbar"
      onClick={onChatClick}
    >
      {visibleMessages.map((msg) => {
        const isSystemMessage = msg.userName === 'System' ||
                                 msg.userName === '시스템' ||
                                 msg.role === 'system' ||
                                 msg.userType === 'system'

        const isSellerMessage = msg.isSeller || msg.userType === 'streamer'

        // Seller messages get a special highlighted style
        if (isSellerMessage) {
          return (
            <div
              key={msg.id}
              className="animate-fade-in rounded-lg px-2.5 py-1.5 mb-0.5"
              style={{
                background: 'linear-gradient(135deg, rgba(99,102,241,0.85) 0%, rgba(168,85,247,0.85) 100%)',
                backdropFilter: 'blur(8px)',
                boxShadow: '0 2px 12px rgba(99,102,241,0.4)',
              }}
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-white/90 bg-white/20 px-1.5 py-0.5 rounded-full">
                  🎙 셀러
                </span>
                <span className="text-[10px] font-bold text-white">{msg.userName}</span>
              </div>
              <p className="text-[12px] leading-[1.4] text-white font-medium">
                {msg.message}
              </p>
            </div>
          )
        }

        // System messages (donations, etc.)
        if (isSystemMessage) {
          return (
            <p
              key={msg.id}
              className="text-[11px] leading-[1.3] animate-fade-in px-1"
              style={{
                textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)',
              }}
            >
              <span className="text-yellow-300 font-semibold">{msg.message}</span>
            </p>
          )
        }

        // Normal viewer messages
        return (
          <p
            key={msg.id}
            className="text-[11px] leading-[1.3] animate-fade-in px-1"
            style={{
              textShadow: '0 1px 4px rgba(0,0,0,0.8), 0 0 12px rgba(0,0,0,0.5)',
            }}
          >
            <span className="font-bold text-white/90">{msg.userName}</span>
            <span className="text-white/70"> {msg.message}</span>
          </p>
        )
      })}
    </div>
  )
}

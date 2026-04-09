import { useState, useEffect, useRef } from 'react'
import { Send } from 'lucide-react'
import api from '@/lib/api'
import axios from 'axios'
import { toast } from '@/hooks/useToast'
import { getSellerToken } from '@/lib/seller-auth'

interface ChatMsg {
  id: string
  author: string
  message: string
  timestamp: number
  source: 'kakao' | 'youtube' | 'seller'
  avatarUrl?: string
}

export default function LiveChatPanel({ streamId }: { streamId: number }) {
  const [messages, setMessages] = useState<ChatMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seenIds = useRef<Set<string>>(new Set())

  // 채팅 폴링 (카카오 WebSocket + YouTube API)
  useEffect(() => {
    let active = true

    const poll = async () => {
      // YouTube 채팅
      try {
        const res = await axios.get(`/api/youtube/chat/chat/${streamId}`)
        if (res.data.success && res.data.data?.messages) {
          const ytMsgs: ChatMsg[] = res.data.data.messages.map((m: any) => ({
            id: `yt-${m.id}`,
            author: m.author,
            message: m.message,
            timestamp: m.timestamp,
            source: 'youtube' as const,
            avatarUrl: m.avatarUrl,
          }))
          if (active) {
            setMessages(prev => {
              const newMsgs = ytMsgs.filter(m => !seenIds.current.has(m.id))
              newMsgs.forEach(m => seenIds.current.add(m.id))
              return [...prev, ...newMsgs].sort((a, b) => a.timestamp - b.timestamp).slice(-50)
            })
          }
        }
      } catch { /* YouTube 채팅 비활성 */ }
    }

    poll()
    const interval = setInterval(poll, 5000)
    return () => { active = false; clearInterval(interval) }
  }, [streamId])

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // 셀러 메시지 전송
  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)
    try {
      // WebSocket DO에 메시지 전송
      const sellerName = localStorage.getItem('seller_name') || '셀러'
      const msg: ChatMsg = {
        id: `seller-${Date.now()}`,
        author: sellerName,
        message: input.trim(),
        timestamp: Date.now(),
        source: 'seller',
      }
      setMessages(prev => [...prev, msg])
      seenIds.current.add(msg.id)
      setInput('')

      // YouTube 채팅에도 전송
      try {
        await api.post(`/api/youtube/chat/chat/${streamId}`, {
          message: input.trim(),
        }, { headers: { Authorization: `Bearer ${getSellerToken()}` } })
      } catch { /* YouTube 전송 실패는 무시 */ }
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex flex-col h-[300px] lg:h-auto">
      {/* 채팅 헤더 */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <span className="text-xs font-bold text-gray-900">실시간 채팅</span>
        <span className="text-[10px] text-gray-500">{messages.length}개 메시지</span>
      </div>

      {/* 메시지 목록 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {messages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8">채팅이 시작되면 여기에 표시됩니다</p>
        ) : (
          messages.map(msg => (
            <div key={msg.id} className="flex items-start gap-1.5">
              {/* 소스 아이콘 */}
              {msg.source === 'youtube' ? (
                <svg viewBox="0 0 24 24" fill="#FF0000" className="w-3.5 h-3.5 shrink-0 mt-0.5">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              ) : msg.source === 'seller' ? (
                <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[7px] text-white font-bold">S</span>
                </span>
              ) : (
                <svg viewBox="0 0 24 24" fill="#FEE500" className="w-3.5 h-3.5 shrink-0 mt-0.5">
                  <path d="M12 3c-5.523 0-10 3.694-10 8.25 0 2.904 1.887 5.46 4.726 6.924-.157.564-.57 2.044-.652 2.362-.101.395.145.39.305.284.125-.083 1.994-1.355 2.808-1.907A11.59 11.59 0 0 0 12 19.5c5.523 0 10-3.694 10-8.25S17.523 3 12 3z" />
                </svg>
              )}
              <p className="text-[11px] leading-snug">
                <span className={`font-bold ${msg.source === 'seller' ? 'text-blue-600' : 'text-gray-900'}`}>{msg.author}</span>
                <span className="text-gray-600"> {msg.message}</span>
              </p>
            </div>
          ))
        )}
      </div>

      {/* 입력 */}
      <form onSubmit={e => { e.preventDefault(); sendMessage() }} className="px-3 py-2 border-t border-gray-100 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="메시지 입력..."
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-400"
          disabled={sending}
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="p-2 bg-blue-600 text-white rounded-lg disabled:opacity-40 active:scale-95"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  )
}

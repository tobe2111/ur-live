import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Send, Pin, Shield, Ban } from 'lucide-react'
import api from '@/lib/api'
import { getSellerToken } from '@/lib/seller-auth'
import ViewerLoyaltyBadge from './ViewerLoyaltyBadge'
import { useLiveStreamWebSocket } from '@/hooks/useLiveStreamWebSocket'

/**
 * 🛡️ 2026-04-23 배치 167: 셀러 LiveChatPanel 을 WebSocket DO 기반으로 통합.
 *   이전: YouTube polling 만 사용 (5초 간격). 시청자 채팅이 seller 에게 안 보임.
 *   개선: useLiveStreamWebSocket 훅으로 DO WebSocket 연결 → 시청자 메시지 실시간 수신.
 *         셀러 메시지는 REST /api/chat/:id/messages (isSeller=true) 로 전송 →
 *         D1 저장 + DO 가 모든 뷰어에게 broadcast. YouTube 도 best-effort 동시 전송.
 */

interface UnifiedMsg {
  id: string
  author: string
  message: string
  timestamp: number
  source: 'kakao' | 'youtube' | 'seller' | 'viewer' | 'system'
  avatarUrl?: string
  userId?: number  // 🛡️ 2026-04-27: 시청자 충성도 배지용 (viewer 만)
}

export default function LiveChatPanel({ streamId }: { streamId: number }) {
  const { t } = useTranslation()
  const [ytMessages, setYtMessages] = useState<UnifiedMsg[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [pinnedInput, setPinnedInput] = useState('')
  const [blockedInput, setBlockedInput] = useState('')
  const [showPinPanel, setShowPinPanel] = useState(false)
  const [showBlockPanel, setShowBlockPanel] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const seenYtIds = useRef<Set<string>>(new Set())

  // ── WebSocket (ur-live native) 채팅 수신 ─────────────────────────
  const {
    messages: wsMessages,
    isConnected,
    sendMessage: sendChatMessage,
  } = useLiveStreamWebSocket(streamId, true, false)

  // ── YouTube 채팅 polling (보조) ──────────────────────────────────
  useEffect(() => {
    let active = true
    const poll = async () => {
      try {
        const res = await api.get(`/api/youtube/chat/chat/${streamId}`)
        if (res.data.success && res.data.data?.messages && active) {
          const ytMsgs: UnifiedMsg[] = res.data.data.messages
            .filter((m: { id: string }) => !seenYtIds.current.has(`yt-${m.id}`))
            .map((m: { id: string; author: string; message: string; timestamp: number; avatarUrl?: string }) => ({
              id: `yt-${m.id}`,
              author: m.author,
              message: m.message,
              timestamp: m.timestamp,
              source: 'youtube' as const,
              avatarUrl: m.avatarUrl,
            }))
          ytMsgs.forEach((m) => seenYtIds.current.add(m.id))
          if (ytMsgs.length > 0) {
            setYtMessages((prev) => [...prev, ...ytMsgs].slice(-200))
          }
        }
      } catch { /* YouTube 채팅 비활성 */ }
    }
    poll()
    // WebSocket 이 실시간 처리하므로 YouTube polling 은 30s 로 낮춤 (quota 절약)
    const interval = setInterval(poll, 30000)
    return () => { active = false; clearInterval(interval) }
  }, [streamId])

  // ── 메시지 통합 (WebSocket + YouTube) ────────────────────────────
  const allMessages: UnifiedMsg[] = [
    ...wsMessages.map((m) => ({
      id: m.id,
      author: m.userName,
      message: m.message,
      timestamp: m.timestamp,
      source: (m.isSeller ? 'seller' : m.isAdmin ? 'system' : 'viewer') as UnifiedMsg['source'],
      userId: m.userId,
    })),
    ...ytMessages,
  ]
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-50)

  // 자동 스크롤
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [allMessages.length])

  // ── 셀러 메시지 전송 (ur-live native → DO broadcast + YouTube) ───
  async function sendMessage() {
    if (!input.trim() || sending) return
    setSending(true)
    const text = input.trim()
    const sellerName = localStorage.getItem('seller_name') || t('seller.liveChat.seller')
    const sellerId = parseInt(localStorage.getItem('seller_id') || '0', 10) || 0
    setInput('')

    try {
      // ur-live native — D1 저장 + DO broadcast
      await sendChatMessage(text, sellerId, sellerName, 'streamer')
    } catch (e) {
      if (import.meta.env.DEV) console.error('[LiveChatPanel] ur-live send failed:', e)
    }

    // YouTube 동시 전송 (best-effort)
    try {
      await api.post(
        `/api/youtube/chat/chat/${streamId}`,
        { message: text },
        { headers: { Authorization: `Bearer ${getSellerToken()}` } }
      )
    } catch { /* YouTube 전송 실패는 무시 */ }

    setSending(false)
  }

  async function banUser(userId: string) {
    if (!confirm(t('seller.liveChat.banConfirm', { defaultValue: '이 사용자를 차단하시겠습니까?' }))) return
    try {
      await api.post(`/api/live/${streamId}/broadcast`,
        { type: 'ban_user', data: { userId } },
        { headers: { Authorization: `Bearer ${getSellerToken()}` } }
      )
    } catch (e) {
      if (import.meta.env.DEV) console.error('[LiveChatPanel] ban_user failed:', e)
    }
  }

  async function setPinnedMessage() {
    try {
      await api.post(`/api/live/${streamId}/broadcast`,
        { type: 'set_pinned_message', data: { message: pinnedInput.trim() || null } },
        { headers: { Authorization: `Bearer ${getSellerToken()}` } }
      )
      setPinnedInput('')
      setShowPinPanel(false)
    } catch (e) {
      if (import.meta.env.DEV) console.error('[LiveChatPanel] set_pinned_message failed:', e)
    }
  }

  async function setBlockedKeywords() {
    const keywords = blockedInput.split(',').map(k => k.trim()).filter(Boolean)
    try {
      await api.post(`/api/live/${streamId}/broadcast`,
        { type: 'set_blocked_keywords', data: { keywords } },
        { headers: { Authorization: `Bearer ${getSellerToken()}` } }
      )
      setBlockedInput('')
      setShowBlockPanel(false)
    } catch (e) {
      if (import.meta.env.DEV) console.error('[LiveChatPanel] set_blocked_keywords failed:', e)
    }
  }

  return (
    <div className="flex flex-col h-[300px] lg:h-auto">
      {/* 채팅 헤더 */}
      <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-bold text-gray-900">{t('seller.liveChat.title')}</span>
          <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-300'}`} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setShowPinPanel(p => !p); setShowBlockPanel(false) }}
            title={t('seller.liveChat.setPinnedMessage', { defaultValue: '고정 공지 설정' })}
            className={`p-1 rounded ${showPinPanel ? 'bg-yellow-100 text-yellow-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setShowBlockPanel(p => !p); setShowPinPanel(false) }}
            title={t('seller.liveChat.setBlockedKeywords', { defaultValue: '금지어 설정' })}
            className={`p-1 rounded ${showBlockPanel ? 'bg-red-100 text-red-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
            <Shield className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] text-gray-500 ml-1">{t('seller.liveChat.messageCount', { count: allMessages.length })}</span>
        </div>
      </div>

      {/* 고정 공지 입력 패널 */}
      {showPinPanel && (
        <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-100">
          <p className="text-[10px] text-yellow-700 font-bold mb-1">📌 {t('seller.liveChat.pinnedMessage', { defaultValue: '고정 공지 (빈칸이면 해제)' })}</p>
          <div className="flex gap-1">
            <input
              value={pinnedInput}
              onChange={e => setPinnedInput(e.target.value)}
              placeholder={t('seller.liveChat.pinnedPlaceholder', { defaultValue: '공지 메시지를 입력하세요' })}
              className="flex-1 px-2 py-1 bg-white border border-yellow-200 rounded text-xs text-gray-900 focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && setPinnedMessage()}
            />
            <button onClick={setPinnedMessage} className="px-2 py-1 bg-yellow-500 text-white text-xs rounded font-bold">
              {t('common.set', { defaultValue: '설정' })}
            </button>
          </div>
        </div>
      )}

      {/* 금지어 설정 패널 */}
      {showBlockPanel && (
        <div className="px-3 py-2 bg-red-50 border-b border-red-100">
          <p className="text-[10px] text-red-700 font-bold mb-1">🛡️ {t('seller.liveChat.blockedKeywords', { defaultValue: '금지어 (쉼표로 구분)' })}</p>
          <div className="flex gap-1">
            <input
              value={blockedInput}
              onChange={e => setBlockedInput(e.target.value)}
              placeholder={t('seller.liveChat.blockedPlaceholder', { defaultValue: '욕설, 스팸, ...' })}
              className="flex-1 px-2 py-1 bg-white border border-red-200 rounded text-xs text-gray-900 focus:outline-none"
              onKeyDown={e => e.key === 'Enter' && setBlockedKeywords()}
            />
            <button onClick={setBlockedKeywords} className="px-2 py-1 bg-red-500 text-white text-xs rounded font-bold">
              {t('common.set', { defaultValue: '설정' })}
            </button>
          </div>
        </div>
      )}

      {/* 메시지 목록 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5 min-h-0">
        {allMessages.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-8">{t('seller.liveChat.empty')}</p>
        ) : (
          allMessages.map(msg => (
            <div key={msg.id} className="flex items-start gap-1.5 group">
              {/* 소스 아이콘 */}
              {msg.source === 'youtube' ? (
                <svg viewBox="0 0 24 24" fill="#FF0000" className="w-3.5 h-3.5 shrink-0 mt-0.5">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              ) : msg.source === 'seller' ? (
                <span className="w-3.5 h-3.5 bg-blue-500 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[7px] text-white font-bold">S</span>
                </span>
              ) : msg.source === 'system' ? (
                <span className="w-3.5 h-3.5 bg-gray-700 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[7px] text-white font-bold">!</span>
                </span>
              ) : (
                <span className="w-3.5 h-3.5 bg-gray-300 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[7px] text-white font-bold">V</span>
                </span>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] leading-snug">
                  {msg.source === 'viewer' && msg.userId && (
                    <ViewerLoyaltyBadge userId={msg.userId} compact />
                  )}
                  <span className={`font-bold ${
                    msg.source === 'seller' ? 'text-blue-600' :
                    msg.source === 'system' ? 'text-gray-700' :
                    'text-gray-900'
                  }`}> {msg.author}</span>
                  <span className="text-gray-600"> {msg.message}</span>
                </p>
              </div>
              {/* viewer 채팅만 차단 버튼 표시 */}
              {msg.source === 'viewer' && msg.userId && (
                <button
                  onClick={() => banUser(String(msg.userId))}
                  title={t('seller.liveChat.banUser', { defaultValue: '차단' })}
                  className="opacity-0 group-hover:opacity-100 p-0.5 text-gray-300 hover:text-red-500 transition-opacity shrink-0 mt-0.5"
                >
                  <Ban className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* 입력 */}
      <form onSubmit={e => { e.preventDefault(); sendMessage() }} className="px-3 py-2 border-t border-gray-100 flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={t('seller.liveChat.inputPlaceholder')}
          className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-900 focus:outline-none focus:border-blue-400"
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

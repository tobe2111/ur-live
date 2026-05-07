/**
 * /embed/seller-overlay/:streamId
 *
 * OBS Browser Source 용 투명 오버레이.
 * - 실시간 채팅 (DO WebSocket + YouTube polling)
 * - 핀 상품 카드 (current_product)
 *
 * 셀러가 OBS 에 추가하면 방송 화면 위에 직접 합성됨 → 셀러가 다른 창 안 봐도 됨.
 *
 * URL 파라미터:
 *   ?chat=1   채팅 표시 (default 1)
 *   ?pin=1    핀 상품 표시 (default 1)
 *   ?token=X  optional read-only token (현재는 publicly readable: 추후 강화)
 */

import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import api from '@/lib/api'
import { useLiveStreamWebSocket } from '@/hooks/useLiveStreamWebSocket'
import { formatNumber } from '@/utils/format'
import { ShoppingBag } from 'lucide-react'

interface PinProduct {
  id: number
  name: string
  price: number
  image_url: string
}

interface OverlayMsg {
  id: string
  author: string
  message: string
  source: 'viewer' | 'youtube' | 'seller' | 'system'
  timestamp: number
}

export default function SellerOverlayPage() {
  const { streamId: streamIdParam } = useParams<{ streamId: string }>()
  const [searchParams] = useSearchParams()
  const showChat = searchParams.get('chat') !== '0'
  const showPin = searchParams.get('pin') !== '0'

  const streamId = /^\d+$/.test(streamIdParam || '') ? Number(streamIdParam) : 0
  const [pinProduct, setPinProduct] = useState<PinProduct | null>(null)
  const [ytMessages, setYtMessages] = useState<OverlayMsg[]>([])
  const seenYtIds = useRef<Set<string>>(new Set())

  const { messages: wsMessages } = useLiveStreamWebSocket(streamId, !!streamId, false)

  // 핀 상품 polling (5s)
  useEffect(() => {
    if (!streamId || !showPin) return
    let active = true
    const fetchPin = async () => {
      try {
        const res = await api.get(`/api/streams/${streamId}/current-product`)
        if (active && res.data.success) {
          setPinProduct(res.data.data?.product || null)
        }
      } catch { /* silent */ }
    }
    fetchPin()
    const t = setInterval(fetchPin, 5000)
    return () => { active = false; clearInterval(t) }
  }, [streamId, showPin])

  // YouTube chat polling (10s)
  useEffect(() => {
    if (!streamId || !showChat) return
    let active = true
    const poll = async () => {
      if (document.hidden) return
      try {
        const res = await api.get(`/api/youtube/chat/chat/${streamId}`)
        if (active && res.data.success && res.data.data?.messages) {
          const newMsgs: OverlayMsg[] = res.data.data.messages
            .filter((m: { id: string }) => !seenYtIds.current.has(`yt-${m.id}`))
            .map((m: { id: string; author: string; message: string; timestamp: number }) => ({
              id: `yt-${m.id}`,
              author: m.author,
              message: m.message,
              source: 'youtube' as const,
              timestamp: m.timestamp,
            }))
          newMsgs.forEach(m => seenYtIds.current.add(m.id))
          if (newMsgs.length > 0) {
            setYtMessages(prev => [...prev, ...newMsgs].slice(-30))
          }
        }
      } catch { /* silent */ }
    }
    poll()
    const t = setInterval(poll, 10000)
    return () => { active = false; clearInterval(t) }
  }, [streamId, showChat])

  if (!streamId) {
    return <div style={{ background: 'transparent' }} />
  }

  const allMessages: OverlayMsg[] = [
    ...wsMessages.map(m => ({
      id: m.id,
      author: m.userName,
      message: m.message,
      source: (m.isSeller ? 'seller' : m.isAdmin ? 'system' : 'viewer') as OverlayMsg['source'],
      timestamp: m.timestamp,
    })),
    ...ytMessages,
  ].sort((a, b) => a.timestamp - b.timestamp).slice(-15)

  return (
    <div
      className="w-screen h-screen overflow-hidden font-sans"
      style={{ background: 'transparent' }}
    >
      {/* 핀 상품 — 우상단 고정 */}
      {showPin && pinProduct && (
        <div className="absolute top-4 right-4 bg-white/95 rounded-2xl shadow-2xl p-3 flex items-center gap-3 max-w-sm">
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
            {pinProduct.image_url
              ? <img src={pinProduct.image_url} alt={pinProduct.name} className="w-full h-full object-cover" />
              : <ShoppingBag className="w-6 h-6 m-auto text-gray-300" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-pink-600 mb-0.5">▶ 지금 소개 중</p>
            <p className="text-sm font-bold text-gray-900 truncate">{pinProduct.name}</p>
            <p className="text-base font-extrabold text-gray-900">{formatNumber(pinProduct.price)}원</p>
          </div>
        </div>
      )}

      {/* 채팅 — 좌하단 누적 */}
      {showChat && (
        <div className="absolute bottom-4 left-4 max-w-md flex flex-col gap-1.5">
          {allMessages.map(msg => (
            <div
              key={msg.id}
              className="bg-black/60 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-sm flex items-center gap-2 max-w-full"
            >
              <span
                className={`text-xs font-bold flex-shrink-0 ${
                  msg.source === 'seller' ? 'text-pink-300' :
                  msg.source === 'youtube' ? 'text-red-300' :
                  msg.source === 'system' ? 'text-yellow-300' :
                  'text-blue-300'
                }`}
              >
                {msg.author}
              </span>
              <span className="truncate">{msg.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * useLiveStreamWebSocket
 *
 * Durable Object WebSocket을 사용하는 실시간 채팅 + 스트림 상태 통합 훅.
 * Firebase Realtime DB (useFirebaseChat + useFirebaseStream)를 완전 대체.
 *
 * 연결 흐름:
 *   브라우저 WebSocket → /api/live/:streamId/ws → Worker → Durable Object
 *
 * 수신 이벤트 타입:
 *   chat          - 새 채팅 메시지
 *   viewer_count  - 시청자 수 변경
 *   stream_status - 스트림 상태 변경 (status, current_product_id 등)
 *   product_change- 현재 상품 변경
 *   product_stock - 상품 재고 변경
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { getAccessToken } from '@/utils/auth'
import { isFeatureBlockedSync, isPWAStandalone } from '@/lib/in-app-warning'
import { toast } from '@/hooks/useToast'
import type { ChatMessage, StreamData } from '@/types/live-stream'
import { safeTime } from '@/utils/safe-date'
import { useStreamStore } from '@/shared/stores/useStreamStore'

export interface DonationEvent {
  donorName: string
  amount: number
  message: string
  creditAmount: number
}

export interface FlashSaleEvent {
  id: number
  product_id: number
  discount_rate: number
  ends_at: string
  [key: string]: unknown
}

export interface UseLiveStreamWebSocketReturn {
  // Chat (useFirebaseChat 동일 인터페이스)
  messages: ChatMessage[]
  isConnected: boolean
  error: string | null
  sendMessage: (
    message: string,
    userId: number,
    userName: string,
    userType: 'viewer' | 'streamer' | 'system'
  ) => Promise<void>
  clearMessages: () => void
  addLocalMessage: (msg: ChatMessage) => void

  // Stream (useFirebaseStream 동일 인터페이스)
  streamData: StreamData | null

  // Donations
  lastDonation: DonationEvent | null

  // Flash Sales
  activeFlashSale: FlashSaleEvent | null

  // Pinned message (셀러 고정 공지)
  pinnedMessage: string | null
}

export function useLiveStreamWebSocket(
  streamId: number | null,
  enabled: boolean = true,
  replay: boolean = false,
): UseLiveStreamWebSocketReturn {
  const { t } = useTranslation()
  const getCachedMessages = useStreamStore(s => s.getCachedMessages)
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    streamId ? getCachedMessages(streamId) : []
  )
  const [streamData, setStreamData] = useState<StreamData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastDonation, setLastDonation] = useState<DonationEvent | null>(null)
  const [activeFlashSale, setActiveFlashSale] = useState<FlashSaleEvent | null>(null)
  const [pinnedMessage, setPinnedMessage] = useState<string | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 🛡️ 2026-05-13 (#4): heartbeat 15s — viewer count 정확도 위한 keepalive
  const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bcRef = useRef<BroadcastChannel | null>(null)
  const tabIdRef = useRef(`tab-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const MAX_RECONNECT = 3

  const clearMessages = useCallback(() => setMessages([]), [])

  const addLocalMessage = useCallback((msg: ChatMessage) => {
    // 🛡️ 2026-05-06: 채팅 무한 누적 차단 — 모바일 라이브 장시간 시청 시 freeze 사고 방지.
    // 최대 200개 유지. 화면 표시는 ReelCard 에서 추가로 -8 슬라이스됨.
    setMessages(prev => [...prev, msg].slice(-200))
  }, [])

  const sendMessage = useCallback(
    async (
      message: string,
      userId: number,
      userName: string,
      userType: 'viewer' | 'streamer' | 'system'
    ) => {
      const accessToken = getAccessToken()
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

      const response = await fetch(`/api/chat/${streamId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId,
          userName,
          message: message.trim(),
          isSeller: userType === 'streamer',
          isAdmin: userType === 'system',
        }),
      })

      if (!response.ok) throw new Error(t('liveWs.sendFailed', { defaultValue: '메시지 전송 실패' }))
    },
    [streamId]
  )

  // Fetch initial messages (called once on connect)
  const fetchInitialMessages = useCallback(async () => {
    if (!streamId) return
    try {
      const replayParam = replay ? '?replay=true' : ''
      const res = await fetch(`/api/live/${streamId}/chat/messages${replayParam}`)
      if (!res.ok) return
      const json = await res.json() as { success: boolean; data: { id: number; user_id: number; user_name: string; message: string; user_type: string; created_at: string; is_seller?: boolean; is_admin?: boolean }[] }
      if (json.success && Array.isArray(json.data)) {
        const formatted: ChatMessage[] = json.data.map((msg) => ({
          id: String(msg.id),
          userId: msg.user_id,
          userName: msg.user_name,
          userType: msg.is_seller ? 'streamer' : (msg.is_admin ? 'system' : 'viewer'),
          message: msg.message,
          timestamp: safeTime(msg.created_at),
          isSeller: Boolean(msg.is_seller),
          isAdmin: Boolean(msg.is_admin),
        }))
        setMessages(formatted)
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('[WS] Initial messages fetch failed:', e)
    }
  }, [streamId, replay])

  // Polling fallback when WebSocket is unavailable
  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current || !streamId) return

    // Fetch messages initially
    fetchInitialMessages()
    setIsConnected(true) // Mark as connected so chat UI works

    // Poll every 5 seconds for new messages
    pollingIntervalRef.current = setInterval(() => {
      fetchInitialMessages()
    }, 5000)
  }, [streamId, fetchInitialMessages])

  const connect = useCallback(() => {
    if (!enabled || !streamId) return

    // BroadcastChannel 탭 간 메시지 중계 — 같은 스트림 여러 탭 열면
    // 마스터 탭(WS 연결 보유) 이 다른 탭에 chat 이벤트를 전달하고,
    // 슬레이브 탭은 WS 연결 없이 메시지를 수신.
    if (!bcRef.current && 'BroadcastChannel' in window) {
      const bc = new BroadcastChannel(`ur-live-${streamId}`)
      bcRef.current = bc
      bc.onmessage = (e) => {
        if (e.data?.type === 'chat' && e.data?.fromTab !== tabIdRef.current) {
          const d = e.data.payload
          setMessages(prev => {
            if (prev.some(m => m.id === String(d.id))) return prev
            const newMsg: ChatMessage = {
              id: String(d.id),
              userId: d.user_id,
              userName: d.user_name,
              userType: d.is_seller ? 'streamer' : (d.is_admin ? 'system' : 'viewer'),
              message: d.message,
              timestamp: d.timestamp ?? Date.now(),
              isSeller: Boolean(d.is_seller),
              isAdmin: Boolean(d.is_admin),
            }
            return [...prev, newMsg].slice(-200)
          })
        }
      }
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    try {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
      const accessToken = getAccessToken()
      const wsUrl = accessToken
        ? `${protocol}//${location.host}/api/live/${streamId}/ws?token=${encodeURIComponent(accessToken)}`
        : `${protocol}//${location.host}/api/live/${streamId}/ws`

      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setIsConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
        // WS 복구 시 폴링 중이었다면 중단
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
          pollingIntervalRef.current = null
        }
        fetchInitialMessages()
        // 🛡️ 2026-05-13 (#4): heartbeat 15s — DO 가 stale session 정리 기준
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            try { ws.send(JSON.stringify({ type: 'heartbeat' })) } catch { /* noop */ }
          }
        }, 15_000)
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)

          if (msg.type === 'chat') {
            const d = msg.data
            // 다른 탭에 relay (같은 streamId BroadcastChannel)
            try {
              bcRef.current?.postMessage({ type: 'chat', fromTab: tabIdRef.current, payload: d })
            } catch { /* ignore */ }
            setMessages((prev) => {
              const newMsg: ChatMessage = {
                id: String(d.id),
                userId: d.user_id,
                userName: d.user_name,
                userType: d.is_seller ? 'streamer' : (d.is_admin ? 'system' : 'viewer'),
                message: d.message,
                timestamp: safeTime(d.created_at),
                isSeller: Boolean(d.is_seller),
                isAdmin: Boolean(d.is_admin),
              }
              return [...prev, newMsg].slice(-200)
            })
          } else if (msg.type === 'viewer_count') {
            setStreamData((prev) =>
              prev ? { ...prev, viewer_count: msg.data.count } : null
            )
          } else if (msg.type === 'stream_status') {
            setStreamData((prev) =>
              prev ? { ...prev, ...msg.data } : {
                id: streamId,
                status: msg.data.status || 'live',
                current_product_id: msg.data.current_product_id ?? null,
                viewer_count: msg.data.viewer_count || 0,
                updated_at: Date.now(),
              }
            )
          } else if (msg.type === 'product_change') {
            setStreamData((prev) =>
              prev
                ? { ...prev, current_product_id: msg.data?.id ?? null }
                : {
                    id: streamId,
                    status: 'live',
                    current_product_id: msg.data?.id ?? null,
                    viewer_count: 0,
                    updated_at: Date.now(),
                  }
            )
          } else if (msg.type === 'donation') {
            setLastDonation(msg.data as DonationEvent)
          } else if (msg.type === 'order_proof') {
            // 🛡️ 2026-05-13 (Phase A): 라이브 시청 중 다른 시청자의 주문 → social proof 채팅 메시지로.
            //   FOMO 효과 → conversion 자극 (TikTok / 라이브 커머스 표준).
            const d = msg.data as { buyer: string; product: string; amount: number }
            addLocalMessage({
              id: `order-proof-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              userId: 0,
              userName: 'system',
              userType: 'system',
              message: `🛍️ ${d.buyer}님이 [${d.product}] 구매!`,
              timestamp: Date.now(),
            })
          } else if (msg.type === 'flash_sale') {
            setActiveFlashSale(msg.data)
          } else if (msg.type === 'pinned_message') {
            setPinnedMessage((msg.data as { message: string | null })?.message ?? null)
          }
        } catch (e) {
          if (import.meta.env.DEV) console.error('[WS] Message parse error:', e)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current)
          heartbeatIntervalRef.current = null
        }

        if (reconnectAttemptsRef.current < MAX_RECONNECT) {
          // 🛡️ 2026-05-06: Exponential backoff + ±25% jitter — 동시 reconnect thundering herd 방지.
          //   서버 재시작 시 모든 클라이언트가 같은 시점에 reconnect 시도 → 부하 폭주.
          //   각 클라이언트 무작위 지연으로 평탄화.
          const baseDelay = 1000 * Math.pow(2, reconnectAttemptsRef.current)
          const jitter = baseDelay * (0.5 - Math.random()) * 0.5  // ±25%
          const delay = Math.max(500, Math.round(baseDelay + jitter))
          reconnectAttemptsRef.current++
          setError(t('liveWs.reconnecting', { defaultValue: '연결 끊김. {{seconds}}초 후 재연결...', seconds: Math.round(delay / 1000) }))
          reconnectTimeoutRef.current = setTimeout(connect, delay)
        } else {
          // WebSocket failed after max retries — fall back to polling
          setError(null) // Clear error so UI doesn't show stale message
          // 🛡️ 2026-04-30 v2: 3회 reconnect 실패 + 인앱 webview + PWA 아님 → 1회만 토스트.
          //   WebSocket 차단은 매트릭스에 포함된 inApp 만 적용 (라인은 가능하므로 제외).
          if (!isPWAStandalone() && isFeatureBlockedSync('websocket') && !sessionStorage.getItem('ur_ws_fallback_notice_v1')) {
            try {
              sessionStorage.setItem('ur_ws_fallback_notice_v1', '1')
              toast.info(t('liveWs.fallbackInApp', { defaultValue: '실시간 채팅이 불안정해요. 외부 브라우저에서 더 안정적으로 시청 가능합니다.' }))
            } catch { /* ignore */ }
          }
          startPolling()
        }
      }

      ws.onerror = () => {
        // WebSocket unavailable (no Durable Objects) — silently fall back to polling
      }
    } catch (e) {
      if (import.meta.env.DEV) console.error('[WS] Failed to create WebSocket:', e)
      setError(t('liveWs.connectFailed', { defaultValue: 'WebSocket 연결 실패' }))
    }
  }, [streamId, enabled, fetchInitialMessages])

  useEffect(() => {
    if (!enabled || !streamId) return

    connect()

    // 🛡️ iOS Safari bfcache: pagehide 시 WebSocket 강제 종료 (좀비 연결 방지),
    //   pageshow persisted=true 면 back/forward 복원 — 재연결 + reconnect 카운터 리셋.
    // 🛡️ 2026-05-13 (#4): graceful leave — 명시적 leave 메시지로 DO 즉시 viewerCount 감소.
    const sendLeave = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        try { wsRef.current.send(JSON.stringify({ type: 'leave' })) } catch { /* noop */ }
      }
    }
    const onPageHide = () => {
      sendLeave()
      if (wsRef.current) {
        try { wsRef.current.close() } catch { /* */ }
        wsRef.current = null
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        reconnectAttemptsRef.current = 0
        connect()
      }
    }
    window.addEventListener('pagehide', onPageHide)
    window.addEventListener('pageshow', onPageShow)

    return () => {
      window.removeEventListener('pagehide', onPageHide)
      window.removeEventListener('pageshow', onPageShow)
      // 🛡️ 2026-05-13 (#4): card 전환 / unmount 시 graceful leave 시도
      sendLeave()
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
      if (wsRef.current) {
        const ws = wsRef.current
        wsRef.current = null
        // 🛡️ 2026-05-06: CONNECTING 상태에서 close() 호출 시 콘솔에 "closed before
        //   established" 경고가 찍힘 (스크롤로 active card 가 빠르게 바뀔 때 발생).
        //   open 후 close() 하면 깔끔하게 종료됨. CONNECTING 인 경우 onopen 에서 close.
        if (ws.readyState === WebSocket.CONNECTING) {
          ws.onopen = () => { try { ws.close() } catch { /* ignore */ } }
          ws.onerror = null
          ws.onmessage = null
        } else {
          try { ws.close() } catch { /* ignore */ }
        }
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
      if (bcRef.current) {
        bcRef.current.close()
        bcRef.current = null
      }
    }
  }, [connect, enabled, streamId])

  return {
    messages,
    isConnected,
    error,
    sendMessage,
    clearMessages,
    addLocalMessage,
    streamData,
    lastDonation,
    activeFlashSale,
    pinnedMessage,
  }
}

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
import { getAccessToken } from '@/utils/auth'
import type { ChatMessage } from './useFirebaseChat'
import type { StreamData } from './useFirebaseStream'

export interface DonationEvent {
  donorName: string
  amount: number
  message: string
  creditAmount: number
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

  // Stream (useFirebaseStream 동일 인터페이스)
  streamData: StreamData | null

  // Donations
  lastDonation: DonationEvent | null
}

export function useLiveStreamWebSocket(
  streamId: number | null,
  enabled: boolean = true
): UseLiveStreamWebSocketReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streamData, setStreamData] = useState<StreamData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastDonation, setLastDonation] = useState<DonationEvent | null>(null)

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // 0 = WebSocket 첫 실패 시 즉시 polling으로 전환 (Durable Objects 없는 환경)
  const MAX_RECONNECT = 0

  const clearMessages = useCallback(() => setMessages([]), [])

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

      if (!response.ok) throw new Error('메시지 전송 실패')
    },
    [streamId]
  )

  // Fetch initial messages (called once on connect)
  const fetchInitialMessages = useCallback(async () => {
    if (!streamId) return
    try {
      const res = await fetch(`/api/live/${streamId}/chat/messages`)
      if (!res.ok) return
      const json = await res.json() as any
      if (json.success && Array.isArray(json.data)) {
        const formatted: ChatMessage[] = json.data.map((msg: any) => ({
          id: String(msg.id),
          userId: msg.user_id,
          userName: msg.user_name,
          userType: msg.is_seller ? 'streamer' : (msg.is_admin ? 'system' : 'viewer'),
          message: msg.message,
          timestamp: new Date(msg.created_at).getTime(),
          isSeller: Boolean(msg.is_seller),
          isAdmin: Boolean(msg.is_admin),
        }))
        setMessages(formatted)
      }
    } catch (e) {
      console.error('[WS] Initial messages fetch failed:', e)
    }
  }, [streamId])

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
        fetchInitialMessages()
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string)

          if (msg.type === 'chat') {
            const d = msg.data
            setMessages((prev) => [
              ...prev,
              {
                id: String(d.id),
                userId: d.user_id,
                userName: d.user_name,
                userType: d.is_seller ? 'streamer' : (d.is_admin ? 'system' : 'viewer'),
                message: d.message,
                timestamp: new Date(d.created_at).getTime(),
                isSeller: Boolean(d.is_seller),
                isAdmin: Boolean(d.is_admin),
              },
            ])
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
          }
        } catch (e) {
          console.error('[WS] Message parse error:', e)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        wsRef.current = null

        if (reconnectAttemptsRef.current < MAX_RECONNECT) {
          const delay = 1000 * Math.pow(2, reconnectAttemptsRef.current)
          reconnectAttemptsRef.current++
          setError(`연결 끊김. ${delay / 1000}초 후 재연결...`)
          reconnectTimeoutRef.current = setTimeout(connect, delay)
        } else {
          // WebSocket failed after max retries — fall back to polling
          setError(null) // Clear error so UI doesn't show stale message
          startPolling()
        }
      }

      ws.onerror = () => {
        // WebSocket unavailable (no Durable Objects) — silently fall back to polling
      }
    } catch (e) {
      console.error('[WS] Failed to create WebSocket:', e)
      setError('WebSocket 연결 실패')
    }
  }, [streamId, enabled, fetchInitialMessages])

  useEffect(() => {
    if (!enabled || !streamId) return

    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
        wsRef.current = null
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current)
        pollingIntervalRef.current = null
      }
    }
  }, [connect, enabled, streamId])

  return {
    messages,
    isConnected,
    error,
    sendMessage,
    clearMessages,
    streamData,
    lastDonation,
  }
}

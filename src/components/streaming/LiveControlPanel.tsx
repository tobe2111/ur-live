/**
 * Live Control Panel
 * Real-time product switching + YouTube chat integration
 */

import { useState, useEffect, useRef } from 'react'
import { MessageSquare, TrendingUp, Eye, Users, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import api from '@/lib/api'

interface Product {
  id: number
  name: string
  price: number
  original_price?: number
  discount_rate?: number
  image_url: string
  stock: number
}

interface ChatMessage {
  id: string
  author: string
  message: string
  timestamp: number
}

interface LiveControlPanelProps {
  streamId: number
  products: Product[]
  youtubeVideoId: string
}

export default function LiveControlPanel({
  streamId,
  products,
  youtubeVideoId
}: LiveControlPanelProps) {
  const [currentProductId, setCurrentProductId] = useState<number>(products[0]?.id)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [viewerCount, setViewerCount] = useState(0)
  const [stats, setStats] = useState({
    clicks: 0,
    purchases: 0,
    revenue: 0
  })

  const wsRef = useRef<WebSocket | null>(null)
  const chatPollingRef = useRef<number>(0)

  useEffect(() => {
    connectWebSocket()
    startChatPolling()

    return () => {
      wsRef.current?.close()
      if (chatPollingRef.current) {
        clearInterval(chatPollingRef.current)
      }
    }
  }, [streamId])

  /**
   * Connect WebSocket for real-time control
   */
  function connectWebSocket() {
    const baseUrl = import.meta.env.VITE_RTMP_SERVER_URL || 'wss://live.ur-team.com'
    const wsUrl = `${baseUrl}/ws/stream/${streamId}`
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      ws.send(JSON.stringify({
        type: 'control_join',
        streamId,
        role: 'seller'
      }))
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      switch (data.type) {
        case 'viewer_count':
          setViewerCount(data.count)
          break
        case 'product_click':
          setStats(prev => ({
            ...prev,
            clicks: prev.clicks + 1
          }))
          break
        case 'purchase':
          setStats(prev => ({
            ...prev,
            purchases: prev.purchases + 1,
            revenue: prev.revenue + data.amount
          }))
          break
        case 'chat_message':
          handleChatMessage(data.message)
          break
      }
    }

    ws.onerror = (err) => {
      console.error('[WebSocket] Error:', err)
    }

    ws.onclose = () => {
      setTimeout(connectWebSocket, 3000)
    }

    wsRef.current = ws
  }

  /**
   * Switch product (broadcasts to all viewers)
   */
  function switchProduct(productId: number) {
    setCurrentProductId(productId)

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'switch_product',
        productId,
        streamId
      }))
    }

    // Also update backend
    api.post(`/api/streams/${streamId}/current-product`, { productId })
  }

  /**
   * Start polling YouTube Live Chat
   */
  function startChatPolling() {
    // Initial fetch
    fetchLiveChat()

    // Poll every 5 seconds
    chatPollingRef.current = window.setInterval(fetchLiveChat, 5000)
  }

  /**
   * Fetch YouTube Live Chat messages
   */
  async function fetchLiveChat() {
    try {
      const response = await api.get(`/api/youtube/chat/${streamId}`)
      if (response.data.success) {
        const newMessages = response.data.data.messages || []
        setChatMessages(prev => {
          const merged = [...prev, ...newMessages]
          // Keep last 50 messages
          return merged.slice(-50)
        })
      }
    } catch (error) {
      console.error('[Chat] Failed to fetch:', error)
    }
  }

  /**
   * Handle incoming chat message
   */
  function handleChatMessage(message: ChatMessage) {
    setChatMessages(prev => [...prev, message].slice(-50))

    // Auto-respond to purchase keywords
    const lowerMessage = message.message.toLowerCase()
    if (lowerMessage.includes('구매') || lowerMessage.includes('링크') || lowerMessage.includes('buy')) {
      sendChatReply(
        message.author,
        `@${message.author} 구매 링크: https://live.ur-team.com/product/${currentProductId} 🛒`
      )
    }
  }

  /**
   * Send chat reply (via YouTube API)
   */
  async function sendChatReply(author: string, message: string) {
    try {
      await api.post(`/api/youtube/chat/${streamId}`, {
        message
      })
    } catch (error) {
      console.error('[Chat] Failed to send reply:', error)
    }
  }

  const currentProduct = products.find(p => p.id === currentProductId)

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* Stats Cards */}
      <div className="lg:col-span-3 grid sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
            <Eye className="h-6 w-6 text-red-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">실시간 시청자</p>
            <p className="text-2xl font-bold">{viewerCount.toLocaleString()}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <Zap className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">상품 클릭</p>
            <p className="text-2xl font-bold">{stats.clicks}</p>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <TrendingUp className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-600">실시간 매출</p>
            <p className="text-2xl font-bold">₩{stats.revenue.toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Product Switcher */}
      <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Zap className="h-5 w-5 text-orange-500" />
          실시간 상품 전환
        </h3>

        <div className="grid sm:grid-cols-2 gap-4">
          {products.map(product => (
            <button
              key={product.id}
              onClick={() => switchProduct(product.id)}
              className={`
                p-4 rounded-lg border-2 transition-all text-left
                ${currentProductId === product.id
                  ? 'border-blue-500 bg-blue-50 shadow-lg scale-105'
                  : 'border-gray-200 hover:border-blue-300'
                }
              `}
            >
              <div className="flex gap-3">
                <img
                  src={product.image_url}
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm truncate mb-1">
                    {product.name}
                  </h4>
                  <p className="text-lg font-bold text-blue-600">
                    ₩{product.price.toLocaleString()}
                  </p>
                  {product.discount_rate && (
                    <span className="inline-block px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded">
                      {product.discount_rate}% OFF
                    </span>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    재고: {product.stock}개
                  </p>
                </div>
              </div>
              {currentProductId === product.id && (
                <div className="mt-2 bg-blue-500 text-white text-center py-1 rounded font-semibold text-xs">
                  🔴 현재 노출 중
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Current Product Preview */}
        {currentProduct && (
          <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
            <p className="text-xs font-semibold text-gray-600 mb-2">
              👁️ 시청자 화면 미리보기
            </p>
            <div className="bg-white rounded-lg p-3 flex items-center gap-3 shadow">
              <img
                src={currentProduct.image_url}
                alt={currentProduct.name}
                className="w-16 h-16 object-cover rounded"
              />
              <div className="flex-1">
                <h5 className="font-bold text-sm">{currentProduct.name}</h5>
                <p className="text-lg font-bold text-green-600">
                  ₩{(currentProduct.price || 0).toLocaleString()}
                </p>
              </div>
              <Button size="sm" className="bg-blue-500 hover:bg-blue-600">
                구매하기
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Live Chat */}
      <div className="bg-white rounded-lg shadow p-6 flex flex-col max-h-[600px]">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-purple-500" />
          실시간 채팅
          <span className="ml-auto text-sm font-normal text-gray-500">
            <Users className="inline h-4 w-4" /> {chatMessages.length}
          </span>
        </h3>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {chatMessages.length === 0 ? (
            <div className="text-center text-gray-400 py-8">
              <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">아직 채팅이 없습니다</p>
            </div>
          ) : (
            chatMessages.map(msg => (
              <div key={msg.id} className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {msg.author.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-900 mb-0.5">
                      {msg.author}
                    </p>
                    <p className="text-sm text-gray-700 break-words">
                      {msg.message}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Auto-Reply Status */}
        <div className="text-xs text-center text-gray-500 py-2 bg-green-50 rounded">
          ✅ "구매" 키워드 자동 응답 활성화
        </div>
      </div>
    </div>
  )
}

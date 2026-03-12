/**
 * Server-Sent Events (SSE) 실시간 통신
 * 
 * Cloudflare Workers에서 WebSocket 대신 SSE 사용
 * - 라이브 방송 상태 업데이트
 * - 실시간 채팅 메시지
 * - 주문 알림
 * - 재고 알림
 */

interface Env {
  DB: D1Database
  LIVE_CACHE: KVNamespace
}

interface SSEMessage {
  type: 'chat' | 'order' | 'stock' | 'status' | 'viewer_count'
  data: any
  timestamp: string
}

/**
 * SSE 연결 생성
 */
export function createSSEResponse(): Response {
  const encoder = new TextEncoder()
  
  let controller: ReadableStreamDefaultController<Uint8Array>

  const stream = new ReadableStream({
    start(c) {
      controller = c
    },
    cancel() {
      // 연결 종료 시 정리
      console.log('[SSE] Connection closed')
    }
  })

  // SSE 헤더 설정
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Nginx 버퍼링 비활성화
    }
  })
}

/**
 * SSE 메시지 전송
 */
export function sendSSEMessage(
  controller: ReadableStreamDefaultController<Uint8Array>,
  message: SSEMessage
): void {
  const encoder = new TextEncoder()
  const data = JSON.stringify(message)
  const formatted = `data: ${data}\n\n`
  controller.enqueue(encoder.encode(formatted))
}

/**
 * Keep-alive 핑 전송
 */
export function sendKeepAlivePing(
  controller: ReadableStreamDefaultController<Uint8Array>
): void {
  const encoder = new TextEncoder()
  controller.enqueue(encoder.encode(': ping\n\n'))
}

/**
 * 라이브 스트림 SSE 엔드포인트
 * 
 * 클라이언트가 /api/live/:streamId/sse에 연결하면
 * 해당 스트림의 실시간 업데이트를 받음
 */
export async function handleLiveStreamSSE(
  streamId: string,
  env: Env
): Promise<Response> {
  const encoder = new TextEncoder()
  let intervalId: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      console.log(`[SSE] Client connected to stream ${streamId}`)

      // 초기 데이터 전송
      try {
        const liveStream = await env.DB.prepare(`
          SELECT 
            id,
            title,
            status,
            viewer_count,
            like_count
          FROM live_streams
          WHERE id = ?
        `).bind(streamId).first()

        if (liveStream) {
          const message: SSEMessage = {
            type: 'status',
            data: liveStream,
            timestamp: new Date().toISOString()
          }
          const data = JSON.stringify(message)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }
      } catch (error) {
        console.error('[SSE] Failed to fetch initial data:', error)
      }

      // 주기적 업데이트 (30초마다)
      intervalId = setInterval(async () => {
        try {
          // 시청자 수 업데이트
          const stats = await env.DB.prepare(`
            SELECT 
              viewer_count,
              like_count,
              comment_count
            FROM live_streams
            WHERE id = ?
          `).bind(streamId).first<{
            viewer_count: number
            like_count: number
            comment_count: number
          }>()

          if (stats) {
            const message: SSEMessage = {
              type: 'viewer_count',
              data: stats,
              timestamp: new Date().toISOString()
            }
            const data = JSON.stringify(message)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }

          // Keep-alive ping
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch (error) {
          console.error('[SSE] Update failed:', error)
        }
      }, 30000) // 30초
    },
    
    cancel() {
      console.log(`[SSE] Client disconnected from stream ${streamId}`)
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}

/**
 * 채팅 SSE 엔드포인트
 * 
 * 실시간 채팅 메시지 스트리밍
 */
export async function handleChatSSE(
  streamId: string,
  env: Env
): Promise<Response> {
  const encoder = new TextEncoder()
  let lastMessageId = 0
  let intervalId: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      console.log(`[SSE Chat] Client connected to stream ${streamId}`)

      // 최근 메시지 전송
      try {
        const messages = await env.DB.prepare(`
          SELECT 
            id,
            user_id,
            user_name,
            user_avatar,
            message,
            is_seller,
            is_admin,
            created_at
          FROM chat_messages
          WHERE live_stream_id = ?
          ORDER BY id DESC
          LIMIT 50
        `).bind(streamId).all()

        if (messages.results.length > 0) {
          lastMessageId = (messages.results[0] as any).id

          const message: SSEMessage = {
            type: 'chat',
            data: messages.results.reverse(),
            timestamp: new Date().toISOString()
          }
          const data = JSON.stringify(message)
          controller.enqueue(encoder.encode(`data: ${data}\n\n`))
        }
      } catch (error) {
        console.error('[SSE Chat] Failed to fetch initial messages:', error)
      }

      // 새 메시지 폴링 (5초마다)
      intervalId = setInterval(async () => {
        try {
          const newMessages = await env.DB.prepare(`
            SELECT 
              id,
              user_id,
              user_name,
              user_avatar,
              message,
              is_seller,
              is_admin,
              created_at
            FROM chat_messages
            WHERE live_stream_id = ? AND id > ?
            ORDER BY id ASC
          `).bind(streamId, lastMessageId).all()

          if (newMessages.results.length > 0) {
            lastMessageId = (newMessages.results[newMessages.results.length - 1] as any).id

            const message: SSEMessage = {
              type: 'chat',
              data: newMessages.results,
              timestamp: new Date().toISOString()
            }
            const data = JSON.stringify(message)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          } else {
            // Keep-alive
            controller.enqueue(encoder.encode(': ping\n\n'))
          }
        } catch (error) {
          console.error('[SSE Chat] Polling failed:', error)
        }
      }, 5000) // 5초
    },
    
    cancel() {
      console.log(`[SSE Chat] Client disconnected from stream ${streamId}`)
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}

/**
 * 주문 알림 SSE (셀러용)
 */
export async function handleOrderNotificationSSE(
  sellerId: string,
  env: Env
): Promise<Response> {
  const encoder = new TextEncoder()
  let lastOrderId = 0
  let intervalId: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      console.log(`[SSE Orders] Seller ${sellerId} connected`)

      // 최근 주문 조회
      try {
        const orders = await env.DB.prepare(`
          SELECT id FROM orders
          WHERE seller_id = ?
          ORDER BY id DESC
          LIMIT 1
        `).bind(sellerId).first<{ id: number }>()

        if (orders) {
          lastOrderId = orders.id
        }
      } catch (error) {
        console.error('[SSE Orders] Failed to fetch last order:', error)
      }

      // 새 주문 폴링 (10초마다)
      intervalId = setInterval(async () => {
        try {
          const newOrders = await env.DB.prepare(`
            SELECT 
              o.id,
              o.order_number,
              o.total_amount,
              o.status,
              o.created_at,
              u.name as buyer_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.seller_id = ? AND o.id > ?
            ORDER BY o.id ASC
          `).bind(sellerId, lastOrderId).all()

          if (newOrders.results.length > 0) {
            lastOrderId = (newOrders.results[newOrders.results.length - 1] as any).id

            const message: SSEMessage = {
              type: 'order',
              data: newOrders.results,
              timestamp: new Date().toISOString()
            }
            const data = JSON.stringify(message)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          } else {
            // Keep-alive
            controller.enqueue(encoder.encode(': ping\n\n'))
          }
        } catch (error) {
          console.error('[SSE Orders] Polling failed:', error)
        }
      }, 10000) // 10초
    },
    
    cancel() {
      console.log(`[SSE Orders] Seller ${sellerId} disconnected`)
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}

/**
 * 재고 알림 SSE (셀러용)
 */
export async function handleStockAlertSSE(
  sellerId: string,
  env: Env
): Promise<Response> {
  const encoder = new TextEncoder()
  let intervalId: ReturnType<typeof setInterval> | undefined

  const stream = new ReadableStream({
    async start(controller) {
      console.log(`[SSE Stock] Seller ${sellerId} connected`)

      // 재고 부족 상품 체크 (60초마다)
      intervalId = setInterval(async () => {
        try {
          const lowStockProducts = await env.DB.prepare(`
            SELECT 
              id,
              name,
              stock,
              low_stock_threshold
            FROM products
            WHERE seller_id = ?
              AND stock <= low_stock_threshold
              AND stock > 0
          `).bind(sellerId).all()

          if (lowStockProducts.results.length > 0) {
            const message: SSEMessage = {
              type: 'stock',
              data: lowStockProducts.results,
              timestamp: new Date().toISOString()
            }
            const data = JSON.stringify(message)
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          } else {
            // Keep-alive
            controller.enqueue(encoder.encode(': ping\n\n'))
          }
        } catch (error) {
          console.error('[SSE Stock] Polling failed:', error)
        }
      }, 60000) // 60초
    },
    
    cancel() {
      console.log(`[SSE Stock] Seller ${sellerId} disconnected`)
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    }
  })
}

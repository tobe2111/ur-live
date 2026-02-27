// Firebase 실시간 훅 (useFirebaseStream)
// src/hooks/useFirebaseStream.ts

import { useEffect, useState, useRef } from 'react'

export interface StreamData {
  id: number
  title?: string
  status: 'live' | 'scheduled' | 'ended'
  current_product_id: number | null
  viewer_count: number
  updated_at: number
}

export interface ProductData {
  id: number
  name: string
  price: number
  original_price?: number
  discount_rate?: number
  stock: number
  image_url?: string
  updated_at: number
}

/**
 * Firebase Realtime Database 스트림 구독 훅
 * 방송 상태 및 현재 상품을 실시간으로 구독
 */
export function useFirebaseStream(streamId: number | null) {
  const [streamData, setStreamData] = useState<StreamData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listenerRef = useRef<any>(null)

  useEffect(() => {
    if (!streamId) return

    let isMounted = true
    let reconnectTimer: any = null

    const initFirebase = () => {
      try {
        // @ts-ignore - Firebase SDK loaded via CDN
        if (typeof window.firebase === 'undefined') {
          console.log('⏳ Firebase SDK not loaded yet, retrying...')
          reconnectTimer = setTimeout(initFirebase, 500)
          return
        }

        // @ts-ignore
        const database = window.firebase.database()
        const streamRef = database.ref(`streams/stream${streamId}`)

        // 실시간 리스너 등록
        const listener = streamRef.on('value', (snapshot: any) => {
          if (!isMounted) return

          const data = snapshot.val()
          if (data) {
            setStreamData({
              id: data.id,
              title: data.title,
              status: data.status,
              current_product_id: data.current_product_id,
              viewer_count: data.viewer_count || 0,
              updated_at: data.updated_at,
            })
            setIsConnected(true)
            setError(null)
            console.log(`🔥 Firebase: Stream ${streamId} updated`, data)
          }
        }, (err: any) => {
          if (!isMounted) return
          console.error('❌ Firebase stream error:', err)
          setError(err.message)
          setIsConnected(false)
        })

        listenerRef.current = { ref: streamRef, listener }
        console.log(`✅ Firebase: Listening to stream ${streamId}`)
      } catch (err: any) {
        console.error('❌ Firebase init error:', err)
        setError(err.message)
      }
    }

    // Firebase 초기화
    initFirebase()

    // Cleanup: 리스너 해제
    return () => {
      isMounted = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      
      if (listenerRef.current) {
        const { ref, listener } = listenerRef.current
        ref.off('value', listener)
        console.log(`🔌 Firebase: Disconnected from stream ${streamId}`)
      }
    }
  }, [streamId])

  return { streamData, isConnected, error }
}

/**
 * Firebase Realtime Database 상품 재고 구독 훅
 * 실시간 재고 변경 감지
 */
export function useFirebaseProduct(productId: number | null) {
  const [productData, setProductData] = useState<ProductData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const listenerRef = useRef<any>(null)

  useEffect(() => {
    if (!productId) return

    let isMounted = true
    let reconnectTimer: any = null

    const initFirebase = () => {
      try {
        // @ts-ignore
        if (typeof window.firebase === 'undefined') {
          console.log('⏳ Firebase SDK not loaded yet, retrying...')
          reconnectTimer = setTimeout(initFirebase, 500)
          return
        }

        // @ts-ignore
        const database = window.firebase.database()
        const productRef = database.ref(`products/product${productId}`)

        // 실시간 리스너 등록
        const listener = productRef.on('value', (snapshot: any) => {
          if (!isMounted) return

          const data = snapshot.val()
          if (data) {
            setProductData({
              id: data.id,
              name: data.name,
              price: data.price,
              original_price: data.original_price,
              discount_rate: data.discount_rate,
              stock: data.stock,
              image_url: data.image_url,
              updated_at: data.updated_at,
            })
            setIsConnected(true)
            setError(null)
            console.log(`🔥 Firebase: Product ${productId} updated - Stock: ${data.stock}`)
          }
        }, (err: any) => {
          if (!isMounted) return
          console.error('❌ Firebase product error:', err)
          setError(err.message)
          setIsConnected(false)
        })

        listenerRef.current = { ref: productRef, listener }
        console.log(`✅ Firebase: Listening to product ${productId}`)
      } catch (err: any) {
        console.error('❌ Firebase init error:', err)
        setError(err.message)
      }
    }

    // Firebase 초기화
    initFirebase()

    // Cleanup: 리스너 해제
    return () => {
      isMounted = false
      if (reconnectTimer) clearTimeout(reconnectTimer)
      
      if (listenerRef.current) {
        const { ref, listener } = listenerRef.current
        ref.off('value', listener)
        console.log(`🔌 Firebase: Disconnected from product ${productId}`)
      }
    }
  }, [productId])

  return { productData, isConnected, error }
}

/**
 * Firebase 연결 상태 모니터링 훅
 * 90명 연결 시 Discord 알림
 */
export function useFirebaseConnectionMonitor() {
  const [connectionCount, setConnectionCount] = useState(0)
  const hasWarned = useRef(false)

  useEffect(() => {
    let isMounted = true

    const initMonitor = () => {
      try {
        // @ts-ignore
        if (typeof window.firebase === 'undefined') {
          setTimeout(initMonitor, 1000)
          return
        }

        // @ts-ignore
        const database = window.firebase.database()
        const connectedRef = database.ref('.info/connected')

        connectedRef.on('value', (snapshot: any) => {
          if (!isMounted) return

          if (snapshot.val() === true) {
            setConnectionCount(prev => {
              const newCount = prev + 1
              
              // 90명 도달 시 Discord 알림 (1회만)
              if (newCount >= 90 && !hasWarned.current) {
                console.warn(`⚠️ Firebase 연결 수 ${newCount}명 도달! (한계: 100명)`)
                hasWarned.current = true
                
                // Discord Webhook 호출
                fetch('/api/internal/discord-alert', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    message: `⚠️ Firebase 연결 수 ${newCount}명 도달! (한계: 100명)\nSSE + KV 전환을 고려하세요.`,
                    type: 'warning',
                  }),
                }).catch(err => console.error('Discord alert failed:', err))
              }
              
              return newCount
            })
          }
        })
      } catch (err) {
        console.error('Firebase connection monitor error:', err)
      }
    }

    initMonitor()

    return () => {
      isMounted = false
    }
  }, [])

  return { connectionCount }
}

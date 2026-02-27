// Firebase 실시간 훅 (useFirebaseStream) - NPM SDK 버전
// src/hooks/useFirebaseStream.ts

import { useEffect, useState, useRef } from 'react'
import { ref, onValue, off, DatabaseReference } from 'firebase/database'
import database from '../lib/firebase-config'

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
  const streamRefObj = useRef<DatabaseReference | null>(null)

  useEffect(() => {
    if (!streamId) {
      setStreamData(null)
      setIsConnected(false)
      return
    }

    let isMounted = true

    try {
      // Firebase Realtime Database 참조 생성
      const streamRef = ref(database, `streams/stream${streamId}`)
      streamRefObj.current = streamRef

      console.log(`🔥 Firebase: Subscribing to stream ${streamId}...`)

      // 실시간 리스너 등록
      const unsubscribe = onValue(
        streamRef,
        (snapshot) => {
          if (!isMounted) return

          const data = snapshot.val()
          if (data) {
            setStreamData({
              id: data.id || streamId,
              title: data.title,
              status: data.status || 'ended',
              current_product_id: data.current_product_id,
              viewer_count: data.viewer_count || 0,
              updated_at: data.updated_at || Date.now(),
            })
            setIsConnected(true)
            setError(null)
            console.log(`✅ Firebase: Stream ${streamId} updated`, data)
          } else {
            console.log(`⚠️ Firebase: No data for stream ${streamId}`)
            setStreamData(null)
            setIsConnected(true) // 연결은 성공했지만 데이터가 없음
          }
        },
        (err) => {
          if (!isMounted) return
          console.error(`❌ Firebase stream error:`, err)
          setError(err.message)
          setIsConnected(false)
        }
      )

      console.log(`✅ Firebase: Listener attached to stream ${streamId}`)

      // Cleanup: 리스너 해제
      return () => {
        isMounted = false
        off(streamRef)
        console.log(`🔌 Firebase: Disconnected from stream ${streamId}`)
      }
    } catch (err: any) {
      console.error('❌ Firebase init error:', err)
      setError(err.message)
      setIsConnected(false)
    }
  }, [streamId])

  return { streamData, isConnected, error }
}

/**
 * Firebase Realtime Database 상품 구독 훅
 * 특정 상품의 재고를 실시간으로 구독
 */
export function useFirebaseProduct(productId: number | null) {
  const [productData, setProductData] = useState<ProductData | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const productRefObj = useRef<DatabaseReference | null>(null)

  useEffect(() => {
    if (!productId) {
      setProductData(null)
      setIsConnected(false)
      return
    }

    let isMounted = true

    try {
      // Firebase Realtime Database 참조 생성
      const productRef = ref(database, `products/product${productId}`)
      productRefObj.current = productRef

      console.log(`🔥 Firebase: Subscribing to product ${productId}...`)

      // 실시간 리스너 등록
      const unsubscribe = onValue(
        productRef,
        (snapshot) => {
          if (!isMounted) return

          const data = snapshot.val()
          if (data) {
            setProductData({
              id: data.id || productId,
              name: data.name,
              price: data.price,
              original_price: data.original_price,
              discount_rate: data.discount_rate,
              stock: data.stock || 0,
              image_url: data.image_url,
              updated_at: data.updated_at || Date.now(),
            })
            setIsConnected(true)
            setError(null)
            console.log(`✅ Firebase: Product ${productId} updated, stock=${data.stock}`)
          } else {
            console.log(`⚠️ Firebase: No data for product ${productId}`)
            setProductData(null)
            setIsConnected(true)
          }
        },
        (err) => {
          if (!isMounted) return
          console.error(`❌ Firebase product error:`, err)
          setError(err.message)
          setIsConnected(false)
        }
      )

      console.log(`✅ Firebase: Listener attached to product ${productId}`)

      // Cleanup: 리스너 해제
      return () => {
        isMounted = false
        off(productRef)
        console.log(`🔌 Firebase: Disconnected from product ${productId}`)
      }
    } catch (err: any) {
      console.error('❌ Firebase product init error:', err)
      setError(err.message)
      setIsConnected(false)
    }
  }, [productId])

  return { productData, isConnected, error }
}

/**
 * Firebase 연결 모니터링 훅
 * 동시 접속자 수가 90명 이상일 때 Discord 알림
 */
export function useFirebaseConnectionMonitor(streamId: number | null, threshold = 90) {
  const [viewerCount, setViewerCount] = useState(0)
  const alertSentRef = useRef(false)

  useEffect(() => {
    if (!streamId) return

    const streamRef = ref(database, `streams/stream${streamId}`)

    const unsubscribe = onValue(streamRef, (snapshot) => {
      const data = snapshot.val()
      if (data?.viewer_count) {
        setViewerCount(data.viewer_count)

        // 90명 이상일 때 Discord 알림 (한 번만)
        if (data.viewer_count >= threshold && !alertSentRef.current) {
          console.warn(`⚠️ High viewer count: ${data.viewer_count} viewers`)
          
          // Discord Webhook 호출 (선택사항)
          fetch('/api/discord/alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              message: `🔥 High traffic alert: Stream ${streamId} has ${data.viewer_count} viewers`,
              threshold,
              current: data.viewer_count,
            }),
          }).catch(console.error)

          alertSentRef.current = true
        }

        // 90명 미만으로 떨어지면 알림 리셋
        if (data.viewer_count < threshold) {
          alertSentRef.current = false
        }
      }
    })

    return () => {
      off(streamRef)
    }
  }, [streamId, threshold])

  return { viewerCount }
}

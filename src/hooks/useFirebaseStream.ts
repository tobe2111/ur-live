// Firebase 실시간 훅 (useFirebaseStream) - NPM SDK 버전
// Optimized: Lazy loading Firebase Database
// src/hooks/useFirebaseStream.ts

import { useEffect, useState, useRef } from 'react'
import type { DatabaseReference } from 'firebase/database'

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

    async function connectFirebase() {
      try {
        // Lazy load Firebase Database using new API
        const { getFirebaseDatabase } = await import('@/lib/firebase-config')
        const { ref, onValue, off } = await import('firebase/database')
        
        const database = await getFirebaseDatabase()
        
        // Firebase Realtime Database 참조 생성
        const streamRef = ref(database, `streams/stream${streamId}`)
        streamRefObj.current = streamRef

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
            } else {
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

        // Cleanup: 리스너 해제
        return () => {
          isMounted = false
          off(streamRef)
        }
      } catch (err: any) {
        if (!isMounted) return
        console.error('❌ Firebase init error:', err)
        setError(err.message)
        setIsConnected(false)
      }
    }

    const cleanup = connectFirebase()
    
    return () => {
      isMounted = false
      cleanup.then(fn => fn && fn())
    }
  }, [streamId])

  return { streamData, isConnected, error }
}

/**
 * Firebase Realtime Database 상품 구독 훅 (Lazy Loading)
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

    async function connectFirebase() {
      try {
        // Lazy load Firebase Database using the same pattern as useFirebaseStream
        const { getFirebaseDatabase } = await import('@/lib/firebase-config')
        const { ref, onValue, off } = await import('firebase/database')
        const database = await getFirebaseDatabase()
        
        // Firebase Realtime Database 참조 생성
        const productRef = ref(database, `products/product${productId}`)
        productRefObj.current = productRef

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
            } else {
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

        // Cleanup: 리스너 해제
        return () => {
          isMounted = false
          off(productRef)
        }
      } catch (err: any) {
        if (!isMounted) return
        console.error('❌ Firebase product init error:', err)
        setError(err.message)
        setIsConnected(false)
      }
    }

    const cleanup = connectFirebase()
    
    return () => {
      isMounted = false
      cleanup.then(fn => fn && fn())
    }
  }, [productId])

  return { productData, isConnected, error }
}

/**
 * Firebase 연결 모니터링 훅 (Lazy Loading)
 * 동시 접속자 수가 90명 이상일 때 Discord 알림
 */
export function useFirebaseConnectionMonitor(streamId: number | null, threshold = 90) {
  const [viewerCount, setViewerCount] = useState(0)
  const alertSentRef = useRef(false)

  useEffect(() => {
    if (!streamId) return

    let isMounted = true

    async function connectFirebase() {
      try {
        // Lazy load Firebase Database using new API
        const { getFirebaseDatabase } = await import('@/lib/firebase-config')
        const { ref, onValue, off } = await import('firebase/database')
        
        const database = await getFirebaseDatabase()
        
        const streamRef = ref(database, `streams/stream${streamId}`)

        const unsubscribe = onValue(streamRef, (snapshot) => {
          if (!isMounted) return

          const data = snapshot.val()
          if (data?.viewer_count) {
            setViewerCount(data.viewer_count)

            // threshold 이상일 때 내부 로깅만 (Discord 알림은 서버 크론에서 처리)
            if (data.viewer_count >= threshold && !alertSentRef.current) {
              if (import.meta.env.DEV) {
                console.warn(`⚠️ High viewer count: ${data.viewer_count} viewers (stream=${streamId})`)
              }
              alertSentRef.current = true
            }

            // threshold 미만으로 떨어지면 알림 리셋
            if (data.viewer_count < threshold) {
              alertSentRef.current = false
            }
          }
        })

        return () => {
          isMounted = false
          off(streamRef)
        }
      } catch (err) {
        console.error('❌ Firebase connection monitor error:', err)
      }
    }

    const cleanup = connectFirebase()
    
    return () => {
      isMounted = false
      cleanup.then(fn => fn && fn())
    }
  }, [streamId, threshold])

  return { viewerCount }
}

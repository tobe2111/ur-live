import { useState, useEffect } from 'react'
import { useFirebaseStream } from './useFirebaseStream'
import api from '@/lib/api'

/**
 * 🎯 스마트 재고 Hook - 시청자 수 기반 자동 전환
 * 
 * 동작:
 * - 시청자 < 100명: Firebase 실시간 재고 (0.2초)
 * - 시청자 >= 100명: D1 폴링 재고 (3초마다)
 * 
 * 급증 대응:
 * - Firebase 100명 제한 회피
 * - 무제한 확장 가능
 * - 비용 $0/월
 */
export function useSmartStock(
  productId: number,
  viewerCount: number = 0
) {
  const [stock, setStock] = useState<number | undefined>(undefined)
  const [mode, setMode] = useState<'firebase' | 'polling'>('firebase')
  
  // Firebase 실시간 재고
  const { streamData: productData } = useFirebaseStream(productId as number | null)
  
  // 시청자 수 기반 모드 전환
  useEffect(() => {
    if (viewerCount < 100 && mode !== 'firebase') {
      setMode('firebase')
    } else if (viewerCount >= 100 && mode !== 'polling') {
      setMode('polling')
    }
  }, [viewerCount])
  
  // Firebase 모드
  useEffect(() => {
    if (mode === 'firebase' && productData) {
      setStock((productData as any).stock)
    }
  }, [mode, productData])
  
  // 폴링 모드 (3초마다 D1 조회)
  useEffect(() => {
    if (mode !== 'polling') return
    
    let interval: NodeJS.Timeout
    
    const pollStock = async () => {
      try {
        const response = await api.get(`/api/products/${productId}`)
        setStock(response.data.stock)
      } catch (error) {
        console.error('[SmartStock] Polling error:', error)
      }
    }
    
    pollStock() // 즉시 실행
    interval = setInterval(pollStock, 3000) // 3초마다
    
    return () => clearInterval(interval)
  }, [mode, productId])
  
  return {
    stock,
    mode,
    isRealtime: mode === 'firebase'
  }
}

import { useState, useEffect, useCallback } from 'react'
import { useFirebaseChat, ChatMessage } from './useFirebaseChat'
import { useLiveChat } from './useLiveChat'

/**
 * 🎯 스마트 채팅 Hook - 시청자 수 기반 자동 전환
 * 
 * 동작 방식:
 * 1. 시청자 < 80명: Firebase 사용 (실시간, 0.2초)
 * 2. 시청자 80~100명: 경고 표시, Firebase 유지
 * 3. 시청자 > 100명: SSE 폴링 자동 전환 (5초 지연)
 * 
 * 급증 대응 전략:
 * - 시청자 수 실시간 모니터링
 * - 예방적 전환 (80명부터 준비)
 * - 무제한 확장 가능
 * 
 * 비용:
 * - 모든 모드 무료 (Firebase 무료 + Cloudflare Workers 무료)
 */
export interface UseSmartChatReturn {
  messages: ChatMessage[]
  isConnected: boolean
  error: string | null
  mode: 'firebase' | 'polling' | 'hybrid'
  viewerCount: number
  capacityWarning: boolean
  sendMessage: (message: string, userId: number, userName: string, userType: 'viewer' | 'streamer' | 'system') => Promise<void>
  clearMessages: () => void
}

export function useSmartChat(
  liveId: string | number,
  viewerCount: number = 0,
  enabled: boolean = true
): UseSmartChatReturn {
  const [mode, setMode] = useState<'firebase' | 'polling' | 'hybrid'>('firebase')
  const [capacityWarning, setCapacityWarning] = useState(false)
  
  // Firebase 채팅
  const firebaseChat = useFirebaseChat(liveId, enabled && mode !== 'polling')
  
  // SSE 폴링 채팅
  const pollingChat = useLiveChat(liveId, enabled && mode !== 'firebase')
  
  /**
   * 시청자 수 기반 모드 자동 전환
   */
  useEffect(() => {
    if (viewerCount < 80) {
      // 안전 범위: Firebase 사용
      if (mode !== 'firebase') {
        setMode('firebase')
        setCapacityWarning(false)
      }
    } else if (viewerCount >= 80 && viewerCount < 100) {
      // 경고 범위: Firebase 유지하되 경고 표시
      console.warn('[SmartChat] ⚠️ Approaching capacity limit:', viewerCount, '/ 100')
      setMode('firebase')
      setCapacityWarning(true)
    } else if (viewerCount >= 100) {
      // 위험 범위: SSE 폴링으로 전환
      console.warn('[SmartChat] 🔴 Capacity exceeded, switching to polling')
      setMode('polling')
      setCapacityWarning(true)
    }
  }, [viewerCount])
  
  /**
   * Firebase 오류 시 강제 전환
   */
  useEffect(() => {
    if (mode === 'firebase' && firebaseChat.error) {
      console.error('[SmartChat] 🚨 Firebase error, emergency switch to polling')
      setMode('polling')
    }
  }, [firebaseChat.error, mode])
  
  // 현재 활성 채팅 선택
  const activeChat = mode === 'firebase' ? firebaseChat : pollingChat
  
  return {
    ...activeChat,
    mode,
    viewerCount,
    capacityWarning
  }
}

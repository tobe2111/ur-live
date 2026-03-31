import { useState, useEffect } from 'react'
import { useFirebaseChat, ChatMessage } from './useFirebaseChat'
import { useLiveChat } from './useLiveChat'

/**
 * 🚀 적응형 채팅 Hook - 급증 대비 페일오버 시스템
 * 
 * 동작 방식:
 * 1. 기본: Firebase Realtime DB 사용 (0.2초, 무료)
 * 2. Firebase 100명 초과/오류 시: SSE 폴링으로 자동 전환 (5초, 무료)
 * 3. 사용자는 전환을 인지하지 못함 (동일한 인터페이스)
 * 
 * 급증 대응:
 * - Firebase 동시 100명 제한 회피
 * - 무제한 동시 접속 가능 (Cloudflare Workers)
 * - 비용 증가 없음 (둘 다 무료 범위)
 * 
 * 트레이드오프:
 * - Firebase: 0.2초 지연, 동시 100명
 * - SSE: 5초 지연, 무제한
 */
export interface UseAdaptiveChatReturn {
  messages: ChatMessage[]
  isConnected: boolean
  error: string | null
  mode: 'firebase' | 'polling'
  sendMessage: (message: string, userId: number, userName: string, userType: 'viewer' | 'streamer' | 'system') => Promise<void>
  clearMessages: () => void
}

export function useAdaptiveChat(
  liveId: string | number,
  enabled: boolean = true
): UseAdaptiveChatReturn {
  const [mode, setMode] = useState<'firebase' | 'polling'>('firebase')
  const [failoverTriggered, setFailoverTriggered] = useState(false)
  
  // Firebase 채팅 (기본)
  const firebaseChat = useFirebaseChat(liveId, enabled && mode === 'firebase')
  
  // SSE 폴링 채팅 (백업)
  const pollingChat = useLiveChat(liveId, enabled && mode === 'polling')
  
  /**
   * Firebase 오류 감지 및 자동 전환
   */
  useEffect(() => {
    if (mode === 'firebase' && firebaseChat.error && !failoverTriggered) {
      console.warn('[AdaptiveChat] 🚨 Firebase error detected, switching to polling mode')
      console.warn('[AdaptiveChat] Error:', firebaseChat.error)
      
      // Firebase → Polling 전환
      setMode('polling')
      setFailoverTriggered(true)
      
      // 사용자에게 알림 (선택사항)
      // alert('채팅이 안정 모드로 전환되었습니다. (약간의 지연이 있을 수 있습니다)')
    }
  }, [firebaseChat.error, mode, failoverTriggered])
  
  /**
   * Firebase 복구 감지 및 자동 복원
   */
  useEffect(() => {
    if (mode === 'polling' && firebaseChat.isConnected && !firebaseChat.error) {
      // 5분 후 Firebase로 복원 시도
      const timer = setTimeout(() => {
        setMode('firebase')
        setFailoverTriggered(false)
      }, 5 * 60 * 1000) // 5분
      
      return () => clearTimeout(timer)
    }
  }, [firebaseChat.isConnected, firebaseChat.error, mode])
  
  // 현재 활성화된 채팅 선택
  const activeChat = mode === 'firebase' ? firebaseChat : pollingChat
  
  return {
    ...activeChat,
    mode
  }
}

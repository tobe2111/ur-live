import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * 채팅 메시지 타입
 */
export interface ChatMessage {
  id: string
  userId: number
  userName: string
  userType: 'viewer' | 'streamer' | 'system'
  message: string
  timestamp: number
  isSeller?: boolean
  isAdmin?: boolean
  role?: string
  username?: string
}

/**
 * Hook 반환 타입
 */
export interface UseFirebaseChatReturn {
  messages: ChatMessage[]
  isConnected: boolean
  error: string | null
  sendMessage: (message: string, userId: number, userName: string, userType: 'viewer' | 'streamer' | 'system') => Promise<void>
  clearMessages: () => void
}

/**
 * 🔥 useFirebaseChat Hook
 * 
 * Firebase Realtime Database를 사용하여 실시간 채팅 메시지를 수신합니다.
 * 
 * Features:
 * - Firebase onValue로 실시간 메시지 수신 (0.2초 지연)
 * - 자동 재연결
 * - 에러 핸들링 및 연결 상태 관리
 * - 컴포넌트 언마운트 시 자동 정리
 * - Lazy loading for Firebase Database SDK (성능 최적화)
 * 
 * @param liveId - 라이브 스트림 ID
 * @param enabled - Firebase 연결 활성화 여부 (기본값: true)
 * @returns 채팅 메시지, 연결 상태, 메시지 전송 함수
 * 
 * @example
 * ```tsx
 * function ChatComponent({ streamId }) {
 *   const { messages, isConnected, sendMessage } = useFirebaseChat(streamId);
 * 
 *   return (
 *     <div>
 *       {messages.map(msg => <p key={msg.id}>{msg.message}</p>)}
 *       <button onClick={() => sendMessage('Hello!', userId, userName, 'viewer')}>
 *         Send
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useFirebaseChat(
  liveId: string | number,
  enabled: boolean = true
): UseFirebaseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const chatRefCache = useRef<any>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)

  /**
   * 메시지 전송 함수
   */
  const sendMessage = useCallback(async (
    message: string,
    userId: number,
    userName: string,
    userType: 'viewer' | 'streamer' | 'system'
  ) => {
    try {
      if (!message.trim()) {
        throw new Error('Message cannot be empty')
      }

      // Lazy load Firebase Database using new API
      const { getFirebaseDatabase } = await import('@/lib/firebase-config')
      const { ref, push, set } = await import('firebase/database')
      
      const database = await getFirebaseDatabase()
      const chatRef = ref(database, `chats/stream${liveId}`)
      const newMessageRef = push(chatRef)
      
      const timestamp = Date.now()
      const messageData = {
        id: timestamp,
        userId,
        userName,
        userType,
        message: message.trim(),
        timestamp,
        isSeller: userType === 'streamer',
        isAdmin: userType === 'system'
      }

      await set(newMessageRef, messageData)

    } catch (err) {
      console.error('[useFirebaseChat] ❌ 메시지 전송 오류:', err)
      throw err
    }
  }, [liveId])

  /**
   * 메시지 초기화
   */
  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  /**
   * Firebase 리스너 연결
   */
  useEffect(() => {
    if (!enabled) return

    // Lazy load Firebase Database
    const loadFirebaseDatabase = async () => {
      try {
        // Load Firebase Database instance using new API
        const { getFirebaseDatabase } = await import('@/lib/firebase-config')
        const { ref, onValue, query, orderByChild, limitToLast, off } = await import('firebase/database')
        
        const database = await getFirebaseDatabase()

        // Firebase Realtime Database 참조
        const chatRef = ref(database, `chats/stream${liveId}`)
        chatRefCache.current = chatRef

        // 최근 50개 메시지만 조회
        const chatQuery = query(
          chatRef,
          orderByChild('timestamp'),
          limitToLast(50)
        )

        // 실시간 리스너 등록
        const unsubscribe = onValue(
          chatQuery,
          (snapshot) => {
            if (snapshot.exists()) {
              const data = snapshot.val()
              const messagesArray: ChatMessage[] = Object.keys(data).map(key => ({
                id: key,
                userId: data[key].userId || 0,
                userName: data[key].userName || '익명',
                userType: data[key].userType || 'viewer',
                message: data[key].message || '',
                timestamp: data[key].timestamp || Date.now(),
                isSeller: data[key].isSeller || false,
                isAdmin: data[key].isAdmin || false
              }))

              // 시간 순 정렬
              messagesArray.sort((a, b) => a.timestamp - b.timestamp)
              
              setMessages(messagesArray)
              setIsConnected(true)
              setError(null)
              
              console.log(`[useFirebaseChat] ✅ Loaded ${messagesArray.length} messages`)
            } else {
              console.log('[useFirebaseChat] ℹ️ No messages yet')
              setMessages([])
              setIsConnected(true)
              setError(null)
            }
          },
          (err) => {
            console.error('[useFirebaseChat] ❌ Firebase error:', err)
            setError(err.message)
            setIsConnected(false)
          }
        )

        unsubscribeRef.current = unsubscribe

      } catch (err) {
        console.error('[useFirebaseChat] ❌ Firebase 연결 오류:', err)
        setError('채팅 연결 실패')
        setIsConnected(false)
      }
    }

    loadFirebaseDatabase()

    // 정리 함수
    return () => {
      console.log(`[useFirebaseChat] 🧹 Cleaning up Firebase listener for stream ${liveId}`)
      
      if (unsubscribeRef.current) {
        unsubscribeRef.current()
        unsubscribeRef.current = null
      }
      
      if (chatRefCache.current) {
        import('firebase/database').then(({ off }) => {
          off(chatRefCache.current)
          chatRefCache.current = null
        }).catch(err => {
          console.error('[useFirebaseChat] ❌ Error cleaning up Firebase:', err)
        })
      }
    }
  }, [liveId, enabled])

  return {
    messages,
    isConnected,
    error,
    sendMessage,
    clearMessages
  }
}

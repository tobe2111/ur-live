import { useState, useEffect, useCallback, useRef } from 'react';
import { getAccessToken } from '@/utils/auth';

/**
 * 채팅 메시지 타입
 */
export interface ChatMessage {
  id: string;
  userId: number;
  userName: string;
  userType: 'viewer' | 'streamer' | 'system';
  message: string;
  timestamp: number;
}

/**
 * Hook 반환 타입
 */
export interface UseLiveChatReturn {
  messages: ChatMessage[];
  isConnected: boolean;
  error: string | null;
  sendMessage: (message: string, userId: number, userName: string, userType: 'viewer' | 'streamer') => Promise<void>;
  clearMessages: () => void;
}

/**
 * 🔥 useLiveChat Hook
 * 
 * Server-Sent Events (SSE)를 사용하여 실시간 채팅 메시지를 수신합니다.
 * 
 * Features:
 * - EventSource로 실시간 메시지 수신
 * - 자동 재연결 (지수 백오프)
 * - 에러 핸들링 및 연결 상태 관리
 * - 컴포넌트 언마운트 시 자동 정리
 * 
 * @param liveId - 라이브 스트림 ID
 * @param enabled - SSE 연결 활성화 여부 (기본값: true)
 * @returns 채팅 메시지, 연결 상태, 메시지 전송 함수
 * 
 * @example
 * ```tsx
 * function ChatComponent({ streamId }) {
 *   const { messages, isConnected, sendMessage } = useLiveChat(streamId);
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
export function useLiveChat(
  liveId: string | number,
  enabled: boolean = true
): UseLiveChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const BASE_RECONNECT_DELAY = 1000; // 1초

  /**
   * 메시지 전송 함수
   */
  const sendMessage = useCallback(async (
    message: string,
    userId: number,
    userName: string,
    userType: 'viewer' | 'streamer'
  ) => {
    try {
      const accessToken = getAccessToken()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }
      
      // JWT 토큰이 있으면 Authorization 헤더 추가
      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`
      }
      
      const response = await fetch(`/api/live/${liveId}/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          user_id: userId,
          user_name: userName,
          user_type: userType,
          message: message.trim()
        })
      });

      if (!response.ok) {
        throw new Error('메시지 전송 실패');
      }
    } catch (err) {
      console.error('[useLiveChat] 메시지 전송 오류:', err);
      throw err;
    }
  }, [liveId]);

  /**
   * 메시지 초기화
   */
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  /**
   * SSE 연결 함수
   */
  const connect = useCallback(() => {
    if (!enabled) return;

    // 기존 연결 정리
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    try {
      // JWT 토큰을 쿼리 파라미터로 추가 (EventSource는 헤더를 지원하지 않음)
      const accessToken = getAccessToken()
      const sseUrl = accessToken 
        ? `/api/live/${liveId}/chat/sse?token=${encodeURIComponent(accessToken)}`
        : `/api/live/${liveId}/chat/sse`
      
      console.log('[useLiveChat] Connecting to SSE:', sseUrl.replace(/token=[^&]+/, 'token=***'))
      const eventSource = new EventSource(sseUrl);
      eventSourceRef.current = eventSource;

      // 연결 성공
      eventSource.onopen = () => {
        console.log('[useLiveChat] ✅ SSE 연결 성공');
        setIsConnected(true);
        setError(null);
        reconnectAttemptsRef.current = 0; // 재연결 카운터 초기화
      };

      // 메시지 수신
      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // 'ping' 메시지는 무시 (keep-alive용)
          if (data.type === 'ping') {
            return;
          }

          // SSE 서버 형식: { type: 'chat', data: [...messages], timestamp }
          if (data.type === 'chat' && data.data && Array.isArray(data.data)) {
            // 메시지 배열을 개별 메시지로 변환
            const formattedMessages = data.data.map((msg: any) => ({
              id: msg.id.toString(),
              userId: msg.user_id,
              userName: msg.user_name,
              userType: msg.is_seller ? 'streamer' : (msg.is_admin ? 'system' : 'viewer'),
              message: msg.message,
              timestamp: new Date(msg.created_at).getTime()
            }));
            
            setMessages(prev => [...prev, ...formattedMessages]);
            return;
          }

          // 레거시 형식 지원: { type: 'message', message: {...} }
          if (data.type === 'message' && data.message) {
            setMessages(prev => [...prev, data.message]);
          }
        } catch (err) {
          console.error('[useLiveChat] 메시지 파싱 오류:', err);
        }
      };

      // 에러 핸들링
      eventSource.onerror = (err) => {
        console.error('[useLiveChat] ❌ SSE 연결 오류:', err);
        setIsConnected(false);
        
        eventSource.close();
        eventSourceRef.current = null;

        // 지수 백오프로 재연결 시도
        if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
          const delay = BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
          reconnectAttemptsRef.current++;
          
          setError(`연결 끊김. ${delay/1000}초 후 재연결 시도 중... (${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`[useLiveChat] 🔄 재연결 시도 ${reconnectAttemptsRef.current}/${MAX_RECONNECT_ATTEMPTS}`);
            connect();
          }, delay);
        } else {
          setError('최대 재연결 시도 횟수 초과. 페이지를 새로고침해주세요.');
        }
      };

    } catch (err) {
      console.error('[useLiveChat] EventSource 생성 오류:', err);
      setError('채팅 연결 실패');
      setIsConnected(false);
    }
  }, [liveId, enabled]);

  /**
   * 초기 연결 및 정리
   */
  useEffect(() => {
    if (!enabled) return;

    connect();

    // 컴포넌트 언마운트 시 정리
    return () => {
      console.log('[useLiveChat] 🧹 정리 중...');
      
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [connect, enabled]);

  return {
    messages,
    isConnected,
    error,
    sendMessage,
    clearMessages
  };
}

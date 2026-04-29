import axios, { AxiosError } from 'axios'
import { logError } from './sentry'

// API 에러 타입
export interface ApiError {
  message: string
  code?: string
  status?: number
  details?: any
}

// 에러 메시지 매핑
const ERROR_MESSAGES: Record<string, string> = {
  // 인증 에러
  'Unauthorized': '로그인이 필요합니다.',
  'Invalid session': '세션이 만료되었습니다. 다시 로그인해주세요.',
  'Forbidden': '접근 권한이 없습니다.',
  
  // 주문/결제 에러
  'Insufficient stock': '재고가 부족합니다.',
  'Product not found': '상품을 찾을 수 없습니다.',
  'Order not found': '주문을 찾을 수 없습니다.',
  'Payment failed': '결제에 실패했습니다.',
  'Invalid payment': '유효하지 않은 결제 정보입니다.',
  
  // 사용자 에러
  'User not found': '사용자를 찾을 수 없습니다.',
  'Email already exists': '이미 가입된 이메일입니다.',
  'Invalid credentials': '아이디 또는 비밀번호가 올바르지 않습니다.',
  
  // 판매자 에러
  'Seller not found': '판매자를 찾을 수 없습니다.',
  'Business info required': '사업자 정보를 먼저 등록해주세요.',
  
  // 배송 에러
  'Shipping address required': '배송지를 선택해주세요.',
  'Invalid address': '유효하지 않은 배송지입니다.',
  
  // 일반 에러
  'Network Error': '네트워크 연결을 확인해주세요.',
  'Server Error': '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  'Bad Request': '잘못된 요청입니다.',
}

// 에러 코드별 메시지
const ERROR_CODE_MESSAGES: Record<number, string> = {
  400: '잘못된 요청입니다.',
  401: '로그인이 필요합니다.',
  403: '접근 권한이 없습니다.',
  404: '요청한 정보를 찾을 수 없습니다.',
  409: '이미 존재하는 정보입니다.',
  429: '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.',
  500: '서버 오류가 발생했습니다.',
  502: '서버에 연결할 수 없습니다.',
  503: '서비스를 일시적으로 사용할 수 없습니다.',
}

/**
 * API 에러를 사용자 친화적 메시지로 변환
 */
export function handleApiError(error: unknown): ApiError {
  // Axios 에러인 경우
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError<any>
    
    // 네트워크 에러
    if (!axiosError.response) {
      return {
        message: ERROR_MESSAGES['Network Error'],
        code: 'NETWORK_ERROR',
        status: 0,
      }
    }

    const { status, data } = axiosError.response
    
    // 서버에서 보낸 에러 메시지
    if (data?.error) {
      const errorMessage = data.error
      
      // 매핑된 메시지가 있으면 사용
      const mappedMessage = ERROR_MESSAGES[errorMessage]
      if (mappedMessage) {
        return {
          message: mappedMessage,
          code: errorMessage,
          status,
          details: data,
        }
      }
      
      // 없으면 서버 메시지 그대로 사용
      return {
        message: errorMessage,
        code: 'API_ERROR',
        status,
        details: data,
      }
    }

    // 상태 코드별 기본 메시지
    const statusMessage = ERROR_CODE_MESSAGES[status]
    if (statusMessage) {
      return {
        message: statusMessage,
        code: `HTTP_${status}`,
        status,
      }
    }

    // 기타 에러
    return {
      message: '알 수 없는 오류가 발생했습니다.',
      code: 'UNKNOWN_ERROR',
      status,
    }
  }

  // 일반 Error 객체
  if (error instanceof Error) {
    // 매핑된 메시지가 있으면 사용
    const mappedMessage = ERROR_MESSAGES[error.message]
    if (mappedMessage) {
      return {
        message: mappedMessage,
        code: error.message,
      }
    }

    return {
      message: error.message || '오류가 발생했습니다.',
      code: 'ERROR',
    }
  }

  // 기타
  return {
    message: '알 수 없는 오류가 발생했습니다.',
    code: 'UNKNOWN',
  }
}

/**
 * API 에러를 로깅하고 사용자 친화적 메시지 반환
 */
export function logAndFormatError(error: unknown, context?: Record<string, any>): string {
  const apiError = handleApiError(error)
  
  // Sentry에 로깅 (Mock 모드에서는 콘솔 로그)
  if (error instanceof Error) {
    logError(error, {
      ...context,
      apiError,
    })
  } else {
    console.error('🔴 API Error:', apiError, context)
  }

  return apiError.message
}

/**
 * Try-Catch로 감싼 안전한 API 호출
 */
export async function safeApiCall<T>(
  apiCall: () => Promise<T>,
  context?: Record<string, any>
): Promise<{ data: T | null; error: ApiError | null }> {
  try {
    const data = await apiCall()
    return { data, error: null }
  } catch (error) {
    const apiError = handleApiError(error)
    
    // 에러 로깅
    if (error instanceof Error) {
      logError(error, { ...context, apiError })
    }

    return { data: null, error: apiError }
  }
}

// 🛡️ 2026-04-29: checkAuthError 제거 — caller 0건 (죽은 코드). 또한
//   returnUrl 화이트리스트 누락으로 /login → /login?returnUrl=/login 자기참조
//   루프 가능했음. 401 핸들링은 lib/api.ts interceptor 가 단일 책임.

/**
 * 에러 Toast 표시를 위한 헬퍼
 */
export function showErrorToast(error: unknown, context?: Record<string, any>): string {
  const message = logAndFormatError(error, context)

  // CustomModal이나 Toast 라이브러리와 연동
  // 여기서는 메시지만 반환
  return message
}

// ── 사용자-친화적 에러 메시지 ──────────────────────────────────────────────
// 서버 에러 메시지에 DB 제약조건, SQL, 스택 트레이스 등 민감한 내부 정보가
// 노출될 수 있으므로 toast에 그대로 표시하지 않는다. 알려진 code를 우선
// 매핑하고, 길이/위험 패턴을 걸러낸 뒤에만 서버 메시지를 그대로 사용한다.

const KNOWN_ERROR_CODES: Record<string, string> = {
  INSUFFICIENT_BALANCE: '잔액이 부족합니다.',
  OUT_OF_STOCK: '재고가 부족합니다.',
  INVALID_COUPON: '쿠폰이 유효하지 않습니다.',
  PAYMENT_KEY_MISSING: '결제 정보를 찾을 수 없습니다. 고객센터에 문의해 주세요.',
  CIRCUIT_OPEN: '결제 시스템이 일시 중단됐습니다. 잠시 후 다시 시도해주세요.',
  ALREADY_CANCELED_PAYMENT: '이미 취소된 결제입니다.',
  EXCEED_CANCEL_AMOUNT: '환불 금액이 결제 금액을 초과합니다.',
  NOT_CANCELABLE_PAYMENT: '취소할 수 없는 결제입니다.',
  FORBIDDEN_CONSECUTIVE_REQUEST: '잠시 후 다시 시도해 주세요.',
}

// 민감한 내부 정보가 들어 있을 수 있는 패턴
const UNSAFE_MESSAGE_PATTERNS =
  /\b(SQL|SQLITE|CONSTRAINT|TypeError|ReferenceError|undefined is not|Cannot read|stack|at \w+\s*\()\b/i

/**
 * 사용자에게 보여주기 안전한 에러 메시지로 변환.
 * - 알려진 code는 한국어 고정 메시지로 매핑
 * - axios 에러의 경우 기존 handleApiError 로직으로 정규화
 * - DB 제약/스택 트레이스 등 패턴이 보이면 일반 메시지로 대체
 */
export function getUserFriendlyError(error: unknown, fallback = '요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'): string {
  // axios 에러 우선 처리 (data.code / data.error 접근)
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as { code?: string; error?: string } | undefined
    if (data?.code && KNOWN_ERROR_CODES[data.code]) {
      return KNOWN_ERROR_CODES[data.code]
    }
    if (typeof data?.error === 'string') {
      const msg = data.error
      if (msg.length < 200 && !UNSAFE_MESSAGE_PATTERNS.test(msg)) {
        return msg
      }
    }
    const status = error.response?.status
    if (status && ERROR_CODE_MESSAGES[status]) {
      return ERROR_CODE_MESSAGES[status]
    }
    return fallback
  }

  // 일반 객체/에러에서 code/message 추출
  const e = error as { code?: string; message?: string } | null | undefined
  if (e?.code && KNOWN_ERROR_CODES[e.code]) {
    return KNOWN_ERROR_CODES[e.code]
  }
  const msg = typeof e?.message === 'string' ? e.message : ''
  if (msg && msg.length < 200 && !UNSAFE_MESSAGE_PATTERNS.test(msg)) {
    return msg
  }
  return fallback
}

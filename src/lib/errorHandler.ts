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

/**
 * 인증 에러 체크 (자동 로그인 페이지 이동)
 */
export function checkAuthError(error: unknown): boolean {
  const apiError = handleApiError(error)
  
  if (apiError.status === 401 || apiError.code === 'Unauthorized') {
    // 로그인 페이지로 이동
    const returnUrl = encodeURIComponent(window.location.pathname)
    window.location.href = `/login?returnUrl=${returnUrl}`
    return true
  }

  return false
}

/**
 * 에러 Toast 표시를 위한 헬퍼
 */
export function showErrorToast(error: unknown, context?: Record<string, any>): string {
  const message = logAndFormatError(error, context)
  
  // CustomModal이나 Toast 라이브러리와 연동
  // 여기서는 메시지만 반환
  return message
}

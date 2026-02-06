/**
 * API 에러 처리 유틸리티
 * 사용자에게 친화적인 에러 메시지를 제공합니다.
 */

export interface ApiError {
  success: false
  error: string
  message?: string
  stack?: string
}

/**
 * Axios 에러를 사용자 친화적인 메시지로 변환
 */
export function getErrorMessage(error: any): string {
  // Axios 에러 구조 확인
  if (error.response) {
    const status = error.response.status
    const data = error.response.data as ApiError
    
    // 서버에서 제공한 에러 메시지 우선 사용
    if (data && data.error) {
      return data.error
    }
    
    // HTTP 상태 코드에 따른 기본 메시지
    switch (status) {
      case 400:
        return '잘못된 요청입니다. 입력 내용을 확인해주세요.'
      case 401:
        return '로그인이 필요합니다.'
      case 403:
        return '접근 권한이 없습니다.'
      case 404:
        return '요청하신 정보를 찾을 수 없습니다.'
      case 409:
        return '이미 존재하는 데이터입니다.'
      case 422:
        return '입력한 정보가 올바르지 않습니다.'
      case 429:
        return '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.'
      case 500:
        return '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
      case 502:
      case 503:
      case 504:
        return '서비스가 일시적으로 불안정합니다. 잠시 후 다시 시도해주세요.'
      default:
        return '알 수 없는 오류가 발생했습니다.'
    }
  }
  
  // 네트워크 에러
  if (error.request) {
    return '네트워크 연결을 확인해주세요.'
  }
  
  // 기타 에러
  return error.message || '오류가 발생했습니다.'
}

/**
 * 에러 토스트 표시 (간단한 알림)
 */
export function showErrorToast(error: any) {
  const message = getErrorMessage(error)
  
  // 간단한 alert (나중에 toast 라이브러리로 교체 가능)
  alert(message)
  
  // 콘솔에 상세 정보 기록
  console.error('[API Error]', {
    message,
    error: error.response?.data || error.message,
    status: error.response?.status,
    url: error.config?.url
  })
}

/**
 * 로그인 필요 여부 확인
 */
export function requiresLogin(error: any): boolean {
  return error.response?.status === 401
}

/**
 * 로그인 페이지로 리다이렉트
 */
export function redirectToLogin() {
  const currentPath = window.location.pathname + window.location.search
  window.location.href = `/seller/login?redirect=${encodeURIComponent(currentPath)}`
}

/**
 * API 호출 래퍼 (자동 에러 처리)
 */
export async function apiCall<T>(
  apiFunction: () => Promise<T>,
  options?: {
    showError?: boolean
    autoLoginRedirect?: boolean
  }
): Promise<T | null> {
  const { showError = true, autoLoginRedirect = false } = options || {}
  
  try {
    return await apiFunction()
  } catch (error: any) {
    // 로그인 필요 시 자동 리다이렉트
    if (autoLoginRedirect && requiresLogin(error)) {
      redirectToLogin()
      return null
    }
    
    // 에러 토스트 표시
    if (showError) {
      showErrorToast(error)
    }
    
    throw error
  }
}

/**
 * 에러 바운더리를 위한 헬퍼
 */
export class AppError extends Error {
  statusCode?: number
  originalError?: any
  
  constructor(message: string, statusCode?: number, originalError?: any) {
    super(message)
    this.name = 'AppError'
    this.statusCode = statusCode
    this.originalError = originalError
  }
}

/**
 * 표준화된 에러 응답 타입 및 헬퍼 함수
 */

/**
 * API 에러 코드
 */
export enum ErrorCode {
  // 인증/권한 관련
  AUTH_REQUIRED = 'AUTH_REQUIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  ADMIN_ONLY = 'ADMIN_ONLY',
  SELLER_ONLY = 'SELLER_ONLY',
  
  // 리소스 관련
  PRODUCT_NOT_FOUND = 'PRODUCT_NOT_FOUND',
  STREAM_NOT_FOUND = 'STREAM_NOT_FOUND',
  ORDER_NOT_FOUND = 'ORDER_NOT_FOUND',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  
  // 비즈니스 로직 관련
  INSUFFICIENT_STOCK = 'INSUFFICIENT_STOCK',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  SELLER_NOT_APPROVED = 'SELLER_NOT_APPROVED',
  DUPLICATE_EMAIL = 'DUPLICATE_EMAIL',
  INVALID_INPUT = 'INVALID_INPUT',
  
  // 시스템 관련
  DATABASE_ERROR = 'DATABASE_ERROR',
  NETWORK_ERROR = 'NETWORK_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * 표준 에러 응답 인터페이스
 */
export interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode | string;
    message: string;
    details?: string; // 개발 환경에서만 포함
  };
}

/**
 * 표준 성공 응답 인터페이스
 */
export interface SuccessResponse<T = any> {
  success: true;
  data: T;
  cached?: boolean;
}

/**
 * 에러 코드별 사용자 친화적 메시지 매핑
 */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // 인증/권한
  [ErrorCode.AUTH_REQUIRED]: '로그인이 필요합니다',
  [ErrorCode.INVALID_CREDENTIALS]: '이메일 또는 비밀번호가 일치하지 않습니다',
  [ErrorCode.SESSION_EXPIRED]: '세션이 만료되었습니다. 다시 로그인해주세요',
  [ErrorCode.ADMIN_ONLY]: '관리자 권한이 필요합니다',
  [ErrorCode.SELLER_ONLY]: '판매자 권한이 필요합니다',
  
  // 리소스
  [ErrorCode.PRODUCT_NOT_FOUND]: '상품을 찾을 수 없습니다',
  [ErrorCode.STREAM_NOT_FOUND]: '라이브 스트림을 찾을 수 없습니다',
  [ErrorCode.ORDER_NOT_FOUND]: '주문을 찾을 수 없습니다',
  [ErrorCode.USER_NOT_FOUND]: '사용자를 찾을 수 없습니다',
  
  // 비즈니스 로직
  [ErrorCode.INSUFFICIENT_STOCK]: '재고가 부족합니다',
  [ErrorCode.PAYMENT_FAILED]: '결제에 실패했습니다',
  [ErrorCode.SELLER_NOT_APPROVED]: '승인 대기 중인 판매자입니다',
  [ErrorCode.DUPLICATE_EMAIL]: '이미 가입된 이메일입니다',
  [ErrorCode.INVALID_INPUT]: '입력값이 올바르지 않습니다',
  
  // 시스템
  [ErrorCode.DATABASE_ERROR]: '데이터베이스 오류가 발생했습니다',
  [ErrorCode.NETWORK_ERROR]: '네트워크 오류가 발생했습니다',
  [ErrorCode.UNKNOWN_ERROR]: '알 수 없는 오류가 발생했습니다',
};

/**
 * 표준화된 에러 응답 생성
 * 
 * @param code 에러 코드
 * @param customMessage 커스텀 메시지 (선택)
 * @param details 디버그 정보 (개발 환경에서만 포함)
 * @returns ErrorResponse 객체
 */
export function createErrorResponse(
  code: ErrorCode,
  customMessage?: string,
  details?: string
): ErrorResponse {
  const message = customMessage || ERROR_MESSAGES[code];
  
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
    },
  };
  
  // 개발 환경에서만 details 포함
  if (details && process.env.NODE_ENV === 'development') {
    response.error.details = details;
  }
  
  return response;
}

/**
 * 표준화된 성공 응답 생성
 * 
 * @param data 응답 데이터
 * @param cached 캐시 여부
 * @returns SuccessResponse 객체
 */
export function createSuccessResponse<T>(
  data: T,
  cached?: boolean
): SuccessResponse<T> {
  const response: SuccessResponse<T> = {
    success: true,
    data,
  };
  
  if (cached !== undefined) {
    response.cached = cached;
  }
  
  return response;
}

/**
 * HTTP 상태 코드 매핑
 */
export const ERROR_STATUS_CODES: Record<ErrorCode, number> = {
  // 400 Bad Request
  [ErrorCode.INVALID_INPUT]: 400,
  [ErrorCode.DUPLICATE_EMAIL]: 400,
  
  // 401 Unauthorized
  [ErrorCode.AUTH_REQUIRED]: 401,
  [ErrorCode.INVALID_CREDENTIALS]: 401,
  [ErrorCode.SESSION_EXPIRED]: 401,
  
  // 403 Forbidden
  [ErrorCode.ADMIN_ONLY]: 403,
  [ErrorCode.SELLER_ONLY]: 403,
  [ErrorCode.SELLER_NOT_APPROVED]: 403,
  
  // 404 Not Found
  [ErrorCode.PRODUCT_NOT_FOUND]: 404,
  [ErrorCode.STREAM_NOT_FOUND]: 404,
  [ErrorCode.ORDER_NOT_FOUND]: 404,
  [ErrorCode.USER_NOT_FOUND]: 404,
  
  // 422 Unprocessable Entity
  [ErrorCode.INSUFFICIENT_STOCK]: 422,
  [ErrorCode.PAYMENT_FAILED]: 422,
  
  // 500 Internal Server Error
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.NETWORK_ERROR]: 500,
  [ErrorCode.UNKNOWN_ERROR]: 500,
};

/**
 * 에러 응답과 함께 적절한 HTTP 상태 코드 반환
 */
export function getStatusCode(code: ErrorCode): number {
  return ERROR_STATUS_CODES[code] || 500;
}

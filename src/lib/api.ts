/**
 * 중앙화된 API 클라이언트
 * 
 * 기능:
 * - 자동 인증 토큰 추가 (Authorization: Bearer)
 * - 401 에러 시 자동 로그아웃
 * - 에러 핸들링 표준화
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

// API 클라이언트 생성
const api = axios.create({
  baseURL: '/',  // Root path, we'll use full paths like '/api/streams'
  timeout: 10000, // 10초 타임아웃
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 요청 인터셉터: 자동 인증 토큰 추가
 * 
 * 현재 사용자 타입에 따라 올바른 토큰 선택
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // 현재 사용자 타입 확인
    const userType = localStorage.getItem('user_type')
    let token: string | null = null
    
    // 사용자 타입에 따라 올바른 토큰 선택
    if (userType === 'seller') {
      token = localStorage.getItem('seller_session_token')
      console.log('[API] Using seller token for request')
    } else if (userType === 'admin') {
      token = localStorage.getItem('admin_session_token')
      console.log('[API] Using admin token for request')
    } else {
      // user 또는 기본
      token = localStorage.getItem('user_session_token')
      console.log('[API] Using user token for request')
    }
    
    if (token && config.headers) {
      // 서버는 X-Session-Token 헤더를 사용함
      config.headers['X-Session-Token'] = token
      console.log('[API] Token attached:', token.substring(0, 20) + '...')
    } else {
      console.warn('[API] No token found for user_type:', userType)
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 응답 인터셉터: 401 에러 시 자동 로그아웃
 */
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // 401 Unauthorized: 세션 만료
    if (error.response?.status === 401) {
      console.warn('[API] 인증 실패 - 로그아웃 처리');
      
      // 모든 세션 토큰 제거
      localStorage.removeItem('user_session_token');
      localStorage.removeItem('seller_session_token');
      localStorage.removeItem('admin_session_token');
      localStorage.removeItem('user_type');
      localStorage.removeItem('user_id');
      
      // 현재 페이지가 로그인 페이지가 아닐 때만 리다이렉트
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login')) {
        // 사용자 타입에 따라 다른 로그인 페이지로 리다이렉트
        if (currentPath.includes('/seller')) {
          window.location.href = '/seller/login';
        } else if (currentPath.includes('/admin')) {
          window.location.href = '/admin/login';
        } else {
          window.location.href = '/login';
        }
      }
    }
    
    // 403 Forbidden: 권한 없음
    if (error.response?.status === 403) {
      console.warn('[API] 권한 없음');
      alert('접근 권한이 없습니다.');
    }
    
    // 500 Internal Server Error
    if (error.response?.status === 500) {
      console.error('[API] 서버 오류:', error.response.data);
    }
    
    return Promise.reject(error);
  }
);

/**
 * 사용자 친화적 에러 메시지 매핑
 */
export const ERROR_MESSAGES: Record<string, string> = {
  'AUTH_REQUIRED': '로그인이 필요합니다',
  'INVALID_CREDENTIALS': '이메일 또는 비밀번호가 일치하지 않습니다',
  'PRODUCT_NOT_FOUND': '상품을 찾을 수 없습니다',
  'STREAM_NOT_FOUND': '라이브 스트림을 찾을 수 없습니다',
  'INSUFFICIENT_STOCK': '재고가 부족합니다',
  'PAYMENT_FAILED': '결제에 실패했습니다',
  'ORDER_NOT_FOUND': '주문을 찾을 수 없습니다',
  'SELLER_NOT_APPROVED': '승인 대기 중인 판매자입니다',
  'ADMIN_ONLY': '관리자 권한이 필요합니다',
  'SELLER_ONLY': '판매자 권한이 필요합니다',
  'NETWORK_ERROR': '네트워크 오류가 발생했습니다',
  'TIMEOUT': '요청 시간이 초과되었습니다',
};

/**
 * 에러에서 사용자 친화적 메시지 추출
 */
export function getErrorMessage(error: any): string {
  // Axios 에러 처리
  if (axios.isAxiosError(error)) {
    const errorCode = error.response?.data?.error?.code;
    
    // 에러 코드가 있으면 매핑된 메시지 반환
    if (errorCode && ERROR_MESSAGES[errorCode]) {
      return ERROR_MESSAGES[errorCode];
    }
    
    // 백엔드에서 제공한 메시지 사용
    if (error.response?.data?.error?.message) {
      return error.response.data.error.message;
    }
    
    // 네트워크 오류
    if (error.code === 'ECONNABORTED') {
      return ERROR_MESSAGES.TIMEOUT;
    }
    
    if (!error.response) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
  }
  
  // 기본 메시지
  return '오류가 발생했습니다. 다시 시도해주세요.';
}

export default api;

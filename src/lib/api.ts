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
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
  },
});

/**
 * 요청 인터셉터: 자동 JWT 토큰 추가
 * 
 * JWT Access Token을 Authorization Bearer 헤더로 전송
 * 토큰 만료 시 Refresh Token으로 자동 갱신
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // ✅ JWT Access Token 사용
    const accessToken = localStorage.getItem('access_token')
    
    if (accessToken && config.headers) {
      // Bearer 토큰 형식으로 전송
      config.headers['Authorization'] = `Bearer ${accessToken}`
      console.log('[API] JWT token attached:', accessToken.substring(0, 20) + '...')
    } else {
      console.warn('[API] No JWT token found')
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * 응답 인터셉터: 401 에러 시 JWT 토큰 갱신 또는 로그아웃
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // 401 Unauthorized: 토큰 만료 또는 권한 부족
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // 🔧 1. 먼저 에러 응답에서 권한 문제인지 확인
      const errorData = error.response?.data as any;
      const errorMessage = errorData?.error || '';
      
      // 🔧 2. 권한 문제(userType 불일치)인 경우 토큰 갱신하지 않고 로그아웃
      if (errorMessage.includes('권한') || errorMessage.includes('admin') || errorMessage.includes('seller')) {
        console.error('[API] ❌ Permission denied (userType mismatch):', errorMessage);
        console.warn('[API] 권한 불일치 - 로그아웃 처리');
        
        // localStorage 완전 클리어
        localStorage.clear();
        
        // 현재 페이지에 따라 리다이렉트
        const currentPath = window.location.pathname;
        if (currentPath.includes('/admin')) {
          alert('관리자 권한이 필요합니다. 다시 로그인해주세요.');
          window.location.href = '/admin/login';
        } else if (currentPath.includes('/seller')) {
          alert('판매자 권한이 필요합니다. 다시 로그인해주세요.');
          window.location.href = '/seller/login';
        } else {
          window.location.href = '/login';
        }
        
        return Promise.reject(error);
      }
      
      // 🔧 3. 토큰 만료인 경우에만 갱신 시도
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (refreshToken) {
        try {
          console.log('[API] Access token expired, refreshing...');
          
          // Refresh Token으로 새 Access Token 발급
          const response = await axios.post('/api/auth/refresh', {
            refreshToken
          });
          
          if (response.data.success) {
            const newAccessToken = response.data.data.accessToken;
            localStorage.setItem('access_token', newAccessToken);
            
            console.log('[API] ✅ Token refreshed successfully');
            
            // 원래 요청에 새 토큰 적용하여 재시도
            if (originalRequest.headers) {
              originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`;
            }
            
            return api(originalRequest);
          }
        } catch (refreshError) {
          console.error('[API] ❌ Token refresh failed:', refreshError);
          // Refresh 실패 시 로그아웃
        }
      }
      
      // Refresh Token이 없거나 갱신 실패 시 로그아웃
      console.warn('[API] 인증 실패 - 로그아웃 처리');
      
      // localStorage 완전 클리어
      localStorage.clear();
      
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

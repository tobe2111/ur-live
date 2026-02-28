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
 * 공개 API 엔드포인트 (JWT 불필요)
 * 비회원도 접근 가능한 페이지용 API
 */
const PUBLIC_API_PATHS = [
  '/api/streams',              // 라이브 스트림 목록
  '/api/streams/',             // 특정 스트림 조회
  '/api/products',             // 상품 목록
  '/api/products/',            // 특정 상품 조회
  '/api/banners',              // 배너 목록
  '/api/categories',           // 카테고리
  '/api/health',               // 헬스 체크
  '/api/auth/login',           // 로그인
  '/api/auth/register',        // 회원가입
  '/api/auth/refresh',         // 토큰 갱신
];

/**
 * 공개 API 경로 체크
 */
function isPublicAPI(url: string): boolean {
  return PUBLIC_API_PATHS.some(path => url.startsWith(path));
}

/**
 * 요청 인터셉터: 자동 인증 토큰 추가
 * 
 * 기본: Firebase ID Token (일반 유저)
 * 예외: JWT Access Token (/admin, /seller 경로만)
 */
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (!config.headers) return config;
    
    const currentPath = window.location.pathname;
    const isAdminOrSeller = currentPath.startsWith('/admin') || currentPath.startsWith('/seller');
    
    // 🔐 인증 토큰 추가
    if (isAdminOrSeller) {
      // 셀러/관리자: JWT 토큰
      const jwtToken = localStorage.getItem('access_token');
      if (jwtToken) {
        config.headers['Authorization'] = `Bearer ${jwtToken}`;
        console.log('[API] 🔑 JWT token (seller/admin)');
      }
    } else {
      // 일반 유저: Firebase ID Token
      const firebaseToken = localStorage.getItem('firebase_token');
      if (firebaseToken) {
        config.headers['Authorization'] = `Bearer ${firebaseToken}`;
        console.log('[API] 🔥 Firebase token (user)');
      } else if (!isPublicAPI(config.url || '')) {
        console.warn('[API] ⚠️ No token for protected API:', config.url);
      }
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 응답 인터셉터: 401 에러 시 토큰 갱신 또는 로그아웃
 * 
 * 일반 유저: Firebase Auth가 자동 처리 → 로그아웃
 * 셀러/관리자: JWT 토큰 갱신 시도
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    // 401 Unauthorized 처리
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // 1️⃣ 공개 API는 401 무시
      if (isPublicAPI(originalRequest.url || '')) {
        console.log('[API] Public API - 401 ignored');
        return Promise.reject(error);
      }
      
      const currentPath = window.location.pathname;
      const isAdminOrSeller = currentPath.startsWith('/admin') || currentPath.startsWith('/seller');
      
      // 2️⃣ 권한 문제 체크
      const errorData = error.response?.data as any;
      const errorMessage = errorData?.error || '';
      
      if (errorMessage.includes('권한') || errorMessage.includes('admin') || errorMessage.includes('seller')) {
        console.error('[API] ❌ Permission denied');
        localStorage.clear();
        
        if (isAdminOrSeller) {
          alert(currentPath.includes('/admin') ? '관리자 권한이 필요합니다.' : '판매자 권한이 필요합니다.');
          window.location.href = currentPath.includes('/admin') ? '/admin/login' : '/seller/login';
        } else {
          window.location.href = '/login';
        }
        
        return Promise.reject(error);
      }
      
      // 3️⃣ 셀러/관리자: JWT 토큰 갱신 시도
      if (isAdminOrSeller) {
        const refreshToken = localStorage.getItem('refresh_token');
        
        if (refreshToken) {
          try {
            console.log('[API] JWT token expired, refreshing...');
            const response = await axios.post('/api/auth/refresh', { refreshToken });
            
            if (response.data.success) {
              const newToken = response.data.data.accessToken;
              localStorage.setItem('access_token', newToken);
              
              // 재시도
              if (originalRequest.headers) {
                originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
              }
              return api(originalRequest);
            }
          } catch (err) {
            console.error('[API] JWT refresh failed');
          }
        }
        
        // Refresh 실패 → 로그아웃
        localStorage.clear();
        window.location.href = currentPath.includes('/admin') ? '/admin/login' : '/seller/login';
        return Promise.reject(error);
      }
      
      // 4️⃣ 일반 유저: Firebase Auth가 토큰 자동 갱신
      // 401 = 진짜 로그아웃 → 로그인 페이지로
      console.warn('[API] Firebase auth failed - redirecting to login');
      localStorage.removeItem('firebase_token');
      localStorage.removeItem('user_type');
      
      if (!currentPath.includes('/login')) {
        window.location.href = '/login';
      }
    }
    
    // 403 Forbidden
    if (error.response?.status === 403) {
      console.warn('[API] 접근 권한 없음');
      alert('접근 권한이 없습니다.');
    }
    
    // 500 Server Error
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

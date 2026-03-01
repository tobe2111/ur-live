/**
 * 중앙화된 API 클라이언트
 * 
 * 기능:
 * - 100% Firebase ID Token 기반 인증 (JWT 완전 제거)
 * - 자동 인증 토큰 추가 (Authorization: Bearer <Firebase_ID_Token>)
 * - 401 에러 시 자동 로그아웃
 * - 에러 핸들링 표준화
 * 
 * 인증 방식:
 * - 모든 사용자(일반/셀러/관리자): Firebase ID Token 단일 사용
 * - Custom Claims로 권한 구분 (role: user, seller, admin)
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { auth } from './firebase';

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
 * 공개 API 엔드포인트 (Firebase ID Token 불필요)
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
  '/api/auth/login',           // 로그인 (deprecated - Firebase 사용)
  '/api/auth/register',        // 회원가입 (deprecated - Firebase 사용)
  '/api/auth/kakao',           // 카카오 로그인 (모든 카카오 엔드포인트)
  '/api/auth/firebase/sync',   // Firebase 동기화 (인증 프로세스의 일부)
  '/api/auth/firebase/register', // Firebase 회원가입
];

/**
 * 공개 API 경로 체크
 */
function isPublicAPI(url: string): boolean {
  return PUBLIC_API_PATHS.some(path => url.startsWith(path));
}

/**
 * 요청 인터셉터: Firebase ID Token 자동 추가
 * 
 * 🔥 핵심 변경: localStorage 대신 Firebase Auth 객체에서 직접 ID Token 가져오기
 * - Custom Token 문제 해결 (localStorage에 Custom Token이 저장되는 경우 방지)
 * - 항상 최신 ID Token 사용 (자동 갱신)
 * - auth.currentUser가 null일 때 Firebase Auth 초기화 대기
 */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!config.headers) return config;
    
    // 공개 API는 토큰 불필요
    if (isPublicAPI(config.url || '')) {
      return config;
    }
    
    // 🔥 Firebase Auth에서 직접 ID Token 가져오기
    try {
      let user = auth.currentUser;
      
      // ✅ auth.currentUser가 null이면 onAuthStateChanged로 대기 (최대 3초)
      if (!user) {
        console.log('[API] ⏳ Waiting for Firebase Auth initialization...');
        user = await new Promise<typeof auth.currentUser>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('[API] ⚠️ Firebase Auth initialization timeout (3s)');
            resolve(null);
          }, 3000);
          
          const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            clearTimeout(timeout);
            unsubscribe();
            resolve(currentUser);
          });
        });
      }
      
      if (user) {
        const idToken = await user.getIdToken(true); // force refresh = true
        
        // 🚨 DEBUGGING: 토큰 타입 확인 (Custom Token vs ID Token)
        try {
          const parts = idToken.split('.');
          if (parts.length === 3) {
            const payloadBase64 = parts[1];
            const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'));
            const payload = JSON.parse(payloadJson);
            
            console.log('[API] 🔍 Token Payload:', {
              iss: payload.iss,
              aud: payload.aud,
              sub: payload.sub,
              exp: payload.exp,
              iat: payload.iat
            });
            
            // 🚨 CRITICAL CHECK: Custom Token 감지
            if (payload.iss && payload.iss.includes('iam.gserviceaccount.com')) {
              console.error('[API] 🚨🚨🚨 CUSTOM TOKEN DETECTED! 🚨🚨🚨');
              console.error('[API] ❌ This should NEVER happen!');
              console.error('[API] ❌ auth.currentUser.getIdToken() returned a Custom Token!');
            } else if (payload.iss && payload.iss.includes('securetoken.google.com')) {
              console.log('[API] ✅ Correct ID Token (securetoken.google.com)');
            }
          }
        } catch (decodeError) {
          console.warn('[API] ⚠️ Could not decode token payload:', decodeError);
        }
        
        config.headers['Authorization'] = `Bearer ${idToken}`;
        console.log('[API] 🔥 Firebase ID Token attached (from auth.currentUser)');
        console.log('[API] 🔑 Token preview:', idToken.substring(0, 50) + '...');
      } else {
        console.warn('[API] ⚠️ No Firebase user for protected API after waiting:', config.url);
      }
    } catch (error) {
      console.error('[API] ❌ Failed to get Firebase ID Token:', error);
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 응답 인터셉터: 401 에러 시 자동 로그아웃
 * 
 * - Firebase Auth가 토큰 만료 시 자동으로 갱신
 * - 401 발생 = 진짜 인증 실패 → 로그아웃 처리
 * - Custom Claims로 권한 체크 (role: user, seller, admin)
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
      
      // 2️⃣ 권한 문제 체크 (Custom Claims 불일치)
      const errorData = error.response?.data as any;
      const errorMessage = errorData?.error || '';
      
      if (errorMessage.includes('권한') || errorMessage.includes('admin') || errorMessage.includes('seller')) {
        console.error('[API] ❌ Permission denied (Firebase Custom Claims 불일치)');
        localStorage.clear();
        
        const currentPath = window.location.pathname;
        if (currentPath.startsWith('/admin')) {
          alert('관리자 권한이 필요합니다.');
          window.location.href = '/admin/login';
        } else if (currentPath.startsWith('/seller')) {
          alert('판매자 권한이 필요합니다.');
          window.location.href = '/seller/login';
        } else {
          window.location.href = '/login';
        }
        
        return Promise.reject(error);
      }
      
      // 3️⃣ Firebase 인증 실패 → 로그아웃
      console.warn('[API] Firebase auth failed (401) - redirecting to login');
      localStorage.clear();
      sessionStorage.clear();
      
      const currentPath = window.location.pathname;
      if (!currentPath.includes('/login')) {
        if (currentPath.startsWith('/admin')) {
          window.location.href = '/admin/login';
        } else if (currentPath.startsWith('/seller')) {
          window.location.href = '/seller/login';
        } else {
          window.location.href = '/login';
        }
      }
      
      return Promise.reject(error);
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

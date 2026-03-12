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
import { getFirebaseAuth } from './firebase';
import * as Sentry from '@sentry/react';

// Sentry error capture helper
function captureError(error: Error, context?: Record<string, any>) {
  console.error('[API] Error captured:', error, context);
  Sentry.captureException(error, { extra: context });
}

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
 * 공개 API 엔드포인트 (토큰 불필요)
 * 비회원도 접근 가능한 페이지용 API + 로그인/회원가입 엔드포인트
 */
const PUBLIC_API_PATHS = [
  '/api/streams',              // 라이브 스트림 목록
  '/api/streams/',             // 특정 스트림 조회
  '/api/products',             // 상품 목록
  '/api/products/',            // 특정 상품 조회
  '/api/banners',              // 배너 목록
  '/api/categories',           // 카테고리
  '/api/health',               // 헬스 체크
  '/api/auth/login',           // 유저 로그인 (deprecated - Firebase 사용)
  '/api/auth/register',        // 유저 회원가입 (deprecated - Firebase 사용)
  '/api/auth/kakao',           // 카카오 로그인 (모든 카카오 엔드포인트)
  '/api/auth/firebase/sync',   // Firebase 동기화 (인증 프로세스의 일부)
  '/api/auth/firebase/register', // Firebase 회원가입
  '/api/seller/login',         // 셀러 로그인 (JWT 방식)
  '/api/seller/register',      // 셀러 회원가입 (JWT 방식)
  '/api/seller/public/',       // 셀러 공개 프로필 페이지 (/s/:sellerId)
  '/api/admin/login',          // 어드민 로그인 (JWT 방식)
  '/api/debug',                // 디버그 엔드포인트 (임시, 프로덕션에서 제거 필요)
];

/**
 * 셀러 공개 API (인증 불필요, 공개 정보만 제공)
 * URL 패턴으로 체크 (정규식)
 */
const SELLER_PUBLIC_API_PATTERNS = [
  /^\/api\/seller\/\d+\/streams$/,          // /api/seller/:id/streams
  /^\/api\/seller\/\d+\/products-public$/,  // /api/seller/:id/products-public
];

/**
 * 공개 API 경로 체크
 */
function isPublicAPI(url: string): boolean {
  // 기본 공개 API 경로 체크
  if (PUBLIC_API_PATHS.some(path => url.startsWith(path))) {
    return true;
  }
  
  // 셀러 공개 API 패턴 체크
  if (SELLER_PUBLIC_API_PATTERNS.some(pattern => pattern.test(url))) {
    return true;
  }
  
  return false;
}

/**
 * 요청 인터셉터: 완전 분리된 인증 시스템
 * 
 * ✅ CRITICAL: Seller/Admin은 Firebase를 절대 사용하지 않음!
 * 
 * - /api/seller/* → seller_token (자체 JWT)
 * - /api/admin/* → admin_token (자체 JWT)  
 * - /api/* (일반) → Firebase ID Token (카카오 OAuth)
 */
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!config.headers) return config;
    
    const url = config.url || '';
    
    // 공개 API는 토큰 불필요
    if (isPublicAPI(url)) {
      console.log('[API] 🌍 Public API - no auth required:', url);
      return config;
    }
    
    // Check if Authorization header is already set (manual override)
    const hasManualAuth = config.headers['Authorization'] || config.headers['authorization'];
    if (hasManualAuth) {
      console.log(`[API] 🔐 Manual Authorization header detected, skipping auto-attach`);
      return config;
    }
    
    console.log(`[API] 🔍 Checking auth for ${url}`);
    
    // ============================================================
    // 🔐 SELLER API: /api/seller/* OR /api/youtube/* → seller_token ONLY
    // Firebase 절대 사용 안함!
    // YouTube API는 Seller가 사용하므로 seller_token 필요
    // ⚠️ 주의: user_type이 'seller'일 때만 seller_token 사용!
    // ============================================================
    if (url.startsWith('/api/seller/') || url.startsWith('/api/youtube/')) {
      const apiType = url.startsWith('/api/youtube/') ? 'YouTube' : 'Seller';
      const userType = localStorage.getItem('user_type');
      
      console.log(`[API] 🏪 ${apiType} API detected`);
      console.log(`[API] 📍 user_type: ${userType}`);
      
      // ✅ user_type이 'seller'가 아니면 Firebase ID Token 사용 (일반 user가 seller 정보 조회할 수 있음)
      if (userType !== 'seller') {
        console.log(`[API] ⚠️ user_type is not 'seller' - falling through to Firebase`);
        // Fall through to Firebase token logic below
      } else {
        // ✅ Seller 계정만 seller_token 사용
        const sellerToken = localStorage.getItem('seller_token');
        
        if (!sellerToken) {
          console.error('[API] ❌ seller_token missing! This WILL cause 401!');
          console.error('[API] 📦 localStorage keys:', Object.keys(localStorage));
          throw new Error('Seller token missing - please login again');
        }
        
        config.headers['Authorization'] = `Bearer ${sellerToken}`;
        console.log('[API] ✅ seller_token attached');
        console.log('[API] 🔑 Token preview:', sellerToken.substring(0, 20) + '...');
        return config; // ⚠️ EARLY RETURN - Firebase 절대 안 씀!
      }
    }
    
    // ============================================================
    // 🔐 ADMIN API: /api/admin/* → admin_token ONLY
    // Firebase 절대 사용 안함!
    // ⚠️ 주의: user_type이 'admin'일 때만 admin_token 사용!
    // ============================================================
    if (url.startsWith('/api/admin/')) {
      const userType = localStorage.getItem('user_type');
      
      console.log('[API] 👑 Admin API detected');
      console.log(`[API] 📍 user_type: ${userType}`);
      
      // ✅ user_type이 'admin'이 아니면 오류
      if (userType !== 'admin') {
        console.error('[API] ❌ user_type is not admin - access denied!');
        throw new Error('Admin access required');
      }
      
      const adminToken = localStorage.getItem('admin_token');
      
      if (!adminToken) {
        console.error('[API] ❌ admin_token missing! This WILL cause 401!');
        console.error('[API] 📦 localStorage keys:', Object.keys(localStorage));
        throw new Error('Admin token missing - please login again');
      }
      
      config.headers['Authorization'] = `Bearer ${adminToken}`;
      console.log('[API] ✅ admin_token attached');
      console.log('[API] 🔑 Token preview:', adminToken.substring(0, 20) + '...');
      return config; // ⚠️ EARLY RETURN - Firebase 절대 안 씀!
    }
    
    // ============================================================
    // 🔔 NOTIFICATIONS API: /api/notifications
    // user_type에 따라 seller_token, admin_token, 또는 Firebase 사용
    // ============================================================
    if (url.startsWith('/api/notifications')) {
      const userType = localStorage.getItem('user_type');
      console.log(`[API] 🔔 Notifications API - user_type: ${userType}`);
      
      if (userType === 'seller') {
        const sellerToken = localStorage.getItem('seller_token');
        if (sellerToken) {
          config.headers['Authorization'] = `Bearer ${sellerToken}`;
          console.log('[API] ✅ Seller JWT attached for notifications');
          return config;
        }
      } else if (userType === 'admin') {
        const adminToken = localStorage.getItem('admin_token');
        if (adminToken) {
          config.headers['Authorization'] = `Bearer ${adminToken}`;
          console.log('[API] ✅ Admin JWT attached for notifications');
          return config;
        }
      }
      // Fall through to Firebase for regular users
    }
    
    // ============================================================
    // 🔥 BUYER API: /api/* (일반) → Firebase ID Token
    // 카카오 OAuth 사용자만 여기 도달
    // ============================================================
    console.log('[API] 👤 General API - using Firebase ID Token for buyers');
    try {
      const auth = await getFirebaseAuth();
      let user = auth.currentUser;
      
      // Wait for Firebase Auth initialization (reduced timeout: 500ms)
      if (!user) {
        console.log('[API] ⏳ Waiting for Firebase Auth initialization...');
        user = await new Promise<typeof auth.currentUser>((resolve) => {
          const timeout = setTimeout(() => {
            console.warn('[API] ⚠️ Firebase Auth timeout (500ms) - user not initialized yet');
            console.warn('[API] 💡 This usually happens on first login - retry should work');
            resolve(null);
          }, 500);
          
          const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            clearTimeout(timeout);
            unsubscribe();
            console.log('[API] ✅ Firebase Auth state resolved:', currentUser ? currentUser.uid : 'null');
            resolve(currentUser);
          });
        });
      }
      
      if (user) {
        // Force refresh token
        const idToken = await user.getIdToken(true);
        config.headers['Authorization'] = `Bearer ${idToken}`;
        console.log('[API] ✅ Firebase ID Token attached (buyer)');
        console.log(`[API] 🔑 Token preview: ${idToken.substring(0, 20)}...`);
      } else {
        console.warn('[API] ⚠️ No Firebase user for protected API:', url);
      }
    } catch (error) {
      console.error('[API] ❌ Firebase Auth failed:', error);
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * 응답 인터셉터: 401 에러 처리 (완전 분리)
 * 
 * - Seller/Admin: JWT 재발급 없음, 바로 로그아웃
 * - Buyers: Firebase Token 재발급 시도
 */
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const url = originalRequest.url || '';
    
    // 401 Unauthorized 처리
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      // 공개 API는 401 무시
      if (isPublicAPI(url)) {
        console.log('[API] Public API - 401 ignored');
        return Promise.reject(error);
      }
      
      const errorData = error.response?.data as any;
      console.error('[API] 🚨 401 Unauthorized:', url);
      console.error('[API] 📊 Server error:', errorData);
      
      // ============================================================
      // 🔐 SELLER/ADMIN: JWT 401 처리
      // YouTube API도 Seller JWT 사용
      // ============================================================
      if (url.includes('/api/seller/') || url.includes('/api/admin/') || url.includes('/api/youtube/')) {
        const isSeller = url.includes('/api/seller/') || url.includes('/api/youtube/');
        const tokenKey = isSeller ? 'seller_token' : 'admin_token';
        const fallbackKey = 'access_token';
        const existingToken = localStorage.getItem(tokenKey) || localStorage.getItem(fallbackKey);
        
        // 🚨 CRITICAL: 토큰이 실제로 있는데 401이 나면 → 서버 검증 문제 (clear 하지 않음!)
        if (existingToken) {
          console.error('[API] 🚨 Token exists but server rejected it!');
          console.error('[API] 📍 This is likely a server-side verification issue');
          console.error('[API] 🔑 Token preview:', existingToken.substring(0, 30) + '...');
          console.error('[API] 📊 Server response:', errorData);
          
          // Sentry에 보고만 하고 clear 하지 않음
          captureError(new Error(`${isSeller ? 'Seller' : 'Admin'} token rejected: ${errorData?.error || 'Unknown'}`), {
            context: isSeller ? 'SELLER.TOKEN_REJECTED' : 'ADMIN.TOKEN_REJECTED',
            url: url,
            tokenPreview: existingToken.substring(0, 30)
          });
          
          // 사용자에게 알림 (재로그인 요구하지 않음)
          console.warn('[API] ⚠️ NOT clearing localStorage - keeping token for debugging');
          
          return Promise.reject(error);
        }
        
        // 토큰이 실제로 없는 경우에만 로그아웃 처리
        console.error('[API] 🚨 No token found - redirecting to login');
        
        captureError(new Error(`${isSeller ? 'Seller' : 'Admin'} 401: No token`), {
          context: isSeller ? 'SELLER.NO_TOKEN' : 'ADMIN.NO_TOKEN',
          url: url
        });
        
        // ✅ 선택적 삭제: Seller/Admin 세션만 삭제 (User 보호)
        const authUtils = await import('@/utils/auth');
        authUtils.clearAuthData(isSeller ? 'seller' : 'admin');
        
        if (isSeller) {
          alert('셀러 인증이 필요합니다.\n\n로그인해주세요.');
          window.location.href = '/seller/login';
        } else {
          alert('관리자 인증이 필요합니다.\n\n로그인해주세요.');
          window.location.href = '/admin/login';
        }
        
        return Promise.reject(error);
      }
      
      // ============================================================
      // 🔥 BUYER: Firebase Token 재발급 시도
      // ============================================================
      console.log('[API] 🔥 Buyer 401 - attempting token refresh...');
      try {
        const auth = await getFirebaseAuth();
        const user = auth.currentUser;
        
        if (user) {
          try {
            console.log('[API] 🔄 Refreshing Firebase token...');
            const newToken = await user.getIdToken(true);
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            console.log('[API] ✅ Token refreshed, retrying request...');
            return api(originalRequest);
          } catch (refreshError) {
            console.error('[API] ❌ Token refresh failed:', refreshError);
            captureError(refreshError as Error, { context: 'BUYER.tokenRefresh', url: url });
          }
        }
      } catch (error) {
        console.error('[API] ❌ Firebase Auth failed:', error);
      }
      
      // Firebase 재발급 실패 → 로그아웃
      console.error('[API] 🚨 Buyer auth failed, logging out...');
      
      captureError(new Error(`Buyer 401: ${errorData?.error || 'Unauthorized'}`), {
        context: 'BUYER.401',
        url: url
      });
      
      alert('인증이 만료되었습니다.\n\n다시 로그인해주세요.');
      
      // ✅ 선택적 삭제: User 세션만 삭제
      const authUtils = await import('@/utils/auth');
      authUtils.clearAuthData('user');
      
      // 현재 페이지가 seller/admin 페이지인 경우 적절한 로그인 페이지로 리다이렉트
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/seller')) {
        window.location.href = '/seller/login';
      } else if (currentPath.startsWith('/admin')) {
        window.location.href = '/admin/login';
      } else {
        window.location.href = '/login';
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

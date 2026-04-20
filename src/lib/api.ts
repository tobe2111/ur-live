/**
 * 중앙화된 API 클라이언트 - 무한 루프 영구 해결 버전
 *
 * 핵심 수정사항:
 * 1. Firebase ID Token 캐싱 (55분): 매 요청마다 getIdToken() 호출 제거
 * 2. onAuthStateChanged 구독 제거 (App.tsx에서만 관리)
 * 3. 401 재시도 루프 방지: _retry 플래그로 단 1회만 재시도
 * 4. Seller/Admin → JWT 전용, Firebase 절대 사용 안 함
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as Sentry from '@sentry/react';

// ─── Firebase Token 캐시 (55분 TTL) ────────────────────────────────────────
interface TokenCache {
  token: string;
  expiresAt: number; // ms timestamp
}

let _firebaseTokenCache: TokenCache | null = null;
const TOKEN_CACHE_TTL_MS = 55 * 60 * 1000; // 55분 (Firebase 토큰 유효기간 1시간)

async function getCachedFirebaseToken(forceRefresh = false): Promise<string | null> {
  const now = Date.now();

  // 캐시 유효한 경우 즉시 반환
  if (!forceRefresh && _firebaseTokenCache && _firebaseTokenCache.expiresAt > now) {
    return _firebaseTokenCache.token;
  }

  try {
    const { getFirebaseAuth } = await import('./firebase-auth');
    const auth = await getFirebaseAuth();
    const user = auth.currentUser;

    if (!user) return null;

    // 강제 갱신 여부 결정: 캐시 만료 or 명시적 forceRefresh
    const needsRefresh = forceRefresh || !_firebaseTokenCache || _firebaseTokenCache.expiresAt <= now;
    const token = await user.getIdToken(needsRefresh);

    _firebaseTokenCache = { token, expiresAt: now + TOKEN_CACHE_TTL_MS };
    return token;
  } catch (err) {
    console.error('[API] Firebase token 조회 실패:', err);
    return null;
  }
}

/** 캐시 무효화 (로그아웃 시 호출) */
export function clearFirebaseTokenCache() {
  _firebaseTokenCache = null;
}

// ─── Sentry 에러 헬퍼 ────────────────────────────────────────────────────────
function captureError(error: Error, context?: Record<string, any>) {
  Sentry.captureException(error, { extra: context });
}

// ─── API 클라이언트 ──────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: '/',
  timeout: 15000,
  withCredentials: true, // Send httpOnly cookies (ur_session) with every request
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── 공개 API 경로 ───────────────────────────────────────────────────────────
const PUBLIC_API_PATHS = [
  '/api/streams',
  '/api/streams/',
  '/api/products',
  '/api/products/',
  '/api/banners',
  '/api/categories',
  '/api/health',
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/kakao',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/firebase/sync',
  '/api/auth/firebase/register',
  '/api/seller/login',
  '/api/seller/register',
  '/api/seller/public/',
  '/api/admin/login',
  '/api/debug',
  '/api/search',
];

const SELLER_PUBLIC_API_PATTERNS = [
  /^\/api\/seller\/\d+\/streams$/,
  /^\/api\/seller\/\d+\/products-public$/,
];

function isPublicAPI(url: string): boolean {
  if (PUBLIC_API_PATHS.some((path) => url.startsWith(path))) return true;
  if (SELLER_PUBLIC_API_PATTERNS.some((re) => re.test(url))) return true;
  return false;
}

// ─── 요청 인터셉터 ───────────────────────────────────────────────────────────
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (!config.headers) return config;
    const url = config.url || '';

    // 공개 API: 토큰 불필요
    if (isPublicAPI(url)) return config;

    // 수동 Authorization 헤더가 있으면 그대로 사용
    if (config.headers['Authorization'] || config.headers['authorization']) return config;

    // ── Seller API (/api/seller/*, /api/youtube/*) ─────────────────────────
    if (url.startsWith('/api/seller/') || url.startsWith('/api/youtube/')) {
      const token = localStorage.getItem('seller_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
      }
      // seller_token 없으면 Firebase fallthrough (공개 셀러 API 등)
    }

    // ── Admin API (/api/admin/*) ───────────────────────────────────────────
    if (url.startsWith('/api/admin/')) {
      const token = localStorage.getItem('admin_token');
      if (!token) throw new Error('Admin token missing - please login again');
      config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    }

    // ── Notifications: 토큰 존재 여부로 분기 ─────────────────────────────
    if (url.startsWith('/api/notifications')) {
      const sellerToken = localStorage.getItem('seller_token');
      const adminToken = localStorage.getItem('admin_token');
      if (sellerToken) { config.headers['Authorization'] = `Bearer ${sellerToken}`; return config; }
      if (adminToken) { config.headers['Authorization'] = `Bearer ${adminToken}`; return config; }
      // fallthrough to Firebase
    }

    // ── Session Cookie User API (preferred for user login) ──────────────
    // If user is logged in via session cookie (ur_session), the cookie is
    // sent automatically (withCredentials: true). No Bearer token needed.
    // The server-side requireAuth() checks Bearer token first, then cookie.
    // Session cookie users (카카오 로그인) don't need Bearer token — cookie handles it.
    const userType = localStorage.getItem('user_type');
    if (userType === 'user' && localStorage.getItem('user_id')) {
      // 세션 쿠키 유저 → 토큰 탐색 건너뛰기 (즉시 요청)
      return config;
    }

    // ── Firebase User API (legacy fallback) ──────────────────────────────
    // ✅ 우선순위 1: useAuthKR/useAuthWorld.getIdToken() → 항상 유효한 토큰 보장
    try {
      const { isKorea } = await import('@/config/region');
      const isKR = isKorea();
      const { useAuthKR } = await import('@/shared/stores/useAuthKR');
      const { useAuthWorld } = await import('@/shared/stores/useAuthWorld');
      const authStore = isKR ? useAuthKR.getState() : useAuthWorld.getState();
      const authStoreWithToken = authStore as typeof authStore & { getIdToken?: (forceRefresh?: boolean) => Promise<string | null> };

      if (authStoreWithToken.user && typeof authStoreWithToken.getIdToken === 'function') {
        // getIdToken()은 내부적으로 캐시+만료 체크 후 필요시 Firebase에서 갱신
        const freshToken = await authStoreWithToken.getIdToken(false);
        if (freshToken) {
          config.headers['Authorization'] = `Bearer ${freshToken}`;
          // useAuthStore도 최신 토큰으로 동기화
          try {
            const { useAuthStore } = await import('@/client/stores/auth.store');
            const current = useAuthStore.getState();
            if (current.user && current.accessToken !== freshToken) {
              useAuthStore.getState().setAuth(current.user, freshToken, '');
            }
          } catch (_) {}
          return config;
        }
      }
    } catch (e) {
      console.warn('[API] useAuthKR/getIdToken 조회 실패:', e);
    }

    // ✅ 우선순위 2: useAuthStore의 accessToken (fallback)
    try {
      const { useAuthStore } = await import('@/client/stores/auth.store');
      const { accessToken } = useAuthStore.getState();
      
      if (accessToken) {
        config.headers['Authorization'] = `Bearer ${accessToken}`;
        return config;
      }
    } catch (e) {
      console.warn('[API] useAuthStore 조회 실패:', e);
    }
    
    // ✅ 우선순위 3: Firebase에서 직접 조회 (최후 fallback)
    const token = await getCachedFirebaseToken();
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    } else {
      // 비로그인 상태 — 공개 API는 토큰 없이 진행, 인증 필요 API는 조용히 실패
      const publicPrefixes = ['/api/products', '/api/streams', '/api/reviews', '/api/sections', '/api/seller-tiers', '/api/banners', '/api/search'];
      const isPublic = publicPrefixes.some(p => config.url?.startsWith(p));
      if (!isPublic) {
        console.warn('[API] 토큰 없음 - 인증 필요 API 호출 스킵 가능');
      }
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── 응답 인터셉터: 401 처리 ─────────────────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const url = originalRequest?.url || '';

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true; // ✅ 무한 재시도 차단

      // 공개 API 401 무시
      if (isPublicAPI(url)) return Promise.reject(error);

      // ── Seller / Admin: Refresh Token 시도 ────────────────────────────
      if (url.includes('/api/seller/') || url.includes('/api/admin/') || url.includes('/api/youtube/')) {
        const isSeller = url.includes('/api/seller/') || url.includes('/api/youtube/');
        const tokenKey = isSeller ? 'seller_token' : 'admin_token';
        const refreshTokenKey = isSeller ? 'seller_refresh_token' : 'admin_refresh_token';
        const refreshToken = localStorage.getItem(refreshTokenKey);

        if (refreshToken) {
          try {
            const refreshUrl = isSeller ? '/api/seller/refresh' : '/api/admin/refresh';
            const refreshRes = await axios.post(refreshUrl, { refreshToken });

            if (refreshRes.data.success) {
              const { accessToken, refreshToken: newRT } = refreshRes.data.data;
              localStorage.setItem(tokenKey, accessToken);
              if (newRT) localStorage.setItem(refreshTokenKey, newRT);

              originalRequest.headers['Authorization'] = `Bearer ${accessToken}`;
              return api(originalRequest);
            }
          } catch (_) {
            // Refresh 실패 → 로그아웃
          }
        }

        // Refresh 불가 → 강제 로그아웃
        const { clearAuthData } = await import('@/utils/auth');
        clearAuthData(isSeller ? 'seller' : 'admin');
        captureError(new Error(`${isSeller ? 'Seller' : 'Admin'} 401: Token expired`), { url });

        alert(isSeller ? '셀러 인증이 만료되었습니다.\n다시 로그인해주세요.' : '관리자 인증이 만료되었습니다.\n다시 로그인해주세요.');
        window.location.href = isSeller ? '/seller/login' : '/admin/login';
        return Promise.reject(error);
      }

      // ── Firebase User: Token 강제 갱신 시도 ──────────────────────────
      try {
        let newToken: string | null = null;

        // ✅ 1차: useAuthKR/useAuthWorld.getIdToken(true) — Firebase User 객체 직접 사용
        try {
          const { isKorea } = await import('@/config/region');
          const isKR = isKorea();
          const { useAuthKR } = await import('@/shared/stores/useAuthKR');
          const { useAuthWorld } = await import('@/shared/stores/useAuthWorld');
          const authStore = isKR ? useAuthKR.getState() : useAuthWorld.getState();
          const authStoreWithToken = authStore as typeof authStore & { getIdToken?: (forceRefresh?: boolean) => Promise<string | null> };
          if (authStoreWithToken.user && typeof authStoreWithToken.getIdToken === 'function') {
            newToken = await authStoreWithToken.getIdToken(true); // force refresh
          }
        } catch (e) {
          console.warn('[API] useAuthKR.getIdToken 실패:', e);
        }

        // ✅ 2차: getCachedFirebaseToken(true) — Firebase auth.currentUser 직접 조회
        if (!newToken) {
          newToken = await getCachedFirebaseToken(true);
        }

        if (newToken) {
          const oldToken = originalRequest.headers['Authorization']?.toString().substring(7);
          if (oldToken !== newToken) {
            // ✅ useAuthStore 및 useAuthKR 캐시 업데이트
            try {
              const { useAuthStore } = await import('@/client/stores/auth.store');
              const currentUser = useAuthStore.getState().user;
              if (currentUser) {
                useAuthStore.getState().setAuth(currentUser, newToken, '');
              }
            } catch (e) {
              console.warn('[API] useAuthStore 업데이트 실패:', e);
            }
            
            originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            return api(originalRequest);
          } else {
            console.error('[API] ⚠️ 토큰이 변경되지 않음 - 세션 만료로 간주');
          }
        } else {
          console.error('[API] ❌ 토큰 갱신 실패 - 새 토큰 없음');
        }
      } catch (err) {
        console.error('[API] ❌ 토큰 갱신 중 예외 발생:', err);
      }

      // Firebase 갱신도 실패 → 세션 헬스체크 먼저
      // ⚠️ 결제 성공 페이지는 Firebase 초기화 지연으로 인한 일시적 401일 수 있으므로 제외
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/payment/')) {
        captureError(new Error('Buyer 401: Unauthorized (payment page - skipping logout)'), { url });
        return Promise.reject(error);
      }

      // 세션 쿠키 유저는 쿠키가 유효한지 확인 후 처리
      const isSessionCookieUser = localStorage.getItem('user_type') === 'user' && localStorage.getItem('user_id');
      if (isSessionCookieUser) {
        try {
          const health = await axios.get('/api/auth/session/health', { withCredentials: true });
          if (health.data?.data?.session) {
            // 세션은 유효 — 해당 API 자체의 권한 문제
            captureError(new Error('Buyer 401: API-specific (session valid)'), { url });
            return Promise.reject(error);
          }
        } catch {}
      }

      clearFirebaseTokenCache();
      const { clearAuthData } = await import('@/utils/auth');
      clearAuthData('user');
      try {
        const { useAuthStore } = await import('@/client/stores/auth.store');
        useAuthStore.getState().clearAuth();
      } catch (_) {}
      captureError(new Error('Buyer 401: Unauthorized'), { url });

      alert('인증이 만료되었습니다.\n다시 로그인해주세요.');
      localStorage.setItem('loginReturnUrl', currentPath);
      window.location.href = currentPath.startsWith('/seller')
        ? '/seller/login'
        : currentPath.startsWith('/admin')
        ? '/admin/login'
        : '/login';
      return Promise.reject(error);
    }

    // 403 Forbidden
    if (error.response?.status === 403) {
      console.warn('[API] 접근 권한 없음:', url);
    }

    return Promise.reject(error);
  }
);

// ─── 에러 메시지 유틸 ─────────────────────────────────────────────────────────
export const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED: '로그인이 필요합니다',
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 일치하지 않습니다',
  PRODUCT_NOT_FOUND: '상품을 찾을 수 없습니다',
  STREAM_NOT_FOUND: '라이브 스트림을 찾을 수 없습니다',
  INSUFFICIENT_STOCK: '재고가 부족합니다',
  PAYMENT_FAILED: '결제에 실패했습니다',
  ORDER_NOT_FOUND: '주문을 찾을 수 없습니다',
  SELLER_NOT_APPROVED: '승인 대기 중인 판매자입니다',
  ADMIN_ONLY: '관리자 권한이 필요합니다',
  SELLER_ONLY: '판매자 권한이 필요합니다',
  NETWORK_ERROR: '네트워크 오류가 발생했습니다',
  TIMEOUT: '요청 시간이 초과되었습니다',
};

export function getErrorMessage(error: any): string {
  if (axios.isAxiosError(error)) {
    const code = error.response?.data?.error?.code;
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];
    if (error.response?.data?.error?.message) return error.response.data.error.message;
    if (error.code === 'ECONNABORTED') return ERROR_MESSAGES.TIMEOUT;
    if (!error.response) return ERROR_MESSAGES.NETWORK_ERROR;
  }
  return '오류가 발생했습니다. 다시 시도해주세요.';
}

export default api;

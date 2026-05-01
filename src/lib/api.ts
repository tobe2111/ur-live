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

// 🛡️ 2026-04-29: 401 시 force refresh 디바운스 — setAuth side-effect 가
//   다른 useEffect 트리거 시 동일 401 endpoint 가 새 request 로 들어와
//   `_retry` 가드(request-level) 우회 가능. 시간 기반 가드로 30초 내 재갱신 차단.
let _lastForceRefreshAt = 0;
const FORCE_REFRESH_DEBOUNCE_MS = 30 * 1000;

// 🛡️ 2026-04-29: 셀러/어드민/에이전시 refresh inflight 락.
//   같은 페이지에서 여러 API 가 동시 401 → 각각 인터셉터 진입 → 동시 refresh 호출 →
//   refresh token rotation 환경에서 첫 번째만 성공, 두 번째부터 stale token 으로 401 → 강제 로그아웃.
//   inflight Promise 캐시로 동시 요청은 같은 결과 공유.
type RefreshResult = { accessToken: string; refreshToken?: string } | null;
const _inflightRefresh: Record<string, Promise<RefreshResult> | undefined> = {};

async function refreshDashboardToken(
  refreshUrl: string,
  refreshToken: string,
  cacheKey: 'seller' | 'admin' | 'agency',
): Promise<RefreshResult> {
  if (_inflightRefresh[cacheKey]) {
    return _inflightRefresh[cacheKey]!;
  }
  const p = (async () => {
    try {
      const res = await axios.post(refreshUrl, { refreshToken });
      if (res.data?.success) {
        return {
          accessToken: res.data.data.accessToken as string,
          refreshToken: res.data.data.refreshToken as string | undefined,
        };
      }
      return null;
    } catch {
      return null;
    } finally {
      // 다음 401 사이클이 새 refresh 시도할 수 있도록 즉시 해제
      delete _inflightRefresh[cacheKey];
    }
  })();
  _inflightRefresh[cacheKey] = p;
  return p;
}

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
// 🛡️ 2026-04-30: 누락된 공개 endpoint 추가 (사용자 신고 — 비로그인 시 예정/다시보기 안 보임).
//   server-side 는 모두 공개이지만 client 가 인증 토큰 시도 시 401 예외 처리에서 redirect 가능.
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
  '/api/agency/login',
  '/api/agency/register',
  '/api/debug',
  '/api/search',
  // 🛡️ 2026-04-30 추가 — server edge cache 와 매칭되는 public read-only endpoints
  '/api/home/bundle',     // 메인페이지 통합 (live + scheduled + ended + 상품)
  '/api/shorts',          // 쇼츠 피드
  '/api/reviews/product/', // 상품 리뷰 목록
  '/api/restaurants',     // 식당 목록
  '/api/group-buy/products', // 공동구매 상품
  '/api/sections',        // 홈 섹션
  '/api/seller-tiers',    // 셀러 등급
  '/api/blog/public/',    // 블로그 공개 글
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

    // ── Agency API (/api/agency/*) ─────────────────────────────────────────
    if (url.startsWith('/api/agency/')) {
      const token = localStorage.getItem('agency_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
      }
    }

    // ── Admin API (/api/admin/*) ───────────────────────────────────────────
    // 🛡️ 2026-04-22 Phase 2A: localStorage 없어도 cookie 로 인증 가능 (Phase 1 cookie 발급).
    // throw 제거 — cookie 만으로도 서버에서 인증 통과.
    if (url.startsWith('/api/admin/')) {
      const token = localStorage.getItem('admin_token');
      if (token) config.headers['Authorization'] = `Bearer ${token}`;
      return config;
    }

    // ── Guides: /api/guides/:type — type 으로 token 결정 ────────────────
    // 🛡️ 2026-04-30: GuideViewer 가 명시 헤더로 token 전달하지만, 명시 안 한 caller
    //   대비. admin 은 모든 type 접근 가능 → admin_token fallback.
    if (url.startsWith('/api/guides/')) {
      const m = url.match(/\/api\/guides\/(admin|seller|agency)/);
      const type = m?.[1] as 'admin' | 'seller' | 'agency' | undefined;
      const tokenKey = type === 'admin' ? 'admin_token'
        : type === 'agency' ? 'agency_token'
        : type === 'seller' ? 'seller_token'
        : 'admin_token';
      let token = localStorage.getItem(tokenKey);
      // admin 은 모든 type 접근 가능 — fallback
      if (!token) token = localStorage.getItem('admin_token');
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`;
        return config;
      }
    }

    // ── Notifications: 토큰 존재 여부로 분기 ─────────────────────────────
    // 🛡️ 2026-04-28: /api/dashboard-notifications 도 같은 분기 (이전엔 누락 → 알림 401)
    if (url.startsWith('/api/notifications') || url.startsWith('/api/dashboard-notifications')) {
      const sellerToken = localStorage.getItem('seller_token');
      const adminToken = localStorage.getItem('admin_token');
      const agencyToken = localStorage.getItem('agency_token');
      // 우선순위: agency > admin > seller (대시보드 컨텍스트 따라)
      if (agencyToken) { config.headers['Authorization'] = `Bearer ${agencyToken}`; return config; }
      if (adminToken) { config.headers['Authorization'] = `Bearer ${adminToken}`; return config; }
      if (sellerToken) { config.headers['Authorization'] = `Bearer ${sellerToken}`; return config; }
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

    // 🛡️ 2026-05-01: KR 도메인은 Firebase 100% 미사용 — fallback 경로 차단.
    //   비로그인 KR 사용자가 인증 필요 API 호출 → Firebase 로드 시도하지 않고 즉시 통과.
    //   (서버는 401 반환, 인터셉터가 처리)
    try {
      const { isKorea } = await import('@/config/region');
      if (isKorea()) return config;
    } catch { /* region detect fail — continue */ }

    // ── Firebase User API (legacy fallback, 글로벌 전용) ──────────────────
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
          } catch (_) {} // non-critical: optional auth store sync
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

      // ── Seller / Admin / Agency: Refresh Token 시도 ────────────────────────
      // 🛡️ 2026-04-22 FIX: URL이 /api/seller/ 이더라도 유저 세션으로 호출한 경우
      // (예: /api/seller/public/:id 공개 프로필, /api/youtube/video-info 등)
      // dashboard 토큰이 없으면 이 블록 건너뛰고 Firebase user refresh 블록으로 fall through.
      // 기존 동작: 유저가 셀러 공개 프로필 보다가 401 → "셀러 인증 만료" → /seller/login (잘못)
      // 🛡️ 2026-04-30: /api/guides/* 도 dashboard 흐름 — :type 으로 token 결정.
      const _isDashboardUrl = url.includes('/api/seller/') || url.includes('/api/admin/') || url.includes('/api/youtube/') || url.includes('/api/agency/') || url.includes('/api/guides/');
      // /api/guides/admin → admin / /api/guides/seller → seller (또는 admin) / /api/guides/agency → agency (또는 admin)
      let _guideType: 'admin' | 'seller' | 'agency' | null = null;
      if (url.includes('/api/guides/')) {
        const m = url.match(/\/api\/guides\/(admin|seller|agency)/);
        _guideType = (m?.[1] as 'admin' | 'seller' | 'agency' | undefined) || null;
      }
      const _isDashTokenKey = _guideType === 'admin' ? 'admin_token'
        : _guideType === 'agency' ? 'agency_token'
        : _guideType === 'seller' ? 'seller_token'
        : url.includes('/api/agency/') ? 'agency_token'
        : (url.includes('/api/seller/') || url.includes('/api/youtube/')) ? 'seller_token'
        : 'admin_token';
      const _hasDashboardToken = _isDashboardUrl && !!localStorage.getItem(_isDashTokenKey);

      if (_isDashboardUrl && _hasDashboardToken) {
        const isSeller = _guideType === 'seller' || (!_guideType && (url.includes('/api/seller/') || url.includes('/api/youtube/')));
        const isAgency = _guideType === 'agency' || (!_guideType && url.includes('/api/agency/'));
        const tokenKey = isAgency ? 'agency_token' : isSeller ? 'seller_token' : 'admin_token';
        const refreshTokenKey = isAgency ? 'agency_refresh_token' : isSeller ? 'seller_refresh_token' : 'admin_refresh_token';
        const refreshToken = localStorage.getItem(refreshTokenKey);

        if (refreshToken) {
          // 🛡️ 2026-04-29: inflight 락 — 동시 401 들이 모두 같은 refresh 결과 공유.
          //   이전 동작: 동시 401 → 동시 refresh 호출 → token rotation 시 race condition.
          const refreshUrl = isSeller ? '/api/seller/refresh' : '/api/admin/refresh';
          const cacheKey = isAgency ? 'agency' : isSeller ? 'seller' : 'admin';
          const refreshed = await refreshDashboardToken(refreshUrl, refreshToken, cacheKey);
          if (refreshed) {
            localStorage.setItem(tokenKey, refreshed.accessToken);
            if (refreshed.refreshToken) localStorage.setItem(refreshTokenKey, refreshed.refreshToken);
            originalRequest.headers['Authorization'] = `Bearer ${refreshed.accessToken}`;
            return api(originalRequest);
          }
          // null 이면 refresh 실패 → 아래 강제 로그아웃 fallthrough
        }

        // Refresh 불가 → 강제 로그아웃
        const { clearAuthData } = await import('@/utils/auth');
        const roleLabel = isAgency ? 'Agency' : isSeller ? 'Seller' : 'Admin';
        if (isAgency) {
          localStorage.removeItem('agency_token');
          localStorage.removeItem('agency_refresh_token');
        } else {
          clearAuthData(isSeller ? 'seller' : 'admin');
        }
        captureError(new Error(`${roleLabel} 401: Token expired`), { url });

        // 🛡️ 2026-04-29: alert 제거 — 카톡 인앱이 alert 차단 → throw → 흰화면.
        //   대신 로그인 페이지에서 ?error=session_expired query 감지해 toast 표시.
        const loginUrl = isAgency ? '/agency/login' : isSeller ? '/seller/login' : '/admin/login';
        console.warn(`[Auth] ${roleLabel} 인증 만료 — 로그인 페이지 이동`);
        window.location.href = `${loginUrl}?error=session_expired`;
        return Promise.reject(error);
      }

      // 🛡️ 2026-05-01: KR 세션 쿠키 유저는 Firebase 토큰 갱신 경로 자체를 건너뜀.
      //   세션 쿠키 401 = 쿠키 만료 / 무효. Firebase 로 갱신 시도 = 무의미한 SDK 로드 + 추가 지연.
      //   바로 session health check → 만료면 로그아웃 흐름.
      let skipFirebaseRefresh = false;
      try {
        const { isKorea } = await import('@/config/region');
        if (isKorea()) skipFirebaseRefresh = true;
      } catch { /* region detect fail — continue with Firebase path */ }

      // ── Firebase User: Token 강제 갱신 시도 (글로벌 전용) ─────────────
      // 🛡️ 2026-04-29: 30초 디바운스 — _retry 가드는 request-level 이라 setAuth
      //   side-effect 로 새 request 가 들어오면 우회 가능. 시간 기반 추가 가드.
      const sinceLastRefresh = Date.now() - _lastForceRefreshAt;
      if (!skipFirebaseRefresh && sinceLastRefresh < FORCE_REFRESH_DEBOUNCE_MS) {
        if (import.meta.env.DEV) console.warn('[API] 토큰 갱신 디바운스 — 직전 갱신 후 30초 미경과:', sinceLastRefresh, 'ms');
        return Promise.reject(error);
      }
      if (!skipFirebaseRefresh) _lastForceRefreshAt = Date.now();

      try {
        let newToken: string | null = null;

        // ✅ 1차: useAuthKR/useAuthWorld.getIdToken(true) — Firebase User 객체 직접 사용
        if (!skipFirebaseRefresh) {
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
        }

        // ✅ 2차: getCachedFirebaseToken(true) — Firebase auth.currentUser 직접 조회
        if (!newToken && !skipFirebaseRefresh) {
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

      // 🛡️ 2026-04-23 배치 175: 비로그인 상태에서 401 발생은 정상 동작 (이미 로그아웃됨).
      //   Sentry 스팸 + 강제 리다이렉트 방지. 조용히 reject.
      const hasAnyAuth = localStorage.getItem('user_id') || localStorage.getItem('user_type') ||
                         localStorage.getItem('seller_token') || localStorage.getItem('admin_token') || localStorage.getItem('agency_token');
      if (!hasAnyAuth) {
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
      } catch (_) {} // non-critical: best-effort clearAuth on 401
      captureError(new Error('Buyer 401: Unauthorized'), { url });

      // 🛡️ 2026-04-28: alert 제거 (카톡 인앱이 alert 차단 → throw → 흰화면).
      //   대신 toast 로 안내 + redirect (콘솔에는 로그).
      console.warn('[Auth] 401 — 자동 로그아웃 후 로그인 페이지 이동');
      // 🛡️ 2026-04-29: login 페이지 자체에선 returnUrl 저장 안 함 (자기참조 차단).
      //   loginReturnUrl 화이트리스트 — /login·/auth/* 면 무시.
      const isAuthPath = currentPath.startsWith('/login') || currentPath.startsWith('/seller/login') ||
                         currentPath.startsWith('/admin/login') || currentPath.startsWith('/agency/login') ||
                         currentPath.startsWith('/auth/');
      if (!isAuthPath) {
        localStorage.setItem('loginReturnUrl', currentPath);
      }

      // 셀러/어드민/에이전시 대시보드 영역만 강제 redirect.
      // 일반 사용자(/, /products 등) 는 *현재 페이지 유지* + 401 reject.
      //   그래야 카톡 인앱에서 비로그인 사용자가 홈 둘러보다 알림톡/위시리스트 등
      //   호출 시 401 받아도 redirect 안 함 (UX 보호).
      // 🛡️ 2026-04-29: 이미 login 페이지면 redirect 안 함 (자기참조 무한 루프 차단).
      if (isAuthPath) {
        return Promise.reject(error);
      }
      if (currentPath.startsWith('/seller')) {
        window.location.href = '/seller/login';
      } else if (currentPath.startsWith('/admin')) {
        window.location.href = '/admin/login';
      } else if (currentPath.startsWith('/agency')) {
        window.location.href = '/agency/login';
      }
      // 일반 사용자: redirect 하지 않음 — 401 reject 만
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

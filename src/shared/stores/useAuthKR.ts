import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User as FirebaseUser } from 'firebase/auth';

/**
 * ✅ Zustand Store - KR 전용 인증 (Kakao + Firebase Email)
 *
 * 핵심 설계 원칙:
 * 1. onAuthStateChanged 를 앱 전체 생명주기 동안 지속 구독 (1회 실행 후 해제 X)
 * 2. isAuthReady 는 최초 Firebase 상태 확인 완료 후 true 로 고정
 * 3. user_type 은 Firebase User 로그인 시에만 'user' 로 설정
 * 4. Seller/Admin 은 이 store 를 전혀 사용하지 않음
 */

interface TokenCache {
  token: string;
  expiresAt: number;  // Unix timestamp (ms)
}

interface AuthKRState {
  user: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthReady: boolean;          // Firebase 첫 상태 확인 완료 여부 (한번 true 되면 영구)
  userRole: 'user' | 'seller' | 'admin' | null;
  tokenCache: TokenCache | null; // ID Token 캐시

  setUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthReady: (ready: boolean) => void;
  setTokenCache: (cache: TokenCache | null) => void;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;

  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithKakao: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => () => void;  // 반환값: unsubscribe 함수
}

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

/** user_type 이 'user' 또는 없을 때만 'user' 로 설정 (seller/admin 보호) */
function safeSetUserType() {
  const current = localStorage.getItem('user_type');
  if (!current || current === 'user') {
    localStorage.setItem('user_type', 'user');
  }
}

/** ID Token 캐시 키 (localStorage) */
const TOKEN_CACHE_KEY = 'firebase_token_cache';

/** ID Token 유효 기간 (55분 = Firebase ID Token 기본 유효 기간 60분 - 5분 버퍼) */
const TOKEN_EXPIRY_MS = 55 * 60 * 1000;

/** localStorage에서 캐시 읽기 */
function loadTokenCacheFromStorage(): TokenCache | null {
  try {
    const cached = localStorage.getItem(TOKEN_CACHE_KEY);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as TokenCache;
    // 만료 확인
    if (Date.now() >= parsed.expiresAt) {
      localStorage.removeItem(TOKEN_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/** localStorage에 캐시 저장 */
function saveTokenCacheToStorage(cache: TokenCache) {
  try {
    localStorage.setItem(TOKEN_CACHE_KEY, JSON.stringify(cache));
  } catch (err) {
    console.warn('[AuthKR] Failed to save token cache:', err);
  }
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthKR = create<AuthKRState>()(
  devtools(
    persist(
      (set, get) => ({
        // ── 초기 상태 ──────────────────────────────────────────────────────────
        user: null,
        isLoading: false,   // App 시작 시 Firebase 초기화 전까지 false 유지
        error: null,
        isAuthReady: false, // initializeAuth() 완료 후 true
        userRole: null,
        tokenCache: loadTokenCacheFromStorage(), // localStorage에서 캐시 로드

        // ── 순수 setter ────────────────────────────────────────────────────────
        setUser: (user) => set({ user }, false, 'setUser'),
        setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),
        setError: (error) => set({ error }, false, 'setError'),
        setAuthReady: (isAuthReady) => set({ isAuthReady }, false, 'setAuthReady'),
        setTokenCache: (tokenCache) => {
          set({ tokenCache }, false, 'setTokenCache');
          if (tokenCache) {
            saveTokenCacheToStorage(tokenCache);
          } else {
            localStorage.removeItem(TOKEN_CACHE_KEY);
          }
        },

        // ── ID Token 가져오기 (캐싱 적용) ──────────────────────────────────────
        getIdToken: async (forceRefresh = false) => {
          const { user, tokenCache } = get();
          
          if (!user) {
            console.warn('[AuthKR] getIdToken: No user logged in');
            return null;
          }

          // Phase 2.3: Try backend token first (if feature flag enabled)
          try {
            const { featureFlags } = await import('@/shared/config/feature-flags');
            const { getIdTokenFromBackend } = await import('@/shared/utils/auth-api');
            
            if (featureFlags.backendToken) {
              console.log('[AuthKR] 🚀 Using backend token endpoint (Phase 2.3)');
              const backendToken = await getIdTokenFromBackend(user.uid, forceRefresh);
              
              if (backendToken) {
                // Cache the backend token
                const newCache: TokenCache = {
                  token: backendToken,
                  expiresAt: Date.now() + TOKEN_EXPIRY_MS
                };
                get().setTokenCache(newCache);
                console.log('[AuthKR] ✅ Backend token cached');
                return backendToken;
              }
              
              // Fallback to client-side if backend fails
              console.warn('[AuthKR] Backend token failed, falling back to client-side');
            }
          } catch (err) {
            console.warn('[AuthKR] Backend token error:', err);
            // Continue to client-side token
          }

          // Original client-side token logic (fallback)
          // 캐시된 토큰 사용 (강제 갱신 아님 + 캐시 유효)
          if (!forceRefresh && tokenCache && Date.now() < tokenCache.expiresAt) {
            console.log('[AuthKR] Using cached ID token (expires in', Math.round((tokenCache.expiresAt - Date.now()) / 1000), 'seconds)');
            return tokenCache.token;
          }

          // 새 토큰 가져오기 (client-side Firebase)
          try {
            console.log('[AuthKR] Fetching new ID token from Firebase', forceRefresh ? '(forced)' : '(cache expired/missing)');
            const token = await user.getIdToken(forceRefresh);
            
            // 캐시 저장
            const newCache: TokenCache = {
              token,
              expiresAt: Date.now() + TOKEN_EXPIRY_MS
            };
            get().setTokenCache(newCache);
            
            return token;
          } catch (err) {
            console.error('[AuthKR] Failed to get ID token:', err);
            return null;
          }
        },

        // ── 이메일 로그인 ──────────────────────────────────────────────────────
        loginWithEmail: async (email, password) => {
          set({ isLoading: true, error: null });
          try {
            const { signInWithEmailAndPassword } = await import('@/lib/firebase-auth');
            const { user } = await signInWithEmailAndPassword(email, password);

            // ID Token 갱신 (claims 확인용)
            const idToken = await user.getIdToken(true);

            // 역할 확인
            const res = await fetch('/api/users/role', {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            const body = (await res.json().catch(() => ({ role: 'user' }))) as { role?: string };
            const role: string = body.role || 'user';

            if (role === 'seller' || role === 'admin') {
              // Firebase signout 후 에러
              const { signOut } = await import('@/lib/firebase-auth');
              await signOut().catch(() => {});
              throw new Error(`${role} 계정은 /seller/login 또는 /admin/login을 이용하세요.`);
            }

            safeSetUserType();
            const displayName = user.displayName || user.email?.split('@')[0] || 'User';
            localStorage.setItem('user_name', displayName);

            // ✅ Phase 2.3: Clear redirect flag on successful login (무한루프 방지)
            sessionStorage.removeItem('auth_redirect_attempted');
            console.log('[AuthKR] ✅ Login successful, redirect flag cleared');

            // onAuthStateChanged 가 자동으로 store 업데이트하므로 set() 최소화
            set({ isLoading: false, error: null });
          } catch (err: any) {
            set({ error: err.message || '로그인 실패', isLoading: false });
            throw err;
          }
        },

        // ── 이메일 회원가입 ────────────────────────────────────────────────────
        signupWithEmail: async (email, password, displayName) => {
          set({ isLoading: true, error: null });
          try {
            const { createUserWithEmailAndPassword } = await import('@/lib/firebase-auth');
            const { user } = await createUserWithEmailAndPassword(email, password);

            await fetch('/api/users/init', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${await user.getIdToken()}`,
              },
              body: JSON.stringify({ displayName }),
            }).catch(() => {});

            safeSetUserType();
            localStorage.setItem('user_name', displayName ?? email.split('@')[0]);
            set({ isLoading: false, error: null });
          } catch (err: any) {
            set({ error: err.message || '회원가입 실패', isLoading: false });
            throw err;
          }
        },

        // ── 카카오 로그인 (redirect) ──────────────────────────────────────────
        loginWithKakao: async () => {
          const KAKAO_AUTH_URL = (import.meta as any).env?.VITE_KAKAO_AUTH_URL || '/auth/kakao';
          window.location.href = KAKAO_AUTH_URL;
        },

        // ── 비밀번호 재설정 ────────────────────────────────────────────────────
        sendPasswordResetEmail: async (email) => {
          set({ isLoading: true, error: null });
          try {
            const { sendPasswordResetEmail: fbReset } = await import('@/lib/firebase-auth');
            await fbReset(email);
            set({ isLoading: false });
          } catch (err: any) {
            set({ error: err.message || '비밀번호 재설정 실패', isLoading: false });
            throw err;
          }
        },

        // ── 로그아웃 ──────────────────────────────────────────────────────────
        logout: async () => {
          try {
            const { signOut } = await import('@/lib/firebase-auth');
            await signOut().catch(() => {});
          } catch (_) {}

          // user 세션 selective clear
          const { clearAuthData } = await import('@/utils/auth');
          clearAuthData('user');
          localStorage.removeItem('auth-kr-storage');
          localStorage.removeItem('auth-world-storage');
          localStorage.removeItem('lastLoginUid');
          localStorage.removeItem(TOKEN_CACHE_KEY); // Token cache clear

          set({ user: null, userRole: null, tokenCache: null, isLoading: false, isAuthReady: true });
          setTimeout(() => { window.location.href = '/'; }, 50);
        },

        // ── 인증 초기화 (앱 최초 1회) ─────────────────────────────────────────
        /**
         * ✅ 핵심 변경:
         * - onAuthStateChanged 를 앱 생명주기 내내 구독 유지
         * - isAuthReady = true 는 첫 콜백 완료 후 영구 설정
         * - 반환값(unsubscribe) 을 App.tsx 에서 cleanup 으로 호출
         *
         * ✅ BUG #9 FIX: Two race conditions patched:
         * 1. `unsubscribeFn` could still be null when cleanup fires if the async
         *    IIFE hasn't resolved yet.  Use an `isMounted` flag so the stale
         *    cleanup is a no-op instead of silently skipping.
         * 2. `isAuthReady` was never set to `true` when the async IIFE itself
         *    threw (e.g. Firebase SDK failed to load), leaving the app in a
         *    permanent loading state.  The catch block now sets isAuthReady.
         */
        initializeAuth: () => {
          let isMounted = true;           // ✅ tracks whether cleanup was already called
          let unsubscribeFn: (() => void) | null = null;

          // Firebase lazy load 후 구독 시작 (비동기)
          (async () => {
            try {
              const { onAuthStateChanged } = await import('@/lib/firebase-auth');

              // ✅ If cleanup ran before we even reached here, bail out immediately
              if (!isMounted) return;

              unsubscribeFn = await onAuthStateChanged(async (firebaseUser) => {
                if (firebaseUser) {
                  // ✅ 중복 처리 방지: KakaoCallback에서 이미 처리했으면 스킵
                  const lastProcessed = sessionStorage.getItem('auth_processed_uid');
                  if (lastProcessed === firebaseUser.uid) {
                    console.log('[AuthKR] ⏩ Already processed, skip:', firebaseUser.uid);
                    set({ isAuthReady: true });
                    return;
                  }
                  
                  // Firebase 유저 있음 → user_type 이 seller/admin 이면 간섭하지 않음
                  const currentType = localStorage.getItem('user_type');
                  if (currentType === 'seller' || currentType === 'admin') {
                    // Seller/Admin 탭에서 Firebase 이벤트가 와도 무시
                    set({ isAuthReady: true });
                    return;
                  }

                  try {
                    const idToken = await firebaseUser.getIdToken(false); // 캐시된 토큰 사용
                    const res = await fetch('/api/users/role', {
                      headers: { Authorization: `Bearer ${idToken}` },
                    });
                    const body = (await res.json().catch(() => ({ role: 'user' }))) as { role?: string };
                    const role = (body.role || 'user') as 'user';

                    safeSetUserType();
                    localStorage.setItem('lastLoginUid', firebaseUser.uid);

                    // ✅ API 요청용 accessToken 저장 (Firebase ID Token)
                    try {
                      const { useAuthStore } = await import('@/client/stores/auth.store');
                      useAuthStore.getState().setAuth(
                        {
                          id: firebaseUser.uid,
                          email: firebaseUser.email || '',
                          name: firebaseUser.displayName || '',
                          role: 'user',
                        },
                        idToken,
                        '' // refreshToken은 Firebase에서 자동 관리
                      );
                      console.log('[AuthKR] ✅ accessToken 저장 완료 (API 요청 가능)');
                    } catch (e) {
                      console.warn('[AuthKR] ⚠️ useAuthStore 업데이트 실패:', e);
                    }

                    // ✅ 처리 완료 플래그 설정
                    sessionStorage.setItem('auth_processed_uid', firebaseUser.uid);

                    set({
                      user: firebaseUser,
                      userRole: role,
                      isLoading: false,
                      isAuthReady: true,
                      error: null,
                    });
                  } catch (err) {
                    // 역할 조회 실패해도 user 로 처리
                    safeSetUserType();
                    localStorage.setItem('lastLoginUid', firebaseUser.uid);
                    set({
                      user: firebaseUser,
                      userRole: 'user',
                      isLoading: false,
                      isAuthReady: true,
                    });
                  }
                } else {
                  // ✅ 로그아웃 시 플래그 제거
                  sessionStorage.removeItem('auth_processed_uid');
                  
                  // Firebase 유저 없음
                  localStorage.removeItem('lastLoginUid');
                  set({
                    user: null,
                    userRole: null,
                    isLoading: false,
                    isAuthReady: true,
                  });
                }
              });
            } catch (err) {
              console.error('[useAuthKR] onAuthStateChanged 설정 실패:', err);
              // ✅ BUG #9 FIX: Always mark auth as ready so the app doesn't hang
              set({ isLoading: false, isAuthReady: true });
            }
          })();

          // 즉시 반환 (cleanup 함수)
          return () => {
            isMounted = false;   // ✅ prevent stale async IIFE from subscribing after unmount
            if (unsubscribeFn) {
              unsubscribeFn();
            }
          };
        },
      }),
      {
        name: 'auth-kr-storage',
        partialize: (state) => ({
          userRole: state.userRole,
          // user 객체는 persist 하지 않음 (Firebase가 관리)
        }),
      }
    ),
    { name: 'AuthKR Store' }
  )
);

// ── Selector 훅 ───────────────────────────────────────────────────────────────
export const useAuthKRUser = () => useAuthKR((s) => s.user);
export const useAuthKRLoading = () => useAuthKR((s) => s.isLoading);
export const useAuthKRError = () => useAuthKR((s) => s.error);
export const useAuthKRRole = () => useAuthKR((s) => s.userRole);
export const useAuthKRReady = () => useAuthKR((s) => s.isAuthReady);

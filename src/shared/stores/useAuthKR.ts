/**
 * KR Region Auth Store — Firebase + Kakao OAuth
 *
 * Used by: KR region pages (live.ur-team.com)
 * Manages: Firebase user state, ID tokens, onAuthStateChanged
 *
 * Note: With session cookie auth, this store's role is reduced.
 * New login flow uses httpOnly cookies, but this remains as fallback
 * and for existing Firebase-based features.
 */
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
  signupWithEmail: (
    email: string,
    password: string,
    displayName: string,
    agreements?: {
      terms_agreed?: boolean;
      privacy_agreed?: boolean;
      marketing_agreed?: boolean;
      age_confirmed?: boolean;
    }
  ) => Promise<void>;
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
              const backendToken = await getIdTokenFromBackend(user.uid, forceRefresh);

              if (backendToken) {
                // Cache the backend token
                const newCache: TokenCache = {
                  token: backendToken,
                  expiresAt: Date.now() + TOKEN_EXPIRY_MS
                };
                get().setTokenCache(newCache);
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
            return tokenCache.token;
          }

          // 새 토큰 가져오기 (client-side Firebase)
          try {
            // ✅ Defensive check: user might be a stale plain object from old localStorage data
            // (Zustand persist reads ALL stored keys on hydration, even if partialize excludes them)
            if (typeof user.getIdToken !== 'function') {
              console.error('[AuthKR] user.getIdToken is not a function — stale plain object from old localStorage. Clearing user.');
              set({ user: null });
              return null;
            }

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
            localStorage.setItem('lastLoginUid', user.uid);

            // ✅ onAuthStateChanged 중복 처리 방지 (kakao 콜백과 동일한 패턴)
            sessionStorage.setItem('auth_processed_uid', user.uid);
            sessionStorage.removeItem('auth_redirect_attempted');

            // ✅ ID Token 캐시 저장
            const newCache: TokenCache = {
              token: idToken,
              expiresAt: Date.now() + TOKEN_EXPIRY_MS,
            };
            saveTokenCacheToStorage(newCache);

            // ✅ API 요청용 accessToken 저장
            try {
              const { useAuthStore } = await import('@/client/stores/auth.store');
              useAuthStore.getState().setAuth(
                { id: user.uid, email: user.email || '', name: displayName, role: 'user' },
                idToken,
                ''
              );
            } catch (e) {
              console.error('[AuthKR] useAuthStore sync error during login:', e);
            }

            // ✅ user를 즉시 store에 설정 — navigate 전에 ProtectedRoute가 user를 확인할 수 있도록
            // (이전: onAuthStateChanged에 위임 → navigate 시점에 user=null → /login 리다이렉트)
            set({
              user,
              userRole: role as 'user',
              isLoading: false,
              isAuthReady: true,
              error: null,
              tokenCache: newCache,
            });
          } catch (err: any) {
            set({ error: err.message || '로그인 실패', isLoading: false });
            throw err;
          }
        },

        // ── 이메일 회원가입 ────────────────────────────────────────────────────
        signupWithEmail: async (email, password, displayName, agreements) => {
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
              body: JSON.stringify({
                displayName,
                terms_agreed: agreements?.terms_agreed === true,
                privacy_agreed: agreements?.privacy_agreed === true,
                marketing_agreed: agreements?.marketing_agreed === true,
                age_confirmed: agreements?.age_confirmed === true,
              }),
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
          } catch (_) {} // non-critical: best-effort Firebase signOut during logout

          // user 세션 selective clear
          const { clearAuthData } = await import('@/utils/auth');
          clearAuthData('user');
          localStorage.removeItem('auth-kr-storage');
          localStorage.removeItem('auth-world-storage');
          localStorage.removeItem('lastLoginUid');
          localStorage.removeItem(TOKEN_CACHE_KEY); // Token cache clear
          sessionStorage.removeItem('auth_processed_uid');

          // ✅ useAuthStore (API 토큰) 도 함께 정리
          try {
            const { useAuthStore } = await import('@/client/stores/auth.store');
            useAuthStore.getState().clearAuth();
          } catch (_) {} // non-critical: best-effort auth store cleanup

          // ✅ api.ts 의 Firebase 토큰 캐시도 정리
          try {
            const { clearFirebaseTokenCache } = await import('@/lib/api');
            clearFirebaseTokenCache();
          } catch (_) {} // non-critical: best-effort token cache cleanup

          // v37 FIX: React Query 캐시 초기화 (이전 유저의 orders/cart 등 잔존 방지)
          try {
            const { getQueryClient } = await import('@/lib/react-query');
            getQueryClient().clear();
          } catch (_) {} // non-critical: query client may not be initialized yet

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
                  // ✅ 중복 처리 방지: KakaoCallback/LoginPage에서 이미 처리했으면
                  //    user와 isAuthReady만 보장하고 스킵 (API 중복 호출 방지)
                  const lastProcessed = sessionStorage.getItem('auth_processed_uid');
                  if (lastProcessed === firebaseUser.uid) {
                    // Already processed by KakaoCallback/LoginPage, just ensure user+ready
                    const currentUser = get().user;
                    if (!currentUser) {
                      set({ user: firebaseUser, isAuthReady: true });
                    } else {
                      set({ isAuthReady: true });
                    }
                    return;
                  }

                  // Firebase 유저 있음 → user_type 이 seller/admin 이면 간섭하지 않음
                  const currentType = localStorage.getItem('user_type');
                  if (currentType === 'seller' || currentType === 'admin') {
                    set({ isAuthReady: true });
                    return;
                  }

                  // ✅ 핵심 수정: user와 isAuthReady를 먼저 설정하여 ProtectedRoute가 즉시 통과
                  // 비동기 작업(role 확인, claims, accessToken)은 백그라운드에서 진행
                  safeSetUserType();
                  localStorage.setItem('lastLoginUid', firebaseUser.uid);
                  set({
                    user: firebaseUser,
                    userRole: 'user',
                    isLoading: false,
                    isAuthReady: true,
                    error: null,
                  });

                  // ✅ 백그라운드 비동기 작업: role 확인, claims 동기화, accessToken 저장
                  // 이 작업이 느려도 UI는 이미 정상 표시됨
                  (async () => {
                    try {
                      const idToken = await firebaseUser.getIdToken(false);

                      // Role 확인
                      const res = await fetch('/api/users/role', {
                        headers: { Authorization: `Bearer ${idToken}` },
                      });
                      const body = (await res.json().catch(() => ({ role: 'user' }))) as { role?: string };
                      const role = (body.role || 'user') as 'user';

                      // Claims에서 userName/profileImage 추출
                      try {
                        const idTokenResult = await firebaseUser.getIdTokenResult();
                        const claimsUserName = idTokenResult.claims.userName as string | undefined;
                        const claimsProfileImage = idTokenResult.claims.profileImage as string | undefined;

                        if (claimsUserName) {
                          const existing = localStorage.getItem('user_name');
                          if (!existing || existing === 'Kakao User' || existing === '사용자') {
                            localStorage.setItem('user_name', claimsUserName);
                          }
                          if (!firebaseUser.displayName) {
                            try {
                              const { updateProfile } = await import('firebase/auth');
                              await updateProfile(firebaseUser, { displayName: claimsUserName });
                            } catch (_) {} // non-critical: best-effort displayName update
                          }
                        }
                        if (claimsProfileImage) {
                          localStorage.setItem('user_profile_image', claimsProfileImage);
                        }
                      } catch (_) {} // non-critical: best-effort claims extraction

                      // accessToken 저장
                      try {
                        const { useAuthStore } = await import('@/client/stores/auth.store');
                        useAuthStore.getState().setAuth(
                          {
                            id: firebaseUser.uid,
                            email: firebaseUser.email || '',
                            name: firebaseUser.displayName || localStorage.getItem('user_name') || '',
                            role: 'user',
                          },
                          idToken,
                          ''
                        );
                        // accessToken saved successfully
                      } catch (e) {
                        console.warn('[AuthKR] ⚠️ useAuthStore 업데이트 실패:', e);
                      }

                      sessionStorage.setItem('auth_processed_uid', firebaseUser.uid);

                      // Role이 다르면 업데이트
                      if (role !== get().userRole) {
                        set({ userRole: role });
                      }
                    } catch (err) {
                      // 백그라운드 실패해도 user/isAuthReady는 이미 설정됨 → 무시
                      console.warn('[AuthKR] ⚠️ 백그라운드 인증 작업 실패 (무시):', err);
                      try {
                        const idTokenFallback = await firebaseUser.getIdToken(false);
                        const { useAuthStore } = await import('@/client/stores/auth.store');
                        useAuthStore.getState().setAuth(
                          { id: firebaseUser.uid, email: firebaseUser.email || '', name: firebaseUser.displayName || '', role: 'user' },
                          idTokenFallback, ''
                        );
                      } catch (e) {
                        console.error('[AuthKR] Fallback token save error:', e);
                      }
                    }
                  })();
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
        version: 1, // bump to invalidate stale localStorage data from older versions
        partialize: (state) => ({
          userRole: state.userRole,
          // user 객체는 persist 하지 않음 (Firebase가 관리)
        }),
        // ✅ Explicit merge: never restore `user` from storage (Firebase User 메서드 없는 plain object 방지)
        merge: (persisted: unknown, current: AuthKRState): AuthKRState => ({
          ...current,
          userRole: (persisted as Partial<AuthKRState>)?.userRole ?? null,
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

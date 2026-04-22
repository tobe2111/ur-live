/**
 * WORLD Region Auth Store — Firebase + Google OAuth
 *
 * Used by: Global region pages (world.ur-team.com)
 * Manages: Firebase user state, ID tokens, onAuthStateChanged
 *
 * Mirrors useAuthKR design but uses Google OAuth instead of Kakao.
 * Same session cookie migration note applies.
 */
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { User as FirebaseUser } from 'firebase/auth';

/**
 * ✅ Zustand Store - WORLD 전용 인증 (Google OAuth)
 *
 * 핵심 설계 원칙 (useAuthKR과 동일):
 * 1. onAuthStateChanged 를 앱 전체 생명주기 동안 지속 구독
 * 2. isAuthReady 는 최초 Firebase 상태 확인 완료 후 true 로 고정
 * 3. Seller/Admin 은 이 store 를 전혀 사용하지 않음
 * 4. initializeAuth() 반환값: unsubscribe 함수 (App.tsx cleanup 용)
 */

interface AuthWorldState {
  user: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthReady: boolean;
  userRole: 'user' | 'seller' | 'admin' | null;

  setUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthReady: (ready: boolean) => void;

  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => () => void; // 반환값: unsubscribe
}

function safeSetUserType() {
  const current = localStorage.getItem('user_type');
  if (!current || current === 'user') {
    localStorage.setItem('user_type', 'user');
  }
}

export const useAuthWorld = create<AuthWorldState>()(
  devtools(
    persist(
      (set) => ({
        user: null,
        isLoading: false,
        error: null,
        isAuthReady: false,
        userRole: null,

        setUser: (user) => set({ user }, false, 'setUser'),
        setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),
        setError: (error) => set({ error }, false, 'setError'),
        setAuthReady: (isAuthReady) => set({ isAuthReady }, false, 'setAuthReady'),

        // ── Google OAuth 로그인 ────────────────────────────────────────────
        loginWithGoogle: async () => {
          set({ isLoading: true, error: null });
          try {
            const { signInWithGoogle } = await import('@/lib/firebase-auth');
            const { user } = await signInWithGoogle();

            const idToken = await user.getIdToken(true);

            const res = await fetch('/api/users/role', {
              headers: { Authorization: `Bearer ${idToken}` },
            });
            const body = (await res.json().catch(() => ({ role: 'user' }))) as { role?: string };
            const role: string = body.role || 'user';

            if (role === 'seller' || role === 'admin') {
              const { signOut } = await import('@/lib/firebase-auth');
              await signOut().catch((e) => { if (import.meta.env.DEV) console.warn('[Auth] signOut failed:', e); });
              throw new Error(`${role} 계정은 /seller/login 또는 /admin/login을 이용하세요.`);
            }

            safeSetUserType();
            localStorage.setItem('user_name', user.displayName || user.email?.split('@')[0] || 'User');
            set({ isLoading: false, error: null });
          } catch (err: any) {
            set({ error: err.message || 'Google 로그인 실패', isLoading: false });
            throw err;
          }
        },

        // ── 로그아웃 ────────────────────────────────────────────────────────
        logout: async () => {
          try {
            const { signOut } = await import('@/lib/firebase-auth');
            await signOut().catch(() => {});
          } catch (_) {} // non-critical: best-effort Firebase signOut during logout

          const { clearAuthData } = await import('@/utils/auth');
          clearAuthData('user');
          localStorage.removeItem('auth-world-storage');
          localStorage.removeItem('auth-kr-storage');
          localStorage.removeItem('lastLoginUid');
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

          set({ user: null, userRole: null, isLoading: false, isAuthReady: true });
          setTimeout(() => { window.location.href = '/'; }, 50);
        },

        // ── 인증 초기화 (앱 최초 1회) ─────────────────────────────────────
        initializeAuth: () => {
          let unsubscribeFn: (() => void) | null = null;

          (async () => {
            try {
              const { onAuthStateChanged } = await import('@/lib/firebase-auth');

              unsubscribeFn = await onAuthStateChanged(async (firebaseUser) => {
                if (firebaseUser) {
                  // ✅ 중복 처리 방지: 이미 처리된 UID면 user+ready만 보장하고 스킵
                  const lastProcessed = sessionStorage.getItem('auth_processed_uid');
                  if (lastProcessed === firebaseUser.uid) {
                    const currentUser = useAuthWorld.getState().user;
                    if (!currentUser) {
                      set({ user: firebaseUser, isAuthReady: true });
                    } else {
                      set({ isAuthReady: true });
                    }
                    return;
                  }

                  const currentType = localStorage.getItem('user_type');
                  if (currentType === 'seller' || currentType === 'admin') {
                    set({ isAuthReady: true });
                    return;
                  }

                  try {
                    const idToken = await firebaseUser.getIdToken(false);
                    const res = await fetch('/api/users/role', {
                      headers: { Authorization: `Bearer ${idToken}` },
                    });
                    const body = (await res.json().catch(() => ({ role: 'user' }))) as { role?: string };
                    const role = (body.role || 'user') as 'user';

                    safeSetUserType();
                    localStorage.setItem('lastLoginUid', firebaseUser.uid);

                    set({
                      user: firebaseUser,
                      userRole: role,
                      isLoading: false,
                      isAuthReady: true,
                      error: null,
                    });
                  } catch (_) {
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
              console.error('[useAuthWorld] onAuthStateChanged 설정 실패:', err);
              set({ isLoading: false, isAuthReady: true });
            }
          })();

          return () => {
            if (unsubscribeFn) unsubscribeFn();
          };
        },
      }),
      {
        name: 'auth-world-storage',
        partialize: (state) => ({ userRole: state.userRole }),
      }
    ),
    { name: 'AuthWorld Store' }
  )
);

// Selectors
export const useAuthWorldUser = () => useAuthWorld((s) => s.user);
export const useAuthWorldLoading = () => useAuthWorld((s) => s.isLoading);
export const useAuthWorldError = () => useAuthWorld((s) => s.error);
export const useAuthWorldRole = () => useAuthWorld((s) => s.userRole);
export const useAuthWorldReady = () => useAuthWorld((s) => s.isAuthReady);

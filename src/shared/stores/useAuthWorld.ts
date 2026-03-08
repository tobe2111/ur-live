import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth } from '@/lib/firebase';

/**
 * ✅ Zustand Store - WORLD 전용 인증 (Google OAuth)
 * - KR과 동일한 인터페이스 유지 → 컴포넌트 재사용 가능
 * - 순수 함수로 구성 → 테스트 가능
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
  initializeAuth: () => Promise<void>;
}

export const useAuthWorld = create<AuthWorldState>()(
  devtools(
    persist(
      (set, get) => ({
        user: null,
        isLoading: true,
        error: null,
        isAuthReady: false,
        userRole: null,

        setUser: (user) => set({ user }, false, 'setUser'),
        setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),
        setError: (error) => set({ error }, false, 'setError'),
        setAuthReady: (isAuthReady) => set({ isAuthReady }, false, 'setAuthReady'),

        // ✅ Google OAuth 로그인
        loginWithGoogle: async () => {
          try {
            set({ isLoading: true, error: null });

            const provider = new GoogleAuthProvider();
            const userCredential = await signInWithPopup(auth, provider);
            const user = userCredential.user;

            // 사용자 역할 조회
            try {
              const roleResponse = await fetch('/api/users/role', {
                headers: { Authorization: `Bearer ${await user.getIdToken()}` },
              });
              const { role } = await roleResponse.json();

              set({
                user,
                userRole: role,
                isLoading: false,
                isAuthReady: true,
              });
            } catch (err) {
              console.error('[useAuthWorld] Failed to fetch user role:', err);
              set({
                user,
                userRole: 'user', // 기본값
                isLoading: false,
                isAuthReady: true,
              });
            }
          } catch (err: any) {
            console.error('[useAuthWorld] loginWithGoogle failed:', err);
            set({
              error: err.message || 'Google 로그인 실패',
              isLoading: false,
            });
            throw err;
          }
        },

        // ✅ 로그아웃
        logout: async () => {
          try {
            set({ isLoading: true, error: null });
            await firebaseSignOut(auth);

            localStorage.removeItem('user');

            set({
              user: null,
              userRole: null,
              isLoading: false,
              isAuthReady: true,
            });
          } catch (err: any) {
            console.error('[useAuthWorld] logout failed:', err);
            set({
              error: err.message || '로그아웃 실패',
              isLoading: false,
            });
            throw err;
          }
        },

        // ✅ 인증 초기화
        initializeAuth: async () => {
          try {
            set({ isLoading: true, error: null });

            return new Promise<void>((resolve) => {
              const unsubscribe = auth.onAuthStateChanged(async (user) => {
                if (user) {
                  try {
                    const roleResponse = await fetch('/api/users/role', {
                      headers: { Authorization: `Bearer ${await user.getIdToken()}` },
                    });
                    const { role } = await roleResponse.json();

                    set({
                      user,
                      userRole: role,
                      isLoading: false,
                      isAuthReady: true,
                    });
                  } catch (err) {
                    console.error('[useAuthWorld] Failed to fetch user role:', err);
                    set({
                      user,
                      userRole: 'user', // 기본값
                      isLoading: false,
                      isAuthReady: true,
                    });
                  }
                } else {
                  set({
                    user: null,
                    userRole: null,
                    isLoading: false,
                    isAuthReady: true,
                  });
                }
                unsubscribe();
                resolve();
              });
            });
          } catch (err: any) {
            console.error('[useAuthWorld] initializeAuth failed:', err);
            set({
              error: err.message || '인증 초기화 실패',
              isLoading: false,
              isAuthReady: true,
            });
            throw err;
          }
        },
      }),
      {
        name: 'auth-world-storage',
        partialize: (state) => ({
          user: state.user,
          userRole: state.userRole,
        }),
      }
    ),
    { name: 'AuthWorld Store' }
  )
);

// Selectors
export const useAuthWorldUser = () => useAuthWorld((state) => state.user);
export const useAuthWorldLoading = () => useAuthWorld((state) => state.isLoading);
export const useAuthWorldError = () => useAuthWorld((state) => state.error);
export const useAuthWorldRole = () => useAuthWorld((state) => state.userRole);
export const useAuthWorldReady = () => useAuthWorld((state) => state.isAuthReady);

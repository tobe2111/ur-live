import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  signInWithGoogle,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from '@/lib/firebase-auth';

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
            console.log('[useAuthWorld] 🔐 Google 로그인 시작...');

            const userCredential = await signInWithGoogle();
            const user = userCredential.user;
            console.log('[useAuthWorld] ✅ Google 로그인 성공:', user.uid);

            // 🔥 중요: Firebase ID Token을 강제로 갱신하여 최신 상태 보장
            console.log('[useAuthWorld] 🔄 ID Token 강제 갱신 중...');
            const idToken = await user.getIdToken(true); // force refresh
            console.log('[useAuthWorld] ✅ ID Token 갱신 완료:', idToken.substring(0, 30) + '...');

            // 🔥 추가 대기: Firebase Auth State가 완전히 업데이트되도록 100ms 대기
            await new Promise(resolve => setTimeout(resolve, 100));

            // ✅ localStorage에 user_type 설정 (API Interceptor를 위해 필수)
            localStorage.setItem('user_type', 'user');
            localStorage.setItem('user_name', user.displayName || user.email?.split('@')[0] || 'User');
            console.log('[useAuthWorld] ✅ localStorage에 user_type 설정: user');

            // 사용자 역할 조회
            console.log('[useAuthWorld] 📡 사용자 역할 조회 API 호출...');
            try {
              const roleResponse = await fetch('/api/users/role', {
                headers: { Authorization: `Bearer ${idToken}` },
              });
              
              if (!roleResponse.ok) {
                console.error('[useAuthWorld] ❌ 역할 조회 실패:', roleResponse.status, roleResponse.statusText);
                throw new Error(`Failed to fetch user role: ${roleResponse.status}`);
              }
              
              const { role } = await roleResponse.json();
              console.log('[useAuthWorld] ✅ 사용자 역할 확인:', role);

              set({
                user,
                userRole: role,
                isLoading: false,
                isAuthReady: true,
              });
            } catch (err) {
              console.error('[useAuthWorld] ❌ Failed to fetch user role:', err);
              set({
                user,
                userRole: 'user', // 기본값
                isLoading: false,
                isAuthReady: true,
              });
            }
            
            console.log('[useAuthWorld] ✅ 로그인 완료 - Zustand 상태 업데이트됨');
          } catch (err: any) {
            console.error('[useAuthWorld] ❌ loginWithGoogle failed:', err);
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
            await firebaseSignOut();

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

            return new Promise<void>(async (resolve) => {
              const unsubscribe = await onAuthStateChanged(async (user) => {
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
          // ❌ user 객체는 persist 하지 않음 (Firebase가 관리)
          // user: state.user,
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

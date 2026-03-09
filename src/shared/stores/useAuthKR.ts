import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  onAuthStateChanged,
  type User as FirebaseUser,
} from '@/lib/firebase-auth';

/**
 * ✅ Zustand Store - KR 전용 인증 (Kakao + Firebase Email)
 * - 순수 함수로 구성 → 테스트 가능
 * - Context API 불필요 → Hook 규칙 위반 방지
 * - Selector 지원 → 리렌더 최소화
 */
interface AuthKRState {
  // 1️⃣ 상태
  user: FirebaseUser | null;
  isLoading: boolean;
  error: string | null;
  isAuthReady: boolean;
  userRole: 'user' | 'seller' | 'admin' | null;

  // 2️⃣ Actions - 순수 함수로 분리
  setUser: (user: FirebaseUser | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setAuthReady: (ready: boolean) => void;

  // 3️⃣ 비즈니스 로직 - 비동기 함수
  loginWithEmail: (email: string, password: string) => Promise<void>;
  signupWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  loginWithKakao: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuth: () => Promise<void>;
}

export const useAuthKR = create<AuthKRState>()(
  devtools(
    persist(
      (set, get) => ({
        // 초기 상태
        user: null,
        isLoading: true,
        error: null,
        isAuthReady: false,
        userRole: null,

        // ✅ Setter - 순수 함수
        setUser: (user) => set({ user }, false, 'setUser'),
        setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),
        setError: (error) => set({ error }, false, 'setError'),
        setAuthReady: (isAuthReady) => set({ isAuthReady }, false, 'setAuthReady'),

        // ✅ 이메일 로그인
        loginWithEmail: async (email, password) => {
          try {
            set({ isLoading: true, error: null });
            const userCredential = await signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // 사용자 역할 조회 (API 호출)
            const roleResponse = await fetch('/api/users/role', {
              headers: { Authorization: `Bearer ${await user.getIdToken()}` },
            });
            const { role } = await roleResponse.json();

            set({
              user,
              userRole: role,
              isLoading: false,
              isAuthReady: true,
              error: null,
            });
          } catch (err: any) {
            console.error('[useAuthKR] loginWithEmail failed:', err);
            set({
              error: err.message || '로그인 실패',
              isLoading: false,
            });
            throw err;
          }
        },

        // ✅ 이메일 회원가입
        signupWithEmail: async (email, password, displayName) => {
          try {
            set({ isLoading: true, error: null });
            const userCredential = await createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;

            // 사용자 프로필 초기화
            await fetch('/api/users/init', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${await user.getIdToken()}`,
              },
              body: JSON.stringify({ displayName }),
            });

            set({
              user,
              userRole: 'user',
              isLoading: false,
              isAuthReady: true,
            });
          } catch (err: any) {
            console.error('[useAuthKR] signupWithEmail failed:', err);
            set({
              error: err.message || '회원가입 실패',
              isLoading: false,
            });
            throw err;
          }
        },

        // ✅ Kakao OAuth 로그인
        loginWithKakao: async () => {
          try {
            set({ isLoading: true, error: null });

            // Kakao OAuth 시작 (Redirect 방식)
            const KAKAO_AUTH_URL = import.meta.env.VITE_KAKAO_AUTH_URL || '/auth/kakao';
            window.location.href = KAKAO_AUTH_URL;
          } catch (err: any) {
            console.error('[useAuthKR] loginWithKakao failed:', err);
            set({
              error: err.message || 'Kakao 로그인 실패',
              isLoading: false,
            });
            throw err;
          }
        },

        // ✅ 비밀번호 재설정
        sendPasswordResetEmail: async (email) => {
          try {
            set({ isLoading: true, error: null });
            await firebaseSendPasswordResetEmail(email);
            set({
              isLoading: false,
              error: null,
            });
          } catch (err: any) {
            console.error('[useAuthKR] sendPasswordResetEmail failed:', err);
            set({
              error: err.message || '비밀번호 재설정 실패',
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

            // 로컬 스토리지 클리어
            localStorage.removeItem('user');
            localStorage.removeItem('kakao_token');

            set({
              user: null,
              userRole: null,
              isLoading: false,
              isAuthReady: true,
            });
          } catch (err: any) {
            console.error('[useAuthKR] logout failed:', err);
            set({
              error: err.message || '로그아웃 실패',
              isLoading: false,
            });
            throw err;
          }
        },

        // ✅ 인증 초기화 (앱 시작 시 호출)
        initializeAuth: async () => {
          try {
            set({ isLoading: true, error: null });

            // Firebase Auth 상태 확인
            return new Promise<void>(async (resolve) => {
              const unsubscribe = await onAuthStateChanged(async (user) => {
                if (user) {
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
                    console.error('[useAuthKR] Failed to fetch user role:', err);
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
            console.error('[useAuthKR] initializeAuth failed:', err);
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
        name: 'auth-kr-storage', // localStorage 키
        partialize: (state) => ({
          user: state.user,
          userRole: state.userRole,
        }),
      }
    ),
    { name: 'AuthKR Store' }
  )
);

// ✅ Selector 예시 (리렌더 최소화)
export const useAuthKRUser = () => useAuthKR((state) => state.user);
export const useAuthKRLoading = () => useAuthKR((state) => state.isLoading);
export const useAuthKRError = () => useAuthKR((state) => state.error);
export const useAuthKRRole = () => useAuthKR((state) => state.userRole);
export const useAuthKRReady = () => useAuthKR((state) => state.isAuthReady);

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
            console.log('[useAuthKR] 🚀 인증 초기화 시작');

            // ✅ 1. localStorage에서 lastLoginUid 체크 (즉시 로딩 상태 해제)
            const lastLoginUid = localStorage.getItem('lastLoginUid');
            if (lastLoginUid) {
              console.log('[useAuthKR] 📦 localStorage에 lastLoginUid 발견:', lastLoginUid);
              // 빠른 UI 표시를 위해 일단 로딩 해제 (Firebase 확인 중)
              set({ isLoading: false });
            }

            // ✅ 2. Firebase Auth 상태 확인 (최대 1.5초 대기)
            return new Promise<void>(async (resolve) => {
              let resolved = false;
              let unsubscribe: (() => void) | null = null;
              
              const timeout = setTimeout(() => {
                if (!resolved) {
                  console.warn('[useAuthKR] ⚠️ onAuthStateChanged 타임아웃 (1.5초)');
                  resolved = true;
                  
                  // ✅ 타임아웃 시 unsubscribe 안전하게 호출
                  if (unsubscribe) {
                    try {
                      unsubscribe();
                    } catch (e) {
                      console.error('[useAuthKR] ❌ unsubscribe 실패:', e);
                    }
                  }
                  
                  set({
                    user: null,
                    userRole: null,
                    isLoading: false,
                    isAuthReady: true,
                  });
                  resolve();
                }
              }, 1500);

              try {
                unsubscribe = await onAuthStateChanged(async (user) => {
                  if (resolved) {
                    // 이미 타임아웃으로 해결됨, unsubscribe만 호출
                    if (unsubscribe) {
                      try {
                        unsubscribe();
                      } catch (e) {
                        console.error('[useAuthKR] ❌ unsubscribe 실패 (타임아웃 후):', e);
                      }
                    }
                    return;
                  }
                  
                  clearTimeout(timeout);
                  resolved = true;

                  if (user) {
                    console.log('[useAuthKR] ✅ Firebase 로그인 상태 확인:', user.uid);
                    
                    // ✅ lastLoginUid 저장 (다음 로드 시 즉시 체크)
                    localStorage.setItem('lastLoginUid', user.uid);
                    
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
                      console.log('[useAuthKR] ✅ 사용자 역할:', role);
                    } catch (err) {
                      console.error('[useAuthKR] ❌ Failed to fetch user role:', err);
                      set({
                        user,
                        userRole: 'user', // 기본값
                        isLoading: false,
                        isAuthReady: true,
                      });
                    }
                  } else {
                    console.log('[useAuthKR] ℹ️ 로그인 상태 아님');
                    // ✅ lastLoginUid 제거
                    localStorage.removeItem('lastLoginUid');
                    set({
                      user: null,
                      userRole: null,
                      isLoading: false,
                      isAuthReady: true,
                    });
                  }
                  
                  // ✅ unsubscribe 안전하게 호출
                  if (unsubscribe) {
                    try {
                      unsubscribe();
                    } catch (e) {
                      console.error('[useAuthKR] ❌ unsubscribe 실패:', e);
                    }
                  }
                  resolve();
                });
              } catch (err) {
                clearTimeout(timeout);
                console.error('[useAuthKR] ❌ onAuthStateChanged 설정 실패:', err);
                resolved = true;
                set({
                  user: null,
                  userRole: null,
                  isLoading: false,
                  isAuthReady: true,
                });
                resolve();
              }
            });
          } catch (err: any) {
            console.error('[useAuthKR] ❌ initializeAuth failed:', err);
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
          // ❌ user 객체는 persist 하지 않음 (Firebase가 관리)
          // user: state.user,
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

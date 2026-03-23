// ============================================================
// Auth Store - Zustand
// ============================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<AuthUser>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        console.log('[AuthStore] 🔐 setAuth 호출됨:', {
          userId: user.id,
          hasAccessToken: !!accessToken,
          tokenLength: accessToken?.length || 0,
          tokenPreview: accessToken?.substring(0, 20) + '...'
        });
        set({
          user,
          accessToken,
          refreshToken,
          isAuthenticated: true,
        });
        console.log('[AuthStore] ✅ Auth 저장 완료 - localStorage 확인:', localStorage.getItem('auth-storage'));
      },

      clearAuth: () => set({
        user: null,
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
      }),

      updateUser: (partial) => set(state => ({
        user: state.user ? { ...state.user, ...partial } : null,
      })),
    }),
    {
      name: 'auth-storage',
      // ✅ accessToken은 persist 제외: 만료된 토큰이 localStorage에 남아 401 유발 방지
      // 토큰은 매 세션마다 Firebase에서 새로 발급받음 (useAuthKR.getIdToken or getCachedFirebaseToken)
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        // accessToken, refreshToken: NOT persisted
      }),
    }
  )
);

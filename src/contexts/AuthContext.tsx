// Compatibility layer for migrating from AuthContext to Zustand stores
import { useAuthKR } from '@/shared/stores/useAuthKR'
import { useAuthWorld } from '@/shared/stores/useAuthWorld'
import { isKorea } from '@/shared/config/region'

/**
 * Legacy useAuth hook - provides compatibility with old AuthContext
 * @deprecated Use useAuthKR or useAuthWorld directly
 */
export function useAuth() {
  const authKR = useAuthKR()
  const authWorld = useAuthWorld()
  
  if (isKorea()) {
    return {
      user: authKR.user,
      isLoggedIn: !!authKR.user,
      loading: authKR.isLoading,
      isAuthReady: authKR.isAuthReady,
      role: authKR.userRole,
      loginWithEmail: authKR.loginWithEmail,
      signupWithEmail: authKR.signupWithEmail,
      loginWithKakao: authKR.loginWithKakao,
      logout: authKR.logout,
      resetPassword: authKR.sendPasswordResetEmail,
    }
  } else {
    return {
      user: authWorld.user,
      isLoggedIn: !!authWorld.user,
      loading: authWorld.isLoading,
      isAuthReady: authWorld.isAuthReady,
      role: authWorld.userRole,
      loginWithEmail: authWorld.loginWithEmail,
      signupWithEmail: authWorld.signupWithEmail,
      loginWithGoogle: authWorld.loginWithGoogle,
      logout: authWorld.logout,
      resetPassword: authWorld.sendPasswordResetEmail,
    }
  }
}

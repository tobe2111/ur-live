import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
function safeSetUserType() {
    const current = localStorage.getItem('user_type');
    if (!current || current === 'user') {
        localStorage.setItem('user_type', 'user');
    }
}
export const useAuthWorld = create()(devtools(persist((set) => ({
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
            const body = (await res.json().catch(() => ({ role: 'user' })));
            const role = body.role || 'user';
            if (role === 'seller' || role === 'admin') {
                const { signOut } = await import('@/lib/firebase-auth');
                await signOut().catch(() => { });
                throw new Error(`${role} 계정은 /seller/login 또는 /admin/login을 이용하세요.`);
            }
            safeSetUserType();
            localStorage.setItem('user_name', user.displayName || user.email?.split('@')[0] || 'User');
            set({ isLoading: false, error: null });
        }
        catch (err) {
            set({ error: err.message || 'Google 로그인 실패', isLoading: false });
            throw err;
        }
    },
    // ── 로그아웃 ────────────────────────────────────────────────────────
    logout: async () => {
        try {
            const { signOut } = await import('@/lib/firebase-auth');
            await signOut().catch(() => { });
        }
        catch (_) { }
        const { clearAuthData } = await import('@/utils/auth');
        clearAuthData('user');
        localStorage.removeItem('auth-world-storage');
        localStorage.removeItem('auth-kr-storage');
        localStorage.removeItem('lastLoginUid');
        set({ user: null, userRole: null, isLoading: false, isAuthReady: true });
        setTimeout(() => { window.location.href = '/'; }, 50);
    },
    // ── 인증 초기화 (앱 최초 1회) ─────────────────────────────────────
    initializeAuth: () => {
        let unsubscribeFn = null;
        (async () => {
            try {
                const { onAuthStateChanged } = await import('@/lib/firebase-auth');
                unsubscribeFn = await onAuthStateChanged(async (firebaseUser) => {
                    if (firebaseUser) {
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
                            const body = (await res.json().catch(() => ({ role: 'user' })));
                            const role = (body.role || 'user');
                            safeSetUserType();
                            localStorage.setItem('lastLoginUid', firebaseUser.uid);
                            set({
                                user: firebaseUser,
                                userRole: role,
                                isLoading: false,
                                isAuthReady: true,
                                error: null,
                            });
                        }
                        catch (_) {
                            safeSetUserType();
                            localStorage.setItem('lastLoginUid', firebaseUser.uid);
                            set({
                                user: firebaseUser,
                                userRole: 'user',
                                isLoading: false,
                                isAuthReady: true,
                            });
                        }
                    }
                    else {
                        localStorage.removeItem('lastLoginUid');
                        set({
                            user: null,
                            userRole: null,
                            isLoading: false,
                            isAuthReady: true,
                        });
                    }
                });
            }
            catch (err) {
                console.error('[useAuthWorld] onAuthStateChanged 설정 실패:', err);
                set({ isLoading: false, isAuthReady: true });
            }
        })();
        return () => {
            if (unsubscribeFn)
                unsubscribeFn();
        };
    },
}), {
    name: 'auth-world-storage',
    partialize: (state) => ({ userRole: state.userRole }),
}), { name: 'AuthWorld Store' }));
// Selectors
export const useAuthWorldUser = () => useAuthWorld((s) => s.user);
export const useAuthWorldLoading = () => useAuthWorld((s) => s.isLoading);
export const useAuthWorldError = () => useAuthWorld((s) => s.error);
export const useAuthWorldRole = () => useAuthWorld((s) => s.userRole);
export const useAuthWorldReady = () => useAuthWorld((s) => s.isAuthReady);

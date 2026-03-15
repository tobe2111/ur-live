import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
// ─── 내부 유틸 ────────────────────────────────────────────────────────────────
/** user_type 이 'user' 또는 없을 때만 'user' 로 설정 (seller/admin 보호) */
function safeSetUserType() {
    const current = localStorage.getItem('user_type');
    if (!current || current === 'user') {
        localStorage.setItem('user_type', 'user');
    }
}
// ─── Store ────────────────────────────────────────────────────────────────────
export const useAuthKR = create()(devtools(persist((set) => ({
    // ── 초기 상태 ──────────────────────────────────────────────────────────
    user: null,
    isLoading: false, // App 시작 시 Firebase 초기화 전까지 false 유지
    error: null,
    isAuthReady: false, // initializeAuth() 완료 후 true
    userRole: null,
    // ── 순수 setter ────────────────────────────────────────────────────────
    setUser: (user) => set({ user }, false, 'setUser'),
    setLoading: (isLoading) => set({ isLoading }, false, 'setLoading'),
    setError: (error) => set({ error }, false, 'setError'),
    setAuthReady: (isAuthReady) => set({ isAuthReady }, false, 'setAuthReady'),
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
            const body = (await res.json().catch(() => ({ role: 'user' })));
            const role = body.role || 'user';
            if (role === 'seller' || role === 'admin') {
                // Firebase signout 후 에러
                const { signOut } = await import('@/lib/firebase-auth');
                await signOut().catch(() => { });
                throw new Error(`${role} 계정은 /seller/login 또는 /admin/login을 이용하세요.`);
            }
            safeSetUserType();
            const displayName = user.displayName || user.email?.split('@')[0] || 'User';
            localStorage.setItem('user_name', displayName);
            // onAuthStateChanged 가 자동으로 store 업데이트하므로 set() 최소화
            set({ isLoading: false, error: null });
        }
        catch (err) {
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
            }).catch(() => { });
            safeSetUserType();
            localStorage.setItem('user_name', displayName ?? email.split('@')[0]);
            set({ isLoading: false, error: null });
        }
        catch (err) {
            set({ error: err.message || '회원가입 실패', isLoading: false });
            throw err;
        }
    },
    // ── 카카오 로그인 (redirect) ──────────────────────────────────────────
    loginWithKakao: async () => {
        const KAKAO_AUTH_URL = import.meta.env?.VITE_KAKAO_AUTH_URL || '/auth/kakao';
        window.location.href = KAKAO_AUTH_URL;
    },
    // ── 비밀번호 재설정 ────────────────────────────────────────────────────
    sendPasswordResetEmail: async (email) => {
        set({ isLoading: true, error: null });
        try {
            const { sendPasswordResetEmail: fbReset } = await import('@/lib/firebase-auth');
            await fbReset(email);
            set({ isLoading: false });
        }
        catch (err) {
            set({ error: err.message || '비밀번호 재설정 실패', isLoading: false });
            throw err;
        }
    },
    // ── 로그아웃 ──────────────────────────────────────────────────────────
    logout: async () => {
        try {
            const { signOut } = await import('@/lib/firebase-auth');
            await signOut().catch(() => { });
        }
        catch (_) { }
        // user 세션 selective clear
        const { clearAuthData } = await import('@/utils/auth');
        clearAuthData('user');
        localStorage.removeItem('auth-kr-storage');
        localStorage.removeItem('auth-world-storage');
        localStorage.removeItem('lastLoginUid');
        set({ user: null, userRole: null, isLoading: false, isAuthReady: true });
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
        let isMounted = true; // ✅ tracks whether cleanup was already called
        let unsubscribeFn = null;
        // Firebase lazy load 후 구독 시작 (비동기)
        (async () => {
            try {
                const { onAuthStateChanged } = await import('@/lib/firebase-auth');
                // ✅ If cleanup ran before we even reached here, bail out immediately
                if (!isMounted)
                    return;
                unsubscribeFn = await onAuthStateChanged(async (firebaseUser) => {
                    if (firebaseUser) {
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
                        catch (err) {
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
                    }
                    else {
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
            }
            catch (err) {
                console.error('[useAuthKR] onAuthStateChanged 설정 실패:', err);
                // ✅ BUG #9 FIX: Always mark auth as ready so the app doesn't hang
                set({ isLoading: false, isAuthReady: true });
            }
        })();
        // 즉시 반환 (cleanup 함수)
        return () => {
            isMounted = false; // ✅ prevent stale async IIFE from subscribing after unmount
            if (unsubscribeFn) {
                unsubscribeFn();
            }
        };
    },
}), {
    name: 'auth-kr-storage',
    partialize: (state) => ({
        userRole: state.userRole,
        // user 객체는 persist 하지 않음 (Firebase가 관리)
    }),
}), { name: 'AuthKR Store' }));
// ── Selector 훅 ───────────────────────────────────────────────────────────────
export const useAuthKRUser = () => useAuthKR((s) => s.user);
export const useAuthKRLoading = () => useAuthKR((s) => s.isLoading);
export const useAuthKRError = () => useAuthKR((s) => s.error);
export const useAuthKRRole = () => useAuthKR((s) => s.userRole);
export const useAuthKRReady = () => useAuthKR((s) => s.isAuthReady);

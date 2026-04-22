/**
 * Firebase Authentication Lazy Loading Module
 * 
 * This module provides lazy-loaded access to Firebase Authentication
 * to reduce initial bundle size. Auth is only loaded when authentication
 * features are actually used.
 * 
 * Created: 2026-03-09
 * Purpose: Performance optimization - lazy load Firebase Auth (~38 KB gzip)
 */

import type { 
  Auth, 
  User, 
  UserCredential,
  AuthProvider 
} from 'firebase/auth';

let authInstance: Auth | null = null;
// ✅ Race condition 방지: 진행 중인 초기화 Promise 재사용
let authInitPromise: Promise<Auth> | null = null;

/**
 * Get Firebase Auth instance (lazy loaded, singleton)
 * @returns Promise<Auth> - Firebase Auth instance
 */
export async function getFirebaseAuth(): Promise<Auth> {
  if (authInstance) {
    return authInstance;
  }

  // 이미 초기화 중이면 동일 Promise 반환 (race condition 방지)
  if (authInitPromise) {
    return authInitPromise;
  }

  authInitPromise = (async () => {
    try {
      // Lazy load firebase/auth
      const { getAuth, setPersistence, browserLocalPersistence } = await import('firebase/auth');
      const { initializeAll } = await import('./firebase-config');

      // Initialize Firebase app first
      const app = await initializeAll();

      if (!app) {
        throw new Error('Firebase app not initialized');
      }

      authInstance = getAuth(app);

      // ✅ 무조건 browserLocalPersistence 설정 (세션 유지 핵심)
      try {
        await setPersistence(authInstance, browserLocalPersistence);
      } catch (persistErr) {
        console.error('[Firebase Auth] ❌ Persistence 설정 실패:', persistErr);
      }

      return authInstance;
    } catch (error) {
      authInitPromise = null; // 실패 시 재시도 허용
      console.error('[Firebase Auth] ❌ Failed to lazy load:', error);
      throw error;
    }
  })();

  return authInitPromise;
}

/**
 * Sign in with custom Firebase token (lazy loaded)
 * @param token - Firebase custom token
 * @returns Promise<UserCredential>
 */
export async function signInWithCustomToken(token: string): Promise<UserCredential> {
  try {
    const auth = await getFirebaseAuth();
    const { signInWithCustomToken: signInFn, setPersistence, browserLocalPersistence } = await import('firebase/auth');
    
    // Set persistence to LOCAL to keep user logged in across browser sessions
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInFn(auth, token);
    
    // Force token refresh in background
    credential.user.getIdToken(true).catch((err) => {
      if (import.meta.env.DEV) console.warn('[Firebase Auth] ⚠️ Token refresh failed:', err);
    });
    
    return credential;
  } catch (error) {
    console.error('[Firebase Auth] ❌ Sign in failed:', error);
    throw error;
  }
}

/**
 * Sign in with email and password (lazy loaded)
 * @param email - User email
 * @param password - User password
 * @returns Promise<UserCredential>
 */
export async function signInWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
  try {
    const auth = await getFirebaseAuth();
    const { signInWithEmailAndPassword: signInFn, setPersistence, browserLocalPersistence } = await import('firebase/auth');
    
    // Set persistence to LOCAL to keep user logged in across browser sessions
    await setPersistence(auth, browserLocalPersistence);
    const credential = await signInFn(auth, email, password);
    return credential;
  } catch (error) {
    console.error('[Firebase Auth] ❌ Email sign in failed:', error);
    throw error;
  }
}

/**
 * Create user with email and password (lazy loaded)
 * @param email - User email
 * @param password - User password
 * @returns Promise<UserCredential>
 */
export async function createUserWithEmailAndPassword(email: string, password: string): Promise<UserCredential> {
  try {
    const auth = await getFirebaseAuth();
    const { createUserWithEmailAndPassword: createFn } = await import('firebase/auth');
    
    const credential = await createFn(auth, email, password);
    return credential;
  } catch (error) {
    console.error('[Firebase Auth] ❌ User creation failed:', error);
    throw error;
  }
}

/**
 * Sign in with Google popup (lazy loaded)
 * @returns Promise<UserCredential>
 */
export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    const auth = await getFirebaseAuth();
    const { GoogleAuthProvider, signInWithPopup, setPersistence, browserLocalPersistence } = await import('firebase/auth');
    
    // Set persistence to LOCAL to keep user logged in across browser sessions
    await setPersistence(auth, browserLocalPersistence);
    const provider = new GoogleAuthProvider();
    provider.addScope('email');
    provider.addScope('profile');
    
    const credential = await signInWithPopup(auth, provider);
    
    return credential;
  } catch (error) {
    console.error('[Firebase Auth] ❌ Google sign in failed:', error);
    throw error;
  }
}

/**
 * Sign out (lazy loaded)
 */
export async function signOut(): Promise<void> {
  try {
    const auth = await getFirebaseAuth();
    const { signOut: signOutFn } = await import('firebase/auth');
    
    await signOutFn(auth);
    authInstance = null;     // Reset instance after sign out
    authInitPromise = null;  // Allow re-initialization
  } catch (error) {
    console.error('[Firebase Auth] ❌ Sign out failed:', error);
    throw error;
  }
}

/**
 * Send password reset email (lazy loaded)
 * @param email - User email
 */
export async function sendPasswordResetEmail(email: string): Promise<void> {
  try {
    const auth = await getFirebaseAuth();
    const { sendPasswordResetEmail: sendResetFn } = await import('firebase/auth');
    
    await sendResetFn(auth, email);
  } catch (error) {
    console.error('[Firebase Auth] ❌ Password reset email failed:', error);
    throw error;
  }
}

/**
 * Get current user (lazy loaded)
 * @returns Promise<User | null>
 */
export async function getCurrentUser(): Promise<User | null> {
  try {
    const auth = await getFirebaseAuth();
    return auth.currentUser;
  } catch (error) {
    console.error('[Firebase Auth] ❌ Failed to get current user:', error);
    return null;
  }
}

/**
 * Auth state change listener (lazy loaded)
 * @param callback - Callback function for auth state changes
 * @returns Promise<function> - Unsubscribe function
 */
export async function onAuthStateChanged(
  callback: (user: User | null) => void
): Promise<() => void> {
  try {
    const auth = await getFirebaseAuth();
    const { onAuthStateChanged: onAuthStateChangedFn } = await import('firebase/auth');
    
    return onAuthStateChangedFn(auth, callback);
  } catch (error) {
    console.error('[Firebase Auth] ❌ Failed to set up auth state listener:', error);
    throw error;
  }
}

/**
 * Check if Firebase Auth is initialized
 */
export function isAuthInitialized(): boolean {
  return authInstance !== null;
}

// Export types for convenience
export type { Auth, User, UserCredential, AuthProvider };

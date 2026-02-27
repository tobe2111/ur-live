import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  User,
  UserCredential
} from 'firebase/auth';
import { auth } from './firebase-config';

/**
 * 🔥 Firebase Authentication 헬퍼 함수들
 * 
 * 모든 인증 로직을 Firebase Auth로 처리
 * 카카오 로그인은 Custom Token 방식 사용
 */

// ============================================
// 이메일/비밀번호 인증
// ============================================

/**
 * 회원가입
 */
export async function signUp(email: string, password: string, displayName: string): Promise<UserCredential> {
  try {
    console.log('[Firebase Auth] 📝 Signing up:', email);
    
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // 사용자 프로필 업데이트
    await updateProfile(userCredential.user, {
      displayName
    });
    
    console.log('[Firebase Auth] ✅ Sign up successful:', userCredential.user.uid);
    return userCredential;
  } catch (error: any) {
    console.error('[Firebase Auth] ❌ Sign up failed:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * 로그인
 */
export async function signIn(email: string, password: string): Promise<UserCredential> {
  try {
    console.log('[Firebase Auth] 🔑 Signing in:', email);
    
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    console.log('[Firebase Auth] ✅ Sign in successful:', userCredential.user.uid);
    return userCredential;
  } catch (error: any) {
    console.error('[Firebase Auth] ❌ Sign in failed:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

/**
 * 로그아웃
 */
export async function signOut(): Promise<void> {
  try {
    console.log('[Firebase Auth] 👋 Signing out');
    await firebaseSignOut(auth);
    console.log('[Firebase Auth] ✅ Sign out successful');
  } catch (error: any) {
    console.error('[Firebase Auth] ❌ Sign out failed:', error);
    throw error;
  }
}

/**
 * 비밀번호 재설정 이메일 전송
 */
export async function resetPassword(email: string): Promise<void> {
  try {
    console.log('[Firebase Auth] 📧 Sending password reset email:', email);
    
    await sendPasswordResetEmail(auth, email);
    
    console.log('[Firebase Auth] ✅ Password reset email sent');
  } catch (error: any) {
    console.error('[Firebase Auth] ❌ Password reset failed:', error);
    throw new Error(getAuthErrorMessage(error.code));
  }
}

// ============================================
// JWT 토큰 관리
// ============================================

/**
 * 현재 사용자의 Firebase JWT 토큰 가져오기
 */
export async function getIdToken(forceRefresh: boolean = false): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) {
      console.log('[Firebase Auth] ⚠️ No current user');
      return null;
    }
    
    const token = await user.getIdToken(forceRefresh);
    console.log('[Firebase Auth] ✅ ID token retrieved');
    return token;
  } catch (error) {
    console.error('[Firebase Auth] ❌ Failed to get ID token:', error);
    return null;
  }
}

/**
 * 현재 로그인된 사용자 가져오기
 */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}

// ============================================
// 에러 메시지 한글화
// ============================================

function getAuthErrorMessage(errorCode: string): string {
  const errorMessages: Record<string, string> = {
    'auth/email-already-in-use': '이미 사용 중인 이메일입니다.',
    'auth/invalid-email': '유효하지 않은 이메일 주소입니다.',
    'auth/operation-not-allowed': '이메일/비밀번호 로그인이 비활성화되어 있습니다.',
    'auth/weak-password': '비밀번호는 최소 6자 이상이어야 합니다.',
    'auth/user-disabled': '이 계정은 비활성화되었습니다.',
    'auth/user-not-found': '이메일 또는 비밀번호가 일치하지 않습니다.',
    'auth/wrong-password': '이메일 또는 비밀번호가 일치하지 않습니다.',
    'auth/too-many-requests': '너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.',
    'auth/network-request-failed': '네트워크 연결을 확인해주세요.',
  };

  return errorMessages[errorCode] || '인증 중 오류가 발생했습니다.';
}

// ============================================
// 카카오 로그인 (Custom Token 방식)
// ============================================

/**
 * 카카오 로그인 - Custom Token 방식
 * 
 * 흐름:
 * 1. 카카오 OAuth로 code 받기
 * 2. 백엔드에서 code → 카카오 access token 교환
 * 3. 백엔드에서 Firebase Custom Token 생성
 * 4. 프론트엔드에서 Custom Token으로 Firebase Auth 로그인
 */
export async function signInWithKakaoCustomToken(customToken: string): Promise<UserCredential> {
  try {
    console.log('[Firebase Auth] 🔑 Signing in with Kakao Custom Token');
    
    const { signInWithCustomToken } = await import('firebase/auth');
    const userCredential = await signInWithCustomToken(auth, customToken);
    
    console.log('[Firebase Auth] ✅ Kakao sign in successful:', userCredential.user.uid);
    return userCredential;
  } catch (error: any) {
    console.error('[Firebase Auth] ❌ Kakao sign in failed:', error);
    throw new Error('카카오 로그인에 실패했습니다.');
  }
}

export default auth;

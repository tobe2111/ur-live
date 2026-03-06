/**
 * 🔐 Login Flow Service
 * 
 * 모든 로그인 관련 로직을 여기에 집중
 * - Kakao 로그인
 * - Firebase Custom Token 처리
 * - Token 갱신
 */

import { signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'

/**
 * 카카오 액세스 토큰으로 Firebase 로그인
 */
export async function loginWithKakaoToken(accessToken: string): Promise<void> {
  console.log('[LoginFlow] 🔑 카카오 토큰으로 Firebase 로그인 시작')
  
  try {
    // 1. 백엔드에서 Firebase Custom Token 받기
    const response = await fetch('/api/auth/kakao/firebase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken }),
    })

    if (!response.ok) {
      throw new Error(`Backend error: ${response.status}`)
    }

    const data = await response.json()
    
    if (!data.firebaseToken && !data.customToken) {
      throw new Error('No Firebase token received from backend')
    }

    const customToken = data.firebaseToken || data.customToken

    // 2. Firebase Custom Token으로 로그인
    console.log('[LoginFlow] 🔥 Firebase Custom Token으로 로그인 중...')
    const credential = await signInWithCustomToken(auth, customToken)
    
    console.log('[LoginFlow] ✅ Firebase 로그인 성공:', credential.user.uid)

    // 3. 백그라운드에서 Token 갱신 (속도 최적화)
    credential.user.getIdToken(true)
      .then(() => console.log('[LoginFlow] 🔥 ID Token 강제 갱신 완료'))
      .catch((err) => console.warn('[LoginFlow] ⚠️ Token 갱신 실패 (무시):', err))

  } catch (error) {
    console.error('[LoginFlow] ❌ 카카오 로그인 실패:', error)
    throw error
  }
}

/**
 * Firebase Custom Token으로 직접 로그인 (URL에서 받은 경우)
 */
export async function loginWithFirebaseToken(firebaseToken: string): Promise<void> {
  console.log('[LoginFlow] 🔑 Firebase Custom Token으로 직접 로그인')
  
  try {
    const credential = await signInWithCustomToken(auth, firebaseToken)
    console.log('[LoginFlow] ✅ Firebase 로그인 성공:', credential.user.uid)

    // 백그라운드 Token 갱신
    credential.user.getIdToken(true)
      .then(() => console.log('[LoginFlow] 🔥 ID Token 강제 갱신 완료'))
      .catch((err) => console.warn('[LoginFlow] ⚠️ Token 갱신 실패 (무시):', err))

  } catch (error) {
    console.error('[LoginFlow] ❌ Firebase Token 로그인 실패:', error)
    throw error
  }
}

/**
 * 로그아웃
 */
export async function logout(): Promise<void> {
  console.log('[LoginFlow] 🚪 로그아웃 시작')
  
  try {
    await auth.signOut()
    
    // localStorage 정리
    localStorage.removeItem('user_name')
    localStorage.removeItem('loginReturnUrl')
    
    console.log('[LoginFlow] ✅ 로그아웃 완료')
  } catch (error) {
    console.error('[LoginFlow] ❌ 로그아웃 실패:', error)
    throw error
  }
}

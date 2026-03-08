/**
 * Firebase 유틸리티 함수
 */

import { auth } from './firebase'

/**
 * Firebase가 초기화되었는지 확인
 */
export function isFirebaseInitialized(): boolean {
  try {
    return !!auth && !!auth.app
  } catch (error) {
    console.error('[Firebase Utils] 초기화 확인 실패:', error)
    return false
  }
}

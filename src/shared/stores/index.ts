/**
 * 인증 스토어 단일 진입점
 *
 * ✅ 리팩토링 완료: useAuth 단일 스토어만 사용.
 *    useAuthKR / useAuthWorld / useAuthStore 는 삭제 대상이며
 *    더 이상 이 파일에서 re-export 하지 않는다.
 *
 * 사용법:
 *   import { useAuth } from '@/shared/stores'
 *   // 또는
 *   import { useAuth } from '@/shared/stores/useAuth'
 */

// ── 단일 통합 인증 스토어 ─────────────────────────────────────────────────
export { useAuth, useAuthUser, useAuthReady, useIsLoggedIn } from './useAuth'
export type { AuthState, UserRole } from './useAuth'

// ── UI 상태 스토어 (모달 등) ──────────────────────────────────────────────
export {
  useAuthUI,
  useLoginModalOpen,
  useSignupModalOpen,
  useResetPasswordModalOpen,
  useGlobalLoading,
  useErrorMessage,
} from './useAuthUI'

// ── 장바구니 스토어 ────────────────────────────────────────────────────────
export { useCartStore } from '../../client/stores/cart.store'

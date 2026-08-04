/**
 * Unified Auth Store - Single Source of Truth
 * 
 * Architecture:
 * - useAuthKR → KR 인증 상태(카카오 세션). 🔥 2026-08-04 useAuthWorld/Firebase 제거(#804 GLOBAL 폐기).
 * - useAuthStore              → JWT-based auth for multi-seller Worker API
 * 
 * Rule: Pages should prefer useAuthKR,
 *       and useAuthStore for the new Worker API flows (registration/login via /api/auth).
 * 
 * This module re-exports everything from a single location.
 */

// ---- Firebase-based stores (KR + World regions) ----
export {
  useAuthKR,
  useAuthKRUser,
  useAuthKRLoading,
  useAuthKRError,
  useAuthKRRole,
  useAuthKRReady,
} from './useAuthKR';


// ---- JWT Worker API auth store ----
export { useAuthStore } from '../../client/stores/auth.store';

// ---- Multi-seller cart store ----
export { useCartStore } from '../../client/stores/cart.store';

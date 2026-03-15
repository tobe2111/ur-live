/**
 * Unified Auth Store - Single Source of Truth
 *
 * Architecture:
 * - useAuthKR / useAuthWorld  → Firebase-based auth (KR region: Kakao+Firebase, World: Google)
 * - useAuthStore              → JWT-based auth for multi-seller Worker API
 *
 * Rule: Pages should prefer useAuthKR/useAuthWorld for Firebase flows,
 *       and useAuthStore for the new Worker API flows (registration/login via /api/auth).
 *
 * This module re-exports everything from a single location.
 */
// ---- Firebase-based stores (KR + World regions) ----
export { useAuthKR, useAuthKRUser, useAuthKRLoading, useAuthKRError, useAuthKRRole, useAuthKRReady, } from './useAuthKR';
export { useAuthWorld, useAuthWorldUser, useAuthWorldLoading, useAuthWorldError, useAuthWorldRole, useAuthWorldReady, } from './useAuthWorld';
export { useAuthUI, useLoginModalOpen, useSignupModalOpen, useResetPasswordModalOpen, useGlobalLoading, useErrorMessage, } from './useAuthUI';
// ---- JWT Worker API auth store ----
export { useAuthStore } from '../../client/stores/auth.store';
// ---- Multi-seller cart store ----
export { useCartStore } from '../../client/stores/cart.store';

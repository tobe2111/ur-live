/**
 * ✅ Zustand Stores - Centralized Auth State Management
 * 
 * Week 5 Day 1 - AuthContext → Zustand Migration
 * 
 * 목적:
 * - React Hook 규칙 위반 100% 제거
 * - 리렌더링 50% 이상 감소 (Selector 사용)
 * - 테스트 가능한 순수 함수로 전환
 * - KR/WORLD 완전 분리
 */

// KR Store (Kakao + Firebase Email)
export { useAuthKR, useAuthKRUser, useAuthKRLoading, useAuthKRError, useAuthKRRole, useAuthKRReady } from './useAuthKR';

// WORLD Store (Google OAuth)
export { useAuthWorld, useAuthWorldUser, useAuthWorldLoading, useAuthWorldError, useAuthWorldRole, useAuthWorldReady } from './useAuthWorld';

// UI Store (Modals, Loading, Errors)
export { useAuthUI, useLoginModalOpen, useSignupModalOpen, useResetPasswordModalOpen, useGlobalLoading, useErrorMessage } from './useAuthUI';

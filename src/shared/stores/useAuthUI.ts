import { create } from 'zustand';

/**
 * ✅ UI 전용 Store
 * - 모달, 로딩 스피너, 에러 메시지 등 순수 UI 상태만 관리
 * - Context API를 대체 → 불필요한 리렌더 제거
 */
interface AuthUIState {
  // 모달 상태
  isLoginModalOpen: boolean;
  isSignupModalOpen: boolean;
  isResetPasswordModalOpen: boolean;

  // 로딩 스피너
  isGlobalLoading: boolean;

  // 에러 토스트
  errorMessage: string | null;

  // Actions
  openLoginModal: () => void;
  closeLoginModal: () => void;
  openSignupModal: () => void;
  closeSignupModal: () => void;
  openResetPasswordModal: () => void;
  closeResetPasswordModal: () => void;
  setGlobalLoading: (loading: boolean) => void;
  showError: (message: string) => void;
  clearError: () => void;
}

export const useAuthUI = create<AuthUIState>((set) => ({
  isLoginModalOpen: false,
  isSignupModalOpen: false,
  isResetPasswordModalOpen: false,
  isGlobalLoading: false,
  errorMessage: null,

  openLoginModal: () => set({ isLoginModalOpen: true }),
  closeLoginModal: () => set({ isLoginModalOpen: false }),
  openSignupModal: () => set({ isSignupModalOpen: true }),
  closeSignupModal: () => set({ isSignupModalOpen: false }),
  openResetPasswordModal: () => set({ isResetPasswordModalOpen: true }),
  closeResetPasswordModal: () => set({ isResetPasswordModalOpen: false }),
  setGlobalLoading: (isGlobalLoading) => set({ isGlobalLoading }),
  showError: (errorMessage) => set({ errorMessage }),
  clearError: () => set({ errorMessage: null }),
}));

// Selectors
export const useLoginModalOpen = () => useAuthUI((state) => state.isLoginModalOpen);
export const useSignupModalOpen = () => useAuthUI((state) => state.isSignupModalOpen);
export const useResetPasswordModalOpen = () => useAuthUI((state) => state.isResetPasswordModalOpen);
export const useGlobalLoading = () => useAuthUI((state) => state.isGlobalLoading);
export const useErrorMessage = () => useAuthUI((state) => state.errorMessage);

import { create } from 'zustand';
export const useAuthUI = create((set) => ({
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

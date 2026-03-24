import { create } from 'zustand'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastStore {
  toasts: ToastItem[]
  show: (message: string, type?: 'success' | 'error' | 'info') => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  remove: (id: string) => void
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'info') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
  success: (message) => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type: 'success' }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
  error: (message) => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type: 'error' }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  info: (message) => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type: 'info' }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// 컴포넌트 외부에서 사용할 수 있는 헬퍼 (non-hook context)
export const toast = {
  show: (message: string, type?: 'success' | 'error' | 'info') =>
    useToast.getState().show(message, type),
  success: (message: string) => useToast.getState().success(message),
  error: (message: string) => useToast.getState().error(message),
  info: (message: string) => useToast.getState().info(message),
}

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

// v36 FIX: 중복 토스트 방지
// 같은 (message, type) 조합이 1.5초 이내 재호출되면 표시 스킵 (sliding window).
// 에러 버스트(네트워크 실패 등)로 동일 토스트 10개 쌓이던 UX 문제 해결.
const DEDUPE_WINDOW_MS = 1500
const lastShownMap = new Map<string, number>()

function pushToast(
  set: (fn: (s: ToastStore) => Partial<ToastStore>) => void,
  message: string,
  type: 'success' | 'error' | 'info',
  ttl: number,
) {
  const key = `${type}:${message}`
  const now = Date.now()
  const last = lastShownMap.get(key)
  if (last && now - last < DEDUPE_WINDOW_MS) {
    lastShownMap.set(key, now)
    return
  }
  lastShownMap.set(key, now)

  const id = crypto.randomUUID()
  set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
  setTimeout(() => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  }, ttl)
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'info') => pushToast(set, message, type, 3500),
  success: (message) => pushToast(set, message, 'success', 3500),
  error: (message) => pushToast(set, message, 'error', 4000),
  info: (message) => pushToast(set, message, 'info', 3500),
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

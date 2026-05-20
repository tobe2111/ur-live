import { create } from 'zustand'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

// 🛡️ 2026-05-20: 일부 호출처가 `{ duration: ms }` 2nd arg 를 넘기던 사고 (TS2554).
//   현 구현은 기본 ttl 만 쓰지만 시그니처는 받아서 호환 — duration > 0 이면 그 값으로 적용.
export interface ToastOptions {
  duration?: number
}

interface ToastStore {
  toasts: ToastItem[]
  show: (message: string, type?: 'success' | 'error' | 'info', opts?: ToastOptions) => void
  success: (message: string, opts?: ToastOptions) => void
  error: (message: string, opts?: ToastOptions) => void
  info: (message: string, opts?: ToastOptions) => void
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

const pickTtl = (opts: ToastOptions | undefined, fallback: number): number => {
  const d = opts?.duration
  return typeof d === 'number' && d > 0 ? d : fallback
}

export const useToast = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'info', opts) => pushToast(set, message, type, pickTtl(opts, 3500)),
  success: (message, opts) => pushToast(set, message, 'success', pickTtl(opts, 3500)),
  error: (message, opts) => pushToast(set, message, 'error', pickTtl(opts, 4000)),
  info: (message, opts) => pushToast(set, message, 'info', pickTtl(opts, 3500)),
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

// 컴포넌트 외부에서 사용할 수 있는 헬퍼 (non-hook context)
export const toast = {
  show: (message: string, type?: 'success' | 'error' | 'info', opts?: ToastOptions) =>
    useToast.getState().show(message, type, opts),
  success: (message: string, opts?: ToastOptions) => useToast.getState().success(message, opts),
  error: (message: string, opts?: ToastOptions) => useToast.getState().error(message, opts),
  info: (message: string, opts?: ToastOptions) => useToast.getState().info(message, opts),
}

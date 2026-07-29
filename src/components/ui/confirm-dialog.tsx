/**
 * 🏭 2026-06-05 (사용자 요청 — 네이티브 confirm/alert 가 디자인 해침): 서비스 내 통일 confirm/alert 인프라.
 *
 *   - 어디서나 호출: `const ok = await confirmDialog({ message })` / `await alertDialog({ message })`
 *     (React 컴포넌트 밖·async 핸들러에서도 사용 가능 — window.confirm 과 동일 사용감, Promise 반환)
 *   - 앱 루트에 <ConfirmHost /> 1개 마운트 → 모든 호출이 같은 디자인 모달로 렌더.
 *   - 안전망: Host 미마운트(초기/테스트) 시 네이티브 confirm/alert 로 graceful fallback.
 *
 *   영구성: 새 코드는 window.confirm 대신 이 함수만 쓰면 자동으로 통일 디자인.
 */
import { useEffect, useRef, useState } from 'react'

export interface ConfirmOptions {
  title?: string
  message: string
  confirmText?: string
  cancelText?: string
  /** 위험 작업(삭제/취소/환불) — 확인 버튼 빨강. */
  danger?: boolean
  /** 단일 버튼(알림). alertDialog 가 설정. */
  alert?: boolean
  /** 🆕 2026-06-29: 입력 prompt 모드 — promptDialog 가 설정. 확인 시 입력문자열, 취소 시 null 반환. */
  prompt?: { placeholder?: string; defaultValue?: string; required?: boolean; multiline?: boolean }
}

interface ConfirmState extends ConfirmOptions {
  resolve: (v: boolean | string | null) => void
}

let _push: ((s: ConfirmState) => void) | null = null

/** window.confirm 대체 — 확인 시 true. */
export function confirmDialog(opts: ConfirmOptions | string): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts
  return new Promise<boolean>((resolve) => {
    if (!_push) {
      // Host 미마운트 — 네이티브 fallback (안전).
      try { resolve(o.alert ? (window.alert(o.message), true) : window.confirm([o.title, o.message].filter(Boolean).join('\n\n'))) }
      catch { resolve(false) }
      return
    }
    _push({ ...o, resolve: resolve as (v: boolean | string | null) => void })
  })
}

/** window.alert 대체 — 단일 '확인' 버튼. */
export function alertDialog(opts: ConfirmOptions | string): Promise<void> {
  const o: ConfirmOptions = typeof opts === 'string' ? { message: opts } : opts
  return confirmDialog({ ...o, alert: true }).then(() => undefined)
}

/** window.prompt 대체 — 통일 디자인 입력 모달. 확인 시 입력문자열, 취소(또는 required 미입력 취소) 시 null. */
export function promptDialog(opts: ConfirmOptions): Promise<string | null> {
  const o: ConfirmOptions = { ...opts, prompt: opts.prompt || {} }
  return new Promise<string | null>((resolve) => {
    if (!_push) {
      // Host 미마운트 — 네이티브 fallback (안전).
      try { resolve(window.prompt([o.title, o.message].filter(Boolean).join('\n\n'), o.prompt?.defaultValue || '')) }
      catch { resolve(null) }
      return
    }
    _push({ ...o, resolve: resolve as (v: boolean | string | null) => void })
  })
}

/**
 * 앱 루트에 1개 마운트. 모든 confirmDialog/alertDialog 호출을 통일 모달로 렌더.
 */
export function ConfirmHost() {
  const [queue, setQueue] = useState<ConfirmState[]>([])
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement | null>(null)
  useEffect(() => {
    _push = (s) => setQueue((q) => [...q, s])
    return () => { _push = null }
  }, [])

  const current = queue[0] || null
  if (!current) return null

  const close = (v: boolean) => {
    if (current.prompt) {
      // prompt 모드: 확인 → 입력값(문자열), 취소 → null. required 면 빈값 확인은 무시(모달 유지).
      if (v) {
        const val = (inputRef.current?.value ?? '').trim()
        if (current.prompt.required && !val) { inputRef.current?.focus(); return }
        current.resolve(val)
      } else {
        current.resolve(null)
      }
    } else {
      current.resolve(v)
    }
    setQueue((q) => q.slice(1))
  }

  return (
    <div
      className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => close(false)}
      role="presentation"
    >
      <div
        className="w-full sm:max-w-sm bg-white dark:bg-[#161616] rounded-t-2xl sm:rounded-2xl p-5 sm:mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {current.title && (
          <p className="text-[16px] font-extrabold text-gray-900 dark:text-white mb-1.5">{current.title}</p>
        )}
        <p className="text-[14px] text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-line">{current.message}</p>

        {current.prompt && (
          current.prompt.multiline ? (
            <textarea
              key={queue.length}
              ref={inputRef}
              defaultValue={current.prompt.defaultValue}
              placeholder={current.prompt.placeholder}
              autoFocus
              rows={3}
              className="mt-3 w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-[#333] text-[14px] text-gray-900 dark:text-white bg-white dark:bg-[#0f0f0f] outline-none resize-none focus:border-gray-500"
            />
          ) : (
            <input
              key={queue.length}
              ref={inputRef}
              defaultValue={current.prompt.defaultValue}
              placeholder={current.prompt.placeholder}
              autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') close(true) }}
              className="mt-3 w-full h-11 px-3 rounded-xl border border-gray-300 dark:border-[#333] text-[14px] text-gray-900 dark:text-white bg-white dark:bg-[#0f0f0f] outline-none focus:border-gray-500"
            />
          )
        )}

        <div className="mt-5 flex gap-2">
          {!current.alert && (
            <button
              onClick={() => close(false)}
              className="flex-1 h-12 rounded-xl text-[14px] font-bold text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-[#262626] active:scale-[0.98] transition-transform"
            >
              {current.cancelText || '취소'}
            </button>
          )}
          <button
            onClick={() => close(true)}
            className="flex-1 h-12 rounded-xl text-[14px] font-extrabold text-white active:scale-[0.98] transition-transform"
            style={{ background: current.danger ? 'linear-gradient(135deg, #ef4444, #dc2626)' : 'linear-gradient(135deg, #6b7280, #6b7280)' }}
          >
            {current.confirmText || '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

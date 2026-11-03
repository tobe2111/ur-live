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
// 🎬 2026-11-02 시안 9차 "확인 창"(대표 "다 해주고") — 뒤가 어두워지며 창이 폰에선 아래에서 올라오고 PC 에선 서서히 뜬다.
//   ⚖️ 새 CSS 없이 공용 등장(`.ur-sheet-veil`·`.ur-dialog-in`, index.css — 동작 줄이기 처리 포함)을 쓴다. 이 창은 모든 화면이 싣는 셸에 있다.

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

  // 🪟 2026-11-02 대표 확정 — **유리 확인창** (*"블러 없이 유리로 하자"*, `docs/design/popup-system-2026-11.md`).
  //   폰·PC 모두 화면 가운데 작은 카드(종전: 폰은 아래 시트). 판은 `.ur-glass`, 뒤 막은 `.ur-veil`(흐림 없음).
  //   버튼은 얇은 선으로 나눈 글자 버튼 둘 — 색 면 버튼을 두지 않는다(B2 렌더에서 꽉 찬 빨강이
  //   "화면에서 가장 시끄러운 것" 이라 세련되지 않다는 지적을 받았다). 위험만 빨간 글자, 나머지는 브랜드 글자.
  return (
    <div
      className="fixed inset-0 z-[100000] grid place-items-center px-8 ur-veil ur-sheet-veil"
      onClick={() => close(false)}
      role="presentation"
    >
      <div
        key={queue.length}
        className="ur-glass ur-dialog-in w-full max-w-[320px] ur-pop-card overflow-hidden text-center"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={current.title || current.message}
      >
        <div className="px-6 pt-7 pb-5">
          {current.title && (
            <p className="text-[16px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">{current.title}</p>
          )}
          <p className={`${current.title ? 'mt-2 text-gray-600 dark:text-gray-300' : 'text-gray-900 dark:text-white'} text-[15px] leading-relaxed whitespace-pre-line`}>{current.message}</p>

          {current.prompt && (
            current.prompt.multiline ? (
              <textarea
                key={queue.length}
                ref={inputRef}
                defaultValue={current.prompt.defaultValue}
                placeholder={current.prompt.placeholder}
                autoFocus
                rows={3}
                className="mt-5 w-full px-3 py-2 rounded-xl bg-surface text-left text-[15px] text-gray-900 dark:text-white outline-none resize-none focus:ring-2 focus:ring-brand/40"
              />
            ) : (
              <input
                key={queue.length}
                ref={inputRef}
                defaultValue={current.prompt.defaultValue}
                placeholder={current.prompt.placeholder}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') close(true) }}
                className="mt-5 w-full h-11 px-3 rounded-xl bg-surface text-left text-[15px] text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-brand/40"
              />
            )
          )}
        </div>

        <div className={`grid ${current.alert ? 'grid-cols-1' : 'grid-cols-2'} border-t ur-glass-rule`}>
          {!current.alert && (
            <button
              type="button"
              onClick={() => close(false)}
              className="h-[52px] text-[15px] font-medium text-gray-700 dark:text-gray-200 active:bg-black/5 dark:active:bg-white/5 focus:outline-none focus-visible:bg-black/5"
            >
              {current.cancelText || '취소'}
            </button>
          )}
          <button
            type="button"
            onClick={() => close(true)}
            className={`h-[52px] text-[15px] font-bold ${current.alert ? '' : 'border-l ur-glass-rule'} ${current.danger ? 'text-red-500' : 'text-brand-text'} active:bg-black/5 dark:active:bg-white/5 focus:outline-none focus-visible:bg-black/5`}
          >
            {current.confirmText || '확인'}
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * 🪟 유어딜 선택창 — 브라우저 기본 `<select>` 를 그대로 대체한다 (2026-11-04 대표 신고)
 *
 * 대표: *"정산 계좌 등록 부분도 팝업 적용 필요해. 안되어있는거 전체 확인 필요"*.
 * 은행 고르기가 기본 `<select>` 라 폰에서 누르면 **휴대폰 기본 목록 창**이 떴다 — 2026-11-03 에 걷어 낸
 * `urdeal.kr 내용:` 기본 확인창과 같은 종류다. 전수로 세니 기본 선택창이 81파일 145곳이었다.
 *
 * ## 쓰는 법 — 태그 이름만 바꾼다
 *   `<select value onChange={(e) => set(e.target.value)} className=…><option …/></select>`
 *   → `<Select …>` 같은 자식·같은 props. `onChange` 는 `e.target.value` 를 그대로 준다(기존 핸들러 무수정).
 *
 * ## 모양 (팝업 유리 체계 `docs/design/popup-system-2026-11.md` 와 같은 결)
 *   폰(<1024): 아래에서 올라오는 유리 시트(`ur-veil` + `ur-glass` + `ur-pop-sheet`) · 줄 48px · 고른 줄 체크.
 *   PC: 버튼 바로 아래 펼쳐지는 유리 목록(버튼 폭 이상).
 *   대시보드·light-island 안에서 열리면 목록도 라이트로 고정한다(포털이라 래퍼 밖에 그려지므로 직접 붙인다).
 *
 * ⚠️ 못 하는 것: `multiple` (쓰는 곳 0 — 2026-11-04 실측).
 */
import {
  Children, Fragment, isValidElement, useCallback, useEffect, useId, useRef, useState,
  type ChangeEvent, type CSSProperties, type ReactElement, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

interface Opt { value: string; label: ReactNode; text: string; disabled: boolean }

function textOf(n: ReactNode): string {
  if (n == null || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(textOf).join('')
  if (isValidElement(n)) return textOf((n.props as { children?: ReactNode }).children)
  return ''
}

/** `<option>` · `<optgroup>` · Fragment · 배열을 납작하게 모은다. */
function collect(children: ReactNode, out: Opt[] = [], groupDisabled = false): Opt[] {
  Children.forEach(children, (ch) => {
    if (!isValidElement(ch)) return
    const el = ch as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean; label?: string }>
    if (el.type === 'option') {
      const text = textOf(el.props.children)
      out.push({
        value: el.props.value != null ? String(el.props.value) : text,
        label: el.props.children,
        text,
        disabled: !!el.props.disabled || groupDisabled,
      })
    } else if (el.type === 'optgroup') {
      collect(el.props.children, out, !!el.props.disabled)
    } else if (el.type === Fragment) {
      collect(el.props.children, out, groupDisabled)
    }
  })
  return out
}

const LIGHT_SCOPES = '.light-island, .force-light-theme, .admin-light-theme, .agency-light-theme, .seller-light-theme'

export interface SelectProps {
  value?: string | number | readonly string[]
  defaultValue?: string | number
  onChange?: (e: ChangeEvent<HTMLSelectElement>) => void
  children?: ReactNode
  className?: string
  style?: CSSProperties
  disabled?: boolean
  id?: string
  name?: string
  title?: string
  required?: boolean
  'aria-label'?: string
}

export function Select({
  value, defaultValue, onChange, children, className = '', style, disabled, id, name, title, required,
  'aria-label': ariaLabel,
}: SelectProps) {
  const opts = collect(children)
  const controlled = value !== undefined
  const [inner, setInner] = useState<string>(defaultValue != null ? String(defaultValue) : (opts[0]?.value ?? ''))
  const cur = controlled ? String(value ?? '') : inner
  const selected = opts.find((o) => o.value === cur) ?? (controlled ? undefined : opts[0])

  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [wide, setWide] = useState(false)
  const [light, setLight] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const listId = useId()

  const openList = () => {
    if (disabled) return
    const b = btnRef.current
    setRect(b?.getBoundingClientRect() ?? null)
    setWide(typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches)
    setLight(!!b?.closest(LIGHT_SCOPES))
    setOpen(true)
  }
  const close = useCallback(() => { setOpen(false); btnRef.current?.focus() }, [])

  const pick = (o: Opt) => {
    if (o.disabled) return
    if (!controlled) setInner(o.value)
    if (o.value !== cur) {
      const target = { value: o.value, name: name ?? '' }
      onChange?.({ target, currentTarget: target } as unknown as ChangeEvent<HTMLSelectElement>)
    }
    close()
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    const onScroll = () => { if (wide) setOpen(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('resize', onScroll)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onScroll) }
  }, [open, wide, close])

  const heading = ariaLabel || title || (opts[0] && opts[0].value === '' ? opts[0].text : '') || '선택'

  const list = (
    <ul role="listbox" id={listId} aria-label={heading} className="py-1">
      {opts.map((o) => {
        const on = o.value === cur
        return (
          <li key={o.value + o.text} role="option" aria-selected={on} aria-disabled={o.disabled || undefined}>
            <button
              type="button"
              disabled={o.disabled}
              onClick={() => pick(o)}
              className={`w-full flex items-center justify-between gap-3 min-h-12 px-5 text-left text-[15px] ${on ? 'font-bold text-brand-text' : 'font-medium text-gray-900 dark:text-white'} disabled:text-gray-400 active:bg-black/5 dark:active:bg-white/5 focus:outline-none focus-visible:bg-black/5`}
            >
              <span className="min-w-0 truncate">{o.label}</span>
              {on && <Check className="w-[18px] h-[18px] shrink-0" strokeWidth={1.6} aria-hidden="true" />}
            </button>
          </li>
        )
      })}
    </ul>
  )

  const scope = light ? 'light-island ' : ''
  const portal = open && typeof document !== 'undefined' ? createPortal(
    wide && rect ? (
      <div className={`${scope}fixed inset-0 z-[100100]`} onClick={close} role="presentation">
        <div
          className="ur-glass ur-dialog-in rounded-2xl overflow-y-auto overscroll-contain"
          style={{
            position: 'fixed',
            left: Math.min(rect.left, window.innerWidth - Math.max(rect.width, 200) - 8),
            top: rect.bottom + 6 + 320 > window.innerHeight ? Math.max(8, rect.top - 6 - Math.min(320, opts.length * 48 + 8)) : rect.bottom + 6,
            minWidth: Math.max(rect.width, 200),
            maxHeight: 320,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {list}
        </div>
      </div>
    ) : (
      <div className={`${scope}fixed inset-0 z-[100100]`} role="presentation">
        <div className="fixed inset-0 ur-veil ur-sheet-veil" onClick={close} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          className="fixed inset-x-2 bottom-2 flex flex-col max-h-[70dvh] ur-pop-sheet ur-glass overflow-hidden ur-sheet-in pb-[env(safe-area-inset-bottom)]"
        >
          <div className="shrink-0 pt-2" aria-hidden="true"><div className="mx-auto w-10 h-[5px] rounded-full bg-gray-400/40" /></div>
          <p className="shrink-0 px-5 pt-3 pb-1 text-[16px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white truncate">{heading}</p>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-2">{list}</div>
        </div>
      </div>
    ),
    document.body,
  ) : null

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        title={title}
        disabled={disabled}
        aria-label={ariaLabel}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-required={required || undefined}
        onClick={openList}
        className={`${className} inline-flex items-center justify-between gap-2 text-left`}
        style={style}
      >
        <span className={`min-w-0 truncate ${selected && selected.value !== '' ? '' : 'opacity-60'}`}>{selected?.label ?? ''}</span>
        <ChevronDown className="w-4 h-4 shrink-0 opacity-60" strokeWidth={1.6} aria-hidden="true" />
      </button>
      {name ? <input type="hidden" name={name} value={cur} /> : null}
      {portal}
    </>
  )
}

export default Select

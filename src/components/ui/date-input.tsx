/**
 * 🗓️ 유어딜 날짜·시간 입력 — 브라우저 기본 `<input type="date|time">` 를 그대로 대체한다 (2026-11-05 대표 *"응 유어딜꺼로 바꿔"*)
 *
 * 2026-11-04 `<select>` → `<Select>` 전수 이행 뒤 남은 마지막 기본 창이 날짜·시간 고르기였다(33파일 43곳) —
 * 누르면 휴대폰 기본 달력·시계가 떴다.
 *
 * ## 쓰는 법 — 태그만 바꾼다
 *   `<input type="date" value onChange={(e) => set(e.target.value)} min className=… />`
 *   → `<DateInput type="date" …/>` 같은 props. 값 형식도 같다(`YYYY-MM-DD` · `HH:MM`, 비우면 '').
 *
 * ## 모양 (팝업 유리 체계 — `docs/design/popup-system-2026-11.md` · `select.tsx` 와 같은 결)
 *   폰(<1024): 아래에서 올라오는 유리 시트 · PC: 칸 아래 유리 달력. 대시보드·light-island 안이면 라이트 고정.
 *   날짜: 달 넘기기 + 7열 달력(일요일 빨강·토요일 파랑 아님 — 색 하나 규칙, 고른 날만 브랜드 면) · 오늘 · 지우기.
 *   시간: 시(00~23) · 분(5분 단위 + 지금 값) 두 줄 목록.
 *
 * 🪶 아이콘은 직접 그린다(lucide 를 부르면 그 봉투가 따라온다 — select.tsx 와 같은 이유).
 *   날짜+시간(`datetime-local`): 날짜를 고르면 같은 창이 시간으로 넘어간다(값 `YYYY-MM-DDTHH:MM`).
 *
 * ⚠️ 못 하는 것: `month`·`week`(쓰는 곳 0 — 2026-11-05 실측) · `step`(초 단위).
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

const LIGHT_SCOPES = '.light-island, .force-light-theme, .admin-light-theme, .agency-light-theme, .seller-light-theme'
const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`

function parseDate(v: string): { y: number; m: number; d: number } | null {
  const mm = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || '')
  return mm ? { y: +mm[1], m: +mm[2] - 1, d: +mm[3] } : null
}
function todayKst(): string {
  // 화면은 한국 날짜를 고른다 — 기기 시간대가 달라도 '오늘' 이 하루 밀리지 않게 KST 로 계산.
  const now = new Date(Date.now() + 9 * 3600_000)
  return ymd(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}
type Kind = 'date' | 'time' | 'datetime-local'
function labelOf(type: Kind, v: string): string {
  if (!v) return ''
  if (type === 'time') return v.slice(0, 5)
  if (type === 'datetime-local') {
    const t = /T(\d{2}:\d{2})/.exec(v)?.[1]
    return `${labelOf('date', v)}${t ? ` ${t}` : ''}`
  }
  const p = parseDate(v)
  if (!p) return v
  const dow = new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay()
  return `${p.y}.${pad(p.m + 1)}.${pad(p.d)} (${WEEK[dow]})`
}

function Icon({ d, className = '' }: { d: string; className?: string }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true"><path d={d} /></svg>
}
const CAL = 'M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v10a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-10ZM4 10h16M8.5 3.5v3M15.5 3.5v3'
const CLOCK = 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7.5V12l3 2'
const PREV = 'M15 6l-6 6 6 6'
const NEXT = 'M9 6l6 6-6 6'

export interface DateInputProps {
  type: Kind
  value?: string
  defaultValue?: string
  onChange?: (e: ChangeEvent<HTMLInputElement>) => void
  min?: string
  max?: string
  className?: string
  style?: CSSProperties
  disabled?: boolean
  required?: boolean
  id?: string
  name?: string
  placeholder?: string
  'aria-label'?: string
}

export function DateInput({
  type, value, defaultValue, onChange, min, max, className = '', style, disabled, required, id, name, placeholder,
  'aria-label': ariaLabel,
}: DateInputProps) {
  const controlled = value !== undefined
  const [inner, setInner] = useState(defaultValue ?? '')
  const cur = controlled ? (value ?? '') : inner

  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [wide, setWide] = useState(false)
  const [light, setLight] = useState(false)
  const [stage, setStage] = useState<'date' | 'time'>('date')
  const [pendingDate, setPendingDate] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)

  const emit = (v: string) => {
    if (!controlled) setInner(v)
    if (v !== cur) {
      const target = { value: v, name: name ?? '' }
      onChange?.({ target, currentTarget: target } as unknown as ChangeEvent<HTMLInputElement>)
    }
  }
  const openPanel = () => {
    if (disabled) return
    const b = btnRef.current
    setRect(b?.getBoundingClientRect() ?? null)
    setWide(typeof window !== 'undefined' && !!window.matchMedia?.('(min-width: 1024px)').matches)
    setLight(!!b?.closest(LIGHT_SCOPES))
    setStage('date')
    setOpen(true)
  }
  const close = useCallback(() => { setOpen(false); btnRef.current?.focus() }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  const fallback = type === 'time' ? '시간 선택' : type === 'date' ? '날짜 선택' : '날짜·시간 선택'
  const heading = ariaLabel || placeholder || fallback
  const clear = required ? undefined : () => { emit(''); close() }
  let panel
  if (type === 'date') {
    panel = <DatePanel value={cur} min={min} max={max} required={required} onPick={(v) => { emit(v); close() }} />
  } else if (type === 'time') {
    panel = <TimePanel value={cur} onPick={(v) => { emit(v); close() }} onClear={clear} />
  } else if (stage === 'date') {
    // 날짜+시간: 날짜를 먼저 고르면 같은 창이 시간으로 넘어간다.
    panel = <DatePanel value={cur} min={min} max={max} required={required} onPick={(v) => {
      if (!v) { emit(''); close(); return }
      setPendingDate(v); setStage('time')
    }} />
  } else {
    const sameDay = cur.slice(0, 10) === pendingDate
    panel = (
      <>
        <button type="button" onClick={() => setStage('date')} className="mx-5 mt-2 h-10 text-[15px] font-medium text-brand-text tabular-nums">‹ {labelOf('date', pendingDate)}</button>
        <TimePanel value={sameDay ? cur.slice(11, 16) : ''} onPick={(t) => { emit(`${pendingDate}T${t}`); close() }} onClear={clear} />
      </>
    )
  }

  const scope = light ? 'light-island ' : ''
  const portal = open && typeof document !== 'undefined' ? createPortal(
    wide && rect ? (
      <div className={`${scope}fixed inset-0 z-[100100]`} onClick={close} role="presentation">
        <div
          role="dialog"
          aria-label={heading}
          className="ur-glass ur-dialog-in rounded-2xl overflow-hidden"
          style={{
            position: 'fixed',
            left: Math.max(8, Math.min(rect.left, window.innerWidth - 328)),
            top: rect.bottom + 6 + 380 > window.innerHeight ? Math.max(8, rect.top - 6 - 380) : rect.bottom + 6,
            width: 320,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {panel}
        </div>
      </div>
    ) : (
      <div className={`${scope}fixed inset-0 z-[100100]`} role="presentation">
        <div className="fixed inset-0 ur-veil ur-sheet-veil" onClick={close} aria-hidden="true" />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={heading}
          className="fixed inset-x-2 bottom-2 flex flex-col max-h-[80dvh] ur-pop-sheet ur-glass overflow-hidden ur-sheet-in pb-[env(safe-area-inset-bottom)]"
        >
          <div className="shrink-0 pt-2" aria-hidden="true"><div className="mx-auto w-10 h-[5px] rounded-full bg-gray-400/40" /></div>
          <p className="shrink-0 px-5 pt-3 text-[16px] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white truncate">{heading}</p>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{panel}</div>
        </div>
      </div>
    ),
    document.body,
  ) : null

  const shown = labelOf(type, cur)
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-required={required || undefined}
        onClick={openPanel}
        className={`${className} inline-flex items-center justify-between gap-2 text-left`}
        style={style}
      >
        <span className={`min-w-0 truncate tabular-nums ${shown ? '' : 'opacity-60'}`}>{shown || placeholder || fallback}</span>
        <Icon d={type === 'time' ? CLOCK : CAL} className="w-4 h-4 shrink-0 opacity-60" />
      </button>
      {name ? <input type="hidden" name={name} value={cur} /> : null}
      {portal}
    </>
  )
}

function DatePanel({ value, min, max, required, onPick }: {
  value: string; min?: string; max?: string; required?: boolean; onPick: (v: string) => void
}) {
  const today = useMemo(todayKst, [])
  const start = parseDate(value) ?? parseDate(min && min > today ? min : today)!
  const [view, setView] = useState({ y: start.y, m: start.m })
  const first = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay()
  const days = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate()
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  while (cells.length % 7) cells.push(null)
  const move = (dm: number) => setView((v) => {
    const t = new Date(Date.UTC(v.y, v.m + dm, 1))
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() }
  })
  const out = (s: string) => (!!min && s < min.slice(0, 10)) || (!!max && s > max.slice(0, 10))
  const navBtn = 'w-10 h-10 grid place-items-center rounded-full text-gray-700 dark:text-gray-200 active:bg-black/5 dark:active:bg-white/5'

  return (
    <div className="px-3 pt-2 pb-3">
      <div className="flex items-center justify-between px-1 h-12">
        <button type="button" onClick={() => move(-1)} aria-label="이전 달" className={navBtn}><Icon d={PREV} className="w-5 h-5" /></button>
        <p className="text-[16px] font-semibold tabular-nums text-gray-900 dark:text-white">{view.y}년 {view.m + 1}월</p>
        <button type="button" onClick={() => move(1)} aria-label="다음 달" className={navBtn}><Icon d={NEXT} className="w-5 h-5" /></button>
      </div>
      <div className="grid grid-cols-7 text-center text-[12px] font-medium text-gray-500 dark:text-gray-400 h-8 items-center" aria-hidden="true">
        {WEEK.map((w) => <span key={w}>{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1" role="grid">
        {cells.map((d, i) => {
          if (d == null) return <span key={i} />
          const s = ymd(view.y, view.m, d)
          const on = s === value.slice(0, 10)
          const isToday = s === today
          const dis = out(s)
          return (
            <button
              key={i}
              type="button"
              disabled={dis}
              onClick={() => onPick(s)}
              aria-label={s}
              aria-pressed={on}
              className={`mx-auto w-10 h-10 rounded-full text-[15px] tabular-nums ${on ? 'bg-brand text-white font-medium' : isToday ? 'text-brand-text font-medium ring-1 ring-inset ring-brand/40' : 'text-gray-900 dark:text-white'} disabled:text-gray-300 dark:disabled:text-gray-600 disabled:ring-0 ${on || dis ? '' : 'active:bg-black/5 dark:active:bg-white/5'}`}
            >
              {d}
            </button>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-2 px-1">
        {!required && value
          ? <button type="button" onClick={() => onPick('')} className="h-10 px-3 text-[15px] font-medium text-gray-500 dark:text-gray-400">지우기</button>
          : <span />}
        {!out(today) && (
          <button type="button" onClick={() => onPick(today)} className="h-10 px-3 text-[15px] font-medium text-brand-text">오늘</button>
        )}
      </div>
    </div>
  )
}

function TimePanel({ value, onPick, onClear }: { value: string; onPick: (v: string) => void; onClear?: () => void }) {
  const [h0, m0] = (value || '').split(':')
  const [h, setH] = useState(h0 && /^\d{2}$/.test(h0) ? h0 : '')
  const mins = useMemo(() => {
    const list = Array.from({ length: 12 }, (_, i) => pad(i * 5))
    if (m0 && /^\d{2}$/.test(m0) && !list.includes(m0)) list.push(m0)
    return list.sort()
  }, [m0])
  const col = 'flex-1 max-h-[264px] overflow-y-auto overscroll-contain py-1'
  const cell = (on: boolean) => `w-full h-11 rounded-xl text-[15px] tabular-nums ${on ? 'bg-brand text-white font-medium' : 'text-gray-900 dark:text-white active:bg-black/5 dark:active:bg-white/5'}`
  const hourRef = useRef<HTMLDivElement>(null)
  useEffect(() => { hourRef.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({ block: 'center' }) }, [])

  return (
    <div className="px-3 pt-2 pb-3">
      <div className="flex gap-2 text-center">
        <div className="flex-1">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 h-8 leading-8">시</p>
          <div className={col} ref={hourRef}>
            {Array.from({ length: 24 }, (_, i) => pad(i)).map((x) => (
              <button key={x} type="button" aria-label={`${x}시`} aria-pressed={x === h} onClick={() => setH(x)} className={cell(x === h)}>{x}</button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400 h-8 leading-8">분</p>
          <div className={col}>
            {mins.map((x) => (
              <button key={x} type="button" aria-label={`${x}분`} aria-pressed={x === m0 && h === h0} disabled={!h} onClick={() => onPick(`${h}:${x}`)} className={`${cell(x === m0 && h === h0)} disabled:text-gray-300 dark:disabled:text-gray-600`}>{x}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between mt-2 px-1">
        {onClear && value ? <button type="button" onClick={onClear} className="h-10 px-3 text-[15px] font-medium text-gray-500 dark:text-gray-400">지우기</button> : <span />}
        <p className="text-[13px] text-gray-500 dark:text-gray-400">{h ? '분을 고르면 정해져요' : '시를 먼저 골라 주세요'}</p>
      </div>
    </div>
  )
}

export default DateInput

/**
 * 🏠 요청서 시트 — 선택지·숫자·여러 개·메모. 날짜는 `DateSheet`, 주소는 `AddressSheet`.
 * 고르기만 하는 시트는 고르는 순간 닫히고 다음 질문이 열린다(오늘의집 흐름 — 확인 버튼 한 번을 줄인다).
 */
import { useState } from 'react'
import type { RequestField } from '@/shared/home-service'
import { Sheet } from './Sheet'

const INPUT = 'w-full rounded-xl border border-rule bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-brand'
const DONE = 'ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-50'
const SKIP = 'ur-btn ur-btn-lg flex w-full justify-center bg-surface text-ink shadow-lift'

/** 받침이 있으면 '을', 없으면 '를' — "이사 날짜를" · "출발지를" · "가게 주소를" · "후드 개수를". */
export function eulReul(word: string): string {
  const c = word.trim().charCodeAt(word.trim().length - 1)
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 ? `${word}을` : `${word}를`
  return `${word}을(를)`
}

export function sheetTitle(f: RequestField): string {
  if (f.type === 'select' || f.type === 'multi') return `${eulReul(f.label)} 골라 주세요`
  return `${eulReul(f.label)} 알려 주세요`
}

export function OptionSheet({ f, value, onPick, onClose }: {
  f: RequestField; value: string; onPick: (v: string) => void; onClose: () => void
}) {
  return (
    <Sheet title={sheetTitle(f)} onClose={onClose}>
      <div className="space-y-2 pb-2">
        {(f.options || []).map((o) => {
          const on = value === o
          const hint = f.optionHints?.[o]
          return (
            <button
              key={o}
              type="button"
              onClick={() => onPick(o)}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-4 text-left ${on ? 'bg-brand-tint ring-2 ring-brand' : 'bg-surface shadow-lift'}`}
            >
              <span className="min-w-0">
                <span className="block text-[15px] font-bold">{o}</span>
                {hint && <span className="mt-1 block text-[13px] text-gray-500 dark:text-gray-400">{hint}</span>}
              </span>
              <span className={`h-5 w-5 shrink-0 rounded-full border-2 ${on ? 'border-brand bg-brand' : 'border-rule-strong'}`} />
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

export function NumberSheet({ f, value, onDone, onClose }: {
  f: RequestField; value: string; onDone: (v: string) => void; onClose: () => void
}) {
  const [v, setV] = useState(value)
  const n = Number(v)
  const ok = v !== '' && Number.isFinite(n) && n > 0 && n <= 1000
  return (
    <Sheet title={sheetTitle(f)} onClose={onClose} footer={<button type="button" disabled={!ok} className={DONE} onClick={() => onDone(String(Math.round(n)))}>완료</button>}>
      <div className="flex items-center gap-2 pb-2">
        <input
          autoFocus
          className={INPUT}
          type="number"
          inputMode="numeric"
          min={1}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && ok) onDone(String(Math.round(n))) }}
        />
        {f.unit && <span className="shrink-0 text-[15px] text-gray-500 dark:text-gray-400">{f.unit}</span>}
      </div>
    </Sheet>
  )
}

export function MultiSheet({ f, value, onDone, onClose }: {
  f: RequestField; value: string; onDone: (v: string) => void; onClose: () => void
}) {
  const [picked, setPicked] = useState<string[]>(value ? value.split(',').map((x) => x.trim()).filter(Boolean) : [])
  const toggle = (o: string) => setPicked((p) => (p.includes(o) ? p.filter((x) => x !== o) : [...p, o]))
  return (
    <Sheet
      title={sheetTitle(f)}
      onClose={onClose}
      footer={
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={SKIP} onClick={() => onDone('')}>건너뛰기</button>
          <button type="button" disabled={!picked.length} className={DONE} onClick={() => onDone(picked.join(', '))}>완료</button>
        </div>
      }
    >
      <p className="pb-3 text-[13px] text-gray-500 dark:text-gray-400">자세할수록 견적이 정확해져요. 지금 어렵다면 업체와 상담하셔도 돼요.</p>
      <div className="grid grid-cols-3 gap-2 pb-2">
        {(f.options || []).map((o) => {
          const on = picked.includes(o)
          return (
            <button key={o} type="button" onClick={() => toggle(o)}
              className={`rounded-xl px-2 py-3 text-[13px] font-medium ${on ? 'bg-brand text-white' : 'bg-surface text-ink shadow-lift'}`}>
              {o}
            </button>
          )
        })}
      </div>
    </Sheet>
  )
}

export function TextSheet({ f, value, onDone, onClose }: {
  f: RequestField; value: string; onDone: (v: string) => void; onClose: () => void
}) {
  const [v, setV] = useState(value)
  const required = f.required
  return (
    <Sheet
      title={sheetTitle(f)}
      onClose={onClose}
      footer={
        <div className={required ? '' : 'grid grid-cols-2 gap-2'}>
          {!required && <button type="button" className={SKIP} onClick={() => onDone('')}>건너뛰기</button>}
          <button type="button" disabled={required && !v.trim()} className={DONE} onClick={() => onDone(v.trim())}>완료</button>
        </div>
      }
    >
      {f.type === 'textarea'
        ? <textarea autoFocus className={`${INPUT} min-h-[120px]`} maxLength={500} placeholder={f.placeholder} value={v} onChange={(e) => setV(e.target.value)} />
        : <input autoFocus className={INPUT} maxLength={60} placeholder={f.placeholder} value={v} onChange={(e) => setV(e.target.value)} />}
    </Sheet>
  )
}

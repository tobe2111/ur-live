/**
 * 🏠 날짜 시트 — 달력. 이사는 **손 없는 날**을 점으로 보여 준다(오늘의집 흐름 · 음력 9·10·19·20·29·30).
 * 오늘 이전은 고를 수 없다(서버 `validateRequest` 와 같은 규칙 — 한국 시간 기준 오늘).
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { isSonEomneunDay, type RequestField } from '@/shared/home-service'
import { kstYmd } from '@/shared/stays-early'
import { Sheet } from './Sheet'
import { eulReul } from './FieldSheets'

const pad = (n: number) => String(n).padStart(2, '0')
const WEEK = ['일', '월', '화', '수', '목', '금', '토']

export function DateSheet({ f, value, lucky, onDone, onClose }: {
  f: RequestField; value: string; lucky?: boolean; onDone: (v: string) => void; onClose: () => void
}) {
  const today = kstYmd(0)
  const [ty, tm] = today.split('-').map(Number)
  const start = value && value >= today ? value : today
  const [cursor, setCursor] = useState(() => { const [y, m] = start.split('-').map(Number); return { y, m } })
  const [picked, setPicked] = useState(value && value >= today ? value : '')

  const cells = useMemo(() => {
    const first = new Date(Date.UTC(cursor.y, cursor.m - 1, 1)).getUTCDay()
    const days = new Date(Date.UTC(cursor.y, cursor.m, 0)).getUTCDate()
    const out: (string | null)[] = Array(first).fill(null)
    for (let d = 1; d <= days; d++) out.push(`${cursor.y}-${pad(cursor.m)}-${pad(d)}`)
    return out
  }, [cursor])

  const monthIndex = (y: number, m: number) => y * 12 + m
  const canPrev = monthIndex(cursor.y, cursor.m) > monthIndex(ty, tm)
  const canNext = monthIndex(cursor.y, cursor.m) < monthIndex(ty, tm) + 12
  const move = (delta: number) => setCursor(({ y, m }) => { const i = y * 12 + (m - 1) + delta; return { y: Math.floor(i / 12), m: (i % 12) + 1 } })

  return (
    <Sheet
      title={`${eulReul(f.label)} 알려 주세요`}
      onClose={onClose}
      footer={<button type="button" disabled={!picked} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-50" onClick={() => onDone(picked)}>선택 완료</button>}
    >
      <div className="flex items-center justify-between pb-3">
        <span className="text-[17px] font-bold">{cursor.y}년 {cursor.m}월</span>
        <span className="flex gap-1">
          <button type="button" aria-label="이전 달" disabled={!canPrev} onClick={() => move(-1)} className="p-2 disabled:opacity-30"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" aria-label="다음 달" disabled={!canNext} onClick={() => move(1)} className="p-2 disabled:opacity-30"><ChevronRight className="h-5 w-5" /></button>
        </span>
      </div>
      <div className="grid grid-cols-7 text-center text-[13px] text-gray-500 dark:text-gray-400">
        {WEEK.map((w) => <span key={w} className="py-2">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((ymd, i) => {
          if (!ymd) return <span key={`e${i}`} />
          const past = ymd < today
          const on = ymd === picked
          const dot = lucky && isSonEomneunDay(ymd)
          return (
            <button
              key={ymd}
              type="button"
              disabled={past}
              onClick={() => setPicked(ymd)}
              className={`mx-auto flex h-12 w-11 flex-col items-center justify-center rounded-xl text-[15px] ${on ? 'bg-brand font-bold text-white' : past ? 'text-gray-300 dark:text-gray-600' : 'font-bold text-ink'}`}
            >
              {Number(ymd.slice(8))}
              <span className={`mt-1 h-1 w-1 rounded-full ${dot ? (on ? 'bg-white' : past ? 'bg-gray-300 dark:bg-gray-600' : 'bg-ink') : 'bg-transparent'}`} />
              {ymd === today && !on && <span className="sr-only">오늘</span>}
            </button>
          )
        })}
      </div>
      {lucky && (
        <p className="flex items-center justify-center gap-2 pt-3 pb-1 text-[13px] text-gray-500 dark:text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-ink" /> 손 없는 날
        </p>
      )}
    </Sheet>
  )
}

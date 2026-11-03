/**
 * 🏠 날짜 시트 — 달력. 이사는 **손 없는 날**을 점으로 보여 준다(오늘의집 흐름 · 음력 9·10·19·20·29·30).
 * 오늘 이전은 고를 수 없다(서버 `validateRequest` 와 같은 규칙 — 한국 시간 기준 오늘).
 * 📅 2026-11-03 대표 *"착공 희망일은 여러개 선택할 수 있게"* — `f.multiple` 칸은 날짜를 눌러 켜고 끈다(최대
 *   `MAX_MULTI_DATES`). 고른 날짜는 달력 아래에 줄로 보인다. 값은 `YYYY-MM-DD, YYYY-MM-DD`(정렬).
 */
import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { MAX_MULTI_DATES, isSonEomneunDay, type RequestField } from '@/shared/home-service'
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
  const multi = !!f.multiple
  // 저장값은 쉼표로 여러 개일 수 있다(다른 요청서에서 이어 온 값 포함) — 오늘 이후만 남긴다.
  const initial = (value || '').split(',').map((x) => x.trim()).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x) && x >= today).sort()
  const start = initial[0] || today
  const [cursor, setCursor] = useState(() => { const [y, m] = start.split('-').map(Number); return { y, m } })
  const [picked, setPicked] = useState<string[]>(multi ? initial.slice(0, MAX_MULTI_DATES) : initial.slice(0, 1))
  const tap = (ymd: string) => setPicked((p) => {
    if (!multi) return [ymd]
    if (p.includes(ymd)) return p.filter((x) => x !== ymd)
    return p.length >= MAX_MULTI_DATES ? p : [...p, ymd].sort()
  })
  const md = (ymd: string) => `${Number(ymd.slice(5, 7))}월 ${Number(ymd.slice(8))}일`

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
      footer={<button type="button" disabled={!picked.length} className="ur-btn ur-btn-lg ur-btn-primary flex w-full justify-center disabled:opacity-50" onClick={() => onDone(picked.join(', '))}>{multi && picked.length > 1 ? `${picked.length}일 고르고 다음` : '다음'}</button>}
    >
      <div className="flex items-center justify-between pb-3">
        <span className="text-[16px] font-semibold">{cursor.y}년 {cursor.m}월</span>
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
          const on = picked.includes(ymd)
          const dot = lucky && isSonEomneunDay(ymd)
          return (
            <button
              key={ymd}
              type="button"
              disabled={past}
              aria-pressed={on}
              onClick={() => tap(ymd)}
              className={`mx-auto flex h-12 w-11 flex-col items-center justify-center rounded-xl text-[15px] ${on ? 'bg-brand font-bold text-white' : past ? 'text-gray-300 dark:text-gray-600' : 'font-bold text-ink'}`}
            >
              {Number(ymd.slice(8))}
              <span className={`mt-1 h-1 w-1 rounded-full ${dot ? (on ? 'bg-white' : past ? 'bg-gray-300 dark:bg-gray-600' : 'bg-ink') : 'bg-transparent'}`} />
              {ymd === today && !on && <span className="sr-only">오늘</span>}
            </button>
          )
        })}
      </div>
      {multi && (
        <p className="pt-3 text-[13px] text-gray-500 dark:text-gray-400">
          {picked.length
            ? <><span className="block font-medium text-ink">{picked.map(md).join(', ')}</span>가능한 날을 여러 개 고를 수 있어요(최대 {MAX_MULTI_DATES}일)</>
            : `가능한 날을 여러 개 고를 수 있어요(최대 ${MAX_MULTI_DATES}일)`}
        </p>
      )}
      {lucky && (
        <p className="flex items-center justify-center gap-2 pt-3 pb-1 text-[13px] text-gray-500 dark:text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-ink" /> 손 없는 날
        </p>
      )}
    </Sheet>
  )
}

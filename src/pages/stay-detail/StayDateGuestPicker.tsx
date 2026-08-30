import { useEffect, useMemo, useRef, useState } from 'react'
import { Calendar, User, ChevronRight, ChevronLeft } from 'lucide-react'

/**
 * 🏨 숙소 날짜·인원 선택 (2026-08-19 대표 시안 — 야놀자/NOL).
 *
 * 대표 신고: *"nol 처럼 숙소 일자 정하는 UI는 별도로 구현해야 할 듯 지금은 그냥 팝업처럼 나오고 말아."*
 * 그동안은 `<input type="date">` 두 개였다 — OS 기본 피커가 떠서 **며칠 묵는지, 그날 얼마인지**를
 * 고르는 화면이 아니었다(날짜를 하나씩 따로 고르는 폼이었다).
 *
 * ⇒ 야놀자 구조로: [기간 트리거] [인원 트리거] → 아래로 펼쳐지는 패널.
 *   - 기간: **두 달을 나란히** 두고 체크인→체크아웃을 이어서 고른다. 선택 구간은 이어진 띠로 보인다.
 *   - 날짜 아래 **1박 요금**(서버가 주는 `dates[].price`). ⚠️ 값이 없으면 **아무것도 안 쓴다** —
 *     모르는 값을 "최저가"처럼 지어내면 그건 가격 오표시다.
 *   - 인원: 성인/아동 스테퍼. 서버 계약은 `guests` 한 개라 **합산**해서 넘긴다(아동 요금 규칙이
 *     아직 없으므로 합산이 정직하다). 기준인원 초과 안내는 야놀자와 같은 문구로 미리 알린다.
 *
 * 📱 모바일은 한 달씩 세로로 이어 붙인다(두 달을 옆으로 두면 한 달이 화면 밖으로 나간다).
 * 📐 PC 에서 이 바는 **우측 360px 아사이드** 안에 있다 — 넓은 패널을 왼쪽 기준으로 펼치면 화면
 *    오른쪽 밖으로 넘어간다. 그래서 패널은 `lg:left-auto lg:right-0` 로 오른쪽 끝을 맞춘다.
 */

export interface DayPrice { date: string; price?: number; available?: boolean }

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const parseIso = (s: string) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1) }
const addDays = (s: string, n: number) => { const d = parseIso(s); d.setDate(d.getDate() + n); return iso(d) }
const nightsBetween = (a: string, b: string) => Math.max(1, Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000))
const fmtTrigger = (s: string) => { const d = parseIso(s); return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}(${WEEK[d.getDay()]})` }
/** 25.7만 — 야놀자 표기. 만 단위 아래는 버린다(칸이 좁아 원 단위는 못 읽는다). */
const fmtMan = (won: number) => (won >= 10000 ? `${Math.round(won / 1000) / 10}만` : `${Math.round(won / 1000)}천`)

function monthMatrix(year: number, month: number): Array<string | null> {
  const first = new Date(year, month, 1)
  const days = new Date(year, month + 1, 0).getDate()
  const cells: Array<string | null> = Array.from({ length: first.getDay() }, () => null)
  for (let d = 1; d <= days; d++) cells.push(iso(new Date(year, month, d)))
  return cells
}

export default function StayDateGuestPicker({
  checkIn, checkOut, guests, onApply, dayPrices = [], maxGuests = 20, baseGuests,
}: {
  checkIn: string
  checkOut: string
  guests: number
  onApply: (v: { checkIn: string; checkOut: string; guests: number }) => void
  /** 서버가 주는 날짜별 1박 요금(있으면 달력에 표시, 없으면 숨김). */
  dayPrices?: DayPrice[]
  maxGuests?: number
  /** 기준 인원 — 넘으면 추가요금이 붙을 수 있다는 안내를 띄운다. */
  baseGuests?: number
}) {
  const [open, setOpen] = useState<'none' | 'date' | 'guest'>('none')
  const [monthOffset, setMonthOffset] = useState(0)
  // 패널 안에서 고르는 임시값 — '적용하기' 를 눌러야 바깥으로 나간다(야놀자와 동일).
  const [draftIn, setDraftIn] = useState(checkIn)
  const [draftOut, setDraftOut] = useState(checkOut)
  const [adults, setAdults] = useState(Math.max(1, guests))
  const [kids, setKids] = useState(0)
  const boxRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { setDraftIn(checkIn); setDraftOut(checkOut) }, [checkIn, checkOut])
  useEffect(() => { setAdults(Math.max(1, guests)) }, [guests])

  useEffect(() => {
    if (open === 'none') return
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen('none') }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen('none') }
    document.addEventListener('mousedown', onDoc); window.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey) }
  }, [open])

  const priceOf = useMemo(() => {
    const m = new Map<string, number>()
    for (const d of dayPrices) if (d?.date && Number(d.price) > 0) m.set(d.date, Number(d.price))
    return m
  }, [dayPrices])
  const soldOut = useMemo(() => new Set(dayPrices.filter(d => d?.available === false).map(d => d.date)), [dayPrices])

  const today = iso(new Date())
  const base = new Date(); base.setDate(1)
  const months = [0, 1].map(i => { const d = new Date(base); d.setMonth(d.getMonth() + monthOffset + i); return d })

  /** 체크인이 정해진 상태에서 다음 클릭은 체크아웃 — 이미 범위가 잡혔으면 새 체크인으로 다시 시작. */
  const pickDay = (day: string) => {
    if (day < today) return
    const rangeDone = draftIn && draftOut && draftIn !== draftOut
    if (!draftIn || rangeDone || day <= draftIn) { setDraftIn(day); setDraftOut(addDays(day, 1)); return }
    setDraftOut(day)
  }

  const nights = nightsBetween(draftIn, draftOut)
  const totalGuests = adults + kids
  const overBase = !!baseGuests && totalGuests > baseGuests

  const trigger = 'flex-1 min-w-0 flex items-center justify-center gap-2 h-12 rounded-xl border text-[14px] font-bold transition-colors'
  const on = 'border-brand text-brand bg-brand/[0.06]'
  const off = 'border-gray-200 dark:border-[#2C2F35] text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/[0.04]'

  return (
    <div ref={boxRef} className="relative">
      <div className="flex items-stretch gap-2">
        <button type="button" onClick={() => setOpen(o => (o === 'date' ? 'none' : 'date'))} className={`${trigger} ${open === 'date' ? on : off}`}>
          <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{fmtTrigger(checkIn)}~{fmtTrigger(checkOut).slice(5)} · {nightsBetween(checkIn, checkOut)}박</span>
        </button>
        <button type="button" onClick={() => setOpen(o => (o === 'guest' ? 'none' : 'guest'))} className={`${trigger} ${open === 'guest' ? on : off}`}>
          <User className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="truncate">성인 {Math.max(1, guests)}{kids > 0 ? `, 아동 ${kids}` : ''}</span>
        </button>
      </div>

      {open === 'date' && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[10500] rounded-2xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#141C27] shadow-[0_12px_40px_rgba(0,0,0,0.18)] p-4 lg:w-[680px] lg:left-auto lg:right-0">
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={() => setMonthOffset(m => Math.max(0, m - 1))} disabled={monthOffset === 0}
              aria-label="이전 달" className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-white/[0.06]">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-[13px] font-bold text-gray-500 dark:text-gray-400">체크인 날짜를 먼저 고르세요</span>
            <button type="button" onClick={() => setMonthOffset(m => m + 1)} aria-label="다음 달"
              className="w-8 h-8 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-100 dark:hover:bg-white/[0.06]">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 max-h-[52vh] lg:max-h-none overflow-y-auto">
            {months.map((mDate, mi) => (
              <div key={mi} className={mi === 1 ? 'hidden lg:block' : ''}>
                <div className="text-center text-[15px] font-extrabold text-gray-900 dark:text-white mb-2">
                  {mDate.getFullYear()}.{String(mDate.getMonth() + 1).padStart(2, '0')}
                </div>
                <div className="grid grid-cols-7 text-center text-[12px] text-gray-400 mb-1">
                  {WEEK.map((w, i) => <span key={w} className={i === 0 ? 'text-red-400' : undefined}>{w}</span>)}
                </div>
                <div className="grid grid-cols-7 gap-y-1">
                  {monthMatrix(mDate.getFullYear(), mDate.getMonth()).map((day, i) => {
                    if (!day) return <span key={`e${i}`} />
                    const past = day < today
                    const isIn = day === draftIn
                    const isOut = day === draftOut
                    const inRange = day > draftIn && day < draftOut
                    const sold = soldOut.has(day)
                    const price = priceOf.get(day)
                    return (
                      <button
                        key={day}
                        type="button"
                        onClick={() => pickDay(day)}
                        disabled={past}
                        aria-label={`${day}${isIn ? ' 체크인' : isOut ? ' 체크아웃' : ''}`}
                        className={`h-11 flex flex-col items-center justify-center text-[13px] transition-colors ${
                          past ? 'text-gray-300 dark:text-gray-600 cursor-default'
                            : isIn || isOut ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-extrabold rounded-xl'
                            : inRange ? 'bg-gray-100 dark:bg-white/[0.08] text-gray-900 dark:text-white'
                            : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-white/[0.05] rounded-xl'
                        }`}
                      >
                        <span className={sold && !past ? 'line-through opacity-50' : undefined}>{parseIso(day).getDate()}</span>
                        {/* 요금은 **서버가 준 날에만** 쓴다 — 없는 값을 지어내지 않는다. */}
                        {price && !past ? (
                          <span className={`text-[10px] leading-none mt-0.5 ${isIn || isOut ? 'opacity-80' : 'text-gray-400 dark:text-gray-500'}`}>{fmtMan(price)}</span>
                        ) : null}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-[#2C2F35]">
            <span className="text-[12.5px] text-gray-500 dark:text-gray-400">
              {fmtTrigger(draftIn)} ~ {fmtTrigger(draftOut)} · <b className="text-gray-900 dark:text-white">{nights}박</b>
            </span>
            <button type="button" onClick={() => { onApply({ checkIn: draftIn, checkOut: draftOut, guests: totalGuests }); setOpen('none') }}
              className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-[14px] font-bold transition-colors">
              적용하기
            </button>
          </div>
        </div>
      )}

      {open === 'guest' && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[10500] rounded-2xl border border-gray-200 dark:border-[#2C2F35] bg-white dark:bg-[#141C27] shadow-[0_12px_40px_rgba(0,0,0,0.18)] p-4 lg:w-[360px] lg:left-auto lg:right-0">
          {overBase && (
            <div className="rounded-xl bg-gray-50 dark:bg-white/[0.05] p-3 mb-3">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white">기준인원 초과 시 추가요금이 발생할 수 있어요.</p>
              <p className="mt-1 text-[12.5px] text-gray-500 dark:text-gray-400">숙소마다 아동 입실가능 여부와 추가요금이 달라요. 이용 안내 및 예약 공지를 확인해 주세요.</p>
            </div>
          )}
          {([
            { label: '성인', v: adults, set: setAdults, min: 1 },
            { label: '아동', v: kids, set: setKids, min: 0 },
          ] as const).map(({ label, v, set, min }) => (
            <div key={label} className="flex items-center justify-between py-2.5">
              <span className="text-[14px] font-bold text-gray-900 dark:text-white">{label}</span>
              <span className="flex items-center gap-3">
                <button type="button" onClick={() => set(Math.max(min, v - 1))} disabled={v <= min} aria-label={`${label} 감소`}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-700 dark:text-gray-200 text-[18px] leading-none disabled:opacity-40">−</button>
                <span className="w-6 text-center text-[15px] font-extrabold text-gray-900 dark:text-white" aria-live="polite">{v}</span>
                <button type="button" onClick={() => set(Math.min(maxGuests, v + 1))} disabled={adults + kids >= maxGuests} aria-label={`${label} 증가`}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-white/[0.08] text-gray-700 dark:text-gray-200 text-[18px] leading-none disabled:opacity-40">+</button>
              </span>
            </div>
          ))}
          <div className="flex justify-end mt-2">
            <button type="button" onClick={() => { onApply({ checkIn, checkOut, guests: totalGuests }); setOpen('none') }}
              className="px-6 py-2.5 rounded-xl bg-brand hover:bg-brand-dark text-white text-[14px] font-bold transition-colors">
              적용하기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

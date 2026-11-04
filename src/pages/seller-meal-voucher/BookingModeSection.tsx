/**
 * 🗓️ 이용권 등록 3단계 — **예약 방식** (2026-11-03 숙소·예약 통일 ①)
 *
 * [바로 사용] · [외부 예약 링크] · [시간 예약]. 숙박은 2단계에서 객실을 넣으므로 여기 오지 않는다(날짜·객실 예약).
 * 시간 예약은 종전에도 코드(`/seller/products/:id/booking-slots`)가 있었는데 **설정하러 들어가는 길이 0** 이라
 * 라이브 설정·예약이 0건이었다(2026-11-03 실측). 이제 등록할 때 바로 정한다.
 */
import { Plus, Trash2 } from 'lucide-react'
import type { VoucherForm } from './voucher-form'
import { DAY_LABELS, type BookingMode, type SlotDraft } from './booking-mode'
import { Select } from '@/components/ui/select'

const INPUT = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none'

const MODES: ReadonlyArray<{ key: BookingMode; label: string; desc: string }> = [
  { key: 'none', label: '바로 사용', desc: '예약 없이 매장에서 바로 써요' },
  { key: 'time', label: '시간 예약', desc: '손님이 산 뒤 날짜·시간을 골라요' },
  { key: 'external', label: '외부 예약', desc: '네이버 예약 등 내 예약 링크로' },
]

export default function BookingModeSection({ form, update }: {
  form: VoucherForm
  update: (key: keyof VoucherForm, value: unknown) => void
}) {
  const slots = form.time_slots
  const patch = (i: number, p: Partial<SlotDraft>) => update('time_slots', slots.map((s, j) => (j === i ? { ...s, ...p } : s)))
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4" data-booking-mode>
      <h2 className="text-base font-bold text-gray-900">예약 방식</h2>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((m) => (
          <button key={m.key} type="button" onClick={() => update('booking_mode', m.key)}
            className={`p-3 rounded-lg border-2 text-center ${form.booking_mode === m.key ? 'border-brand bg-brand-tint' : 'border-gray-200 bg-white'}`}>
            <div className={`text-xs font-bold ${form.booking_mode === m.key ? 'text-brand-text' : 'text-gray-900'}`}>{m.label}</div>
            <div className="text-[12px] text-gray-500 mt-1">{m.desc}</div>
          </button>
        ))}
      </div>

      {form.booking_mode === 'external' && (
        <input type="url" value={form.external_booking_url} onChange={(e) => update('external_booking_url', e.target.value)}
          placeholder="https://booking.naver.com/..." className={INPUT} />
      )}

      {form.booking_mode === 'time' && (
        <div className="space-y-2">
          {slots.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <Select value={s.day_of_week} onChange={(e) => patch(i, { day_of_week: Number(e.target.value) })} className="px-2 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900">
                {DAY_LABELS.map((d, k) => <option key={d} value={k}>{d}</option>)}
              </Select>
              <input type="time" value={s.start_time} onChange={(e) => patch(i, { start_time: e.target.value })} className={INPUT} aria-label="시작" />
              <input type="time" value={s.end_time} onChange={(e) => patch(i, { end_time: e.target.value })} className={INPUT} aria-label="끝" />
              <input inputMode="numeric" value={s.capacity || ''} onChange={(e) => patch(i, { capacity: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className="w-16 px-2 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900" aria-label="받는 인원" />
              <button type="button" aria-label="시간 빼기" onClick={() => update('time_slots', slots.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-tone-bad"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => update('time_slots', [...slots, { day_of_week: 6, start_time: '10:00', end_time: '11:00', capacity: 1 }])}
            className="w-full py-2.5 rounded-lg border border-dashed border-gray-300 text-sm font-bold text-gray-700 flex items-center justify-center gap-1">
            <Plus className="w-4 h-4" /> 시간 추가
          </button>
          <p className="text-[12px] text-gray-500">요일 · 시작 · 끝 · 한 번에 받는 인원. 들어온 예약은 [예약 관리]에서 확인해요.</p>
        </div>
      )}
    </div>
  )
}

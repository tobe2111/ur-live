/**
 * 🏨 이용권 등록 2단계 — 숙박을 고르면 가격 칸 대신 **숙소 유형 · 체크인/아웃 · 객실** (2026-11-03 숙소 통일 ①)
 *
 * 종전엔 '숙박' 을 고르면 이 폼이 객실 없는 숙소를 만들었고, 진짜 숙소 등록은 5월에 만든 별도 화면이었다
 * (매장 연결 없이 주소를 손으로 다시 치고, 임시저장도 없고, 객실은 저장 뒤 다른 화면에서). 이제 같은 위저드 안에서
 * 끝난다 — 매장은 1단계가 이미 골랐다. 판매가는 객실 평일가 최저값으로 자동(`stayFromPrice`).
 * 달력(날짜별 요금·막기)은 등록 뒤 [수정] 에서 — 여기서는 객실 기본값만 받는다.
 */
import { Plus, Trash2, BedDouble } from 'lucide-react'
import type { VoucherForm } from './voucher-form'
import StayAmenityPicker from './StayAmenityPicker'
import { STAY_PROPERTY_TYPES, emptyRoom, stayFromPrice, type StayRoomDraft } from './booking-mode'

const INPUT = 'w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-900 focus:border-brand focus:outline-none'

export default function StayRoomsFields({ form, update }: {
  form: VoucherForm
  update: (key: keyof VoucherForm, value: unknown) => void
}) {
  const rooms = form.stay_rooms
  const setRooms = (next: StayRoomDraft[]) => {
    update('stay_rooms', next)
    // 판매가 = 객실 평일가 최저 — 카드·검색이 '1박 N원~' 으로 쓴다. 정가는 따로 없으니 같은 값.
    const from = stayFromPrice(next)
    update('price', from)
    update('original_price', from)
  }
  const patch = (i: number, p: Partial<StayRoomDraft>) => setRooms(rooms.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))

  return (
    <div className="space-y-4" data-stay-rooms>
      <div className="grid grid-cols-3 gap-2">
        {STAY_PROPERTY_TYPES.map((p) => (
          <button key={p.value} type="button" onClick={() => update('stay_property_type', p.value)}
            className={`py-2 rounded-lg border-2 text-xs font-bold ${form.stay_property_type === p.value ? 'border-brand bg-brand-tint text-brand-text' : 'border-gray-200 bg-white text-gray-900'}`}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm font-medium text-gray-700">체크인
          <input type="time" value={form.stay_check_in} onChange={(e) => update('stay_check_in', e.target.value)} className={`${INPUT} mt-1`} />
        </label>
        <label className="block text-sm font-medium text-gray-700">체크아웃
          <input type="time" value={form.stay_check_out} onChange={(e) => update('stay_check_out', e.target.value)} className={`${INPUT} mt-1`} />
        </label>
      </div>

      <div className="space-y-3">
        {rooms.map((r, i) => (
          <div key={i} className="rounded-lg border border-gray-200 p-3 space-y-2">
            <div className="flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-gray-500" aria-hidden />
              <input value={r.name} onChange={(e) => patch(i, { name: e.target.value })} placeholder={`객실 이름 (예: 오션뷰 더블)`} className={INPUT} />
              {rooms.length > 1 && (
                <button type="button" aria-label="객실 빼기" onClick={() => setRooms(rooms.filter((_, j) => j !== i))} className="p-2 text-gray-400 hover:text-tone-bad"><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500">평일 1박(원)<input inputMode="numeric" value={r.price_weekday || ''} onChange={(e) => patch(i, { price_weekday: num(e.target.value) })} className={`${INPUT} mt-1`} /></label>
              <label className="text-xs text-gray-500">주말 1박(원)<input inputMode="numeric" value={r.price_weekend || ''} onChange={(e) => patch(i, { price_weekend: num(e.target.value) })} className={`${INPUT} mt-1`} /></label>
              <label className="text-xs text-gray-500">기준 인원<input inputMode="numeric" value={r.base_guests || ''} onChange={(e) => patch(i, { base_guests: num(e.target.value) })} className={`${INPUT} mt-1`} /></label>
              <label className="text-xs text-gray-500">최대 인원<input inputMode="numeric" value={r.max_guests || ''} onChange={(e) => patch(i, { max_guests: num(e.target.value) })} className={`${INPUT} mt-1`} /></label>
              <label className="text-xs text-gray-500 col-span-2">같은 객실 수<input inputMode="numeric" value={r.inventory || ''} onChange={(e) => patch(i, { inventory: num(e.target.value) })} className={`${INPUT} mt-1`} /></label>
            </div>
          </div>
        ))}
        <button type="button" onClick={() => setRooms([...rooms, emptyRoom()])}
          className="w-full py-2.5 rounded-lg border border-dashed border-gray-300 text-sm font-bold text-gray-700 flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" /> 객실 추가
        </button>
        <p className="text-[12px] text-gray-500">날짜별 요금·예약 막기는 등록 뒤 [수정]의 달력에서 바꿀 수 있어요.</p>
      </div>
      <StayAmenityPicker amenities={form.stay_amenities} roomAmenities={form.stay_room_amenities} onChange={(f, v) => update(f, v)} />
    </div>
  )
}

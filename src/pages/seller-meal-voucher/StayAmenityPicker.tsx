/**
 * 🏨 숙소 시설 고르기 — 이용권 등록 위저드 안으로 옮겨 왔다 (2026-11-03 숙소 통일 ①)
 * 종전 `SellerStayNewPage` 의 '시설 / 어메니티' 그대로(2026-10-31 대표 *"업로드할 때도 선택이 되어야"*).
 * 고른 시설은 상세의 '서비스 및 부대시설'에 뜬다.
 */
import { useApiQuery } from '@/hooks/queries/useApiQuery'

interface Amenity { code: string; label_ko: string; icon_emoji: string; category: string }

export default function StayAmenityPicker({ amenities, roomAmenities, onChange }: {
  amenities: string[]; roomAmenities: string[]
  onChange: (field: 'stay_amenities' | 'stay_room_amenities', next: string[]) => void
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const q = useApiQuery<Amenity[]>(['seller', 'stays-amenities'], '/api/seller/stays-amenities', { select: (r: any) => (r?.success ? r.data || [] : []) })
  const list = q.data ?? []
  const groups: Array<{ field: 'stay_amenities' | 'stay_room_amenities'; title: string; items: Amenity[]; on: string[] }> = [
    { field: 'stay_amenities', title: '숙소 공통 시설', items: list.filter((a) => a.category === 'property' || a.category === 'service'), on: amenities },
    { field: 'stay_room_amenities', title: '객실 기본 시설', items: list.filter((a) => a.category === 'room'), on: roomAmenities },
  ]
  if (!list.length) return null
  return (
    <div className="space-y-3" data-stay-amenities>
      <p className="text-[13px] text-gray-500">고른 시설은 상세의 ‘서비스 및 부대시설’에 표시돼요.</p>
      {groups.map((g) => (
        <div key={g.field}>
          <p className="text-sm font-medium text-gray-700 mb-2">{g.title}</p>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {g.items.map((a) => {
              const on = g.on.includes(a.code)
              return (
                <button key={a.code} type="button" onClick={() => onChange(g.field, on ? g.on.filter((c) => c !== a.code) : [...g.on, a.code])}
                  className={`p-2 rounded-lg border-2 text-center text-xs ${on ? 'border-brand bg-brand-tint text-brand-text' : 'border-gray-200 bg-white text-gray-700'}`}>
                  <div className="text-lg">{a.icon_emoji}</div>
                  <div className="mt-1 font-medium">{a.label_ko}</div>
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

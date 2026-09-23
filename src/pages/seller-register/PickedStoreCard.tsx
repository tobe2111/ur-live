/**
 * 🏪 고른 가게 한 장 — **네 칸을 대신한다** (2026-09-21 대표 확정 "안 B: 가게부터").
 *
 * 종전 가입 화면의 [가게명]·[매장 종류]·[매장 주소] 세 칸은 사장님이 **방금 지도에서 고른 가게**를
 * 손으로 다시 옮겨 적는 자리였다(그리고 지도가 주는 전화·좌표·place_id 는 아예 버려졌다).
 * 고르고 나면 그 값들은 **묻는 것이 아니라 확인하는 것**이므로, 입력 칸이 아니라 카드로 보여 준다.
 *
 * ⚠️ **되돌릴 길을 항상 둔다**(`onClear`). 잘못 고른 가게를 못 바꾸면, 고치려는 사장님이
 *   가입을 처음부터 다시 하거나 그냥 떠난다.
 *
 * ⚠️ 업종은 여기 **안 적는다** — 바로 아래 '매장 종류' 칩이 같은 것을 말하고, 그쪽은 고칠 수도 있다.
 *   같은 말을 두 번 하면 어느 쪽이 진짜인지 사장님이 알 수 없다.
 *
 * 🎫 규칙: 테두리 없는 흰 카드 + 파란 밴드 하나(어디서 온 값인지), 이모지 0 · 색깔 정보상자 0.
 */
import { MapPin, Phone, Store } from 'lucide-react'
import type { PickedStore } from '@/shared/store-place'

export default function PickedStoreCard({ place, onClear }: { place: PickedStore; onClear: () => void }) {
  return (
    <div className="overflow-hidden rounded-[var(--dash-radius,16px)] bg-white shadow-lift">
      <div className="flex items-center justify-between gap-2 bg-brand px-4 py-2">
        <span className="text-[11.5px] font-bold tracking-[.02em] text-white">카카오맵에서 가져왔어요</span>
        <button type="button" onClick={onClear}
          className="shrink-0 rounded-md px-2 py-0.5 text-[11.5px] font-bold text-white/90 underline underline-offset-2 hover:text-white">
          다른 가게 고르기
        </button>
      </div>
      <div className="px-4 py-3.5">
        <p className="flex items-center gap-1.5 text-[19px] font-extrabold leading-tight tracking-[-.02em] text-gray-900">
          <Store size={17} className="shrink-0 text-gray-400" aria-hidden />
          <span className="min-w-0 truncate">{place.name}</span>
        </p>
        <dl className="mt-2.5 space-y-1.5">
          <div className="flex items-start gap-1.5 text-[13px] leading-snug text-gray-600">
            <MapPin size={14} className="mt-[2px] shrink-0 text-gray-400" aria-hidden />
            <dd className="min-w-0">{place.address}</dd>
          </div>
          {place.phone && (
            <div className="flex items-center gap-1.5 text-[13px] text-gray-600">
              <Phone size={14} className="shrink-0 text-gray-400" aria-hidden />
              <dd className="dash-num">{place.phone}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  )
}

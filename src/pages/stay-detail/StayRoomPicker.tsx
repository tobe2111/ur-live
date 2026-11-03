/**
 * 🛏️ 숙소 상세 모바일 '객실 선택' — 2026-10-25 대표 확정 **E안**(여기어때 순서)
 *
 * 대표: *"공백도 쓸데없이 많고 구매하기 버튼이 2개가 동시에 있어."* 숙소는 더 심했다 — 객실 카드마다
 * [이 객실 예약] 버튼 + 수량 스테퍼가 있고 하단 바에도 [예약하기]가 있어 **한 화면에 예약 버튼이 객실 수 + 1개**였다.
 *
 * E안: 객실 카드는 **고르는 것**만 한다(누르면 파란 테두리 + "선택됨"), 예약은 하단 바 **하나**가 한다.
 * 고른 객실은 장바구니 1실로 들어가므로 하단 바가 그 객실 이름·가격을 보여 주고 같은 예약 창을 연다.
 * 여러 객실 한 번에 예약은 PC 우측 패널(B안)이 그대로 맡는다.
 */
import { formatNumber } from '@/utils/format'
import { SectionTitle, StaySoldOutCard } from './StayInfoSections'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-03 14차 ③ — 객실을 고르면 카드가 톡 눌렸다 놓이고 '선택됨' 앞에 체크가 그려진다.
injectMotionCss('ur-m-room', `@keyframes ur-room-on { 0% { transform: scale(.98); } 60% { transform: scale(1.01); } 100% { transform: none; } }@keyframes ur-room-ck { to { stroke-dashoffset: 0; } }.ur-room-on { animation: ur-room-on .3s cubic-bezier(.3,1.3,.5,1); }.ur-room-ck path { stroke-dasharray: 20; stroke-dashoffset: 20; animation: ur-room-ck .3s .08s ease-out forwards; }@media (prefers-reduced-motion: reduce){.ur-room-on{animation:none!important}.ur-room-ck path{animation:none!important;stroke-dashoffset:0}}`)

export interface PickerRoom {
  room_id: number
  name: string
  bed_config: string | null
  base_guests: number
  max_guests: number
  extra_guest_fee: number
  available: boolean
  available_count: number
  total_price: number
  nights: number
}

export default function StayRoomPicker({ rooms, loading, guests, nights, selectedId, onSelect, onPickDates, readOnly = false }: {
  rooms: PickerRoom[]
  loading: boolean
  guests: number
  nights: number
  selectedId: number | null
  onSelect: (room: PickerRoom) => void
  onPickDates: () => void
  /** 주인이 보는 화면 — 자기 객실을 고를 일이 없다(하단은 [관리하기] 바). 목록만 보인다. */
  readOnly?: boolean
}) {
  return (
    <>
      <SectionTitle className="mb-3">객실 선택</SectionTitle>
      {loading ? (
        <p className="text-[13px] text-gray-500 dark:text-gray-400">가용 객실 조회 중…</p>
      ) : rooms.length === 0 ? (
        <StaySoldOutCard onPickDates={onPickDates} />
      ) : (
        <div className="grid gap-2" role="radiogroup" aria-label="객실 선택">
          {/* 만실이어도 목록은 남긴다 — 어떤 객실이 있는 숙소인지 잃지 않게(2026-09-14 안 B). */}
          {rooms.every((r) => !r.available) && <StaySoldOutCard onPickDates={onPickDates} />}
          {rooms.map((r) => {
            const tooMany = guests > r.max_guests
            const disabled = readOnly || !r.available || tooMany
            const on = selectedId === r.room_id && !disabled
            return (
              <button key={r.room_id} type="button" role="radio" aria-checked={on} disabled={disabled}
                onClick={() => onSelect(r)}
                className={`w-full text-left rounded-2xl p-5 flex items-start justify-between gap-3 bg-surface ${readOnly ? 'disabled:cursor-default' : 'disabled:opacity-50 disabled:cursor-default'} ${on ? 'border-2 border-brand ur-room-on' : 'border border-rule-strong'}`}>
                <span className="min-w-0">
                  <span className="block text-[15px] font-medium text-gray-900 dark:text-white">{r.name}</span>
                  <span className="block mt-1 text-[12px] text-gray-500 dark:text-gray-400">
                    {r.bed_config ? `${r.bed_config} · ` : ''}기준 {r.base_guests}명 · 최대 {r.max_guests}명 · {r.available ? `남은 ${r.available_count}실` : '매진'}
                  </span>
                  {r.extra_guest_fee > 0 && guests > r.base_guests && (
                    <span className="block mt-1 text-[12px] text-gray-500 dark:text-gray-400">추가 {guests - r.base_guests}명 요금 포함</span>
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="block text-[16px] font-bold text-gray-900 dark:text-white">{formatNumber(r.total_price)}원</span>
                  <span className={`block mt-1 text-[12px] ${on ? 'text-brand-text font-medium' : 'text-gray-500 dark:text-gray-400'}`}>
                    {tooMany ? `최대 ${r.max_guests}명` : on ? (
                      <span className="inline-flex items-center gap-1"><svg key={r.room_id} aria-hidden="true" viewBox="0 0 24 24" className="ur-room-ck w-3 h-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>선택됨</span>
                    ) : `${r.nights || nights}박`}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      )}
    </>
  )
}

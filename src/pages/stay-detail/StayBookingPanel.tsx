/**
 * 🏨 숙소 상세 PC 예약 패널 — B안 (2026-09-02 대표 선택: "B안으로 하는데")
 *
 * 우측 360px 안에서 [날짜/인원 → 객실 목록(수량) → 총액 → 예약] 이 한 카드로 끝난다(호텔 OTA).
 * 종전엔 아사이드가 날짜 상자 하나뿐이라 화면 오른쪽 절반이 비었고, 객실을 고르러 왼쪽 아래로
 * 내려갔다 다시 올라와야 했다. 시안·3안 비교: `docs/design/stay-detail-pc-layout-2026-09.md`.
 *
 * 규칙
 *   - 카드 테두리 0 + `shadow-lift`(🎫 디자인 시스템). 객실 행은 헤어라인(`border-rule`)으로만 나눈다.
 *   - 객실 행은 이름·정원·잔여·가격·수량 스테퍼뿐. 사진·긴 설명은 여기 안 넣는다(넣기 시작하면 패널이 곧 화면을 넘긴다).
 *   - 주 행동은 하나: 담긴 객실이 있을 때 "₩총액 예약하기". 없으면 비활성으로 남겨 "무엇을 하면 되는지"를 버튼이 말한다.
 *   - 모바일(<lg)은 이 패널을 안 쓴다 — 페이지의 객실 카드 + 하단바가 종전대로 담당.
 */
import { formatNumber } from '@/utils/format'

export interface PanelRoom {
  room_id: number
  name: string
  base_guests: number
  max_guests: number
  available: boolean
  available_count: number
  total_price: number
  nights: number
}

/** 취소 정책 한 줄 — 페이지 본문 '이용 안내'와 같은 문장을 쓴다(두 벌이면 반드시 갈린다). */
export function cancellationLabel(policy?: string | null): string {
  return policy === 'flexible' ? '체크인 24시간 전까지 무료 취소'
    : policy === 'strict' ? '체크인 72시간 전 50% 환불 · 이후 환불 불가'
    : policy === 'non_refundable' ? '환불 불가 (대신 가격 할인)'
    : '체크인 48시간 전 100% 환불 · 24시간 전 50% 환불'
}

export default function StayBookingPanel({
  modeTabs, selector, rooms, roomsLoading, cartQty, setCartQty, guests, nights, cancellation, onBook,
}: {
  modeTabs: React.ReactNode
  selector: React.ReactNode
  rooms: PanelRoom[]
  roomsLoading: boolean
  cartQty: Record<number, number>
  setCartQty: React.Dispatch<React.SetStateAction<Record<number, number>>>
  guests: number
  nights: number
  cancellation: string
  onBook: () => void
}) {
  const items = rooms.filter((r) => (cartQty[r.room_id] || 0) > 0)
  const totalQty = items.reduce((s, r) => s + (cartQty[r.room_id] || 0), 0)
  const subtotal = items.reduce((s, r) => s + r.total_price * (cartQty[r.room_id] || 0), 0)
  const bump = (r: PanelRoom, d: 1 | -1) => setCartQty((q) => {
    const cur = q[r.room_id] || 0
    const next = d > 0 ? Math.min(Math.min(r.available_count, 10), cur + 1) : Math.max(0, cur - 1)
    return { ...q, [r.room_id]: next }
  })

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1D1F29] shadow-lift p-5 space-y-3">
      {modeTabs}
      {selector}

      <div className="pt-1">
        <p className="text-[13px] font-bold text-gray-900 dark:text-white mb-1">객실 ({rooms.length})</p>
        {roomsLoading ? (
          <p className="py-3 text-xs text-gray-500 dark:text-gray-400">가용 객실 조회 중...</p>
        ) : rooms.length === 0 ? (
          <p className="py-3 text-xs text-gray-500 dark:text-gray-400">해당 기간 가용 객실이 없습니다</p>
        ) : rooms.map((r) => {
          const qty = cartQty[r.room_id] || 0
          const tooMany = guests > r.max_guests
          const disabled = !r.available || tooMany
          return (
            <div key={r.room_id} className={`flex items-center justify-between gap-3 py-3 border-t border-rule ${disabled ? 'opacity-55' : ''}`}>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-gray-900 dark:text-white truncate">{r.name}</p>
                <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-0.5">
                  기준 {r.base_guests} / 최대 {r.max_guests} · {r.available ? `잔여 ${r.available_count}` : '매진'}
                  {tooMany && r.available ? ` · 최대 ${r.max_guests}인까지` : ''}
                </p>
                <p className="text-[14px] font-extrabold text-gray-900 dark:text-white mt-0.5 tabular-nums">
                  ₩{formatNumber(r.total_price)} <span className="text-[11px] font-normal text-gray-500 dark:text-gray-400">{r.nights}박</span>
                </p>
              </div>
              <div className="flex items-center gap-1 h-9 px-1.5 rounded-[10px] border border-rule-strong shrink-0">
                <button type="button" aria-label={`${r.name} 객실 수 줄이기`} onClick={() => bump(r, -1)} disabled={qty === 0}
                  className="w-7 h-7 rounded-full text-gray-600 dark:text-gray-300 disabled:opacity-25 font-bold">−</button>
                <span className={`w-5 text-center text-[13px] font-bold tabular-nums ${qty ? 'text-gray-900 dark:text-white' : 'text-gray-400'}`}>{qty}</span>
                <button type="button" aria-label={`${r.name} 객실 수 늘리기`} onClick={() => bump(r, 1)} disabled={disabled || qty >= Math.min(r.available_count, 10)}
                  className="w-7 h-7 rounded-full text-gray-600 dark:text-gray-300 disabled:opacity-25 font-bold">+</button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="flex justify-between items-baseline pt-3 border-t border-rule">
        <span className="text-[13px] text-gray-500 dark:text-gray-400">{totalQty > 0 ? `${totalQty}객실 · ${nights}박` : '객실을 담아 주세요'}</span>
        <span className="text-[20px] font-extrabold text-gray-900 dark:text-white tabular-nums">₩{formatNumber(subtotal)}</span>
      </div>
      <button type="button" onClick={onBook} disabled={totalQty === 0}
        className="w-full h-12 rounded-xl bg-brand hover:bg-brand-dark text-white text-[15px] font-bold disabled:opacity-45 disabled:cursor-not-allowed">
        {totalQty > 0 ? `₩${formatNumber(subtotal)} 예약하기` : '예약하기'}
      </button>
      <p className="text-[12px] text-gray-500 dark:text-gray-400">{cancellation}</p>
    </div>
  )
}

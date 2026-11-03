/**
 * 🗓️ 이용권 등록 뒤 — 예약 방식에 따라 붙이는 것 (2026-11-03 숙소·예약 통일 ①)
 *
 * 상품은 모든 이용권과 같은 `POST /api/seller/products` 로 이미 만들어졌다. 여기서는:
 *   - 숙박: 숙소 정보(`/stays/:id/info`) + 객실들(`/stays/:id/rooms`)
 *   - 시간 예약: 시간표(`/products/:id/booking-slots`)
 * 실패하면 **상품은 남기고** 무엇을 못 붙였는지 돌려준다 — 사장님이 [수정]에서 이어서 붙일 수 있다(지우면 사진·매장 입력이 날아간다).
 */
import api from '@/lib/api'
import type { VoucherForm } from './voucher-form'
import { regionFromAddress } from './booking-mode'

export async function attachBooking(productId: number, form: VoucherForm, headers: Record<string, string>): Promise<string | null> {
  if (form.category === 'stay_voucher') {
    const { sido, sigungu } = regionFromAddress(form.restaurant_address)
    try {
      await api.post(`/api/seller/stays/${productId}/info`, {
        property_type: form.stay_property_type,
        check_in_time: form.stay_check_in, check_out_time: form.stay_check_out,
        total_rooms: form.stay_rooms.reduce((n, r) => n + (Number(r.inventory) || 0), 0) || 1,
        address: form.restaurant_address, region_sido: sido, region_sigungu: sigungu,
        latitude: form.restaurant_lat ? Number(form.restaurant_lat) : null,
        longitude: form.restaurant_lng ? Number(form.restaurant_lng) : null,
        description_full: form.description || null,
        amenities: form.stay_amenities, room_amenities: form.stay_room_amenities, // 상세 '서비스 및 부대시설'
      }, { headers })
    } catch { return '숙소 정보를 저장하지 못했어요. [수정]에서 다시 넣어 주세요' }
    let failed = 0
    for (const [i, r] of form.stay_rooms.entries()) {
      try {
        await api.post(`/api/seller/stays/${productId}/rooms`, {
          name: r.name.trim(), display_order: i,
          base_guests: r.base_guests, max_guests: Math.max(r.max_guests, r.base_guests),
          base_price_weekday: r.price_weekday, base_price_weekend: r.price_weekend,
          total_inventory: r.inventory,
        }, { headers })
      } catch { failed++ }
    }
    return failed ? `객실 ${failed}개를 저장하지 못했어요. [수정]에서 다시 넣어 주세요` : null
  }
  if (form.booking_mode === 'time') {
    try {
      await api.post(`/api/seller/products/${productId}/booking-slots`, { slots: form.time_slots }, { headers })
    } catch { return '예약 시간을 저장하지 못했어요. [예약 시간]에서 다시 넣어 주세요' }
  }
  return null
}

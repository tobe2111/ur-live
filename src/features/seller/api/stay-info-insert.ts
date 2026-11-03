/** 🏨 숙소 정보(`product_stay_info`) INSERT — `seller-stays.routes.ts` 에서 분리(파일 크기 래칫, 2026-11-03). */

// 🏨 2026-11-03 숙소 통일 ①: 숙소 정보 INSERT 를 한 곳에 — `POST /stays`(옛 숙소 등록)와
//   `POST /stays/:productId/info`(이용권 등록 위저드가 만든 상품에 숙소 정보를 붙인다)가 같이 쓴다.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function insertStayInfo(DB: D1Database, productId: number, body: Record<string, any>): Promise<void> {
  const {
    property_type, star_rating, total_rooms,
    check_in_time, check_out_time,
    address, address_detail, postal_code, region_sido, region_sigungu, latitude, longitude,
    amenities, room_amenities,
    cancellation_policy, custom_cancellation_text,
    house_rules, check_in_instructions,
    description_full, nearby_attractions,
    min_nights, max_nights, advance_booking_days,
    sale_mode, voucher_validity_days, voucher_weekday_only, voucher_weekend_only,
    referral_enabled, influencer_discount_pct, influencer_commission_pct,
  } = body
    await DB.prepare(
      `INSERT INTO product_stay_info (
         product_id, property_type, star_rating, total_rooms,
         check_in_time, check_out_time,
         address, address_detail, postal_code, region_sido, region_sigungu,
         latitude, longitude,
         amenities, room_amenities,
         cancellation_policy, custom_cancellation_text,
         house_rules, check_in_instructions,
         description_full, nearby_attractions,
         min_nights, max_nights, advance_booking_days,
         sale_mode, voucher_validity_days, voucher_weekday_only, voucher_weekend_only,
         referral_enabled, influencer_discount_pct, influencer_commission_pct
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      productId,
      property_type || 'pension',
      star_rating || null,
      total_rooms || 1,
      check_in_time || '15:00',
      check_out_time || '11:00',
      address || null,
      address_detail || null,
      postal_code || null,
      region_sido || null,
      region_sigungu || null,
      latitude != null ? Number(latitude) : null,
      longitude != null ? Number(longitude) : null,
      typeof amenities === 'string' ? amenities : JSON.stringify(amenities || []),
      typeof room_amenities === 'string' ? room_amenities : JSON.stringify(room_amenities || []),
      cancellation_policy || 'standard',
      custom_cancellation_text || null,
      house_rules || null,
      check_in_instructions || null,
      description_full || null,
      typeof nearby_attractions === 'string' ? nearby_attractions : JSON.stringify(nearby_attractions || []),
      Math.max(1, Number(min_nights) || 1),
      max_nights != null ? Number(max_nights) : null,
      Math.max(1, Math.min(365, Number(advance_booking_days) || 90)),
      // 🛡️ 2026-05-18: sale_mode + voucher + referral.
      (sale_mode === 'voucher' || sale_mode === 'both') ? sale_mode : 'date',
      Math.max(30, Math.min(365, Number(voucher_validity_days) || 180)),
      voucher_weekday_only ? 1 : 0,
      voucher_weekend_only ? 1 : 0,
      referral_enabled ? 1 : 0,
      Math.max(0, Math.min(50, Number(influencer_discount_pct) || 0)),
      Math.max(0, Math.min(20, Number(influencer_commission_pct) || 0)),
    ).run().catch((e: Error) => { throw new Error(`stay_info INSERT 실패: ${e.message}`) })
}

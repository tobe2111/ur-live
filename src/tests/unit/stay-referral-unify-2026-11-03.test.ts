/**
 * 🏨 숙소 소개 적립 = 이용권 장부 (2026-11-03 숙소·예약 통일 ③, 결재 1안 · 결제 잠금 대표 허가)
 *
 * 고정하는 것:
 *  ① 결제 확정의 새 분기는 **옛 금액 0** 일 때(= 새 예약) 이용권과 **같은 함수**(`applyGroupBuyReferral`)로 적립. 스위치 없음(대표 2026-11-03)
 *  ② 적립과 같은 커밋에서 역전 — 숙소 취소·오버부킹 환불·어드민 환불 세 곳 모두 `clawbackStayReferral`
 *  ③ 예약 생성은 옛 객실 '소개 할인·수수료' 를 쓰지 않는다(손님 할인 0, 소개자만 기록)
 *  ④ 상세에 이용권과 같은 '팔아보기', ?aff 를 이용권처럼 저장
 *  ⑤ /pass ↔ /stays 서로 보내기 루프가 없다(`nostay`)
 * ⚠️ 못 보는 것: 실제 결제 왕복의 숫자 — 배포 뒤 S-STAYREF 5건으로 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (p: string) => readFileSync(p, 'utf-8')
const mod = read('src/features/group-buy/api/stay-referral.ts')

describe('숙소 소개 적립 통일', () => {
  it('① 결제 확정 — 옛 금액 0 · 같은 함수 · 스위치 없음', () => {
    const pay = read('src/worker/routes/payment.routes.ts')
    expect(pay).toContain('if (booking.referrer_id && !(booking.influencer_commission_amount > 0)) {')
    expect(pay).toContain("const sr = await import('../../features/group-buy/api/stay-referral'); await sr.creditStayReferral(")
    expect(pay).not.toContain('isStayReferralUnified')
    expect(mod).toContain('await applyGroupBuyReferral(DB, rates, {')
    expect(mod).toContain("SELECT 1 AS x FROM influencer_attributions WHERE order_id = ? AND influencer_id = ?") // 멱등
    expect(mod).not.toContain('platform_settings') // 스위치를 다시 심지 않는다
  })
  it('①-b 실제 숙소 결제 경로(/stays/bookings/confirm)에서 적립 — 2026-11-04 (11-03 엔 payment.routes 에만 있어 이 길에선 0)', () => {
    const pub = read('src/features/group-buy/api/stays-public.routes.ts')
    const confirm = pub.slice(pub.indexOf("staysPublicRoutes.post('/stays/bookings/confirm'"))
    expect(confirm).toContain("await (await import('./stay-referral')).creditStayReferral(c.env.DB, { orderId,")
    expect(confirm).toContain("if (rb?.referrer_id && !(Number(rb.influencer_commission_amount) > 0))")
    expect(read('src/pages/checkout/StayCheckout.tsx')).toContain('/stays/checkout-return?order_id=') // 그 길이 실제로 쓰인다
  })
  it('② 역전 세 곳', () => {
    const pub = read('src/features/group-buy/api/stays-public.routes.ts')
    expect(pub).toContain("clawbackStayReferral(c.env.DB, { orderId: Number(orderId), bookingId: 0, full: true, reason: 'stay_overbooked' })")
    expect(pub).toContain("clawbackStayReferral(c.env.DB, { orderId: Number(booking.order_id), bookingId: Number(id), refundAmount, reason: 'stay_cancel' })")
    expect(read('src/features/admin/api/admin-stays.routes.ts')).toContain("reason: 'stay_admin_refund'")
    expect(mod).toContain('await reverseAttributionLedgerShares(DB,') // 원장도
    expect(mod).toContain('AND paid_at IS NULL') // 지급된 줄은 안 건드린다
  })
  it('③ 예약 생성 — 옛 객실 할인 경로를 건너뛴다(두 곳)', () => {
    const pub = read('src/features/group-buy/api/stays-public.routes.ts')
    expect(pub.match(/const uni = await unifiedStayReferrer\(c\.env\.DB, body\?\.referrer_id, userId\)/g)?.length).toBe(2)
    expect(pub).toContain('if (!uni.on && body?.referrer_id && room.referral_enabled')
    expect(pub).toContain('if (!uni.on && body?.referrer_id && firstRoom.referral_enabled')
  })
  it('④ 상세 — 팔아보기 · ?aff 저장', () => {
    const page = read('src/pages/StayDetailPage.tsx')
    expect(page).toContain('{!own && <div className="-mx-4 empty:hidden"><SellThisCard productId={stay.id}')
    expect(page).toContain("storeAffiliateRef(params.get('aff') || params.get('ref'))")
  })
  it('⑤ /pass ↔ /stays 루프 없음', () => {
    expect(read('src/pages/StayDetailPage.tsx')).toContain('navigate(`/pass/${productId}?nostay=1`, { replace: true })')
    expect(read('src/pages/GroupBuyDetailPage.tsx')).toContain("if (detail.category === 'stay_voucher' && !searchParams.get('nostay')) return <Navigate")
  })
  it('스위치는 없다 — 운영 목록·값 검증·돈 스위치 화면 어디에도', () => {
    expect(read('src/features/admin/api/admin-system-monitoring.routes.ts')).not.toContain('stay_referral_unify_enabled')
    expect(read('src/worker/utils/platform-settings-validation.ts')).not.toContain('stay_referral_unify_enabled')
    expect(read('src/pages/admin-platform-settings/money-switch-fields.ts')).not.toContain('stay_referral_unify_enabled')
  })
})

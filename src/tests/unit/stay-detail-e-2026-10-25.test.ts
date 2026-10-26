import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

/**
 * 🛏️ 숙소 상세 **E안** (2026-10-25 대표 — *"공백도 쓸데없이 많고 구매하기 버튼이 2개가 동시에 있어.
 *   여기어때 페이지 참고해봐"* → 시안 → *"이용권 상세 시안은 … 둘 다 해야하는거 아니야?"*).
 *
 * 불변식: 모바일에서 **예약 버튼은 하단 바 하나**다. 객실 카드는 고르기만 한다(radio).
 * 순서: 날짜 → 객실 → 시설 → 소개 → 이용 안내 → 위치 → 비슷한 스테이 → 후기.
 *
 * ⚠️ 못 보는 것: 실제 픽셀(띠 간격이 보기 좋은지) · PC 패널(B안, 무접촉).
 */
const PAGE = 'src/pages/StayDetailPage.tsx'
const PICKER = 'src/pages/stay-detail/StayRoomPicker.tsx'

describe('숙소 E안 — 예약 버튼은 하나', () => {
  it('객실 카드에 예약 버튼이 없다 — 카드는 radio 로 고르기만', () => {
    const page = readCode(PAGE)
    expect(page).not.toContain('이 객실 예약')
    const picker = readCode(PICKER)
    expect(picker).toContain('role="radio"')
    expect(picker).not.toMatch(/예약/)
    expect(picker).not.toMatch(/navigate|setBookingOpen/)
  })
  it('고르면 그 객실 1실이 담기고, 하단 바가 1실이면 단일 예약 창을 연다', () => {
    const page = readCode(PAGE)
    expect(page).toContain('onSelect={(r) => setCartQty({ [r.room_id]: 1 })}')
    expect(page).toMatch(/onBook=\{\(\) => \{ if \(cartItems\.length === 1 && cartTotalQty === 1\) \{ setSelectedRoom\(cartItems\[0\]\); setBookingOpen\(true\) \} else setMultiBookingOpen\(true\) \}\}/)
  })
  it('하단 예약 바가 하단 탭(z-[9999]) 위에 뜬다 — 폰의 유일한 예약 문', () => {
    const bar = readCode('src/pages/stay-detail/StayStickyBar.tsx')
    expect(bar).toMatch(/fixed bottom-0 left-0 right-0 z-\[10002\]/)
    expect(bar).toContain("cartTotalQty === 1 ? '예약하기'")
  })
  it('E안 순서 — 날짜 → 객실 → 시설 → 소개 → 이용 안내 → 위치 → 비슷한 스테이 → 후기', () => {
    const page = readCode(PAGE)
    const order = ['id="stay-sec-dates"', '<StayRoomPicker', '<SectionTitle>시설</SectionTitle>', '<SectionTitle>숙소 소개</SectionTitle>',
      '<StayPolicyInfo', '<RestaurantMiniMap', '<SimilarStays', '<StayReviews'].map((a) => {
      const i = page.indexOf(a); expect(i, `앵커가 없다: ${a}`).toBeGreaterThan(-1); return i
    })
    for (let k = 1; k < order.length; k++) expect(order[k], `순서가 어긋났다 (${k})`).toBeGreaterThan(order[k - 1])
  })
})

/** 🛏️ 숙소 상세 E안 (2026-10-25) — 예약 버튼 하나 · 여기어때 순서. */
const TEST = 'src/tests/unit/stay-detail-e-2026-10-25.test.ts'
export default [
  {
    name: '🛏️E 하단 예약 바가 다시 하단 탭 뒤로 깔린다',
    file: 'src/pages/stay-detail/StayStickyBar.tsx',
    find: 'fixed bottom-0 left-0 right-0 z-[10002]',
    replace: 'fixed bottom-0 left-0 right-0 z-50',
    test: TEST,
    why: '하단 탭이 z-[9999] 라 바가 안 보인다 — 객실 카드에 예약 버튼이 없으니 폰에서 예약할 길이 사라진다.',
  },
  {
    name: '🛏️E 객실 카드에 예약 문구가 돌아온다',
    file: 'src/pages/stay-detail/StayRoomPicker.tsx',
    find: "on ? '선택됨' : `${r.nights || nights}박`",
    replace: "on ? '이 객실 예약' : `${r.nights || nights}박`",
    test: TEST,
    why: '카드마다 예약 버튼 + 바의 예약하기 = 대표가 지적한 "구매하기 버튼 2개"가 되살아난다.',
  },
  {
    name: '🛏️E 1실을 골라도 여러 객실 창으로 간다',
    file: 'src/pages/StayDetailPage.tsx',
    find: 'if (cartItems.length === 1 && cartTotalQty === 1) { setSelectedRoom(cartItems[0]); setBookingOpen(true) } else ',
    replace: '',
    test: TEST,
    why: '단일 객실은 단일 예약 경로(create)를 타야 한다 — 여러 객실 경로로 새면 결제 흐름이 바뀐다.',
  },
  {
    name: '🛏️E 비슷한 스테이가 소개 위로 되돌아간다',
    file: 'src/pages/StayDetailPage.tsx',
    find: '        {/* Description */}',
    replace: '        <SimilarStays stayId={stay.id} regionSido={stay.region_sido} checkIn={checkIn} checkOut={checkOut} guests={guests} />\n        {/* Description */}',
    test: TEST,
    why: 'E안 순서가 깨진다(비슷한 스테이는 위치 다음).',
  },
]

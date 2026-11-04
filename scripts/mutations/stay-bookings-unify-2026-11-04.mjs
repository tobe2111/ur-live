// 🗓️ 2026-11-04 숙소 예약 창 움직임 · 사장님 예약 화면 하나 — 가드가 실제로 실패하는지.
const TEST = 'src/tests/unit/stay-bookings-unify-2026-11-04.test.ts'
export default [
  {
    name: 'stay-bookings — 숙소 예약 창 움직임이 빠진다',
    file: 'src/pages/stay-detail/StayBookingModals.tsx',
    find: "injectMotionCss('ur-m-buysheet', `",
    replace: "injectMotionCss('ur-m-buysheet-x', `",
    test: TEST,
    why: '이용권 구매 창은 움직이는데 숙소 창만 멈춰 있다.',
  },
  {
    name: 'stay-bookings — 예약 창이 할인가를 결제 금액으로 보여 준다',
    file: 'src/pages/stay-detail/StayBookingModals.tsx',
    find: '₩{formatNumber(room.total_price)}</span></p>\n          </div></div>',
    replace: '₩{formatNumber(room.discounted_price || room.total_price)}</span></p>\n          </div></div>',
    test: TEST,
    why: '서버는 객실 총액을 받는다 — 화면 금액과 결제 금액이 다르다.',
  },
  {
    name: 'stay-bookings — 옛 숙소 예약 주소가 따로 열린다',
    file: 'src/routes/seller.routes.tsx',
    find: '<Route path="/seller/stays/bookings" element={<Navigate to="/seller/bookings?tab=stay" replace />} />',
    replace: '<Route path="/seller/stays/bookings" element={<SellerBookingsPage />} />',
    test: TEST,
    why: '알림·이용권 행의 링크가 구분 없이 시간 예약으로 열린다.',
  },
  {
    name: 'stay-bookings — 안에 들어간 화면이 바깥 틀을 또 그린다',
    file: 'src/pages/SellerStaysBookingsPage.tsx',
    find: 'const Frame = embedded ? EmbeddedFrame : SellerLayout',
    replace: 'const Frame = SellerLayout',
    test: TEST,
    why: '사이드바·머리가 두 겹이 된다.',
  },
]

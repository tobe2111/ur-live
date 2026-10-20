/**
 * 🧹 마이 세 가지 (2026-10-20 대표 "2,3,4 모두 다 고쳐줘")
 * 가드: src/tests/unit/my-three-fixes-2026-10-20.test.tsx
 */
const TEST = 'src/tests/unit/my-three-fixes-2026-10-20.test.tsx'

export default [
  {
    name: '🧹 판매 알림이 다시 종 아이콘이 된다 (한 화면에 종 둘)',
    file: 'src/pages/user-profile/seller-section/StoreNotifications.tsx',
    find: '        <span>판매 알림</span>\n',
    replace: '        <span aria-hidden="true">🔔</span>\n',
    test: TEST,
    why: '맨 위 종(내 알림)과 이 종(가게 알림)이 구분되지 않는다.',
  },
  {
    name: '🧹 등록 줄이 다시 판 끝까지 꽉 찬다 (사용처리 티켓과 폭이 갈린다)',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'min-h-[52px] py-2 rounded-[10px] bg-brand text-white text-left',
    replace: 'min-h-[52px] py-2 bg-brand text-white text-left',
    test: TEST,
    why: '바로 위 티켓은 좌우 12px 안쪽인데 이 줄만 끝까지 차서 두 칸의 폭이 다르다.',
  },
  {
    name: '🧹 주문 내역 줄을 빼면서 결제 내역 길까지 지운다',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "onClick: () => navigate('/my-orders') }}>",
    replace: "onClick: () => navigate('/my-vouchers') }}>",
    test: TEST,
    why: '영수증·환불을 확인할 길이 사라진다 — 줄을 뺀 것은 겹침 때문이지 화면을 없애려던 게 아니다.',
  },
]

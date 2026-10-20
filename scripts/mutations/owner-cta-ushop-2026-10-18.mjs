// 👤🏪 2026-10-18 이용권 주인의 [구매하기] 혼동 · 유어샵 '이번 주 픽' 결함 3건 재발 방지.
const T = 'src/tests/unit/owner-cta-ushop-hero-2026-10-18.test.tsx'
export default [
  {
    name: '👤 구매 차단이 주인 좌석(/store/new 사장님)을 다시 못 본다',
    file: 'src/features/group-buy/api/gb-purchase-guards.ts',
    find: "AND o.role = 'owner' AND o.revoked_at IS NULL) )",
    replace: "AND o.role = 'owner' AND o.revoked_at IS NULL AND 0) )",
    test: T,
    why: '직접 등록한 사장님이 자기 이용권을 사고 화면도 그를 주인으로 못 알아본다',
  },
  {
    name: '👤 중개(operator)까지 주인으로 본다',
    file: 'src/features/group-buy/api/gb-purchase-guards.ts',
    find: "AND o.role = 'owner' AND o.revoked_at IS NULL) )",
    replace: "AND o.revoked_at IS NULL) )",
    test: T,
    why: '맡은 가게일 뿐인 중개가 그 가게 이용권을 못 산다',
  },
  {
    name: '👤 모바일 바가 주인에게도 구매 버튼을 낸다',
    file: 'src/pages/group-buy/DealBottomBar.tsx',
    find: '{isOwner && onManage ? <OwnerManagePanel onManage={onManage} compact /> : (',
    replace: '{false ? <OwnerManagePanel onManage={onManage!} compact /> : (',
    test: T,
    why: '누르면 "본인 상품은 참여할 수 없습니다" 로 혼나는 버튼이 다시 보인다',
  },
  {
    name: '👤 PC 상자가 주인에게도 결제 버튼을 낸다',
    file: 'src/pages/group-buy/DealPurchaseBox.tsx',
    find: '{isOwner && onManage ? <OwnerManagePanel onManage={onManage} /> : <>',
    replace: '{false ? <OwnerManagePanel onManage={onManage!} /> : <>',
    test: T,
    why: 'PC 에서만 같은 혼동이 남는다',
  },
  {
    name: '🏪 이번 주 픽이 사진 없는 첫 이용권을 다시 고른다(남색 빈 판)',
    file: 'src/pages/seller-public/featured-pick.ts',
    find: 'const featured = vouchers.find((p) => photoOf(p)) ?? shopProducts.find((p) => photoOf(p)) ?? null',
    replace: 'const featured = vouchers[0] ?? shopProducts[0] ?? null',
    test: T,
    why: '대표 사진이 비면 큰 카드가 색만 칠한 판이 된다',
  },
  {
    name: '🏪 히어로가 이용권 하나를 가져가도 [이용권] 칩이 남는다',
    file: 'src/pages/seller-public/featured-pick.ts',
    find: 'showChips: gridVouchers.length > 0 && gridProducts.length > 0',
    replace: 'showChips: vouchers.length > 0 && shopProducts.length > 0',
    test: T,
    why: '눌러도 아무 데도 안 가는 칩이 다시 뜬다',
  },
]

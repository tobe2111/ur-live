// 🏷️ 브랜드 3단계 — 가맹점 간 이용권 사용 + 쓴 지점 정산 (결재 2026-10-18-franchise-cross-owner-redeem)
const TEST = 'src/tests/unit/brand-cross-owner-2026-10-18.test.ts'

export default [
  {
    name: '🏷️ 브랜드 3단계: 게이트를 안 보고 가맹점이 받는다',
    file: 'src/worker/utils/brand-cross-owner.ts',
    find: "  return r?.value === 'true'",
    replace: '  return true',
    test: TEST,
    why: '게이트 OFF 는 1·2단계와 같아야 한다 — 머니 경로라 켜는 것은 대표가 staging 실결제 뒤에 한다.',
  },
  {
    name: '🏷️ 브랜드 3단계: 받는 점주 동의 없이 가맹점이 받는다',
    file: 'src/worker/utils/brand-wide-redeem.ts',
    find: " && okStatus && r.cross_accept === '1',",
    replace: ' && okStatus,',
    test: TEST,
    why: '결재 ① — 남이 정한 가격·구성으로 손님을 받게 되므로 받는 지점 주인이 직접 켠 지점만 받는다.',
  },
  {
    name: '🏷️ 브랜드 3단계: 소개비가 붙은 이용권도 가맹점이 받는다',
    file: 'src/worker/utils/brand-wide-redeem.ts',
    find: '  return !(await voucherHasSunkCost(DB, Number(voucherId)))',
    replace: '  return true',
    test: TEST,
    why: '결재 ② — 판매 때 이미 판 지점 계정에서 빠진 비용이 있는데 매출만 다른 점주에게 가면 판 지점이 비용만 떠안는다.',
  },
  {
    name: '🏷️ 브랜드 3단계: 주간 정산이 쓴 지점 기록을 무시하고 판 지점으로 묶는다',
    file: 'src/worker/cron/auto-settlement.ts',
    find: '             ${REDEEM_STORE_SETTLEMENT_SQL} AS seller_id,',
    replace: '             p.seller_id AS seller_id,',
    test: TEST,
    why: '원장(Rail B)은 쓴 지점으로, 주간 정산(Rail A)은 판 지점으로 가면 같은 매출이 두 지점으로 나간다.',
  },
  {
    name: '🏷️ 브랜드 3단계: 원장이 같은 주인 지점 기록까지 그 지점으로 정산한다',
    file: 'src/worker/utils/brand-cross-owner.ts',
    find: "'SELECT store_seller_id FROM voucher_redeem_stores WHERE voucher_id = ? AND cross_owner = 1 LIMIT 1'",
    replace: "'SELECT store_seller_id FROM voucher_redeem_stores WHERE voucher_id = ? LIMIT 1'",
    test: TEST,
    why: '같은 주인 지점끼리는 정산이 판 지점에 남아야 한다(1·2단계 약속) — 옮기는 것은 다른 점주 지점뿐이다.',
  },
  {
    name: '🏷️ 브랜드 3단계: 주간 정산 조각이 같은 주인 지점 기록까지 옮긴다',
    file: 'src/worker/utils/brand-cross-owner.ts',
    find: '  WHERE r.voucher_id = v.id AND r.cross_owner = 1), p.seller_id)`',
    replace: '  WHERE r.voucher_id = v.id), p.seller_id)`',
    test: TEST,
    why: '원장 쪽과 같은 판단이어야 한다 — 갈리면 같은 이용권이 두 레일에서 다른 지점으로 정산된다.',
  },
  {
    name: '🏷️ 브랜드 3단계: 판 지점이 다시 받아도 옛 기록을 안 지운다',
    file: 'src/worker/utils/brand-cross-owner.ts',
    find: '  if (Number(p.soldSellerId) === Number(p.storeSellerId)) {',
    replace: '  if (false) {',
    test: TEST,
    why: '사용 취소 뒤 판 지점에서 다시 쓰면 옛 가맹점 기록이 남아 정산이 엉뚱한 지점으로 간다.',
  },
  {
    name: '🏷️ 브랜드 3단계: 받기 동의 변경에서 주인 확인이 빠진다',
    file: 'src/features/seller/api/seller-brands.routes.ts',
    find: "      if (!(await isStoreOwner(c.env.DB, sellerId, userId))) return c.json({ success: false, error: '이 지점의 주인만 바꿀 수 있어요' }, 403)",
    replace: '',
    test: TEST,
    why: '받기 동의는 그 지점의 정산 방향을 바꾸는 결정 — 운영자 좌석이 켜면 주인 모르게 남의 매출이 들어온다.',
  },
]

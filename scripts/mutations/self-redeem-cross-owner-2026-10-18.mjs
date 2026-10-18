// 🏷️ 손님 셀프 사용 — 받는 가맹점(다른 점주 지점) 열기 + 받은 지점 기록 (결재 2026-10-18-franchise-cross-owner-redeem 후속)
const TEST = 'src/tests/unit/brand-cross-owner-2026-10-18.test.ts'

export default [
  {
    name: '🏷️ 셀프 가맹점: 게이트가 이용권 id 를 판정에 안 넘긴다',
    file: 'src/worker/utils/self-redeem-gate.ts',
    find: '{ allowScanOnly: false, voucherId })',
    replace: '{ allowScanOnly: false })',
    test: TEST,
    why: '이용권 id 가 없으면 소개비 붙은 이용권인지 못 보므로 가맹점이 늘 거절된다 — 게이트를 켜도 셀프 경로만 조용히 죽는다.',
  },
  {
    name: '🏷️ 셀프 가맹점: 게이트가 열린 지점을 돌려주지 않는다',
    file: 'src/worker/utils/self-redeem-gate.ts',
    find: "return { ok: true, mode: 'store_code', branchSellerId: branch }",
    replace: "return { ok: true, mode: 'store_code' }",
    test: TEST,
    why: '어느 지점에서 썼는지 모르면 기록이 판 지점으로 남아, 가맹점이 받은 매출이 판 지점으로 정산된다(에러 0).',
  },
  {
    name: '🏷️ 셀프 가맹점: 잠금 파일이 게이트 결과를 버린다',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: '; redeemStore = gate.branchSellerId ?? null',
    replace: '',
    test: TEST,
    why: '문은 열렸는데 받은 지점을 안 적어 정산이 판 지점으로 간다 — 결재 ③(쓴 지점 정산)이 셀프 경로에서만 깨진다.',
  },
  {
    name: '🏷️ 셀프 가맹점: 기록이 늘 판 지점을 적는다',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: 'storeSellerId: redeemStore ?? pre.seller_id })',
    replace: 'storeSellerId: pre.seller_id })',
    test: TEST,
    why: '판 지점으로 적으면 기록이 지워져 주간 정산이 가맹점을 못 찾는다.',
  },
]

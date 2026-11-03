/** 🔢 2026-11-03 사업자등록번호 자동 하이픈 — 시험: src/tests/unit/biz-no-autohyphen-2026-11-03.test.ts */
const T = 'src/tests/unit/biz-no-autohyphen-2026-11-03.test.ts'
export default [
  { name: '🔢 에이전시 가입 사업자번호가 하이픈 없이 그대로 받는다', file: 'src/pages/agency-console/AgencySignupPage.tsx', find: 'onChange={(e) => setBizNo(formatBizNo(e.target.value))}', replace: 'onChange={(e) => setBizNo(e.target.value)}', test: T, why: '대표 "모든 입력란".' },
  { name: '🔢 소유권 신청 사업자번호가 하이픈 없이 그대로 받는다', file: 'src/pages/StoreOwnerClaimPage.tsx', find: 'value={bno} onChange={(e) => setBno(formatBizNo(e.target.value))}', replace: 'value={bno} onChange={(e) => setBno(e.target.value)}', test: T, why: '대표 "모든 입력란".' },
  { name: '🔢 정산 사업자번호가 하이픈 없이 그대로 받는다', file: 'src/pages/influencer-settlement/SettleInfoSheet.tsx', find: 'business_number: formatBizNo(e.target.value) }))}', replace: "business_number: e.target.value.replace(/[^\\d-]/g, '') }))}", test: T, why: '대표 "모든 입력란".' },
]

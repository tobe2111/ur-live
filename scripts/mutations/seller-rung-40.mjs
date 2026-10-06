/**
 * 되돌려-검증 주입 — 셀러 40px 눈금 + 정산 패널 봉투 (2026-10-06)
 * 가드: src/tests/unit/seller-rung-40-2026-10-06.test.ts
 */
export default [
  {
    name: '눈금 — 묶음 탭 줄이 28px 로 돌아간다',
    file: 'src/components/seller/SellerGroupTabs.tsx',
    find: 'px-3.5 min-h-[40px] inline-flex items-center rounded-lg',
    replace: 'px-3.5 py-1.5 rounded-lg',
    test: 'src/tests/unit/seller-rung-40-2026-10-06.test.ts',
    why: '탭 줄이 28px 로 환원되면 모든 묶음 화면의 주 내비가 다시 눈금 밖이다.',
  },
  {
    name: '눈금 — 탭 줄에 금지된 tap-reach 를 쓴다(부모 overflow 로 히트영역이 죽는다)',
    file: 'src/components/seller/SellerGroupTabs.tsx',
    find: 'px-3.5 min-h-[40px] inline-flex items-center rounded-lg',
    replace: 'px-3.5 py-1.5 tap-reach rounded-lg',
    test: 'src/tests/unit/seller-rung-40-2026-10-06.test.ts',
    why: '부모가 overflow-x-auto 라 ::after 히트영역이 세로로 잘린다 — 넓힌 만큼이 그대로 죽는다.',
  },
  {
    name: '눈금 — 전폭 주 버튼이 32px(ur-btn-sm) 로 돌아간다',
    file: 'src/pages/seller-settlements/DealBalanceCard.tsx',
    find: 'ur-btn ur-btn-md ur-btn-primary flex-1 sm:flex-none',
    replace: 'ur-btn ur-btn-sm ur-btn-primary flex-1 sm:flex-none',
    test: 'src/tests/unit/seller-rung-40-2026-10-06.test.ts',
    why: '폭 182px 짜리 돈 버튼("교환권으로 받기")이 다시 32px 가 된다.',
  },
  {
    name: '눈금 — 카드 머리 링크가 잘리는 자리에서 tap-reach 를 쓴다',
    file: 'src/pages/seller-settlements/ReferralEarningsCard.tsx',
    find: 'className="flex min-h-[40px] items-center gap-1 text-[12px] font-bold text-brand-text"',
    replace: 'className="tap-reach flex items-center gap-1 text-[12px] font-bold text-brand-text"',
    test: 'src/tests/unit/seller-rung-40-2026-10-06.test.ts',
    why: 'DashboardCard 가 overflow-hidden 이라 히트영역이 잘린다 — 넓힌 척만 하고 18px 로 남는다.',
  },
  {
    name: '눈금 — 안 닿는 히트영역을 문장 속 링크에 다시 선언한다',
    file: 'src/pages/SellerStoreInfoPage.tsx',
    find: 'className="font-semibold text-brand-text underline">사업자 정보</Link>',
    replace: 'className="tap-reach font-semibold text-brand-text underline">사업자 정보</Link>',
    test: 'src/tests/unit/seller-rung-40-2026-10-06.test.ts',
    why: '실측(reachDead 1)으로 안 닿는 것이 확인된 자리다 — 선언만 남으면 감사가 "정상"으로 세어 더 나쁘다.',
  },
  {
    name: '눈금 — 폼 입력이 38px 로 돌아간다',
    file: 'src/pages/SellerStoreInfoPage.tsx',
    find: "const INPUT = 'w-full min-h-[40px] rounded-lg",
    replace: "const INPUT = 'w-full rounded-lg",
    test: 'src/tests/unit/seller-rung-40-2026-10-06.test.ts',
    why: '입력 12개가 2px 모자란 상태로 돌아간다(폼 전체 밀도라 한 자리만 고치면 갈린다).',
  },
  {
    name: '정산 패널 — 봉투 불일치가 되돌아온다(행이 있어도 빈 화면)',
    file: 'src/pages/seller-settlements/RestaurantSettlementsSection.tsx',
    find: 'const items = q.data?.data ?? []',
    replace: 'const items = q.data?.items ?? []',
    test: 'src/tests/unit/seller-rung-40-2026-10-06.test.ts',
    why: '서버는 { success, data, pagination } 을 주는데 items 를 읽으면 늘 undefined — 에러 없이 "내역이 없습니다" 만 뜬다.',
  },
]

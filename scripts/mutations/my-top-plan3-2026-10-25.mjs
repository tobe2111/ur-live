/**
 * 📋 마이 위쪽 안 3 (2026-10-25 대표 확정 — *"위쪽 안 3 으로 하되, 곧 쓸 이용권은 빼주고"*)
 * 가드: src/tests/unit/my-top-plan3-2026-10-25.test.ts
 */
const TEST = 'src/tests/unit/my-top-plan3-2026-10-25.test.ts'
const STATS = 'src/pages/user-profile/MyStats.tsx'
const PAGE = 'src/pages/UserProfilePage.tsx'

export default [
  {
    name: '📋 위쪽 판에서 쿠폰 줄이 빠진다',
    file: STATS,
    find: "        {row('쿠폰', '/my-coupons', coupon, '장')}\n",
    replace: '',
    test: TEST,
    why: '세 숫자 중 하나가 빠지면 그 목적지(쿠폰함)로 가는 길이 위쪽에서 사라진다.',
  },
  {
    name: '📋 환급 줄이 다시 "환급" 만 말한다 (무엇을 돌려받는지 모른다)',
    file: STATS,
    find: '? `충전 딜 환급 ${formatNumber(refundPending)}원 · 입금 준비 중`',
    replace: '? `환급 ${formatNumber(refundPending)}원 · 입금 준비 중`',
    test: TEST,
    why: '대표가 "환급은 뭐야? 정산이야?" 라고 물은 바로 그 문구다 — 충전 딜을 돌려받는 일이라고 말해야 한다.',
  },
  {
    name: '📋 손님 쪽 다른 구역에도 판이 생긴다',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "import { useNavigate } from 'react-router-dom'\n",
    replace: "import { useNavigate } from 'react-router-dom'\nexport const __plate = 'shadow-lift'\n",
    test: TEST,
    why: '위쪽 판은 대표 승인 예외다. 다른 손님 구역까지 판이 되면 "판 = 파는 쪽" 표시가 무의미해진다.',
  },
  {
    name: '📋 벨이 다시 회색 원이 된다',
    file: PAGE,
    find: 'className="rounded-full flex items-center justify-center w-11 h-11 -mr-2 text-gray-900 dark:text-white active:opacity-70"',
    replace: 'className="rounded-full flex items-center justify-center w-11 h-11 -mr-2 bg-gray-100 text-gray-900 dark:text-white active:opacity-70"',
    test: TEST,
    why: '시안 안 3 의 머리줄은 벨이 맨 아이콘이다 — 회색 원이 서면 이름 줄과 다툰다.',
  },
]

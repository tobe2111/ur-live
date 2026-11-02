/**
 * 🧬 주입 — 마이에서 들어가는 화면 정리 2차 (2026-10-19 대표 *"응 다 이상적으로 진행해줘 모두"*)
 *    가드: src/tests/unit/my-subpages-2026-10-19.test.ts · account-delete-honest-2026-10-19.test.ts ⑥
 */
const T = 'src/tests/unit/my-subpages-2026-10-19.test.ts'
const H = 'src/tests/unit/account-delete-honest-2026-10-19.test.ts'
export default [
  {
    name: '마이하위 — 마이 목록에 새 줄을 더하며 머리줄 표에 안 넣는다',
    file: 'src/pages/user-profile/ShoppingGroup.tsx',
    find: "path: '/my/follows' },",
    replace: "path: '/my/follows' },\n    { Icon: StarIcon, label: 'x', path: '/my-new-place' },",
    test: H,
    why: '표에 없는 목적지는 아무도 머리줄을 안 본다 — 조용히 다른 머리줄로 샌다.',
  },
  {
    name: '마이하위 — 주문 내역이 자기 뒤로 버튼을 다시 그린다',
    file: 'src/pages/MyOrdersPage.tsx',
    find: "import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'\n",
    replace: "import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'\nimport { ArrowLeft } from 'lucide-react'\n",
    test: H,
    why: '마이에서 줄을 누를 때마다 다른 앱으로 넘어간 것처럼 보인다(종전 네 모양).',
  },
  {
    name: '마이하위 — 내 교환권이 지갑 머리줄의 뒤로 버튼을 다시 쓴다',
    file: 'src/pages/MyGifticonsPage.tsx',
    find: "          unit={t('voucher.deal', { defaultValue: '딜' })}\n        />",
    replace: "          unit={t('voucher.deal', { defaultValue: '딜' })}\n          onBack={() => navigate('/vouchers')}\n        />",
    test: H,
    why: '공용 머리줄과 지갑 머리줄이 각자 뒤로 버튼을 그려 화살표가 둘 선다.',
  },
  {
    name: '마이하위 — 딜 내역에 늘 비는 추천 칩이 돌아온다',
    file: 'src/pages/MyDealHistoryPage.tsx',
    find: "  { value: 'refund',          label: '환불',    Icon: RotateCcw },\n",
    replace: "  { value: 'refund',          label: '환불',    Icon: RotateCcw },\n  { value: 'referral_bonus' as FilterType,  label: '추천',    Icon: List },\n",
    test: T,
    why: '지급된 적 없는(그리고 주지 않는) 보너스를 "있는 혜택" 처럼 보인다.',
  },
  {
    name: '마이하위 — 딜 잔액이 검정 그라디언트 판으로 돌아간다',
    file: 'src/pages/MyDealHistoryPage.tsx',
    // 2026-11-02 앵커 재조준 — A안 평면으로 판·그림자가 걷혔다(결함은 그대로).
    find: '<div className="rounded-2xl p-5">',
    replace: '<div className="rounded-2xl p-5" style={{ background: \'linear-gradient(135deg, #2b2b2e 0%, #0a0a0b 100%)\' }}>',
    test: T,
    why: '이 화면에만 있던 모양 — 숫자가 아니라 검은 판이 주인공이 된다.',
  },
  {
    name: '마이하위 — 주문 상태 칩 줄이 종류 탭 위에 다시 선다',
    file: 'src/pages/MyOrdersPage.tsx',
    find: '      {/* Content */}',
    replace: '      <div>{STATUS_FILTERS.map(f => <button key={f.key}>{f.label}</button>)}</div>\n      {/* Content */}',
    test: T,
    why: '필터가 위아래 두 줄이면 어느 줄이 무엇을 거르는지 읽어야 한다.',
  },
  {
    name: '마이하위 — 주문 빈 카드에 테두리가 돌아온다',
    file: 'src/components/mypage/OrdersTab.tsx',
    find: '<div className="rounded-2xl p-12 text-center">', // 2026-11-02 A안 평면 재조준
    replace: '<div className="bg-surface rounded-2xl border border-gray-100 dark:border-[#2C2F35] p-12 text-center">',
    test: T,
    why: '카드는 테두리 0 · 들림 하나(표면 규칙 ①).',
  },
  {
    name: '마이하위 — 테마 선택이 옅은 테두리로 돌아간다',
    file: 'src/components/settings/ThemeToggleSection.tsx',
    find: "const activeClass = 'bg-brand text-white'",
    replace: "const activeClass = 'bg-brand/15 border border-brand/40 text-brand-text'",
    test: T,
    why: '다른 선택 칩은 전부 브랜드 면이다 — 이 화면만 다른 선택 모양이 된다.',
  },
  {
    name: '마이하위 — 이메일 알림과 화면 테마 사이 구분선이 다시 빠진다',
    file: 'src/components/settings/ThemeToggleSection.tsx',
    find: " border-y border-rule`}>",
    replace: "`}>",
    test: T,
    why: '바로 위 알림 줄이 자기 마지막 선을 지워 두 블록이 한 덩어리로 붙는다.',
  },
  {
    name: '마이하위 — 알림 빈 화면 버튼이 보조 버튼으로 돌아간다',
    file: 'src/pages/NotificationsPage.tsx',
    find: 'className="ur-btn ur-btn-md ur-btn-primary mt-6"',
    replace: 'className="ur-btn ur-btn-md ur-btn-secondary mt-6"',
    test: T,
    why: '그 화면의 유일한 할 일인데 회색 테두리 버튼이면 주 행동으로 안 읽힌다.',
  },
]

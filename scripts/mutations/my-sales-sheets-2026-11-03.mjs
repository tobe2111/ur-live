/** 🧬 주입 — 마이 판매 시트 마이용(2026-11-03). 가드: src/tests/unit/my-sales-sheets-2026-11-03.test.tsx */
const TEST = 'src/tests/unit/my-sales-sheets-2026-11-03.test.tsx'
export default [
  {
    name: '🧾 마이 판매 시트 — 주문이 다시 셀러 화면 그대로 뜬다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: "'/seller/orders': 'myOrders', ",
    replace: '',
    test: TEST,
    why: '대표가 "붕 떠 보인다" 고 한 그 화면(머리·몸통 두 조각 · 흰 위 테두리 카드)이 돌아온다.',
  },
  {
    name: '🧾 마이 판매 시트 — 깊은 화면을 openPage 로 열어 자기 자신으로 되돌아온다',
    file: 'src/pages/user-profile/SellerSection.tsx',
    find: 'onDeep={(p, t, from) => openRawPage(p, t, from)}',
    replace: 'onDeep={(p, t, from) => { void openPage(p, t, from) }}',
    test: TEST,
    why: "'더 보기(/seller/analytics)' 를 누르면 같은 마이 시트가 다시 열려 셀러 화면에 영영 못 간다.",
  },
  {
    name: '🧾 마이 판매 시트 — 셀러 주문 화면이 환불을 따로 부른다(두 벌)',
    file: 'src/pages/SellerOrdersPage.tsx',
    find: "import { useOrderActions } from './seller-orders/useOrderActions'",
    replace: "import { useOrderActions } from './seller-orders/useOrderActions'\nconst _dup = (api: { post: (u: string, b: unknown) => unknown }, orderNumber: string) => api.post(`/api/seller/orders/${orderNumber}/refund`, {})",
    test: TEST,
    why: '환불 호출이 두 곳에 있으면 한쪽만 고쳐지는 날이 온다(사유 누락 같은 것).',
  },
  {
    name: '🧾 마이 판매 시트 — 주문 시트가 다른 캐시 키를 쓴다(목록이 두 벌)',
    file: 'src/pages/user-profile/my-sales/MyOrdersSheet.tsx',
    find: "queryKey: ['seller', 'orders'],",
    replace: "queryKey: ['my', 'orders'],",
    test: TEST,
    why: '셀러 화면에서 처리한 주문이 마이 시트엔 낡은 상태로 남는다.',
  },
  {
    name: '🧾 마이 판매 시트 — 판매 없음 화면이 빈 흰 면으로 돌아간다',
    file: 'src/pages/user-profile/my-sales/MyAnalyticsSheet.tsx',
    find: '<p className="px-5 pt-8 text-[13px] font-medium text-gray-500 dark:text-gray-400">판매가 생기면 보이는 것</p>',
    replace: '',
    test: TEST,
    why: '시트 아래 절반이 비어 "붕 떠 보이는" 그 모양이 된다.',
  },
]

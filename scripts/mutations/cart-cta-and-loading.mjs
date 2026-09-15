/**
 * 🔘🕐 장바구니 버튼 자동 분할 + 로딩/없음 구분 (2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/cart-cta-and-loading-2026-09-15.test.tsx
 *
 * 로딩 쪽은 **에러가 안 나는 결함**이라 더 위험하다 — 화면이 "없어요"라고 거짓말해도 아무도 안 죽는다.
 */
const TEST = 'src/tests/unit/cart-cta-and-loading-2026-09-15.test.tsx'
const CTA = 'src/pages/cart/cart-cta.ts'
const TOTALS = 'src/pages/cart/cart-totals.ts'
const CACHE = 'src/hooks/queries/localCache.ts'
const HOOKS = 'src/hooks/queries/useMyData.ts'
const SUM = 'src/components/cart/CartSummary.tsx'
const ROUTES = 'src/features/cart/api/cart.routes.ts'
const BAR = 'src/pages/restaurant-map/SheetFilterBar.tsx'
const MAP = 'src/pages/RestaurantMapPage.tsx'

export default [
  {
    name: '[장바구니버튼] 섞이면 다시 잠근다 (사용자에게 체크박스 노동을 떠넘긴다)',
    file: CTA,
    find: '    disabled: !!updating,\n    payItems,',
    replace: '    disabled: true,\n    payItems,',
    test: TEST,
    why: '대표가 정확히 이걸 지적했다 — "따로 골라서 결제할 필요도 또 없지 않나?".',
  },
  {
    name: '[장바구니버튼] 고른 덩어리가 아니라 전부를 결제로 보낸다 (딜+원 한 결제)',
    file: CTA,
    find: '  const payItems = groups.get(first)!',
    replace: '  const payItems = selected',
    test: TEST,
    why: '딜로 살 것이 카드로 청구된다 — 이 PR 이전의 그 머니 버그로 되돌아간다.',
  },
  {
    name: '[장바구니버튼] 남는 것을 안 알려 준다 (사라진 줄 안다)',
    file: CTA,
    find: '    hint: `교환권은 딜로, 이용권은 카드로 결제돼요. ',
    replace: '    hint: `${``}',
    test: TEST,
    why: '버튼이 일부만 결제하는데 나머지가 어떻게 되는지 화면이 말하지 않으면 불신이 생긴다.',
  },
  {
    name: '[장바구니버튼] 개수 우선순위를 뒤집는다 (적은 쪽을 먼저)',
    file: CTA,
    find: '  const first = present.reduce((a, b) => (qty(groups.get(b)!) > qty(groups.get(a)!) ? b : a))',
    replace: '  const first = present.reduce((a, b) => (qty(groups.get(b)!) < qty(groups.get(a)!) ? b : a))',
    test: TEST,
    why: '많이 담은 쪽을 먼저 처리하는 게 사람의 기대다.',
  },
  {
    name: '[로딩거짓] 캐시 없을 때 다시 빈 값을 "진짜 데이터"로 준다',
    file: CACHE,
    find: '  return readCacheOrNull<T>(key) ?? undefined',
    replace: '  return (readCacheOrNull<T>(key) ?? ([] as unknown as T))',
    test: TEST,
    why: '🩸 이게 원래 결함이다 — isLoading:false 가 되어 화면이 "없어요"를 먼저 그린다.',
  },
  {
    name: '[로딩거짓] 내 지갑 훅이 readCache 폴백으로 되돌아간다',
    file: HOOKS,
    find: "    initialData: () => cachedInitialData<MyVoucher[]>('my-vouchers'),",
    replace: "    initialData: () => readCache<MyVoucher[]>('my-vouchers', []),",
    test: TEST,
    why: '훅 하나만 되돌아가도 그 페이지는 다시 거짓말한다 — 20곳이 같은 함정이었다.',
  },
  {
    name: '[할인] 아낀 금액을 안 센다',
    file: TOTALS,
    find: '      if (d.showOriginal) saved += (d.originalPrice - d.price) * item.quantity',
    replace: '      void d',
    test: TEST,
    why: '대표가 요청한 "할인 정보"의 핵심 숫자가 사라진다.',
  },
  {
    name: '[할인] 정가가 판매가와 같아도 아꼈다고 한다',
    file: TOTALS,
    find: '      if (d.showOriginal) saved += (d.originalPrice - d.price) * item.quantity',
    replace: '      saved += Math.max(0, d.originalPrice - d.price) * item.quantity || 1',
    test: TEST,
    why: '"0원 아꼈어요" 는 소음이고, 없는 할인을 지어내면 거짓말이다.',
  },
  {
    name: '[할인] 요약이 할인 줄을 안 그린다',
    file: SUM,
    find: '        {savedAmount > 0 && (',
    replace: '        {false && (',
    test: TEST,
    why: '계산은 맞는데 화면에 없으면 사용자에겐 없는 것이다.',
  },
  {
    name: '[할인] 서버가 정가·할인율을 안 내려준다',
    file: ROUTES,
    find: '           p.original_price,\n           p.discount_rate,',
    replace: '           ',
    test: TEST,
    why: '화면이 그릴 값 자체가 없어진다 — 조용히 할인 표시가 통째로 사라진다.',
  },
  {
    name: '[지도] 받기 전에 다시 "0곳"이라고 단정한다',
    file: BAR,
    find: "{filteredCount ?? '…'}",
    replace: '{filteredCount ?? 0}',
    test: TEST,
    why: '렌더 실측에서 696ms "0곳" → 957ms "336곳" 이었다. 0곳은 거짓이다.',
  },
  {
    name: '[지도] 모바일 시트에만 로딩 신호를 준다 (PC 와 갈린다)',
    file: MAP,
    // 두 시트가 거의 같은 줄을 쓴다 — 모바일 쪽 꼬리(`filtered.length`)로 구분한다.
    find: 'filteredCount={loading && displayList.length === 0 ? null : (!needsAll && !search ? (feedTotal ?? displayList.length) : filtered.length)}',
    replace: 'filteredCount={!needsAll && !search ? (feedTotal ?? displayList.length) : filtered.length}',
    test: TEST,
    why: '한쪽만 고치면 두 화면이 서로 다른 숫자를 말한다 — 이 레포가 반복해 당한 자리.',
  },
]

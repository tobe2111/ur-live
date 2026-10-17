/**
 * 🧭 지도·검색 → 상세 직행 + 미리 데우기 (2026-10-15) — 주입 매니페스트.
 * 가드: src/tests/unit/map-detail-direct-2026-10-15.test.ts
 */
const TEST = 'src/tests/unit/map-detail-direct-2026-10-15.test.ts'
export default [
  { name: '🧭 지도 선택 카드가 다시 /products 로 보낸다', file: 'src/pages/restaurant-map/SelectedDealCard.tsx',
    find: '    navigate(detailHref(selected))', replace: '    navigate(`/products/${selected.id}`)', test: TEST,
    why: '쇼핑 상세가 데이터를 받은 뒤 /pass 로 다시 보낸다 — 로더 두 번 · 같은 상품 두 번.' },
  { name: '🧭 지도 목록(목록 모드)이 다시 /products 로 보낸다', file: 'src/pages/RestaurantMapPage.tsx',
    find: 'onSelect={(r) => navigate(detailHref(r))}', replace: 'onSelect={(r) => navigate(`/products/${r.id}`)}', test: TEST,
    why: '같은 중간 페이지.' },
  { name: '🧭 detailHref 가 숙소를 /pass 로 보낸다', file: 'src/shared/product-flow.ts',
    find: '  return canonicalDetailPath(p) ?? FLOW_CONFIG.standard_checkout.detailPath(p.id)', replace: "  return p.category === 'stay_voucher' ? `/pass/${p.id}` : (canonicalDetailPath(p) ?? FLOW_CONFIG.standard_checkout.detailPath(p.id))", test: TEST,
    why: '숙소는 객실·날짜가 있는 /stays 가 정본이다.' },
  { name: '🧭 선택 카드가 상세를 안 데운다', file: 'src/pages/restaurant-map/SelectedDealCard.tsx',
    find: '  useEffect(() => { prefetchDetail(selected) }, [selected.id, prefetchDetail])', replace: '  useEffect(() => {}, [selected.id, prefetchDetail])', test: TEST,
    why: '누른 뒤에야 청크·데이터를 받아 풀스크린 로더가 ~0.7초 뜬다.' },
  { name: '🧭 목록 줄이 손가락 닿은 순간을 안 쓴다', file: 'src/pages/restaurant-map/RestaurantRow.tsx',
    find: '      onPointerDown={onIntent ? () => onIntent(r) : undefined}\n', replace: '', test: TEST,
    why: 'pointerdown→click 사이를 버리면 목록 모드에서 로더가 그대로 뜬다.' },
  { name: '🧭 데우기가 홈 카드와 다른 키를 쓴다', file: 'src/pages/restaurant-map/prefetch-detail.ts',
    find: 'prefetchGroupBuyProduct(qc, k)', replace: 'Promise.resolve(k)', test: TEST,
    why: '키가 다르면 받아 놓고 상세가 못 쓴다.' },
  { name: '🧭 유어샵 핀이 교환권을 이용권 상세로 보낸다', file: 'src/worker/routes/curator.routes.ts',
    find: "${Number(prod!.deal_only) === 1 ? '/vouchers' : '/pass'}/${productId}", replace: '/pass/${productId}', test: TEST,
    why: '교환권(딜 결제)을 이용권 화면이 그린다.' },
]

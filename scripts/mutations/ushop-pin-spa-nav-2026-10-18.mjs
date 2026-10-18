// 📌 유어샵 진열 카드 앱 안 이동 — 결재 `2026-10-15-ushop-pin-spa-nav` 안 1 (2026-10-18)
const TEST = 'src/tests/unit/ushop-pin-spa-nav-2026-10-18.test.tsx'

export default [
  {
    name: '📌 유어샵 앱 안 이동: 카드에서 onClick 을 뺀다',
    file: 'src/pages/curator-page/PinRow.tsx',
    find: "      onClick={() => onPinClick(handle, curatorUserId, pin.product_id)}\n",
    replace: "",
    test: TEST,
    why: '화면은 똑같이 상세로 가는데 소개 값이 안 남아 커미션 귀속이 조용히 사라진다.',
  },
  {
    name: '📌 유어샵 앱 안 이동: 누를 때 소개 값 저장을 뺀다',
    file: 'src/pages/curator-page/pin-nav.ts',
    find: "  if (curatorUserId) storeAffiliateRef(String(curatorUserId)) // 본인 유어샵이면 함수가 알아서 건너뛴다\n",
    replace: "",
    test: TEST,
    why: '클릭 수는 그대로 세지는데 결제 때 실어 보낼 소개 값이 없다 — 돈이 새는 쪽.',
  },
  {
    name: '📌 유어샵 앱 안 이동: 비콘 주소가 다른 상품을 가리킨다',
    file: 'src/pages/curator-page/pin-nav.ts',
    find: "/p/${encodeURIComponent(String(productId))}/click`",
    replace: "/p/0/click`",
    test: TEST,
    why: '클릭 기록이 엉뚱한 상품(없는 핀)으로 가 유어샵 통계가 0 이 된다.',
  },
  {
    name: '📌 유어샵 앱 안 이동: 목적지를 손으로 /pass 로 고정',
    file: 'src/pages/curator-page/pin-nav.ts',
    find: "  return detailHref({ id: pin.product_id, deal_only: pin.deal_only, category: pin.category })",
    replace: "  return `/pass/${pin.product_id}`",
    test: TEST,
    why: '숙소·교환권·쇼핑이 이용권 화면으로 가서 다시 튕긴다(로더 두 번).',
  },
  {
    name: '📌 유어샵 앱 안 이동: 서버 비콘 엔드포인트를 지운다',
    file: 'src/worker/routes/curator.routes.ts',
    find: "curatorRoutes.post('/:handle/p/:productId/click'",
    replace: "curatorRoutes.post('/:handle/p/:productId/click-removed'",
    test: TEST,
    why: '앱 안 클릭이 전부 404 로 사라져 유어샵 클릭 수가 멈춘다(에러 0).',
  },
  {
    name: '📌 유어샵 앱 안 이동: 바깥 공유 링크 라우트를 지운다',
    file: 'src/App.tsx',
    find: '            <Route path="/u/:handle/p/:productId" element={<CuratorPinClientRedirect />} />\n',
    replace: '',
    test: TEST,
    why: '카톡·SNS 에 이미 퍼진 /u/:handle/p/:id 링크가 귀속 없이 엉뚱한 화면으로 간다.',
  },
]

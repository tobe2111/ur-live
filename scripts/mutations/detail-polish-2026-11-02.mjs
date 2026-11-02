/**
 * 🧹 이용권 상세 다듬기 넷 (2026-11-02 대표 선택 ①②③④) — 주입 매니페스트.
 * 가드: src/tests/unit/detail-polish-2026-11-02.test.ts
 */
const T = 'src/tests/unit/detail-polish-2026-11-02.test.tsx'

export default [
  {
    name: '다듬기① — 이용권 상세 지도가 다시 테두리 상자로 그려진다',
    file: 'src/pages/GroupBuyDetailPage.tsx',
    find: '<RestaurantMiniMap bare name=',
    replace: '<RestaurantMiniMap name=',
    test: T,
    why: '같은 가게 이름이 매장 칸 한 곳에 세 번 나오고, 그 칸만 테두리 상자가 남는다(대표 선택 ①).',
  },
  {
    name: '다듬기① — bare 지도에서 카카오 장소 링크가 사라진다',
    file: 'src/components/RestaurantMiniMap.tsx',
    find: '{bare && kakaoMapUrl && (',
    replace: '{false && kakaoMapUrl && (',
    test: T,
    why: '테두리를 걷으면서 카카오 장소 페이지(사진·후기)로 가는 길까지 잃으면 안 된다.',
  },
  {
    name: '다듬기② — 로그아웃 손님에게 [리뷰 작성하기] 가 다시 뜬다',
    file: 'src/pages/product-detail/ProductReviews.tsx',
    find: '{getUserIdSync() && <ReviewForm productId={productId}',
    replace: '{true && <ReviewForm productId={productId}',
    test: T,
    why: '눌러도 "로그인 후" 안내뿐이던 큰 버튼이 모든 손님에게 보였다(대표 선택 ②).',
  },
  {
    name: '다듬기③ — 이미 담은 상품에서 링크가 복사되지 않는다',
    file: 'src/features/curator/hooks/usePinAction.ts',
    find: "        if (result.code === 'ALREADY_PINNED') {\n          const copied = await copyShareLink(",
    replace: "        if (result.code === 'ALREADY_PINNED') {\n          const copied = false && await copyShareLink(",
    test: T,
    why: "그러면 '링크만 복사' 버튼이 따로 필요해진다 — 버튼을 하나로 줄인 전제(대표 선택 ③).",
  },
  {
    name: "다듬기④ — '상품 구성' 이 제목을 되풀이해도 다시 뜬다",
    file: 'src/pages/group-buy/StoreIntro.tsx',
    find: '  if (core.length <= name.length && squash(name).includes(squash(core))) return \'\'\n',
    replace: '\n',
    test: T,
    why: "라이브 2919: '달빛한스푼 이용권' 한 줄이 구역 하나를 차지했다(대표 선택 ④).",
  },
]

/** 🎫 지갑 안 B(2026-10-14 대표 확정) — 아래 추천 줄의 두 약속. */
const T = 'src/tests/unit/wallet-and-slop.test.ts'
export default [
  {
    name: '🎫 지갑 추천이 이미 가진 이용권을 다시 권한다',
    file: 'src/pages/my-vouchers/WalletRecommend.tsx',
    find: '.filter(p => !ownedProductIds.has(p.id) && !ownedProductIds.has(String(p.id)))',
    replace: '.filter(Boolean)',
    test: T,
    why: '지갑에 있는 바로 그 이용권을 "이건 어때요?" 로 권하면 추천이 아니라 소음이다. 화면은 멀쩡해서 안 보인다.',
  },
  {
    name: '🎫 지갑 추천이 홈 피드와 다른 요청을 만든다',
    file: 'src/pages/my-vouchers/WalletRecommend.tsx',
    find: '  const { data } = usePopularPasses()',
    replace: "  const { data } = { data: [] as ReturnType<typeof usePopularPasses>['data'] }; void fetch('/api/group-buy/products?sort=popular')",
    test: T,
    why: '같은 키를 쓰면 홈을 거쳐 온 사람에게 요청 0회다. 따로 부르면 지갑 첫 화면에 요청이 하나 늘고 예열도 빗나간다.',
  },
]

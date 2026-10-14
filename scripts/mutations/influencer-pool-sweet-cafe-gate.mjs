/**
 * 🧬 주입 — 스위트스팟 블로그 하한 1천 + 카페 스위치 저장 경로 (2026-10-14 대표 *"카페 꺼줘 · 스윗스팟 1천"*).
 */
const TEST = 'src/tests/unit/influencer-pool-sweet-cafe-gate-2026-10-14.test.ts'

export default [
  {
    name: '🎯 스위트스팟이 다시 블로그를 숫자 없이 전부 넣는다',
    file: 'src/features/marketing/api/admin-ads-influencers.routes.ts',
    find: "THEN 1000 ELSE 10000 END)",
    replace: "THEN 0 ELSE 10000 END)",
    test: TEST,
    why: '대표가 정한 1천이 사라지면 이웃 0명 블로그까지 스위트스팟으로 나온다. 화면·에러는 그대로다.',
  },
  {
    name: '🎯 블로그 하한이 유튜브로 샌다',
    file: 'src/features/marketing/api/admin-ads-influencers.routes.ts',
    find: "THEN 1000 ELSE 10000 END)",
    replace: "THEN 1000 ELSE 1000 END)",
    test: TEST,
    why: '유튜브 1만 기준은 대표가 바꾸지 않았다 — 한 숫자로 합치면 구독자 1천 유튜브가 섞인다.',
  },
  {
    name: '🎛️ 카페 스위치 라우터를 다시 뒤에 마운트한다',
    file: 'src/features/marketing/api/admin-ads.routes.ts',
    find: "app.route('/', adminAdsCollectGatesRoutes)\napp.route('/', adminAdsInfluencerRoutes)\napp.route('/', adminAdsPoolOpsRoutes)",
    replace: "app.route('/', adminAdsInfluencerRoutes)\napp.route('/', adminAdsPoolOpsRoutes)\napp.route('/', adminAdsCollectGatesRoutes)",
    test: TEST,
    why: 'PATCH /influencer-pool/:id 가 collect-gates 를 id 로 잡아 400 — 어드민 카페 스위치가 저장되지 않는다.',
  },
]

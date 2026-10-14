/**
 * 🎛️ 유어애즈 어드민 — 앞의 `/:id` 가 뒤의 고정 경로를 삼키지 않는다 (2026-10-14 — 카페 토글이 저장 안 되던 것) — 주입 매니페스트.
 * 가드: src/tests/unit/admin-ads-route-shadow-2026-10-14.test.ts
 */
const TEST = 'src/tests/unit/admin-ads-route-shadow-2026-10-14.test.ts'
const FILE = 'src/features/marketing/api/admin-ads-influencers.routes.ts'

export default [
  {
    name: '🎛️ PATCH /influencer-pool/:id 숫자 제약을 뺀다',
    file: FILE,
    find: "app.patch('/influencer-pool/:id{[0-9]+}', async",
    replace: "app.patch('/influencer-pool/:id', async",
    test: TEST,
    why: '카페 원클릭 토글(PATCH collect-gates)이 "잘못된 ID" 로 거절돼 어드민에서 끌 수 없다.',
  },
  {
    name: '🎛️ DELETE /influencer-pool/:id 숫자 제약을 뺀다',
    file: FILE,
    find: "app.delete('/influencer-pool/:id{[0-9]+}', async",
    replace: "app.delete('/influencer-pool/:id', async",
    test: TEST,
    why: '같은 클래스 — 나중에 고정 경로 DELETE 를 추가하면 조용히 /:id 에 먹힌다.',
  },
]

/** 🧬 주입 — 마이 내 가게 + 에이전시 한 구역(2026-11-02). 가드: src/tests/unit/my-agency-merged-2026-11-02.test.ts */
const TEST = 'src/tests/unit/my-agency-merged-2026-11-02.test.ts'
export default [
  {
    name: '🧩 합친 구역 — 하나만 겹쳐도 에이전시 매장 판을 숨긴다',
    file: 'src/pages/agency-console/AgencyStoresPanel.tsx',
    find: '(rows === null || active.every((r) => ownSellerIds.includes(r.sellerId)))',
    replace: '(rows === null || active.some((r) => ownSellerIds.includes(r.sellerId)))',
    test: TEST,
    why: '내 가게 밖의 맡은 매장이 있어도 판이 사라져 그 매장으로 갈 길이 없어진다.',
  },
  {
    name: '🧩 합친 구역 — 에이전시 매장 판이 다시 두 번 그려진다',
    file: 'src/pages/agency-console/AgencyStoresPanel.tsx',
    find: "className={coveredByMine ? 'hidden' :",
    replace: "className={false ? 'hidden' :",
    test: TEST,
    why: '같은 매장이 내 가게와 맡은 매장에 두 번 — 대표가 "왜 따로 노는 형태인거지?" 라고 짚은 그 모양.',
  },
  {
    name: '🧩 합친 구역 — 에이전시 이름 제목이 매장 판 위에서 빠진다',
    file: 'src/pages/UserProfilePage.tsx',
    find: '      <AgencyTitleDoor storeCount={sellerSeats.stores.length} />\n      <SellerSection',
    replace: '      <SellerSection',
    test: TEST,
    why: '매장이 어느 에이전시 아래인지 안 보인다 — 다시 따로 노는 것처럼 보인다.',
  },
]

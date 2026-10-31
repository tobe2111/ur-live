/**
 * 🧬 주입 — 에이전시 매장 초대 링크(직원 복사·카톡 카드·여러 매장, 2026-10-31).
 * 가드: src/tests/unit/agency-invite-multi-2026-10-31.test.ts
 */
const T = 'src/tests/unit/agency-invite-multi-2026-10-31.test.ts'
export default [
  {
    name: '초대링크 — 직원이 다시 못 읽게 된다',
    file: 'src/features/agency-console/api/agency-stores.routes.ts',
    find: "agencyStoresRoutes.get('/store-invite', requireAgencyStaff(), async (c) => {",
    replace: "agencyStoresRoutes.get('/store-invite', requireAgencyStaff({ adminOnly: true }), async (c) => {",
    test: T,
    why: '매장에 찾아가는 사람은 직원인데 링크를 못 보면 관리자에게 매번 물어야 한다.',
  },
  {
    name: '초대링크 — 직원에게 새로 만들기가 열린다',
    file: 'src/features/agency-console/api/agency-stores.routes.ts',
    find: "agencyStoresRoutes.post('/store-invite', cors(), requireAgencyStaff({ adminOnly: true }),",
    replace: "agencyStoresRoutes.post('/store-invite', cors(), requireAgencyStaff(),",
    test: T,
    why: '직원이 새로 만들면 다른 직원이 이미 보낸 링크가 그 순간 죽는다.',
  },
  {
    name: '초대링크 — 서버 메타가 색인 허용으로 돌아간다',
    file: 'src/worker/utils/store-invite-ssr.ts',
    find: '    noindex: true,',
    replace: '    noindex: false,',
    test: T,
    why: '남에게 보이면 안 되는 개인 링크가 검색에 오른다.',
  },
  {
    name: '초대링크 — 없는 토큰이 다시 200 이 된다',
    file: 'src/worker/utils/surface-ssr-meta.ts',
    find: "  'STOREINVITE',\n",
    replace: '',
    test: T,
    why: '끊긴·지어낸 링크가 홈과 같은 200 페이지로 남는다.',
  },
  {
    name: '초대링크 — 첫 매장만 주인 확인한다',
    file: 'src/features/seller/api/store-agency-invite.routes.ts',
    find: '    for (const id of sellerIds) results.push(await entrustOne(DB, inv, userId, id))',
    replace: '    for (const id of sellerIds) results.push(id === sellerIds[0] ? await entrustOne(DB, inv, userId, id) : { seller_id: id, ok: true })',
    test: T,
    why: '여러 매장 중 남의 매장을 섞어 넣으면 확인 없이 넘어간다.',
  },
  {
    name: '초대링크 — 카톡 카드가 문구 SSOT 를 안 쓴다',
    file: 'src/pages/agency-console/AgencyInviteLinkCard.tsx',
    find: '      title: storeInviteCardTitle(agencyName),',
    replace: "      title: '유어딜 매장 초대',",
    test: T,
    why: '보내는 방법에 따라 같은 링크가 다른 말을 한다.',
  },
]

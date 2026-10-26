/**
 * 🏢 셀러 대시보드 제거 2단계 — 에이전시 콘솔 안 A (2026-10-12) — 주입 매니페스트.
 * 가드: src/tests/unit/agency-console-plate-2026-10-12.test.tsx
 *
 * 전부 **에러가 안 나는 결함**이다 — 숫자가 조용히 갈리거나, 남의 좌석을 쓰거나, 대시보드가 되살아난다.
 */
const TEST = 'src/tests/unit/agency-console-plate-2026-10-12.test.tsx'
const TODAY = 'src/features/agency-console/api/agency-store-today.ts'
const ROUTES = 'src/features/agency-console/api/agency-stores.routes.ts'
const API = 'src/pages/agency-console/agency-api.ts'
const PLATE = 'src/pages/agency-console/AgencyStorePlate.tsx'
const PANEL = 'src/pages/agency-console/AgencyStoresPanel.tsx'
const LAYOUT = 'src/components/MobileAppLayout.tsx'

export default [
  {
    name: '[에이전시판] 오늘 매출을 다른 규칙으로 센다 (마이와 숫자가 갈린다)',
    file: TODAY,
    find: "WHERE o.seller_id IN (${marks}) AND o.status IN ('PAID','DONE') AND DATE(o.created_at, '+9 hours') = ?",
    replace: "WHERE o.seller_id IN (${marks}) AND o.status IN ('PAID','DONE') AND DATE(o.created_at) = ?",
    test: TEST,
    why: '같은 매장을 사장님은 마이에서, 에이전시는 콘솔에서 본다 — KST 를 빼면 아침 9시 전 주문이 어제로 간다.',
  },
  {
    name: '[에이전시판] 맡김 요청 단계 매장까지 센다',
    file: ROUTES,
    find: ".filter((r) => r.status === 'active').map((r) => r.seller_id), me.agencyId)",
    replace: '.map((r) => r.seller_id), me.agencyId)',
    test: TEST,
    why: '수락 전 매장의 매출은 아직 우리 일이 아니다 — 목록에 그 숫자가 실리면 남의 매장을 들여다보는 셈이다.',
  },
  {
    name: '[에이전시판] 내 좌석을 매장 id 만으로 판정한다 (다른 직원 좌석을 그대로 씀)',
    file: API,
    find: '    return Number(p.seller_id) === sellerId && Number(p.agency_staff_id) === staffId\n',
    replace: '    return Number(p.seller_id) === sellerId\n',
    test: TEST,
    why: '매장 컴퓨터를 같이 쓰면 배정이 다른 직원·사장님 본인의 좌석이 남아 있다 — 그걸 내 것으로 쓰면 권한이 섞인다.',
  },
  {
    // 🤝 2026-10-24 재조준 — 판엔 사용처리 티켓이 없다(자기 이용권만). 같은 판임은 큰 숫자 모양으로 잰다.
    name: '[에이전시판] 판의 오늘 숫자 모양이 마이와 갈린다',
    file: PLATE,
    find: 'className="mt-2 text-[28px] font-extrabold tabular-nums leading-none whitespace-nowrap text-gray-900 dark:text-white"',
    replace: 'className="mt-2 text-[24px] font-extrabold tabular-nums leading-none whitespace-nowrap text-gray-900 dark:text-white"',
    test: TEST,
    why: '두 판은 같은 판이어야 한다 — 한쪽만 고치면 사장님과 에이전시가 다른 화면을 본다.',
  },
  {
    // 🤝 2026-10-24 재조준 — 종전 "정산을 출금 시트로" 의 불변식(돈 흐름을 직원에게 안 연다)은 이제 "정산을 아예 안 연다" 다.
    name: '[에이전시판] 판이 다시 정산(매장 전체 돈)을 연다',
    file: PLATE,
    find: "          onClick={() => openPage('/seller/group-buy', '우리 이용권')}",
    replace: "          onClick={() => openPage('/seller/settlements', '정산')}",
    test: TEST,
    why: '한 매장 · 여러 에이전시 — 정산은 매장 전체 돈이라 사장님만 본다(서버도 막는다). 판이 열면 누를 때마다 403 이다.',
  },
  {
    name: '[에이전시판] 콘솔이 다시 셀러 대시보드로 보낸다',
    file: PANEL,
    find: "            <AgencyStorePlate\n              key={`${picked.sellerId}:${openPath ?? ''}:${openNonce}`}",
    replace: "            <button type=\"button\" onClick={() => navigate('/seller')}>운영하기</button>\n            <AgencyStorePlate\n              key={`${picked.sellerId}:${openPath ?? ''}:${openNonce}`}",
    test: TEST,
    why: '이 단계의 목적이 대시보드 껍데기를 안 쓰는 것이다 — 되살아나면 4단계(껍데기 삭제)를 못 한다.',
  },
  {
    name: '[에이전시판] PC 에서 소비자 액자에 다시 갇힌다',
    file: LAYOUT,
    find: "  '/agency',\n",
    replace: '\n',
    test: TEST,
    why: '안 A 의 PC 는 두 칸이다 — 430 액자 안에서는 목록과 판이 나란히 설 수 없다(하네스 실측).',
  },
]

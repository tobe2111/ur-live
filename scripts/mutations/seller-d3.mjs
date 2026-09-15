/**
 * 🧮 셀러 대시보드 2차 (D3·A2·B2·C, 2026-09-15) — 주입 매니페스트.
 * 가드: src/tests/unit/seller-d3-2026-09-15.test.ts
 */
const TEST = 'src/tests/unit/seller-d3-2026-09-15.test.ts'

export default [
  {
    name: '🧮 D3 토큰이 어드민 래퍼로 새어 든다 (어드민 카드까지 8px)',
    file: 'src/index.css',
    find: '.seller-light-theme,\n.admin-light-theme {\n  --background: 0 0% 96%;',
    replace: '.seller-light-theme,\n.admin-light-theme {\n  --dash-radius: 8px;\n  --background: 0 0% 96%;',
    test: TEST,
    why: '공용 부품이 변수를 읽는 구조라, 변수를 어드민 스코프에 두는 순간 어드민도 D3 가 된다 — "셀러만" 이 이 설계의 약속이다.',
  },
  {
    name: '🏷️ 폰 헤더가 매장 대신 페이지 제목으로 되돌아간다',
    file: 'src/components/SellerLayout.tsx',
    find: '<StoreSwitcher variant="title" />',
    replace: '<h1 className="truncate text-[15px] font-bold text-gray-900">{title}</h1>',
    test: TEST,
    why: 'A2 의 요점은 헤더 제목 자리 = 매장(전환 겸용)이다. 제목으로 되돌리면 폰의 매장 전환이 다시 구석 드롭다운으로 숨는다.',
  },
  {
    name: '🧮 요약 API 가 승인 대기 매장까지 센다 (좌석 전환은 거부되는데 합계엔 들어간다)',
    file: 'src/features/seller/api/seller-operators.routes.ts',
    find: "      .filter(s => s.status === 'active' || s.status === 'approved')\n      .slice(0, 20)",
    replace: '      .slice(0, 20)',
    test: TEST,
    why: '좌석 토큰(/stores/:id/token)은 active|approved 만 내준다. 요약이 그 밖을 세면 화면의 합계와 전환 가능한 매장이 어긋난다.',
  },
  {
    name: '🧮 요약 API 의 오늘 판정이 /dashboard/stats 와 갈린다 (UTC 날짜)',
    file: 'src/features/seller/api/seller-operators.routes.ts',
    find: "WHERE seller_id IN (${marks}) AND status IN ('PAID','DONE') AND DATE(created_at, '+9 hours') = ?",
    replace: "WHERE seller_id IN (${marks}) AND status IN ('PAID','DONE') AND DATE(created_at) = ?",
    test: TEST,
    why: '두 API 가 같은 "오늘" 을 말해야 합계 행과 현재 좌석 타일이 맞는다 — 2026-09-14 에 고친 UTC 어긋남이 여기서 재발할 자리.',
  },
  {
    name: '🧮 홈이 매장 1곳에서도 합계 모드로 그린다 (종전 화면이 사라진다)',
    file: 'src/pages/seller-page/TodayTicket.tsx',
    find: 'const multi = !!summary && summary.stores.length >= 2',
    replace: 'const multi = !!summary && summary.stores.length >= 1',
    test: TEST,
    why: '매장 1곳인 대부분의 사장님에게 "내 매장 1곳 전체" 와 한 줄짜리 매장 표는 소음이다 — B2 는 2곳 이상에서만 켜진다.',
  },
  {
    name: '🧾 소개 수익 카드가 세션 없을 때 빈 카드를 그린다 ("소개 수익 0" 으로 읽힌다)',
    file: 'src/pages/seller-settlements/ReferralEarningsCard.tsx',
    find: '  if (!stats) return null\n',
    replace: '',
    test: TEST,
    why: '이메일 로그인 셀러는 소비자 세션이 없어 401 이다 — 그때 카드가 남으면 0원짜리 수익 칸이 정산 화면에 박힌다.',
  },
  {
    name: '📱 소개 수익 카드의 폰 행이 사라져 세 칸이 폰까지 덮는다 (₩1,180,000 이 22px 세 칸에서 넘친다)',
    file: 'src/pages/seller-settlements/ReferralEarningsCard.tsx',
    find: 'className="hidden grid-cols-3 divide-x divide-rule sm:grid"',
    replace: 'className="grid grid-cols-3 divide-x divide-rule"',
    test: TEST,
    why: '폰 폭 390 에서 세 칸은 칸당 ~120px 인데 ₩1,180,000 을 22px 모노로 넣으면 넘친다 — 폰은 행, PC 는 칸.',
  },
  {
    name: '📱 내 매장 패널이 2열 카드 그리드로 돌아간다 (340px 열에서 "이용권 등록" 이 두 줄로 꺾인다)',
    file: 'src/pages/seller-page/MyStoresPanel.tsx',
    find: 'className="-mx-4 -mb-4 divide-y divide-rule border-t border-rule"',
    replace: 'className="grid sm:grid-cols-2 gap-2"',
    test: TEST,
    why: '대표 신고(2026-09-15) "버튼이랑 글자 깨지고" — PC 홈 우측 340px 열에서 카드 한 장이 ~150px 로 눌렸다.',
  },
]

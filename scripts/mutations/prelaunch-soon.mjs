/**
 * 🌱 오픈 예정 모아보기(`/soon`) — 주입 매니페스트 (2026-09-24 등록).
 * 가드: src/tests/unit/prelaunch-soon-2026-09-24.test.ts
 *
 * 이 화면의 위험은 **조용한 부재**다: 라우트 파일만 있고 마운트를 안 하면 404 인데 빌드는 초록이고,
 * 푸터 링크가 없으면 페이지가 있어도 아무도 못 찾는다.
 */
export default [
  {
    name: '오픈 예정 라우트를 워커에 안 건다(파일만 있고 404)',
    file: 'src/worker/index.ts',
    find: "app.route('/api/group-buy', prelaunchRoutes);",
    replace: "// app.route('/api/group-buy', prelaunchRoutes);",
    test: 'src/tests/unit/prelaunch-soon-2026-09-24.test.ts',
    why:
      '라우트 모듈은 만들어 두고 마운트를 빠뜨리면 **빌드·타입·유닛이 전부 초록인데 404** 다. ' +
      '이 레포가 반복해 당한 "실패가 아니라 조용한 부재".',
  },
  {
    name: '비활성 상품도 오픈 예정 목록에 내보낸다',
    file: 'src/features/group-buy/api/prelaunch.routes.ts',
    find: 'WHERE p.is_active = 1',
    replace: 'WHERE 1 = 1',
    test: 'src/tests/unit/prelaunch-soon-2026-09-24.test.ts',
    why: '내려간 상품이 "오픈 예정" 으로 되살아난다 — 손님이 응모할 수 없는 것에 응모하게 된다.',
  },
  {
    name: '승인 안 된 매장 상품을 오픈 예정에 노출한다',
    file: 'src/features/group-buy/api/prelaunch.routes.ts',
    find: "AND ${approvedSellerProductSql('p')}",
    replace: '',
    test: 'src/tests/unit/prelaunch-soon-2026-09-24.test.ts',
    why:
      '2026-09-16 대표 지시 *"승인이 되어야 메인에 노출"* 이 새 표면에서 새는 전형적인 자리다 — ' +
      '가입 직후 아무나 만든 상품이 "오픈 예정" 으로 뜬다.',
  },
  {
    name: 'limit 을 날것으로 파싱한다(비숫자 쿼리에 D1 크래시)',
    file: 'src/features/group-buy/api/prelaunch.routes.ts',
    find: 'intParam(c.req.query(\'limit\'), DEFAULT_LIMIT)',
    replace: "parseInt(String(c.req.query('limit') || ''), 10) || DEFAULT_LIMIT",
    test: 'src/tests/unit/prelaunch-soon-2026-09-24.test.ts',
    why:
      '`?limit=abc` 가 NaN → `.bind(NaN)` 으로 500 이 나던 클래스(2026-07-01 도매 카탈로그 실사고). ' +
      '레포 룰은 `intParam` 경유다.',
  },
  {
    name: '푸터에서 오픈 예정 링크를 뺀다(있어도 아무도 못 찾는다)',
    file: 'src/components/main/SiteFooter.tsx',
    find: '<a href="/soon" className={colLink}>오픈 예정</a>',
    replace: '',
    test: 'src/tests/unit/prelaunch-soon-2026-09-24.test.ts',
    why:
      '대표 요구는 "페이지가 있었으면" 이지만, 들어갈 길이 없으면 없는 것과 같다. ' +
      '푸터는 프리렌더된 홈에 포함돼 검색엔진도 발견한다.',
  },
  {
    name: '빈 목록을 막다른 골목으로 만든다',
    file: 'src/pages/SoonPage.tsx',
    find: '지금 살 수 있는 딜 보기 →',
    replace: '준비 중입니다',
    test: 'src/tests/unit/prelaunch-soon-2026-09-24.test.ts',
    why:
      '2026-07-20 대표 지적 *"빈 화면이 막다른 골목"* 과 같은 자리다. 응모할 게 없는 날에도 ' +
      '살 수 있는 딜로 나가는 문은 있어야 한다.',
  },
  {
    name: '오픈 예정 목록에서 fcfs 배지 정보를 뺀다',
    file: 'src/features/group-buy/api/prelaunch.routes.ts',
    find: "      if (rec.fcfs_enabled !== '1') return { ...r, prelaunch: true }",
    replace: '      return { ...r, prelaunch: true }',
    test: 'src/tests/unit/prelaunch-soon-2026-09-24.test.ts',
    why:
      '카드 배지("오픈 예정 · 사전응모")는 `p.fcfs` 를 본다. 빼면 **오픈 예정 목록인데 카드가 ' +
      '평범한 딜처럼** 보인다 — 에러도 빈 화면도 아니라 아무도 신고하지 않는 종류.',
  },
  {
    name: '보내지도 않는 오픈 알림을 화면이 약속한다',
    file: 'src/pages/SoonPage.tsx',
    find: '아직 문을 열지 않은 매장이에요. 사전 응모를 받는 곳은 카드를 눌러 지금 응모할 수 있어요.',
    replace: '아직 열지 않은 매장이에요. 지금 응모해 두면 오픈할 때 알려드려요.',
    test: 'src/tests/unit/prelaunch-soon-2026-09-24.test.ts',
    why:
      '초판 문구가 실제로 이랬다. 오픈 시점 알림을 보내는 코드는 없다 — `prelaunch` 는 표시 플래그다. ' +
      '못 지킬 약속은 빈 화면보다 나쁘다.',
  },
  {
    name: '피드 필터에 prelaunch 를 얹어 별도 경로의 근거를 지운다',
    file: 'src/features/group-buy/api/group-buy-public.routes.ts',
    find: '    const ALLOWED_GB_SORT: Record<string, string> = {',
    replace: "    const _pl = c.req.query('prelaunch')\n    const ALLOWED_GB_SORT: Record<string, string> = {",
    test: 'src/tests/unit/prelaunch-soon-2026-09-24.test.ts',
    why:
      '잠긴 피드에 필터를 더하면 **캐시키가 갈려** SSR 0-RTT·엣지캐시 계약을 건드린다(대표 승인 사항). ' +
      '별도 경로의 존재 이유가 정확히 이것이라, 이 주입은 그 경계가 살아 있는지 확인한다.',
  },
]

/**
 * 🧬 2026-10-14 — 공개 셀러 페이로드의 내부 상거래 조건 차단.
 *
 * 근거·실측은 `src/tests/unit/seller-public-no-rate-2026-10-14.test.ts` 머리말.
 * **절반이 반대 방향**이다 — 이 수리는 "더 지우는" 쪽으로 틀리면 통신판매업자 표기 의무를
 * 깨뜨리거나 유어샵 화면이 비므로, 지우는 방향도 함께 잠근다.
 */
const SRC = 'src/worker/utils/seller-public-payload.ts'
const TEST = 'src/tests/unit/seller-public-no-rate-2026-10-14.test.ts'

export default [
  {
    name: '🔒 공개 셀러 페이로드에 수수료율을 되살린다',
    file: SRC,
    find: "  { expr: 's.created_at' },",
    replace: "  { expr: 's.commission_rate', out: 'commission_rate', probe: 'commission_rate' },\n  { expr: 's.created_at' },",
    test: TEST,
    why:
      '라이브 실측(인증 0, id 순회) — 홍대돈까스 5 · 청룡갈비 5 · 달빛한스푼 10 이 그대로 나갔다. ' +
      '그 응답은 `__SSR_INITIAL_SELLER__` 로 서빙 HTML 에 박혀 **크롤러까지** 받는다. 매장별 요율은 ' +
      '내부 상거래 조건이고, `/about` 이 "셀러별 개별 조정(협상 여지)" 라고 알려 주는 상황에서 ' +
      '남의 요율이 조회되면 그게 협상 근거가 된다.',
  },
  {
    name: '🔒 정산 주기를 공개 페이로드에 더한다',
    file: SRC,
    find: "  { expr: 's.created_at' },",
    replace: "  { expr: 's.settlement_cycle', out: 'settlement_cycle', probe: 'settlement_cycle' },\n  { expr: 's.created_at' },",
    test: TEST,
    why:
      '요율만 막으면 **같은 클래스의 다음 필드**가 조용히 들어온다. 금지 목록이 이름 하나가 아니라 ' +
      '묶음(요율·정산·커미션·마진)이어야 하는 이유다.',
  },
  {
    name: '🔒 반대 방향 — 사업자등록번호를 지운다 (통신판매업자 표기 의무)',
    file: SRC,
    find: "  { expr: 's.business_number', out: 'business_number', probe: 'business_number' },\n",
    replace: '',
    test: TEST,
    why:
      '**이 방향이 위험하다** — 사업자등록번호·대표자명·주소는 표기 의무 정보이고 유어샵 사업자정보 ' +
      '섹션이 실제로 쓴다. 요율을 지우는 작업이 이것까지 같이 지우면 법적 표기가 사라지는데 ' +
      '화면은 조용히 빈 칸이 된다.',
  },
  {
    name: '🔒 반대 방향 — 대표자명을 지운다',
    file: SRC,
    find: "  { expr: 's.representative_name AS ceo_name', out: 'ceo_name', probe: 'representative_name' },\n",
    replace: '',
    test: TEST,
    why: '위와 같은 축. 표기 의무 정보를 "내부 정보" 로 오분류하면 반대 사고가 난다.',
  },
  {
    name: '🔒 반대 방향 — 유어샵이 그리는 소개·사진을 지운다',
    file: SRC,
    find: "  { expr: 's.bio', out: 'bio', probe: 'bio' },\n",
    replace: '',
    test: TEST,
    why:
      '`bio` 는 크롤러 요약(`curatorNoscriptFromPayload`)과 화면이 둘 다 쓴다. 지우면 유어샵 ' +
      '크롤러 본문이 다시 thin 이 되는데 **에러가 안 난다**(2026-10-14 #1775 가 값을 치른 자리).',
  },
  {
    name: '🔒 제거 사유 주석을 걷어낸다 (다음 세션이 "빠졌네" 하고 되살린다)',
    file: SRC,
    find: '  // 🔒 2026-10-14 — `commission_rate` 를 **일부러 뺐다**. 되살리지 말 것.',
    replace: '  // (주석 제거)',
    test: TEST,
    why:
      '필드가 빠진 자리는 **빠진 것처럼 보인다**. 왜 뺐는지가 그 자리에 없으면 다음 세션이 ' +
      '"자가치유 SELECT 에서 누락됐다" 로 읽고 되살린다 — 이 레포가 반복해 당한 클래스다.',
  },
]

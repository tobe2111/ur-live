/**
 * 🧬 주입 — 매장 영입 2% 폐지 (2026-09-16 대표 확정).
 * 각 항목은 "되돌리면 사용자에게 다시 거짓 약속을 하게 된다" 는 형태다.
 */
const TEST = 'src/tests/unit/store-intro-abolished-2026-09-16.test.ts'

export default [
  {
    name: '🛑 유어샵 사다리가 다시 "매출의 2%" 를 약속한다',
    file: 'src/pages/curator-page/EarnLadder.tsx',
    find: '내 샵으로 팔릴 때마다 소개비가 붙어요.',
    replace: '내 샵으로 팔릴 때마다 소개비가 붙어요. 데려온 가게면 매출의 2%도 받습니다.',
    test: TEST,
    why: '적립은 0인데 화면만 약속하던 상태가 몇 주 갔다. 그 문구가 돌아오면 다시 약속 위반이다.',
  },
  {
    name: '🛑 인플루언서 약관에 영입 2% 조항이 되살아난다',
    file: 'src/pages/InfluencerTermsPage.tsx',
    find: '          <li>소개비는 결제 후 환불 가능 기간(7일)이 지나야 확정되며',
    replace: '          <li>매장 영입: 직접 데려온 매장 매출의 <strong>2%</strong>를 1년간 적립합니다.</li>\n          <li>소개비는 결제 후 환불 가능 기간(7일)이 지나야 확정되며',
    test: TEST,
    why: '약관은 법적 문서다 — 지급하지 않는 보상을 적어 두면 계약 위반이다. 실제로 이 줄이 라이브에 있었다.',
  },
  {
    name: '🛑 적립 함수가 다시 호출된다 (죽은 축 부활)',
    file: 'src/worker/utils/order-commissions.ts',
    find: "export type CommissionAxis = 'affiliate' | 'multi_tier' | 'supplier'",
    replace: "export type CommissionAxis = 'affiliate' | 'multi_tier' | 'supplier' | 'store_intro'",
    test: TEST,
    why: '축 타입에 이름이 돌아오면 오케스트레이터가 다시 부를 수 있다 — 타입이 마지막 방벽이다.',
  },
  {
    name: '🛑 어드민 폐지 표시가 사라진다 (다음 사람이 다시 만든다)',
    file: 'src/pages/AdminCommissionSettingsPage.tsx',
    find: '매장 영입 커미션 — 폐지됨',
    replace: '매장 영입 커미션',
    test: TEST,
    why: '"없다" 를 명시적으로 남기지 않으면 몇 달 뒤 누군가 "왜 이게 없지" 하고 되살린다.',
  },
  {
    name: '🛑 폐지된 요율 입력란이 다시 수정 가능해진다',
    file: 'src/pages/AdminCommissionSettingsPage.tsx',
    find: '<input type="number" value={form.influencer_store_intro_pct} disabled',
    replace: '<input type="number" value={form.influencer_store_intro_pct}',
    test: TEST,
    why: '켤 수 있으면 폐지가 아니다. 값을 보여 주되 만질 수는 없어야 한다.',
  },
  {
    name: '🛑 "누가 데려왔나" 기록까지 지워진다 (중개사 모델이 쓸 것)',
    file: 'src/worker/routes/repair-schema/column-repairs.ts',
    find: "ADD COLUMN introduced_by_influencer_id INTEGER",
    replace: "ADD COLUMN intro_by_inf_id INTEGER",
    test: TEST,
    why: '보상은 폐지했지만 사실(누가 데려왔나)은 남긴다 — 중개사 계약이 그 기록 위에 선다.',
  },
]

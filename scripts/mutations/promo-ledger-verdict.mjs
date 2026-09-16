/**
 * 🧬 주입 — 주문 1건 S1 판정 패널이 **틀린 것을 비교**하거나 **덜 세는** 경우 (2026-09-15)
 *
 * 이 판정은 대표가 실결제 1건으로 아비터(`commission_budget_enabled`)를 켜도 되는지
 * 가르는 자리다. 판정이 헛돌면 그 결과가 **초록불로 보이면서** 예산 초과 주문을 통과시킨다 —
 * 이 레포가 반복해 당한 "검사가 실패할 수 없음" 이 하필 머니 게이트 앞에서 나는 경우다.
 */
const TEST = 'src/tests/unit/promo-ledger-order-verdict.test.ts'
const FILE = 'src/features/admin/api/admin-promo-ledger.routes.ts'

export default [
  {
    name: '🔍S1 판정이 예산 대신 결제액과 비교한다 (어떤 주문이든 통과)',
    file: FILE,
    find: `          within_budget: grantedTotal <= budgetKrw,`,
    replace: `          within_budget: grantedTotal <= amountKrw,`,
    test: TEST,
    why:
      '결제액은 예산(수수료 − PG 준비금)보다 10~20배 크다. 이 한 글자로 판정이 **언제나 참**이 ' +
      '되고, 화면은 초록불을 띄운 채 게이트를 켜도 된다고 말한다.',
  },
  {
    name: '🔍S1 판정이 에이전시 축을 안 센다 (합이 후하게 나온다)',
    file: FILE,
    find: `    await collect('agency_store_intro',`,
    replace: `    await Promise.resolve('agency_store_intro',`,
    test: TEST,
    why:
      '축 하나가 빠지면 Σ적립이 작아져 판정이 통과 쪽으로 기운다. 이 축은 지금 라이브 0행이라 ' +
      '**빼도 숫자가 안 변해서** 더 위험하다 — "안 센 것"과 "0 인 것"이 화면에서 같아 보인다.',
  },
  {
    name: '🔍S1 예산을 원장 fee 대신 요율로 다시 계산한다',
    file: FILE,
    find: '      `SELECT COALESCE(SUM(fee_amount), 0) AS fee FROM ledger_entries',
    replace: '      `SELECT COALESCE(SUM(amount), 0) AS fee FROM ledger_entries',
    test: TEST,
    why:
      '실제로 찍힌 수수료가 아니라 다른 값을 예산의 근거로 삼으면 판정이 실제 청구와 갈린다. ' +
      '갈리는 것이 이 레포의 단골 사고다(채널 요율 표시가 실제 청구와 달랐던 건과 같은 클래스).',
  },
  {
    name: '🔍폐기된 07-08 원칙이 판정으로 되살아난다',
    file: FILE,
    find: `          over_by_krw: Math.max(0, grantedTotal - budgetKrw),`,
    replace:
      `          over_by_krw: Math.max(0, grantedTotal - budgetKrw),\n` +
      `          platform_revenue_untouched: debitTotal === 0,`,
    test: TEST,
    why:
      '2026-09-07 결재 Q4-2 로 "유어딜 5% 는 어떤 커미션에도 안 쓴다"가 폐기됐다. 이 줄을 ' +
      '판정에 되돌리면 **정상인 주문이 빨간불**로 보고되고, 대표가 안 켜도 될 이유로 읽는다.',
  },
  {
    name: '🤝S8 조회 실패가 "통과" 로 샌다 (판정이 조용히 true)',
    file: FILE,
    find: `    const s8 = attrs === null`,
    replace: `    const s8 = false`,
    test: TEST,
    why:
      '`attrs === null` 을 없애면 실패 경로가 정상 경로로 떨어지고, 빈 배열의 `every()` 는 **true** 다. ' +
      '스키마가 안 맞아 조회가 죽은 주문이 "딜대로 적립됨" 으로 보고된다 — 머니 게이트 앞의 헛도는 검사.',
  },
  {
    name: '🤝S8 기대액에 옛 자동분(영입 1%)이 되살아난다',
    file: FILE,
    find: `      const expected = pct === null ? 0 : Math.floor((amountKrw * pct) / 100)`,
    replace: `      const expected = Math.floor((amountKrw * ((pct ?? 0) + 1)) / 100)`,
    test: TEST,
    why:
      '2026-08-30 대표 "자동분은 빼줘" 로 없앤 영입 1% 다. 그 몫은 **매장 지갑**에서 나갔다 — ' +
      '매장이 동의한 적 없는 차감이라 되살아나면 즉시 알아야 한다.',
  },
  {
    name: '🤝S8 딜 %를 SSOT 대신 직접 쿼리한다 (화면↔정산 드리프트)',
    file: FILE,
    find: `      const pct = await findActiveDealPct(DB, p2.sellerId, p2.influencerId).catch(() => null)`,
    replace:
      `      const pct = await DB.prepare('SELECT commission_pct FROM seller_influencer_deals WHERE seller_id = ? AND influencer_id = ?')\n` +
      `        .bind(p2.sellerId, p2.influencerId).first().then((r) => Number(r?.commission_pct) || null).catch(() => null)`,
    test: TEST,
    why:
      'WHERE 절을 베끼면 `status=active`·기간·콘텐츠 인증 조건이 빠진다. `influencer-deal.ts` 머리주석이 ' +
      '경고한 바로 그 드리프트 — 화면은 "N% 받는다" 인데 정산은 0 이 되는 약속 위반이다.',
  },
  {
    name: '🧾S2·S3 이중적립을 "1회 이상" 으로 느슨하게 본다',
    file: FILE,
    find: `        exactly_once: credits === 1,`,
    replace: `        exactly_once: credits >= 1,`,
    test: TEST,
    why:
      '두 번 찍힌 것이 이중적립이다. `>= 1` 로 두면 그 사고가 **통과**로 보고된다 — ' +
      'S2·S3 의 통과선이 정확히 "한 번만" 인 이유다.',
  },
  {
    name: '🧾S5 몰수를 주문 키로 찾는다 (교환권 키가 아니라)',
    file: FILE,
    find: `              AND reference_id IN (SELECT 'voucher:' || id FROM vouchers WHERE order_id IN (${'${idPh}'}))) AS forfeits,`,
    replace: `              AND reference_id IN (${'${refPh}'})) AS forfeits,`,
    test: TEST,
    why:
      '`unclaimed_forfeit` 의 reference_id 는 `voucher:{id}` 다. 주문 키로 찾으면 **항상 0건**이 나오고, ' +
      '그 0 을 "몰수 없음" 으로 읽으면 미수령 검증이 통째로 헛돈다.',
  },
  {
    name: '🧾S6 환불액이 결제액을 넘어도 통과한다',
    file: FILE,
    find: `          within_paid: (Number(s6Row.set_krw) || 0) <= amountKrw,`,
    replace: `          within_paid: true,`,
    test: TEST,
    why:
      '부분환불 금액은 **사람이 친다**. 초과 입력이 가장 흔한 실수이고 서버 클램프가 그걸 막는데, ' +
      '판정이 늘 참이면 클램프가 죽어도 아무도 모른다.',
  },
  {
    name: '🧾게이트 상태를 안 내려 0건의 이유를 못 가린다',
    file: FILE,
    find: `      gate_on: settingsForGates.promo_funding_source === 'owner',`,
    replace: `      // gate_on 생략`,
    test: TEST,
    why:
      '게이트가 꺼져 있으면 0건이 **정상**이다. 그 상태를 같이 안 내리면 "결함이라 0" 인지 ' +
      '"안 켜서 0" 인지 화면에서 구분할 수 없고, 대표가 통과로 읽는다.',
  },
]

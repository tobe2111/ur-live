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
]

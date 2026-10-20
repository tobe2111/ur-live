/**
 * 🧬 주입 — **판정 패널이 "0원" 을 내놓고도 초록불이던 자리** (2026-10-01)
 *
 * S1 의 합격선은 `Σ성장커미션 ≤ 주문당 예산` 이고, 예산의 재료가 **이 주문의 원장 수수료**다.
 * 그 수수료 쿼리가 틀려서 라이브 유일 주문에서 **0원**이 나왔는데, 그걸 보던 시험은
 * `SUM(fee_amount)` 가 **있는지**만 봐서 통과했다. 여기 담은 결함은 전부 그 클래스다 —
 * 에러 없이, 빌드 초록으로, **판정만 조용히 거짓말한다.**
 */
const SSOT = 'src/worker/utils/order-platform-fee.ts'
const ROUTE = 'src/features/admin/api/admin-promo-ledger.routes.ts'

const REAL = 'src/tests/unit/promo-ledger-fee-real-rows-2026-10-01.test.ts'
const VERDICT = 'src/tests/unit/promo-ledger-order-verdict.test.ts'

export default [
  {
    name: '수수료 — credit_account 로 거른다(라이브 전부 0원)',
    file: SSOT,
    find: '            WHERE fee_account = ? AND reference_id IN (${ph})`,',
    replace: "            WHERE credit_account = 'platform:revenue' AND reference_id IN (${ph})`,",
    test: REAL,
    why:
      '종전 쿼리 그대로다. 매장이 있는 주문의 크레딧은 `seller:N` 이므로 그런 행이 아예 없다 — ' +
      '수수료가 0 이 되고, 예산도 0 이 되고, S1 의 판정이 양쪽으로 틀린다(0≤0 은 늘 참 · ' +
      '적립이 1원만 있어도 늘 거짓). 라이브에서 실제로 이 상태였다.',
  },
  {
    name: '수수료 — 참조 키를 order:N 하나만 묻는다(이용권 레일 전멸)',
    file: SSOT,
    find: "  if (num && !refs.includes(num)) refs.push(num)",
    replace: '  void num',
    test: REAL,
    why:
      '공구·이용권 원장은 참조 키가 **주문번호**다(`group-buy.routes` · `cart-checkout.routes`). ' +
      '`order:N` 만 물으면 지금 라이브 트래픽 전부가 조용히 0원으로 읽힌다 — 쇼핑 주문만 맞아서 ' +
      '한쪽 레일을 보고 "맞다" 고 오판하기 쉽다.',
  },
  {
    name: '수수료 — 엉뚱한 fee_account 를 센다',
    file: SSOT,
    find: "export const PLATFORM_FEE_ACCOUNT = 'platform:commission'",
    replace: "export const PLATFORM_FEE_ACCOUNT = 'platform:pg_fee'",
    test: REAL,
    why:
      '`platform:pg_fee` 는 타입 주석에만 있고 쓰는 곳이 0 이다(2026-10-01 실측). 상수 한 줄만 ' +
      '바꿔도 전 주문이 0원이 되는데 **빌드도 타입도 멀쩡하다** — 상수가 실제로 원장에 존재하는 ' +
      '계정인지는 실제 행으로만 확인된다.',
  },
  {
    name: '수수료 — 쓰레기 id·빈 주문번호를 바인딩에 섞는다',
    file: SSOT,
    find: '    .filter((id) => Number.isFinite(id) && id > 0)',
    replace: '    .filter(() => true)',
    test: REAL,
    why:
      '`order:NaN`·`order:0` 이 섞이면 바인딩만 늘고 매칭은 0 이다. 나쁜 쪽은 성능이 아니라 ' +
      '**다른 주문의 행을 집을 가능성**이고(id 0·음수 규약이 바뀌는 날), 조용히 틀린다.',
  },
  {
    name: '판정 패널 — 수수료 쿼리를 손으로 다시 쓴다',
    file: ROUTE,
    find: '    const feeQ = platformFeeQuery(orderIds, orderNumber)',
    replace:
      "    const feeQ = { sql: `SELECT COALESCE(SUM(fee_amount), 0) AS fee FROM ledger_entries"
      + " WHERE credit_account = 'platform:revenue' AND reference_id IN (${refPh})`, binds: refs }",
    test: VERDICT,
    why:
      'SQL 을 호출부에 베껴 쓰면 SSOT 와 두 벌이 갈린다 — 그러면 실제 행으로 돌려 보는 시험은 ' +
      '**SSOT 만** 통과시키고 라우트는 계속 틀린 채 초록불이 된다(이 레포의 단골 드리프트).',
  },
]

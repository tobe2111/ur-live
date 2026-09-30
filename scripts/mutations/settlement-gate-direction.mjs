/**
 * 🚦 정산 게이트 `settlement_skip_ledgered` 방향 (2026-09-29, 대표 "2번 내가 어떻게 하는데?") — 주입 매니페스트.
 * 가드: src/tests/unit/settlement-gate-direction-2026-09-29.test.ts
 *
 * 지키는 것: 게이트를 켰을 때 **원장에 있는 것만** 건너뛴다(NOT EXISTS) · 원장 기록은 게이트가 없다 ·
 * 그 원장이 지급까지 간다 · 어드민에 보이는 두 문구가 그 사실과 어긋나지 않는다.
 */
const TEST = 'src/tests/unit/settlement-gate-direction-2026-09-29.test.ts'

const SKIP_CLAUSE =
  "AND NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.reference_id = 'voucher:' || v.id AND le.event_type = 'voucher_used')"
const SKIP_INVERTED =
  "AND EXISTS (SELECT 1 FROM ledger_entries le WHERE le.reference_id = 'voucher:' || v.id AND le.event_type = 'voucher_used')"

export default [
  {
    name: '🚦 자동정산 cron 의 skip 절이 EXISTS 로 뒤집혀 원장에 없는 이용권을 건너뛴다',
    file: 'src/worker/cron/auto-settlement.ts',
    find: SKIP_CLAUSE,
    replace: SKIP_INVERTED,
    test: TEST,
    why: '이 한 글자가 뒤집히면 낡은 경고문이 말했던 "정산이 통째로 빠진다"가 비로소 진짜가 된다 — 매장이 돈을 못 받고 에러는 안 난다.',
  },
  {
    name: '🚦 어드민 수동 정산의 skip 절이 EXISTS 로 뒤집힌다',
    file: 'src/features/settlement/api/restaurant-settlement.routes.ts',
    find: SKIP_CLAUSE,
    replace: SKIP_INVERTED,
    test: TEST,
    why: '게이트는 cron 과 수동 정산 두 곳에 같은 절로 붙는다 — 한쪽만 뒤집히면 두 화면의 정산 대상이 갈린다.',
  },
  {
    name: '🚦 이용권 사용 시점의 원장 기록이 설정값 게이트 뒤로 들어간다',
    file: 'src/features/group-buy/api/group-buy-voucher.routes.ts',
    find: '              const merchantId = meta.consigned_from_seller_id ?? meta.seller_id ?? 0',
    replace:
      "              const _g = await DB.prepare(\"SELECT value FROM platform_settings WHERE key = 'ledger_enabled'\").first()\n              if (_g?.value !== 'true') return\n              const merchantId = meta.consigned_from_seller_id ?? meta.seller_id ?? 0",
    test: TEST,
    why: '원장이 조건부가 되면 "지금 켜도 빠지는 정산은 없다"가 거짓이 된다 — 게이트 ON 상태에서 원장이 꺼지면 양쪽 레일이 동시에 침묵한다.',
  },
  {
    name: '🚦 payouts-generate 가 merchant 계정 집계를 잃어 원장이 지급까지 못 간다',
    file: 'src/worker/cron/payouts-generate.ts',
    find: "WHERE (credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%'",
    replace: "WHERE (credit_account LIKE 'seller:%'",
    test: TEST,
    why: '매장 몫은 merchant:N 로 적힌다 — 이 패턴이 빠지면 원장에 쌓이기만 하고 payout 행이 안 생긴다(정산 화면엔 0원).',
  },
  {
    name: '🚦 스위치 hint 가 낡은 주장("원장이 돌기 시작한 뒤에 켠다")으로 되돌아간다',
    file: 'src/pages/admin-platform-settings/money-switch-fields.ts',
    find:
      "    hint: '🔴 머니 경로. 정산 준비를 하는 길이 둘(자동정산 · 원장)인데, 켜면 원장에 이미 잡힌 이용권을 자동정산이 건너뛴다 → 한 길로 모인다. 안 켜면 같은 매출이 양쪽에 적혀 이중 지급 위험. 원장 기록은 이용권 사용 시점에 게이트 없이 항상 돌므로 지금 켜도 빠지는 정산은 없다',",
    replace:
      "    hint: '🔴 머니 경로. 원장(ledger) 경로와 자동정산이 같은 매출을 두 번 정산하는 것을 막는 스위치. 원장 적립이 실제로 돌기 시작한 뒤에 켠다. 건너뛴다',",
    test: TEST,
    why: '대표가 실제로 읽는 자리다 — 이 문구 하나 때문에 켤 수 있는 스위치를 두 세션이 미뤘다.',
  },
  {
    name: '🚦 레지스트리 turn_on_when 이 정정 없이 낡은 주장만 남는다',
    file: 'src/features/admin/api/admin-system-monitoring.routes.ts',
    find: '⚠️ 2026-09-29 정정: 여기 오래 "그전엔 켜면 정산이 통째로 빠진다"고 적혀 있었는데 사실이 아니다 — skip 절이 NOT EXISTS 라서 원장에 없으면 건너뛸 것도 없고(자동정산 그대로 진행), 원장 기록(recordVoucherUsedLedger)은 이용권 사용 시점에 게이트 없이 항상 돈다. 그 오기를 믿고 두 레일을 켜 둔 채로 두면 오히려 이중 지급 위험',
    replace: '그전엔 켜면 정산이 통째로 빠진다',
    test: TEST,
    why: '정정 기록을 지우면 다음 세션이 같은 오판을 반복한다 — 이미 두 번 그랬다.',
  },
]

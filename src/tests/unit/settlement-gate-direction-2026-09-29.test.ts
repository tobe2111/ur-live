/**
 * 🚦 정산 게이트 `settlement_skip_ledgered` — **방향**을 코드로 고정 (2026-09-29)
 *
 * ## 무엇을 고쳤나
 *
 * 대표가 *"2번 내가 어떻게 하는데?"* 라고 물어 어드민 화면을 열어 보니, 그 스위치에 붙은 두 문구가
 * **반대로** 말하고 있었다:
 *
 *   - 스위치 hint: *"원장 적립이 실제로 돌기 시작한 뒤에 켠다"*
 *   - 게이트 레지스트리 `turn_on_when`: *"그전엔 켜면 정산이 통째로 빠진다"*
 *
 * **둘 다 사실이 아니다.** 2026-09-29 에 코드로 확인한 것:
 *
 *   1. skip 절이 **`NOT EXISTS`** 다 — 원장에 그 이용권 행이 **있을 때만** 자동정산에서 건너뛴다.
 *      원장이 비어 있으면 건너뛸 것이 없어 자동정산은 종전과 똑같이 돈다 ⇒ "통째로 빠진다"는
 *      구조적으로 일어날 수 없다.
 *   2. 원장 기록(`recordVoucherUsedLedger`)은 이용권 사용 시점에 **게이트 없이** 돈다
 *      (`group-buy-voucher.routes.ts` 의 `waitUntil` — 조건은 `merchantId && amount > 0` 뿐).
 *   3. 그 원장은 실제로 지급까지 간다 — `payouts-generate` 가 `credit_account LIKE 'merchant:%'`
 *      를 집계해 payout 행을 만든다.
 *
 * ⇒ 즉 **켜는 것이 보호**이고, 켜지 않은 채 두 레일을 살려 두는 것이 **이중 지급 위험**이다.
 * 같은 파일(`cron/auto-settlement.ts`)의 머리말 주석은 이미 그렇게 적혀 있었다 — 어드민에 보이는
 * 두 문구만 2026-07-08 작성 당시 상태로 낡아 있었고, **대표가 읽는 자리가 그 두 곳**이다.
 *
 * ## 이 시험이 지키는 것
 *
 * 문구를 고치는 것만으로는 다음 세션이 같은 오기를 되살린다. 그래서 문구가 아니라 **그 문구가
 * 참이 되게 하는 세 가지 사실**을 고정한다 — 하나라도 깨지면 문구가 다시 거짓이 되므로 여기서
 * 빨강이 뜬다.
 *
 * ## 이 시험이 **못 막는 것**
 *
 * - 소스 텍스트만 본다. 라이브에서 원장이 실제로 채워지는지는 D1 조회로만 안다
 *   (2026-09-29 실측: `ledger_entries` 3행 · 사용된 이용권 0장 · `restaurant_settlements` 0행).
 * - 게이트를 실제로 켠 뒤의 정산 결과는 staging 실결제만 판정한다(`STAGING_CHECKLIST.md`).
 * - 문구의 *어투*는 안 본다. 거짓 주장 두 개의 재유입만 막는다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, stripComments } from '../helpers/source-text'

const CRON = readCode('src/worker/cron/auto-settlement.ts')
const MANUAL = readCode('src/features/settlement/api/restaurant-settlement.routes.ts')
const VOUCHER_USE = readCode('src/features/group-buy/api/group-buy-voucher.routes.ts')
const PAYOUTS = readCode('src/worker/cron/payouts-generate.ts')
const SWITCH = readCode('src/pages/admin-platform-settings/money-switch-fields.ts')
const REGISTRY = readCode('src/features/admin/api/admin-system-monitoring.routes.ts')

/** 게이트가 붙은 두 레일(자동 cron · 어드민 수동) — 같은 키를 읽고 같은 절을 쓴다. */
const RAIL_A_SITES: Array<[string, string]> = [
  ['cron/auto-settlement', CRON],
  ['restaurant-settlement.routes(수동)', MANUAL],
]

describe('게이트 방향 — 원장에 있는 것만 건너뛴다(NOT EXISTS)', () => {
  it('소스 다섯 개가 실재한다 (경로가 낡으면 통과가 아니라 실패)', () => {
    for (const [, code] of RAIL_A_SITES) expect(code.length).toBeGreaterThan(500)
    expect(VOUCHER_USE.length).toBeGreaterThan(500)
    expect(PAYOUTS.length).toBeGreaterThan(500)
    expect(SWITCH.length).toBeGreaterThan(500)
  })

  for (const [name, code] of RAIL_A_SITES) {
    it(`${name} — skip 절이 NOT EXISTS 다 (EXISTS 로 뒤집으면 정산이 실제로 빠진다)`, () => {
      const exec = stripComments(code)
      // 게이트가 켜졌을 때 붙는 술어. 이 문장이 `EXISTS` 로 바뀌면 **원장에 없는** 이용권을
      // 건너뛰게 되어, 낡은 경고문이 말했던 "정산이 통째로 빠진다"가 비로소 진짜가 된다.
      const m = exec.match(/AND NOT EXISTS \(SELECT 1 FROM ledger_entries le WHERE le\.reference_id = 'voucher:' \|\| v\.id AND le\.event_type = 'voucher_used'\)/)
      expect(m, '게이트 ON 술어를 찾지 못했다 — 절이 바뀌었으면 문구도 함께 재검토할 것').not.toBeNull()
      // 같은 자리에 EXISTS(부정 없는) 판정이 새로 생기지 않았는지.
      expect(exec).not.toMatch(/AND EXISTS \(SELECT 1 FROM ledger_entries le WHERE le\.reference_id = 'voucher:'/)
    })

    it(`${name} — 게이트 기본값은 OFF 다 (키 부재·조회 실패 시 현행 유지)`, () => {
      const exec = stripComments(code)
      expect(exec).toMatch(/skipLedgered\s*=\s*false/)
      expect(exec).toMatch(/=== 'true'/)
    })
  }
})

describe('켜도 안전한 이유 — 원장 기록은 게이트가 없다', () => {
  it('이용권 사용 시점의 원장 기록 블록에 platform_settings 게이트가 없다', () => {
    const exec = stripComments(VOUCHER_USE)
    expect(exec).toContain('recordVoucherUsedLedger(DB, {')

    // 🩸 첫 판은 호출 **앞 400자**만 봤다. 주입 러너가 그게 헛돈다고 잡았다 — 심은 게이트가
    //   창 밖(약 450자)으로 밀려나 초록이 떴다. 창 크기는 임의 숫자이고, 조금만 멀어지면 새다.
    //   ⇒ 구조로 앵커한다: 원장 기록은 `waitUntil((async () => { … })())` 블록 안에서 도는데,
    //     **그 블록 전체**에 설정 조회가 없어야 "게이트 없이 항상 돈다"가 참이다.
    const blocks = exec.split('waitUntil(').filter((b) => b.includes('recordVoucherUsedLedger(DB, {'))
    expect(blocks.length, '원장 기록이 waitUntil 블록 밖으로 나갔다 — 구조가 바뀌었으면 문구도 재검토').toBeGreaterThan(0)
    for (const b of blocks) {
      expect(b, '원장 기록이 설정값에 묶였다 — 게이트를 켜기 전에 문구를 다시 쓸 것').not.toMatch(/platform_settings/)
    }
  })

  it('그 원장이 실제 지급까지 간다 (payouts-generate 가 merchant 계정을 집계한다)', () => {
    // 🎯 2026-10-01 재조준: 집계 문장이 `payout-account.ts` 로 옮겨졌다(결재 voucher-credit-double-rail).
    //   불변식은 그대로 — **원장을 읽고, 매장 몫(`merchant:N`)을 집계에 포함한다.** 둘 다 본다:
    //   문장이 그 모듈에 있고, cron 이 그 문장을 실제로 쓴다.
    const sql = stripComments(readCode('src/worker/utils/payout-account.ts'))
    expect(sql).toContain('FROM ledger_entries')
    expect(sql).toMatch(/credit_account LIKE 'merchant:%'/)
    expect(stripComments(PAYOUTS), 'cron 이 그 문장을 쓰지 않으면 모듈에 있어도 지급이 안 된다')
      .toMatch(/payoutCreditsSql\(/)
  })
})

describe('어드민에 보이는 두 문구 — 거짓 주장 재유입 차단', () => {
  /** 낡은 주장 그대로, 그리고 같은 뜻의 흔한 변형. */
  const STALE = [
    '정산이 통째로 빠진다',
    '원장 적립이 실제로 돌기 시작한 뒤에 켠다',
    '실제로 돌기 시작한 뒤에 켠다',
  ]

  it('스위치 hint 가 낡은 주장을 하지 않고, 기제를 설명한다', () => {
    const line = SWITCH.split('\n').find((l) => l.includes('hint:') && l.includes('건너뛴다'))
    expect(line, '⑨ 스위치 hint 를 찾지 못했다').toBeTruthy()
    for (const s of STALE) expect(line!).not.toContain(s)
    // 기제 두 가지가 문구에 실제로 적혀 있는지(없으면 대표가 왜 켜는지 모른다).
    expect(line!).toMatch(/원장에 이미 잡힌/)
    expect(line!).toMatch(/이중 지급/)
  })

  it('게이트 레지스트리 turn_on_when 이 낡은 주장을 사실로 말하지 않는다', () => {
    const line = REGISTRY.split('\n').find((l) => l.includes("key: 'settlement_skip_ledgered'"))
    expect(line, '게이트 레지스트리 항목을 찾지 못했다').toBeTruthy()
    // ⚠️ 낡은 문장은 **정정 기록으로만** 남아 있어야 한다 — 인용 부호 안에서 "사실이 아니다"와
    //   함께 있는 경우만 허용한다. 그 짝이 없으면 주장으로 되살아난 것이다.
    if (line!.includes('정산이 통째로 빠진다')) {
      expect(line!, '낡은 문장이 정정 없이 되살아났다').toContain('사실이 아니다')
    }
    expect(line!).not.toContain('실제로 돌기 시작한 뒤에 켠다')
    expect(line!).toMatch(/NOT EXISTS/)
  })
})

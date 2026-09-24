/**
 * 🕙 유보를 **사장님 화면도 알게 한다** (2026-09-24 — #1521 유보 10일의 짝)
 *
 * #1521 이 정산 유보를 넣으면서 약관(제4조)과 셀러 가이드는 고쳤는데 **대시보드만 안 고쳤다.**
 * `/seller/settlements` 는 그대로 이렇게 말하고 있었다:
 *
 * > "정산은 매주 자동으로 처리됩니다"
 * > **미지급 (정산 예정 잔액)** — 힌트: **"다음 집계 대상"**
 *
 * 유보가 생긴 뒤 그건 방금 적립된 돈에 대해 **거짓**이다. 다음 집계가 아니라 2주 뒤 집계 대상이다.
 * 숫자가 틀린 게 아니라 **화면이 못 지킬 약속을 하는 것**이고, 그래서 에러도 실패도 안 난다 —
 * 첫 실매장이 뭔가 팔면 사장님이 "돈은 떠 있는데 왜 안 들어오지"로 겪는다.
 * (#1521 의 시험이 스스로 "이 시험이 못 보는 것: 화면이 그 값을 **사람에게** 어떻게 보여 주는지"
 *  라고 적어 둔, 바로 그 자리다.)
 *
 * ## 이 시험이 지키는 것
 * 1. `heldSql` 은 `sql` 의 **정확한 여집합** — 어떤 원장 행도 양쪽에 다 들어가거나, 어디에도 안 들어가지 않는다.
 * 2. `created_at` 이 NULL 인 행은 **held 쪽**에 잡힌다(cron 이 집계에서 빼는 것과 같은 소리를 한다).
 * 3. 유보 0 이면 held 는 항상 0 → 화면 문구가 종전과 byte-동일하게 돌아간다(되돌리기 가능).
 * 4. 셀러 엔드포인트가 **부등호를 손으로 뒤집지 않는다** — `payout-hold.ts` 의 조각을 그대로 쓴다.
 * 5. 화면이 **유보일을 지어내지 않는다** — 서버가 준 `hold_days` 만 쓰고, 안 주면 종전 문구.
 *
 * ## ⚠️ 이 시험이 **못** 보는 것
 * - 실제 D1 의 `datetime('now')`(여기선 node:sqlite 로 같은 규약을 재현할 뿐이다).
 * - 사장님이 그 문장을 읽고 실제로 납득하는지 — 그건 라이브 판정(E4/E5)이다.
 * - 6개 언어 번역: 이 화면의 `seller.autoPayout.*` 는 locale 파일에 키가 **하나도 없고**
 *   전부 `defaultValue` 로 산다(실측). 그래서 문구 추가가 locale 갱신을 요구하지 않는다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { buildPayoutHoldSql } from '@/worker/utils/payout-hold'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

const ACCOUNT = 'seller:14'

function seed(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ledger_entries (
    id INTEGER PRIMARY KEY, amount INTEGER, credit_account TEXT,
    fee_amount INTEGER, created_at DATETIME
  )`)
  const add = (amount: number, fee: number, createdAt: string | null) =>
    db.prepare('INSERT INTO ledger_entries (amount, credit_account, fee_amount, created_at) VALUES (?,?,?,?)')
      .run(amount, ACCOUNT, fee, createdAt)
  add(10_000, 500, "datetime('now','-30 days')" as never) // 자리만 — 아래에서 실제 값으로 다시 넣는다
  db.exec('DELETE FROM ledger_entries')
  // 실제 시각 값으로 심는다(바인딩에 SQL 함수를 못 넣으므로 SQL 안에서 계산).
  db.exec(`INSERT INTO ledger_entries (amount, credit_account, fee_amount, created_at) VALUES
    (10000, '${ACCOUNT}', 500, datetime('now','-30 days')),
    (20000, '${ACCOUNT}', 1000, datetime('now','-15 days')),
    (30000, '${ACCOUNT}', 1500, datetime('now','-3 days')),
    (40000, '${ACCOUNT}', 2000, datetime('now','-1 hours')),
    (50000, '${ACCOUNT}', 2500, NULL)`)
  return db
}

/** payouts.ts 가 만드는 것과 같은 모양의 합계 쿼리. */
function sumWith(db: Db, frag: string): number {
  const row = db.prepare(
    `SELECT COALESCE(SUM(amount - COALESCE(fee_amount, 0)), 0) AS s
       FROM ledger_entries WHERE credit_account = ? ${frag}`,
  ).get(ACCOUNT) as { s: number }
  return Number(row.s)
}

describe('유보 여집합 — 실제 SQLite', () => {
  it('익은 것 + 유보 중 = 전체. 겹치지도, 새지도 않는다', () => {
    const db = seed()
    const h = buildPayoutHoldSql(14)
    const total = sumWith(db, '')
    const ready = sumWith(db, h.sql)
    const held = sumWith(db, h.heldSql)
    expect(total).toBe(9500 + 19000 + 28500 + 38000 + 47500)
    expect(ready + held).toBe(total)
    // 30일·15일 전 것만 익었다(14일 유보).
    expect(ready).toBe(9500 + 19000)
    db.close()
  })

  it('created_at 이 NULL 인 행은 held 쪽에 잡힌다 — cron 이 빼는 것과 같은 소리', () => {
    const db = seed()
    const h = buildPayoutHoldSql(14)
    // NULL 행(47,500)은 `<=` 로도 `>` 로도 안 잡힌다. 그래서 heldSql 이 IS NULL 을 명시적으로 줍는다.
    expect(sumWith(db, h.heldSql)).toBe(28500 + 38000 + 47500)
    expect(sumWith(db, "AND created_at > datetime('now','-14 days')")).toBe(28500 + 38000) // NULL 빠짐 = 순진한 반전의 결함
    db.close()
  })

  it('유보 0 이면 held 는 0 — 화면이 종전 문구로 돌아간다', () => {
    const db = seed()
    const h = buildPayoutHoldSql(0)
    expect(h.enabled).toBe(false)
    expect(sumWith(db, h.heldSql)).toBe(0)
    expect(sumWith(db, h.sql)).toBe(sumWith(db, '')) // 전부 익은 것으로 본다
    db.close()
  })
})

describe('배선 — 셀러 정산 API', () => {
  const src = stripComments(readFileSync('src/features/seller/api/seller-settlements/payouts.ts', 'utf-8'))

  it('SSOT 의 여집합 조각을 쓴다', () => {
    expect(src).toContain('resolvePayoutHold')
    expect(src).toContain('${hold.heldSql}')
  })

  it('🔴 부등호를 손으로 쓰지 않는다 — 유보일을 바꾼 날 한쪽만 따라가는 길을 안 만든다', () => {
    // 🩸 처음엔 `/created_at\s*[<>]/` 로 썼는데 같은 파일의 **운영자 스코프**(`created_at >= ?`,
    //   2026-09-07 합류 이후만 보여 주는 조건)까지 먹어 빨간불이 났다. 무관한 선재 코드다.
    //   막아야 하는 건 부등호 자체가 아니라 **cutoff 를 손으로 짓는 것**이다.
    expect(src).not.toContain("datetime('now'")
    expect(src).not.toMatch(/-\s*\$\{[^}]*days/)
  })

  it('응답에 held 와 hold_days 를 싣는다', () => {
    expect(src).toMatch(/\bheld,/)
    expect(src).toMatch(/hold_days:\s*hold\.days/)
  })

  it('held 는 payable 을 넘지 않는다 — "그중 N" 이 말이 되게', () => {
    expect(src).toMatch(/Math\.min\(payable,/)
  })
})

describe('배선 — 사장님 화면', () => {
  const raw = readFileSync('src/pages/seller-settlements/AutoPayoutSection.tsx', 'utf-8')
  const src = stripComments(raw)

  it('유보일을 서버에서 받는다', () => {
    expect(src).toMatch(/data\?\.hold_days/)
    expect(src).toMatch(/data\?\.held/)
  })

  it('🔴 화면이 유보일을 지어내지 않는다 — 숫자 리터럴 금지', () => {
    // `holdDays` 에 상수를 대입하거나 문구에 '14일'/'10일' 을 박으면 설정을 바꾼 날 안내가 거짓말이 된다.
    expect(src).not.toMatch(/holdDays\s*=\s*\d/)
    expect(src).not.toMatch(/\d+일이 지난/)
    expect(src).toContain('{{days}}')
  })

  it('서버가 유보를 안 알려주면 종전 문구 그대로 — 무회귀', () => {
    expect(src).toMatch(/hold_days\s*\?\?\s*0/)
    expect(src).toContain('holdDays > 0 &&')
    expect(src).toContain("defaultValue: '다음 집계 대상' }")
  })

  it('유보 중인 몫이 있으면 힌트가 바뀐다', () => {
    expect(src).toContain('payableHintHold')
    expect(src).toMatch(/held > 0/)
  })
})

describe('롤백 손잡이 — 어드민이 유보를 실제로 조정할 수 있는가', () => {
  const page = readFileSync('src/pages/AdminPlatformSettingsPage.tsx', 'utf-8')
  const validators = readFileSync('src/worker/utils/platform-settings-validation.ts', 'utf-8')
  const holdSrc = readFileSync('src/worker/utils/payout-hold.ts', 'utf-8')

  it('설정 화면이 코드가 실제로 읽는 키를 쓴다', () => {
    // #1521 본문: "머니 경로의 롤백 시간이 곧 손실 크기다" — 그 롤백 수단이 payout_hold_days 인데
    // 화면에 없어서 대표가 닿을 수 없었다(2026-09-24 실측).
    const read = holdSrc.match(/key = '([a-z_]*hold_days)'/)
    expect(read?.[1]).toBe('payout_hold_days')
    expect(page).toContain(`key: '${read![1]}'`)
  })

  it('🔴 아무도 안 읽는 죽은 손잡이를 화면에 두지 않는다', () => {
    // 라벨이 '정산 대기 기간'이라 유보를 줄이려고 그 값을 고치면 아무 일도 안 일어난다.
    // 돈은 그대로 묶여 있는데 화면은 고쳤다고 말한다 — 머니 경로에서 가장 나쁜 종류의 침묵.
    expect(page).not.toMatch(/key: 'settlement_hold_days'/)
  })

  it('저장 시점에 범위를 검증한다 — 오타가 조용히 기본값이 되지 않게', () => {
    // 미등록 키는 pass-through 라, 검증이 없으면 'abc' 가 저장되고 fail-closed 가 조용히 14로 되돌린다.
    expect(validators).toMatch(/payout_hold_days:\s*intRange\(0, 365\)/)
  })
})

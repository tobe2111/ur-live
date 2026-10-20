/**
 * 🚧 이용권 정산 Rail A — **켜지 말 것**을 코드로 고정 (2026-08-02)
 *
 * ## 무엇을 지키나
 *
 * `cron/auto-settlement.ts` 는 `restaurant_settlements`(Rail A)에 정산행을 만든다.
 * 2026-08-02 프로덕션 D1 실측: **그 테이블도, `vouchers.settlement_id` 도, 이 cron 이 읽던
 * `products.commission_rate` 도 전부 없다.** 즉 Rail A 는 한 행도 만든 적이 없고, 이 cron 은
 * 매일 03:00 KST 에 첫 SELECT 에서 던지고 죽었다.
 *
 * 실제 지급은 **Rail B**(`ledger_entries` → 주간 `payouts-generate` → 어드민 approve)가 한다.
 * 그래서 "테이블이 없네, 만들어 주자"는 **수리가 아니라 사고**다 — 과거 사용분 전체가 Rail A 에
 * 한꺼번에 적재되고 두 레일은 서로의 멱등 마커를 안 보므로 **같은 매출을 두 번 지급**할 수 있다
 * (`docs/design/settlement-reconciliation.md` §Severe 3 가 파킹해 둔 머니 경로).
 *
 * 이 테스트는 그 유혹을 막는다. 다음 세션이 "고쳐 두자"고 손대면 여기서 빨강이 뜬다.
 *
 * ## 이 테스트가 **못 막는 것**
 *
 * - 어드민이 정산 화면을 한 번 열면 `restaurant-settlement.routes.ts` 의 `ensureSettlementTables()`
 *   가 테이블을 만든다. 그 경로는 여기서 안 막는다(라우트의 정당한 기능이다).
 *   Rail A 를 영구히 닫으려면 게이트 `settlement_skip_ledgered` flip — **대표 판단 + staging**.
 * - 소스 텍스트만 본다. 런타임에 Rail A 가 실제로 비어 있는지는 D1 조회로만 알 수 있다.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const SRC = path.join(process.cwd(), 'src/worker/cron/auto-settlement.ts')
const CODE = fs.readFileSync(SRC, 'utf8')

/** 주석을 걷어낸 실행 코드 — 설명문에 남은 단어가 판정을 통과시키지 않게. */
const EXEC = CODE
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*)/.test(l))
  .join('\n')

describe('auto-settlement — Rail A 를 깨우지 않는다', () => {
  it('cron 소스가 존재한다 (경로가 낡으면 통과가 아니라 실패)', () => {
    expect(fs.existsSync(SRC)).toBe(true)
    expect(EXEC.length).toBeGreaterThan(500)
  })

  it('Rail A 테이블을 스스로 만들지 않는다', () => {
    // 여기에 CREATE 를 넣는 순간 다음 회차부터 과거분 전체가 적재된다 → Rail B 와 이중지급.
    expect(EXEC).not.toMatch(/CREATE\s+TABLE[\s\S]{0,80}restaurant_settlements/i)
  })

  it('vouchers.settlement_id 컬럼을 스스로 만들지 않는다', () => {
    // 이 컬럼이 Rail A 의 멱등 마커다. cron 이 만들면 Rail A 가 조용히 깨어난다.
    expect(EXEC).not.toMatch(/ALTER\s+TABLE\s+vouchers\s+ADD\s+COLUMN\s+settlement_id/i)
  })

  it('프로비저닝 판정을 통과해야 본작업으로 간다', () => {
    expect(EXEC).toMatch(/railAProvisioned\s*\(/)
    // 판정이 **INSERT 보다 앞에** 있어야 한다. 뒤에 있으면 이미 만든 뒤라 의미가 없다.
    const gate = EXEC.indexOf('railAProvisioned(DB)')
    const insert = EXEC.search(/INSERT\s+INTO\s+restaurant_settlements/i)
    expect(gate).toBeGreaterThan(-1)
    expect(insert).toBeGreaterThan(-1)
    expect(gate).toBeLessThan(insert)
  })
})

describe('auto-settlement — 수수료율 출처', () => {
  it('존재하지 않는 products.commission_rate 를 읽지 않는다', () => {
    // 이 컬럼은 프로덕션에 없고 products-column-baseline.json(97컬럼)에도 없다.
    // 읽는 순간 `no such column` 으로 **회차 전체**가 죽는다 — 실제로 그렇게 죽고 있었다.
    expect(EXEC).not.toMatch(/\bp\.commission_rate\b/)
  })

  it('sellers.commission_rate 를 조인해서 읽는다 (SSOT)', () => {
    expect(EXEC).toMatch(/JOIN\s+sellers\s+s\s+ON/i)
    expect(EXEC).toMatch(/COALESCE\(\s*s\.commission_rate\s*,\s*\?\s*\)/)
  })

  it('플랫폼 기본율 폴백이 남아 있다 (셀러 미설정 매장 보호)', () => {
    expect(EXEC).toMatch(/platformRate/)
  })
})

describe('컬럼 가드의 SELECT 패스 — 헛돌지 않게', () => {
  const GUARD = path.join(process.cwd(), 'scripts/check-sql-column-exists.mjs')
  const G = fs.readFileSync(GUARD, 'utf8')

  it('SELECT alias 패스가 실제로 호출된다', () => {
    // 함수만 있고 호출이 없으면 "가드가 있는데 안 돎"(레지스트리 교훈) 그 자체가 된다.
    expect(G).toMatch(/function scanSelectAliases\(/)
    expect(G).toMatch(/walkSelect\(path\.join\(ROOT, 'src'\)\)/)
  })

  it('보간(${}) 이 있어도 문장을 통째로 건너뛰지 않는다', () => {
    // 🔴 첫 구현이 정확히 이랬고, **이 사건의 원본 쿼리**(${ledgerSkipClause})가 그 형태라
    //    주입 검증에서 초록이 떴다. 되돌아가면 가드가 다시 헛돈다.
    expect(G).not.toMatch(/const stmt = m\[0\]\s*\n\s*if \(stmt\.includes\('\$\{'\)\) \{ stats\.dynamicSkip\+\+; continue \}/)
    expect(G).toMatch(/stmt\.replace\(\/\\\$\\\{\[\^\{\}\]\*\\\}\/g/)
  })

  it('주석을 코드로 읽지 않는다', () => {
    // 설명 주석에 적힌 컬럼명을 위반으로 신고했다(실제로 발생). 반대로 주석 때문에 통과하는
    // 함정(`check-lock-table-symbols`)의 거울상이다.
    expect(G).toMatch(/function blankComments\(/)
  })

  it('스키마 인덱스가 비면 통과가 아니라 실패다', () => {
    expect(G).toMatch(/schema\.size < 20/)
  })
})

describe('products 스키마 — 이 사고의 전제', () => {
  it('baseline 에 commission_rate 가 없다는 사실을 고정한다', () => {
    // 누군가 products 에 commission_rate 를 추가하면(예산제라 차단돼 있지만) 이 테스트가 깨지고,
    // 그때는 위 "읽지 마라" 규칙을 다시 판단해야 한다. 조용히 어긋나지 않게 묶어 둔다.
    const baseline = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'scripts/products-column-baseline.json'), 'utf8')
    ) as string[]
    expect(Array.isArray(baseline)).toBe(true)
    expect(baseline.length).toBeGreaterThan(50)
    expect(baseline).not.toContain('commission_rate')
  })
})

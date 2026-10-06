/**
 * 🧾 **소급 기록** — 이미 환불한 이용권이 주문 장부에 안 적혀 있던 행을 메운다 (2026-10-06)
 *
 * 결재 `docs/decisions/2026-10-02-expired-refund-not-booked.md` (대표 "남은 것도 다 해줘").
 *
 * ## #1625 와 무엇이 다른가
 *
 * #1625(`expired-refund-booked-2026-10-06.test.ts`)는 **앞으로의** 만료 환불이 장부에 적히는지 본다.
 * 이 시험은 **이미 나간 돈**이 소급으로 적히는지 본다. 라이브 실측(2026-10-06):
 *
 * ```
 * voucher 1  refund_status='refunded'  applied_price=1,800  order_id=85
 * order  85  total_amount=1,800        refunded_amount=0          ← 상한이 열려 있다
 * ```
 *
 * ## 문자열이 아니라 **실행**으로 판정한다
 *
 * `node:sqlite` 에 주문·이용권을 넣고 SSOT SQL 을 **실제로 돌린** 뒤, 전액환불 경로와 **같은 식**
 * (`total_amount − refunded_amount`)으로 두 번째 환불액을 계산해 **0** 인지 센다.
 *
 * ⚠️ **이 시험이 못 보는 것**: `repair-schema` 가 라이브에서 실제로 호출되는지는 배선이고,
 *   아래 `describe('배선')` 이 소스로 본다. 실제 발화는 머지 후 `d1-migrate.yml` 로그가 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
// 🩸 YAML 은 `readCode` 로 읽지 않는다 — JS/TS 용 주석 제거기가 `https://…` 의 `//` 를 줄주석
//   시작으로 읽어 URL 을 **잘라 버린다**(이 시험을 쓰다가 실제로 빨간불을 봤다. CLAUDE.md
//   `check-comment-stripper` 가 경고하는 그 클래스다). 워크플로는 `readRaw` 로.
import { readCode, readRaw } from '../helpers/source-text'
import {
  voucherRefundBackfillSql,
  voucherRefundAmbiguousSql,
} from '@/worker/routes/repair-schema/backfill-voucher-refund-booking'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

/** 최소 스키마 — 이 결함을 재현하는 데 필요한 두 칸이 **있다**. */
function seed(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE orders (id INTEGER PRIMARY KEY, total_amount INTEGER, refunded_amount INTEGER);
    CREATE TABLE vouchers (
      id INTEGER PRIMARY KEY, order_id INTEGER, applied_price INTEGER, refund_status TEXT
    );
  `)
  return db
}

function order(db: Db, id: number, total: number, refunded: number | null) {
  db.prepare('INSERT INTO orders (id, total_amount, refunded_amount) VALUES (?, ?, ?)').run(id, total, refunded)
}
function voucher(db: Db, id: number, orderId: number, price: number | null, status: string | null) {
  db.prepare('INSERT INTO vouchers (id, order_id, applied_price, refund_status) VALUES (?, ?, ?, ?)')
    .run(id, orderId, price, status)
}
function refundedAmountOf(db: Db, id: number): number {
  const r = db.prepare('SELECT COALESCE(refunded_amount, 0) AS v FROM orders WHERE id = ?').get(id) as { v: number }
  return Number(r.v)
}
/** 전액환불 경로(`order-refund.ts`)와 **같은 식**. 이게 0 이어야 두 번째 환불이 못 나간다. */
function refundCeiling(db: Db, id: number): number {
  const r = db.prepare(
    'SELECT MAX(0, COALESCE(total_amount,0) - COALESCE(refunded_amount,0)) AS v FROM orders WHERE id = ?',
  ).get(id) as { v: number }
  return Number(r.v)
}
function runBackfill(db: Db): number {
  return Number(db.prepare(voucherRefundBackfillSql()).run().changes)
}

describe('소급 기록 — 이미 환불된 이용권을 주문 장부에 적는다', () => {
  it('라이브 주문 85 재현: refunded_amount 0 → 1,800 이 되고 두 번째 환불액이 0 이 된다', () => {
    const db = seed()
    order(db, 85, 1800, 0)
    voucher(db, 1, 85, 1800, 'refunded')

    // 수리 전 — 1,800 이 또 나갈 수 있다(이게 실제 라이브 상태였다).
    expect(refundCeiling(db, 85)).toBe(1800)

    expect(runBackfill(db)).toBe(1)
    expect(refundedAmountOf(db, 85)).toBe(1800)
    // 수리 후 — 구조적으로 못 나간다.
    expect(refundCeiling(db, 85)).toBe(0)
    db.close()
  })

  it('refunded_amount 가 NULL 인 행도 메운다 (0 과 같은 취급)', () => {
    const db = seed()
    order(db, 85, 1800, null)
    voucher(db, 1, 85, 1800, 'refunded')
    expect(runBackfill(db)).toBe(1)
    expect(refundedAmountOf(db, 85)).toBe(1800)
    db.close()
  })

  it('멱등 — 두 번째 실행은 changes 0 이고 금액이 누적되지 않는다', () => {
    const db = seed()
    order(db, 85, 1800, 0)
    voucher(db, 1, 85, 1800, 'refunded')
    expect(runBackfill(db)).toBe(1)
    expect(runBackfill(db)).toBe(0)
    expect(runBackfill(db)).toBe(0)
    expect(refundedAmountOf(db, 85)).toBe(1800) // 3,600 이 되면 안 된다
    db.close()
  })

  it('한 주문에 이용권 여러 장이면 합으로 적는다', () => {
    const db = seed()
    order(db, 90, 5000, 0)
    voucher(db, 1, 90, 1800, 'refunded')
    voucher(db, 2, 90, 1200, 'refunded')
    expect(runBackfill(db)).toBe(1)
    expect(refundedAmountOf(db, 90)).toBe(3000)
    expect(refundCeiling(db, 90)).toBe(2000) // 아직 안 환불된 몫은 남겨 둔다
    db.close()
  })

  it('총액을 절대 넘지 않는다 — 합이 총액보다 커도 clamp 되어 상한이 0', () => {
    const db = seed()
    order(db, 91, 1800, 0)
    voucher(db, 1, 91, 1800, 'refunded')
    voucher(db, 2, 91, 900, 'refunded') // 비정상 데이터(합 2,700 > 총액 1,800)
    expect(runBackfill(db)).toBe(1)
    expect(refundedAmountOf(db, 91)).toBe(1800) // 2,700 이 아니다
    expect(refundCeiling(db, 91)).toBe(0) // 안전한 방향으로 실패
    db.close()
  })

  it('환불 안 된 이용권은 건드리지 않는다 — 안 쓴 사람의 상한을 깎으면 안 된다', () => {
    const db = seed()
    order(db, 92, 1800, 0)
    voucher(db, 1, 92, 1800, null) // 아직 환불 안 됨
    voucher(db, 2, 92, 1800, 'claimed') // 선점만 된 상태
    expect(runBackfill(db)).toBe(0)
    expect(refundedAmountOf(db, 92)).toBe(0)
    expect(refundCeiling(db, 92)).toBe(1800) // 정상 환불이 여전히 가능해야 한다
    db.close()
  })

  it('applied_price 가 비면 금액을 지어내지 않는다 — 그 주문은 대상이 아니다', () => {
    const db = seed()
    order(db, 93, 1800, 0)
    voucher(db, 1, 93, null, 'refunded')
    expect(runBackfill(db)).toBe(0)
    expect(refundedAmountOf(db, 93)).toBe(0)
    db.close()
  })

  it('이미 뭔가 적혀 있는 주문은 덮어쓰지 않는다 — 남의 부분환불 기록을 지우면 안 된다', () => {
    const db = seed()
    order(db, 94, 5000, 500) // 다른 품목 부분환불 500 이 이미 적혀 있다
    voucher(db, 1, 94, 1800, 'refunded')
    expect(runBackfill(db)).toBe(0)
    expect(refundedAmountOf(db, 94)).toBe(500) // 1,800 으로 덮어쓰면 500 이 사라진다
    db.close()
  })

  it('그 대신 사람이 볼 목록으로 올린다 (0 < 장부 < 이용권합)', () => {
    const db = seed()
    order(db, 94, 5000, 500)
    voucher(db, 1, 94, 1800, 'refunded')
    const rows = db.prepare(voucherRefundAmbiguousSql()).all() as { order_id: number; voucher_refunded: number }[]
    expect(rows.map((r) => r.order_id)).toEqual([94])
    expect(Number(rows[0].voucher_refunded)).toBe(1800)
    db.close()
  })

  it('백필이 자동으로 고치는 행은 수동확인 목록에 안 뜬다 — 소음이 되면 정말 봐야 할 행이 묻힌다', () => {
    const db = seed()
    order(db, 85, 1800, 0) // 백필 대상(장부 0)
    voucher(db, 1, 85, 1800, 'refunded')
    // 백필 **전**에도 목록은 비어 있어야 한다 — 이건 사람이 볼 것이 아니라 기계가 고칠 것이다.
    expect(db.prepare(voucherRefundAmbiguousSql()).all()).toEqual([])
    expect(runBackfill(db)).toBe(1)
    expect(db.prepare(voucherRefundAmbiguousSql()).all()).toEqual([])
    db.close()
  })

  it('장부가 이용권합 이상이면 목록에 안 뜬다 — 이미 정상인 주문으로 소음 만들지 않는다', () => {
    const db = seed()
    order(db, 95, 5000, 1800) // 그 이용권 몫이 이미 적혀 있다
    voucher(db, 1, 95, 1800, 'refunded')
    expect(runBackfill(db)).toBe(0)
    expect(db.prepare(voucherRefundAmbiguousSql()).all()).toEqual([])
    db.close()
  })

  it('총액이 0/NULL 인 주문은 대상이 아니다 — 무한 no-op 로 매번 보고되지 않게', () => {
    const db = seed()
    order(db, 96, 0, 0)
    order(db, 97, null as unknown as number, 0)
    voucher(db, 1, 96, 1800, 'refunded')
    voucher(db, 2, 97, 1800, 'refunded')
    expect(runBackfill(db)).toBe(0)
    db.close()
  })

  it('다른 주문의 이용권이 섞여 들어오지 않는다 (상관 서브쿼리가 order_id 로 묶인다)', () => {
    const db = seed()
    order(db, 98, 5000, 0)
    order(db, 99, 5000, 0)
    voucher(db, 1, 98, 1800, 'refunded')
    voucher(db, 2, 99, 1200, 'refunded')
    expect(runBackfill(db)).toBe(2)
    expect(refundedAmountOf(db, 98)).toBe(1800)
    expect(refundedAmountOf(db, 99)).toBe(1200)
    db.close()
  })
})

describe('배선 — repair-schema 가 실제로 부른다', () => {
  const REPAIR = readCode('src/worker/routes/repair-schema.routes.ts')

  it('runSchemaRepair 가 백필을 호출한다', () => {
    expect(REPAIR).toContain('backfillVoucherRefundBooking(DB)')
  })

  it('수동확인 행을 error 로 올린다 — 조용히 넘기면 구멍이 남은 채 초록불이 된다', () => {
    expect(REPAIR).toMatch(/backfill:voucher-refund-booking 수동확인[\s\S]{0,200}status: 'error'/)
  })

  // 🩸 2026-10-06 — **이 자리에서 두 번 틀렸고, 두 번째가 맞다. 둘 다 남긴다.**
  //   1차 판단: "`d1-migrate.yml` 이 repair-schema 를 부르니 자동으로 돈다" → **틀렸다.**
  //     그 워크플로는 `ADMIN_REPAIR_TOKEN` 미설정으로 호출을 skip 하고, 마이그레이션 적용도
  //     `Couldn't find DB with name 'ur-live'`(실제 이름은 `toss-live-commerce-db`)로 전부 실패하는데
  //     `|| echo "⚠️ 실패 (already applied?)"` 가 삼켜 **잡이 success 로 찍힌다**(run 37465121609).
  //   2차 판단: "그럼 보증은 일간 cron 뿐이다" → **이것도 틀렸다.** 실제 백필을 돌린 것은
  //     **`main.yml` 의 `Auto schema repair after deploy`**(배포 **직후** 같은 잡에서
  //     `POST /api/_internal/repair-schema/auto`)다. 실측: 주문 85 의 `refunded_amount` 가
  //     Pages 배포 완료와 **같은 시점에** 0 → 1800 으로 바뀌었다(cron 시각 03:30 KST 가 아니다).
  //   🧭 2차 오판의 원인: `grep -rn repair-schema … src/ .github/ | … | head -20` 로 찾았는데
  //     **`head -20` 이 `.github/` 매치를 통째로 잘라냈다.** 검색을 자르고 그 결과로 결론을 내렸다.
  //   ⇒ 세 경로를 **각자의 성격대로** 고정한다. 하나가 죽어도 나머지가 받치는 것이 요점이다.
  it('1차 보증: main.yml 이 배포 직후 repair-schema/auto 를 부른다 — 실제로 이게 돌았다', () => {
    const wf = readRaw('.github/workflows/main.yml')
    expect(wf).toContain('/api/_internal/repair-schema/auto')
    // 토큰 헤더가 빠지면 403 fail-closed 라 조용히 아무 일도 안 일어난다.
    expect(wf).toContain('X-Repair-Token')
    // 순서가 핵심이다 — 배포 **뒤**여야 새 코드의 백필이 돈다(앞이면 옛 워커에 닿는다).
    const deployAt = wf.indexOf('pages deploy')
    const repairAt = wf.indexOf('/api/_internal/repair-schema/auto')
    expect(deployAt).toBeGreaterThan(-1)
    expect(repairAt).toBeGreaterThan(deployAt)
  })

  it('2차 보증: 일간 cron(schema-repair-daily)도 runSchemaRepair 를 부른다', () => {
    const lane = readCode('src/worker/cron/daily-lane.ts')
    expect(lane).toContain("run('schema-repair-daily'")
    expect(lane).toMatch(/schema-repair-daily[\s\S]{0,400}runSchemaRepair\(env\.DB\)/)
  })

  it('그 cron 이 등록돼 있다 — 등록이 빠지면 조용히 아무 일도 안 일어난다', () => {
    const sched = readCode('src/worker/scheduled.ts')
    expect(sched).toMatch(/runDailyLane\('maintenance'/)
  })

  /**
   * 🔀 **재조준(2026-10-06 같은 날 후속)** — 이 자리는 원래 *"3차(죽은) 경로: d1-migrate 의 배선은
   *   유지한다 — 토큰이 채워지면 다시 일한다"* 였다. 같은 날 그 호출을 **의도적으로 제거**했다:
   *     · 토큰(`ADMIN_REPAIR_TOKEN`) 미설정으로 **한 번도 실행된 적이 없고**,
   *     · `main.yml` 이 배포 **직후** 같은 일을 하며 **실제로 돈다**(위 1차 — 주문 85 를 그것이 메웠다),
   *     · 그런데도 **있다는 사실만으로 "자동으로 돈다" 는 거짓 확신**을 만들었다(그 오판을 실제로 했다).
   *   ⇒ 가드를 **풀지 않고 방향을 뒤집는다**: 지키려던 것("복구 경로가 살아 있다")은 위 1차·2차가
   *     이미 단언한다. 여기서는 **중복이 되돌아오지 않는 것**을 지킨다.
   *   상세: `src/tests/unit/d1-migrate-honesty-2026-10-06.test.ts`
   */
  it('3차 경로는 제거했다 — d1-migrate 는 더 이상 repair-schema 를 부르지 않는다(중복·거짓 확신)', () => {
    const wf = readRaw('.github/workflows/d1-migrate.yml')
    expect(wf, 'repair-schema 호출이 되돌아왔다 — 한 번도 안 돌았고 "자동으로 돈다" 는 오판을 만든 자리다')
      .not.toContain('/api/_internal/repair-schema')
    // 트리거 경로는 그대로 둔다 — repair-schema 라우트가 바뀌면 마이그레이션 상태를 **보고**할 이유가 있다.
    expect(wf, '트리거 경로가 사라졌다').toContain('src/worker/routes/repair-schema.routes.ts')
  })
})

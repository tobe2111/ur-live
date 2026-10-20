/**
 * 🔒 **소개 커미션은 사용 확인 뒤에 익는다** — 실제 SQLite 로 돌려서 판정 (2026-09-16)
 *
 * 대표: *"그 전에도 사기꾼이 멋대로 이용권 기껏 유저들에게 팔았는데 사장님은 아예 모르는
 * 단계라 난처해질 수 있잖아."* → 확정 *"사용된 것 → 사용 확인 즉시 / 안 쓰인 것 → 유효기간 만료 후."*
 *
 * ## 왜 문자열이 아니라 SQL 을 돌리나
 * 이 게이트의 실패 모드 둘 다 **조용하다**:
 *   - 너무 조이면 정상 소개비가 **영영 안 익는다**(아무 에러도 안 난다).
 *   - 너무 풀면 **가짜 매장 돈이 그대로 나간다**(오늘과 같아서 티가 안 난다).
 * 상관 서브쿼리·`COALESCE(expires_at, datetime(created_at,'+N days'))` 가 의도대로 도는지는
 * 소스를 읽어선 알 수 없다 ⇒ 실제 SQLite 에 넣고 **성숙한 행 수를 센다**.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *   - D1 과 node:sqlite 의 차이 · cron 의 나머지(잔고 동기·송금 대기 목록) · 어드민 [송금 처리].
 *   - 게이트가 **켜져 있는지**(라이브 `platform_settings`) — 그건 코드가 아니라 운영 상태다.
 *     "코드에 있다 ≠ 살아 있다"(CLAUDE.md) — 켜는 것은 등급 C 로 대표가 한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { buildPayoutUseGateSql, resolvePayoutUseGate, DEFAULT_UNUSED_MAX_WAIT_DAYS } from '@/worker/utils/payout-use-gate'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { binds = a; return self },
        first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
        all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(binds as never[])).changes) } }),
      }
      return self
    },
  } as unknown as D1Database
}

const daysAgo = (n: number) => {
  const d = new Date(Date.now() - n * 86400_000)
  return d.toISOString().slice(0, 19).replace('T', ' ')
}

function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)`)
  db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER,
    status TEXT DEFAULT 'unused', used_at DATETIME, expires_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
  db.exec(`CREATE TABLE influencer_attributions (id INTEGER PRIMARY KEY AUTOINCREMENT,
    influencer_id TEXT, order_id INTEGER, commission_amount INTEGER,
    status TEXT DEFAULT 'pending', available_at DATETIME)`)
  return db
}

/** 성숙 UPDATE 를 cron 과 **같은 모양**으로 실행하고 익은 행 수를 돌려준다. */
function mature(db: Db, gateSql: string): number {
  return Number(db.prepare(`
    UPDATE influencer_attributions
       SET status = 'available'
     WHERE status = 'pending'
       AND available_at IS NOT NULL
       AND available_at <= datetime('now')
       ${gateSql}
  `).run().changes)
}

/** 주문 1건 + 그 주문의 이용권들 + 이미 환불창을 지난 소개 적립 1행. */
function seed(db: Db, orderId: number, vouchers: Array<{ status: string; expires?: string | null; created?: string }>) {
  for (const v of vouchers) {
    db.prepare(`INSERT INTO vouchers (order_id, status, expires_at, created_at) VALUES (?,?,?,?)`)
      .run(orderId, v.status, v.expires ?? null, v.created ?? daysAgo(10))
  }
  db.prepare(`INSERT INTO influencer_attributions (influencer_id, order_id, commission_amount, status, available_at)
              VALUES ('inf1', ?, 1000, 'pending', ?)`).run(orderId, daysAgo(3))
}

const ON = () => buildPayoutUseGateSql(true).sql

describe('🔒 사용 확인 게이트 (실제 SQL)', () => {
  it('게이트 OFF 면 SQL 이 빈 문자열 — 종전과 byte-동일', () => {
    const g = buildPayoutUseGateSql(false)
    expect(g.sql).toBe('')
    expect(g.enabled).toBe(false)
  })

  it('OFF 면 안 쓰인 이용권도 익는다 (= 오늘의 동작, 그래서 구멍이었다)', () => {
    const db = fresh()
    seed(db, 1, [{ status: 'unused', expires: daysAgo(-365) }])
    expect(mature(db, buildPayoutUseGateSql(false).sql), 'OFF 인데 안 익으면 롤백이 안 되는 것').toBe(1)
  })

  it('ON — 아무도 안 썼고 아직 쓸 수 있으면 **안 익는다**', () => {
    const db = fresh()
    seed(db, 1, [{ status: 'unused', expires: daysAgo(-365) }])
    expect(mature(db, ON()), '가짜 매장이 돈을 가져가는 바로 그 경로다').toBe(0)
  })

  it('ON — 한 장이라도 사용됐으면 익는다 (부분 사용도 통과)', () => {
    const db = fresh()
    seed(db, 1, [
      { status: 'used' },
      { status: 'unused', expires: daysAgo(-365) },
      { status: 'unused', expires: daysAgo(-365) },
    ])
    expect(mature(db, ON()), '3장 사서 1장 쓴 정상 소비자가 소개비를 얼리면 안 된다').toBe(1)
  })

  it('ON — 만료일이 지났어도 아직 unused 면 **안 익는다** (만료 cron 레이스)', () => {
    const db = fresh()
    seed(db, 1, [{ status: 'unused', expires: daysAgo(1) }])
    // `auto-settlement` 가 [expired → 고객 100% 환불 → clawback] 을 돌리기 전 창이다.
    // 여기서 익히면 **곧 회수될 돈**이 "송금 대기"로 뜬다.
    expect(mature(db, ON()), '날짜가 아니라 처리 결과(status)를 봐야 한다').toBe(0)
  })

  it('ON — 만료 레일이 지나가 status 가 expired 면 익는다 (잔여 정리)', () => {
    const db = fresh()
    seed(db, 1, [{ status: 'expired', expires: daysAgo(1) }])
    expect(mature(db, ON())).toBe(1)
  })

  it('ON — 이용권 행이 없는 주문(쇼핑·교환권)은 게이트 대상이 아니다', () => {
    const db = fresh()
    seed(db, 1, [])
    expect(mature(db, ON()), '이용권이 아닌 주문의 소개비가 영영 안 익으면 정직한 사람이 막힌다').toBe(1)
  })

  it('ON — status 가 refunded/expired 면 (쓸 수 없으므로) 익는다', () => {
    const db = fresh()
    seed(db, 1, [{ status: 'refunded' }, { status: 'expired' }])
    expect(mature(db, ON())).toBe(1)
  })

  it('ON — **무기한** 이용권은 발급일 + N일이 지나야 익는다 (만료 cron 이 안 집는 유일한 경우)', () => {
    const near = fresh()
    seed(near, 1, [{ status: 'unused', expires: null, created: daysAgo(10) }])
    expect(mature(near, ON()), '무기한인데 갓 발급된 건 아직 기다린다').toBe(0)

    const old = fresh()
    seed(old, 1, [{ status: 'unused', expires: null, created: daysAgo(DEFAULT_UNUSED_MAX_WAIT_DAYS + 5) }])
    expect(mature(old, ON()), '천장이 없으면 무기한 이용권의 소개비는 **영원히** 안 익는다').toBe(1)
  })

  it('ON — 환불창(available_at)은 그대로 먼저 지나야 한다 (게이트는 추가 조건일 뿐)', () => {
    const db = fresh()
    db.prepare(`INSERT INTO vouchers (order_id, status) VALUES (1,'used')`).run()
    db.prepare(`INSERT INTO influencer_attributions (influencer_id, order_id, commission_amount, status, available_at)
                VALUES ('inf1', 1, 1000, 'pending', ?)`).run(daysAgo(-3))
    expect(mature(db, ON()), '사용됐다고 환불창을 건너뛰면 환불 시 회수 못 한 돈이 나간다').toBe(0)
  })

  it('다른 주문끼리 새지 않는다 — 남의 사용이 내 소개비를 익히면 안 된다', () => {
    const db = fresh()
    seed(db, 1, [{ status: 'unused', expires: daysAgo(-365) }])   // 안 씀
    seed(db, 2, [{ status: 'used' }])                              // 썼음
    expect(mature(db, ON()), '상관 서브쿼리가 order_id 로 안 묶이면 전부 익어 버린다').toBe(1)
    const stuck = db.prepare(`SELECT order_id FROM influencer_attributions WHERE status='pending'`).all() as Array<{ order_id: number }>
    expect(stuck.map(r => r.order_id)).toEqual([1])
  })

  it('무기한 천장은 정수로 클램프된다 — SQL 에 들어가는 값이라', () => {
    expect(buildPayoutUseGateSql(true, 0).maxWaitDays).toBe(1)
    expect(buildPayoutUseGateSql(true, 99999).maxWaitDays).toBe(3650)
    expect(buildPayoutUseGateSql(true, NaN).maxWaitDays).toBe(DEFAULT_UNUSED_MAX_WAIT_DAYS)
    expect(buildPayoutUseGateSql(true, 30).sql).toContain("'+30 days'")
    // 문자열이 섞여 들어갈 자리가 없어야 한다.
    expect(buildPayoutUseGateSql(true, "7 days' OR 1=1 --" as unknown as number).sql).toContain(`'+${DEFAULT_UNUSED_MAX_WAIT_DAYS} days'`)
  })

  it('platform_settings 를 읽어 켜고 끈다 (기본 OFF)', async () => {
    const db = fresh()
    expect((await resolvePayoutUseGate(d1(db))).enabled, '설정이 없으면 OFF 여야 종전과 같다').toBe(false)

    // 🩸 주입이 잡은 구멍: 위 한 줄만으로는 **행이 아예 없어서** 읽기 루프가 안 돈다 —
    //    루프 안에서 `enabled = true` 로 바꿔 놔도 초록이었다. 행이 **있는데 값이 'true' 가
    //    아닌** 경우를 반드시 같이 본다(어드민이 껐다가 켜는 실제 모양이기도 하다).
    db.prepare(`INSERT INTO platform_settings VALUES ('payout_requires_voucher_use','false')`).run()
    expect((await resolvePayoutUseGate(d1(db))).enabled, "'false' 인데 켜지면 승인 없이 머니 게이트가 켜진다").toBe(false)
    db.prepare(`UPDATE platform_settings SET value='off' WHERE key='payout_requires_voucher_use'`).run()
    expect((await resolvePayoutUseGate(d1(db))).enabled, "'true' 가 아닌 값은 전부 OFF 여야 한다").toBe(false)

    db.prepare(`UPDATE platform_settings SET value='true' WHERE key='payout_requires_voucher_use'`).run()
    db.prepare(`INSERT INTO platform_settings VALUES ('payout_unused_max_wait_days','45')`).run()
    const g = await resolvePayoutUseGate(d1(db))
    expect(g.enabled).toBe(true)
    expect(g.maxWaitDays).toBe(45)
    expect(mature(db, g.sql)).toBe(0)
  })

  it('설정을 못 읽어도 돈을 얼리지 않는다 (fail-open = OFF)', async () => {
    const broken = { prepare: () => { throw new Error('no such table: platform_settings') } } as unknown as D1Database
    expect((await resolvePayoutUseGate(broken)).enabled).toBe(false)
  })

  it('성숙 cron 이 실제로 이 게이트를 통과시킨다 (배선)', () => {
    const src = stripComments(readFileSync('src/worker/cron/influencer-payout.ts', 'utf-8'))
    expect(src, '게이트를 안 부르면 이 파일 전체가 장식이다').toContain('resolvePayoutUseGate')
    // 조각이 **성숙 UPDATE 안**에 있어야 한다 — 변수만 만들고 안 쓰면 조용히 무력화된다.
    const upd = src.slice(src.indexOf('UPDATE influencer_attributions'))
    const stmtEnd = upd.indexOf('`)')
    expect(upd.slice(0, stmtEnd), '조각이 UPDATE 밖에 있으면 게이트는 켜도 안 먹는다').toContain('useGate.sql')
  })
})

/**
 * 🤝 **이용권은 판 시점의 영입자를 기억한다** — 실제 SQLite 로 돌려서 판정 (2026-09-09)
 *
 * 대표 원칙: *"귀속되는 시점부터 계산해서 성과 수익이 계산되어야 하지 않을까?"*
 *
 * 이용권 **사용** 레일이 마지막 미적용 자리였다 — 사용 시점에 매장의 *현재* 영입자를 읽어
 * **과거에 팔린 이용권의 커미션까지 오늘의 영입자에게** 줬다(소급, 에러 없음).
 *
 * 여기서 보는 것은 배선이 아니라 **인과**다: 팔 때 찍은 도장이 → 사용 시점 수령자를 결정한다.
 *
 * ## ⚠️ 못 막는 것
 *   - D1 과 node:sqlite 의 차이 · 실제 적립(`creditUserCommission`) · HTTP 층.
 *   - 도장을 **찍는 쪽**(3개 INSERT)의 배선은 짝 시험이 소스로 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { resolveVoucherIntroStamp } from '@/worker/utils/voucher-intro-stamp'

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

function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, introduced_by_influencer_id INTEGER,
    introduced_at DATETIME, referral_bonus_until DATETIME)`)
  db.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)`)
  db.exec(`CREATE TABLE vouchers (id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER, user_id TEXT,
    introduced_by_influencer_id INTEGER, intro_stamped_at DATETIME)`)
  return db
}

const monthsAgo = (n: number) => {
  const d = new Date(); d.setMonth(d.getMonth() - n); return d.toISOString().slice(0, 19).replace('T', ' ')
}

describe('🤝 판 시점 도장 (실제 함수 · 실제 DB)', () => {
  it('영입 창이 열려 있으면 그 영입자를 찍는다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 500, ?, NULL)`).run(monthsAgo(1))
    const s = await resolveVoucherIntroStamp(d1(db), 7)
    expect(s.introducerId).toBe(500)
    expect(s.stampedAt, '판정했다는 표시가 없으면 옛 이용권과 구분이 안 된다').toBeTruthy()
  })

  it('창이 닫혔으면 NULL 을 찍는다 — 그래도 도장은 찍는다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 500, ?, NULL)`).run(monthsAgo(24))  // 기본 12개월 초과
    const s = await resolveVoucherIntroStamp(d1(db), 7)
    expect(s.introducerId, '만료된 관계로 판 이용권이 나중에 되살아나면 안 된다').toBeNull()
    expect(s.stampedAt, 'NULL 이어도 "판정했다"는 표시는 남아야 폴백으로 안 샌다').toBeTruthy()
  })

  it('영입자가 없으면 NULL', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, NULL, NULL, NULL)`).run()
    expect((await resolveVoucherIntroStamp(d1(db), 7)).introducerId).toBeNull()
  })

  it('매장이 없거나 조회가 깨져도 결제를 막지 않는다 (fail-soft)', async () => {
    const db = fresh()
    const s = await resolveVoucherIntroStamp(d1(db), 999)
    expect(s.introducerId).toBeNull()
    expect(s.stampedAt).toBeTruthy()
    // 테이블 자체가 없는 최악의 경우
    const broken = new DatabaseSync(':memory:')
    expect((await resolveVoucherIntroStamp(d1(broken), 7)).introducerId).toBeNull()
  })

  it('platform_settings 의 기간 설정을 따른다 (레일 간 규칙 일치)', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 500, ?, NULL)`).run(monthsAgo(18))
    db.prepare(`INSERT INTO platform_settings VALUES ('influencer_store_intro_months', '24')`).run()
    expect((await resolveVoucherIntroStamp(d1(db), 7)).introducerId, '24개월 설정이면 18개월은 아직 유효').toBe(500)
  })
})

describe('🤝 도장이 수령자를 결정한다 (영입자가 바뀌어도 소급 안 됨)', () => {
  /** 사용 레일(`recordIntroductionCommissionShare`)의 수령자 판정 그대로. */
  const payee = (db: Db, voucherId: number, sellerId: number) => {
    const stamp = db.prepare('SELECT introduced_by_influencer_id AS iid, intro_stamped_at FROM vouchers WHERE id = ?')
      .get(voucherId) as { iid: number | null; intro_stamped_at: string | null } | undefined
    const stamped = !!stamp?.intro_stamped_at
    if (stamped && !stamp?.iid) return null
    const seller = db.prepare('SELECT introduced_by_influencer_id FROM sellers WHERE id = ?')
      .get(sellerId) as { introduced_by_influencer_id: number | null } | undefined
    return stamped ? Number(stamp!.iid) : (seller?.introduced_by_influencer_id ?? null)
  }

  it('영입자가 바뀌어도 판 시점의 사람이 받는다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 500, ?, NULL)`).run(monthsAgo(1))
    const s = await resolveVoucherIntroStamp(d1(db), 7)
    db.prepare(`INSERT INTO vouchers (order_id, user_id, introduced_by_influencer_id, intro_stamped_at)
                VALUES (1, '900', ?, ?)`).run(s.introducerId, s.stampedAt)

    // 나중에 영입자가 바뀐다
    db.prepare(`UPDATE sellers SET introduced_by_influencer_id = 600 WHERE id = 7`).run()
    expect(payee(db, 1, 7), '새 영입자에게 과거 판매분이 소급되면 안 된다').toBe(500)
  })

  it('팔 때 받을 사람이 없었으면 나중에 영입자가 붙어도 0 이다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, NULL, NULL, NULL)`).run()
    const s = await resolveVoucherIntroStamp(d1(db), 7)
    db.prepare(`INSERT INTO vouchers (order_id, user_id, introduced_by_influencer_id, intro_stamped_at)
                VALUES (1, '900', ?, ?)`).run(s.introducerId, s.stampedAt)

    db.prepare(`UPDATE sellers SET introduced_by_influencer_id = 600, introduced_at = ? WHERE id = 7`).run(monthsAgo(0))
    expect(payee(db, 1, 7), '없던 관계가 소급으로 생기면 안 된다').toBeNull()
  })

  it('도장이 없는 옛 이용권은 종전 규칙으로 떨어진다 (보상이 사라지지 않는다)', () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 500, ?, NULL)`).run(monthsAgo(1))
    db.prepare(`INSERT INTO vouchers (order_id, user_id) VALUES (1, '900')`).run()
    expect(payee(db, 1, 7), '옛 이용권을 전부 "없음"으로 접으면 실제 보상이 사라진다').toBe(500)
  })
})

/**
 * 위 시험들은 **순수 판정**을 본다. 도장을 실제로 찍고 읽는 자리는 HTTP·D1 층이라 여기서 못 돈다
 * — 그 배선은 소스로 못 박는다(빠지면 판정 코드가 멀쩡해도 입력이 비어 조용히 폴백된다).
 */
describe('🔌 배선 — 찍는 쪽 3곳 · 읽는 쪽 1곳', () => {
    /**
   * 🔴 주석 제거는 **레포 SSOT** 를 쓴다. 직접 쓴 정규식은 문자열/정규식 리터럴 안의 `/*` 를
   *   블록주석 시작으로 보고 **파일 가운데를 통째로 삼킨다** — 이번에 실제로 밟았다
   *   (`RestaurantMapPage` 에서 검사 대상 줄이 증발해 가짜 빨간불).
   */
  const read = (p: string) => stripComments(readFileSync(p, 'utf8'))
  const GB = 'src/features/group-buy/api/group-buy.routes.ts'
  const EXP = 'src/features/group-buy/api/experience-campaign.routes.ts'
  const LEDGER = 'src/worker/utils/ledger.ts'

  it('이용권을 만드는 3곳이 전부 도장을 찍는다', () => {
    const gb = read(GB)
    expect(gb.match(/resolveVoucherIntroStamp\(DB, product\.seller_id\)/g)?.length,
      `${GB}: /join 과 카드결제 두 경로 모두 필요하다`).toBeGreaterThanOrEqual(2)
    expect(gb.match(/introStamp\.introducerId, introStamp\.stampedAt/g)?.length,
      '계산만 하고 INSERT 에 안 넣으면 아무 일도 안 일어난다').toBeGreaterThanOrEqual(2)
    expect(gb.match(/intro_stamped_at/g)?.length, 'INSERT 컬럼에 들어가야 실제로 찍힌다')
      .toBeGreaterThanOrEqual(2)
    // 🩸 첫 판은 `/resolveVoucherIntroStamp[\s\S]{0,400}intro_stamped_at/` 였는데 **헛돌았다** —
    //   그 이름이 **import 줄에도** 있어서 호출을 통째로 지워도 초록이었다. 주입 검증이 잡았다.
    //   ⇒ **호출 자리(인자 포함)** 로 앵커를 좁힌다.
    expect(read(EXP), `${EXP}: 체험단만 빠지면 그 레일에서 소급이 남는다`)
      .toMatch(/resolveVoucherIntroStamp\(DB, campaign\.seller_id\)/)
    expect(read(EXP), '도장을 계산만 하고 INSERT 에 안 넣으면 아무 일도 안 일어난다')
      .toMatch(/introStamp\.introducerId, introStamp\.stampedAt/)
  })

  it('사용 레일이 도장을 먼저 읽는다', () => {
    const l = read(LEDGER)
    expect(l, `${LEDGER}: 도장을 안 읽으면 오늘의 영입자에게 과거 판매분이 간다`)
      .toMatch(/intro_stamped_at FROM vouchers/)
    expect(l, '"영입자 없음"과 "옛 이용권"을 가르는 표시가 판정에 쓰여야 한다')
      .toMatch(/const stamped = !!stamp\?\.intro_stamped_at/)
  })

  it('수령자가 도장 우선이다 (돈이 실제로 그 사람에게 간다)', () => {
    const l = read(LEDGER)
    expect(l, `${LEDGER}: 도장을 읽고도 지급을 seller 에서 다시 꺼내면 도장이 무의미하다`)
      .toMatch(/const influencerUserId = payeeId/)
    expect(l).toMatch(/const payeeId = stamped \? Number\(stamp!\.iid\)/)
  })
})

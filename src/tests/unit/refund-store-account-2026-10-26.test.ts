/**
 * 🏦 충전 딜 환급 — 가게 정산 계좌로 받기 (2026-10-26 대표 *"a 해주고"*)
 *
 * 지키는 것:
 *  ① 주인인 가게의 계좌만 — 운영(대행)하는 남의 가게·회수된 좌석·계좌가 빈 가게는 안 된다.
 *     (운영자의 개인 환급이 그 가게 사장님 통장으로 가면 에러 없이 돈이 엉뚱한 곳으로 간다.)
 *  ② 화면엔 끝 4자리만 — 정산 계좌 마스킹(2026-06-12)을 이 길이 우회하지 않는다.
 *  ③ 신청은 `use_store_account: true` 만 보내고, 서버가 세 칸을 채운다.
 *  ④ 환급 로직(`requestDealRefund`)은 그대로 — 이 기능은 입력만 채운다.
 *
 * 실제 SQLite 로 판정한다(문자열 검사 아님).
 * ⚠️ 못 보는 것: D1 실제 스키마 · 화면 렌더 · 이체가 실제로 그 계좌로 가는지(지급 센터의 사람 손).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readCode } from '../helpers/source-text'
import { findOwnedStoreAccount, toPublicStoreAccount } from '@/worker/utils/deal-refund-store-account'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { binds = a; return self },
        first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      }
      return self
    },
  } as unknown as D1Database
}

function fresh(opts: { noOperators?: boolean } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, name TEXT, business_name TEXT, linked_user_id INTEGER,
    bank_name TEXT, bank_account TEXT, account_holder TEXT)`)
  if (!opts.noOperators) {
    db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY, seller_id INTEGER, user_id INTEGER, role TEXT, revoked_at TEXT)`)
  }
  return { db, D: d1(db) }
}

describe('① 주인인 가게의 계좌만', () => {
  it('직접 연결된 가게의 계좌를 고른다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO sellers VALUES (1, '달빛', '달빛상회', 7, '국민', '123-456-789012', '정지원')`)
    const a = await findOwnedStoreAccount(D, 7)
    expect(a).toMatchObject({ seller_id: 1, store_name: '달빛상회', bank_name: '국민', bank_account: '123-456-789012', account_holder: '정지원' })
  })

  it('주인 좌석(/store/new 사장님)도 주인이다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO sellers VALUES (2, '홍대돈까스', NULL, NULL, '신한', '110-222-333444', '김사장')`)
    db.exec(`INSERT INTO seller_operators VALUES (1, 2, 7, 'owner', NULL)`)
    expect((await findOwnedStoreAccount(D, 7))?.seller_id).toBe(2)
  })

  it('운영(대행)하는 남의 가게 계좌는 절대 안 준다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO sellers VALUES (3, '남의 가게', NULL, 99, '우리', '1002-111-222333', '남사장')`)
    db.exec(`INSERT INTO seller_operators VALUES (1, 3, 7, 'operator', NULL)`)
    expect(await findOwnedStoreAccount(D, 7)).toBeNull()
  })

  it('회수된 주인 좌석은 안 된다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO sellers VALUES (4, '옛 가게', NULL, NULL, '농협', '301-0000-1111-22', '옛사장')`)
    db.exec(`INSERT INTO seller_operators VALUES (1, 4, 7, 'owner', '2026-10-01')`)
    expect(await findOwnedStoreAccount(D, 7)).toBeNull()
  })

  it('계좌 세 칸 중 하나라도 비면 고르지 않는다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO sellers VALUES (5, '빈 계좌', NULL, 7, '국민', '   ', '정지원')`)
    expect(await findOwnedStoreAccount(D, 7)).toBeNull()
  })

  it('둘 다 있으면 직접 연결된 가게가 먼저다', async () => {
    const { db, D } = fresh()
    db.exec(`INSERT INTO sellers VALUES (1, '좌석 가게', NULL, NULL, '신한', '110-1', '갑')`)
    db.exec(`INSERT INTO sellers VALUES (9, '연결 가게', NULL, 7, '국민', '123-456-789012', '을')`)
    db.exec(`UPDATE sellers SET bank_account='110-222-333444' WHERE id=1`)
    db.exec(`INSERT INTO seller_operators VALUES (1, 1, 7, 'owner', NULL)`)
    expect((await findOwnedStoreAccount(D, 7))?.seller_id).toBe(9)
  })

  it('좌석 테이블이 없으면 직접 연결만 본다(던지지 않는다)', async () => {
    const { db, D } = fresh({ noOperators: true })
    db.exec(`INSERT INTO sellers VALUES (1, '달빛', NULL, 7, '국민', '123-456-789012', '정지원')`)
    expect((await findOwnedStoreAccount(D, 7))?.seller_id).toBe(1)
    expect(await findOwnedStoreAccount(D, 8)).toBeNull()
  })

  it('잘못된 사용자 id 는 조회조차 안 한다', async () => {
    const { D } = fresh()
    expect(await findOwnedStoreAccount(D, 0)).toBeNull()
    expect(await findOwnedStoreAccount(D, 'abc')).toBeNull()
  })
})

describe('② 화면엔 끝 4자리만', () => {
  it('공개 모양에 전체 계좌번호가 없다', () => {
    const pub = toPublicStoreAccount({ seller_id: 1, store_name: '달빛', bank_name: '국민', bank_account: '123-456-789012', account_holder: '정지원' })
    expect(pub).toEqual({ store_name: '달빛', bank_name: '국민', bank_account_masked: '****9012', account_holder: '정지원' })
    expect(JSON.stringify(pub)).not.toContain('123-456')
    expect(pub).not.toHaveProperty('bank_account')
    expect(pub).not.toHaveProperty('seller_id')
  })

  it('조회 라우트는 공개 모양만 싣는다', () => {
    const src = readCode('src/features/points/api/points.routes.ts')
    const get = src.slice(src.indexOf("pointsRoutes.get('/refund'"), src.indexOf("pointsRoutes.post('/refund'"))
    expect(get).toMatch(/store_account:\s*toPublicStoreAccount\(await findOwnedStoreAccount\(/)
  })
})

describe('③ 신청은 선택만 보내고 서버가 채운다', () => {
  const route = readCode('src/features/points/api/points.routes.ts')
  const post = route.slice(route.indexOf("pointsRoutes.post('/refund'"), route.indexOf("pointsRoutes.post('/withdraw'"))

  it('서버가 주인 가게 계좌로 세 칸을 덮어쓴다 — 정리·검증보다 먼저', () => {
    const at = post.indexOf('use_store_account === true')
    expect(at).toBeGreaterThan(-1)
    const block = post.slice(at, post.indexOf('normalizeRefundInput(body)'))
    expect(block).toMatch(/\.findOwnedStoreAccount\(c\.env\.DB, user\.id\)/)
    for (const k of ['bank_name', 'bank_account', 'account_holder']) {
      expect(block).toMatch(new RegExp(`body\\.${k} = acc\\.${k}`))
    }
    expect(block).toMatch(/if \(!acc\) return c\.json\(\{ success: false/)
  })

  it('시트는 가게 계좌일 때 계좌 칸을 보내지 않는다', () => {
    const sheet = readCode('src/pages/user-profile/RefundSheet.tsx')
    expect(sheet).toMatch(/viaStore\s*\?\s*\{ amount: parsed, use_store_account: true \}/)
    expect(sheet).toMatch(/setUseStore\(!!s\.store_account\)/)
    // 가게 계좌가 없으면 종전 입력 칸 그대로(가게 계좌 선택지가 없다)
    expect(sheet).toMatch(/const viaStore = useStore && !!store/)
  })
})

describe('④ 환급 로직은 그대로', () => {
  it('requestDealRefund 는 이 기능을 모른다', () => {
    const lib = readCode('src/worker/utils/deal-refund.ts')
    expect(lib).not.toMatch(/use_store_account|findOwnedStoreAccount/)
  })
})

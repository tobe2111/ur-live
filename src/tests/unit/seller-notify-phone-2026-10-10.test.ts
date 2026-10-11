/**
 * 📱 사장님 알림이 **받을 수 있는 번호로** 가는가 (2026-10-10 사장님·중개사 플로우 전수조사)
 *
 * 라이브 실측: 매장 13곳 중 12곳은 `sellers.phone` 이 매장 대표번호(유선 063·051·02)이고 휴대폰은
 * `seller_meta.manager_phone` 에만 있다. 알림톡 함수는 `^01` 이 아니면 조용히 건너뛰므로 판매·사용·승인
 * 알림이 **에러 없이** 아무에게도 안 갔다. 여기서는 실제 SQLite 에 넣고 고른 번호와 발송 횟수를 센다.
 *
 *  ① 담당자 휴대폰 우선 · 매장 번호가 휴대폰이면 그것 · 둘 다 유선이면 null(유선을 "있다" 고 하지 않는다)
 *  ② 판매 알림 — 첫 판매는 온보딩 한 번만(CAS), 그 뒤는 건별 · 휴대폰 없으면 첫 판매 표시를 남기지 않는다
 *  ③ 승인 = 등록증 확인 — 사본 있고 대기일 때만(반려된 서류를 덮어쓰지 않는다)
 *  ④ 배선 — 딜·카드·장바구니 셋이 같은 함수 · 없는 컬럼(store_owner_token) 조회가 돌아오지 않는다
 * ⚠️ 못 보는 것: 실제 카카오/솔라피 발송 결과(외부) · 템플릿 글자 일치.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { pickNotifyPhone, toMobile, resolveSellerNotifyTarget } from '@/worker/utils/seller-notify-phone'

const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { exec: (s: string) => void; prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }

let raw: InstanceType<typeof DatabaseSync>
let DB: D1Database
function d1(db: InstanceType<typeof DatabaseSync>): D1Database {
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}

beforeEach(() => {
  raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, name TEXT, business_name TEXT, phone TEXT, first_voucher_notified INTEGER DEFAULT 0,
      business_registration_image_url TEXT, business_registration_status TEXT, business_registration_verified_at TEXT);
    CREATE TABLE seller_meta (seller_id INTEGER, key TEXT, value TEXT);
    INSERT INTO sellers (id, name, business_name, phone) VALUES
      (1, '김', '전주식당', '063-123-4567'), (2, '이', '부산집', '010-2222-3333'), (3, '박', '서울가게', '02-555-6666');
    INSERT INTO seller_meta VALUES (1, 'manager_phone', '010-1111-2222'), (3, 'manager_phone', '031-777-8888');
  `)
  DB = d1(raw)
})

describe('① 번호 고르기', () => {
  it('숫자만 남겨 휴대폰만 통과', () => {
    expect(toMobile('010-1234-5678')).toBe('01012345678')
    expect(toMobile('063-123-4567')).toBeNull()
    expect(toMobile(null)).toBeNull()
  })
  it('담당자 휴대폰 → 매장 번호(휴대폰일 때만) 순서', () => {
    expect(pickNotifyPhone('010-1111-2222', '010-9999-0000')).toBe('01011112222')
    expect(pickNotifyPhone('031-777-8888', '010-9999-0000')).toBe('01099990000')
    expect(pickNotifyPhone('', '02-555-6666')).toBeNull()
  })
  it('실제 조회 — 유선 매장도 담당자 휴대폰으로 닿는다', async () => {
    expect((await resolveSellerNotifyTarget(DB, 1))?.phone).toBe('01011112222')
    expect((await resolveSellerNotifyTarget(DB, 2))?.phone).toBe('01022223333')
    expect((await resolveSellerNotifyTarget(DB, 3))?.phone).toBeNull()
    expect(await resolveSellerNotifyTarget(DB, 999)).toBeNull()
  })
})

describe('② 판매 알림 — 첫 판매 한 번(CAS) · 그 뒤 건별', () => {
  const fetchMock = vi.fn(async () => new Response('{}'))
  beforeEach(() => { fetchMock.mockClear(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => vi.unstubAllGlobals())
  const env = { ALIMTALK_API_KEY: 'k', ALIMTALK_SENDER_KEY: 's' }
  const bodies = () => fetchMock.mock.calls.map(c => JSON.parse(String((c as unknown as [string, { body: string }])[1].body)).message)

  it('첫 판매 → 온보딩 안내 1통, 다음 판매 → 건별 판매 1통(같은 휴대폰)', async () => {
    const { notifySellerVoucherSale } = await import('@/features/group-buy/api/seller-sale-notify')
    await notifySellerVoucherSale(env, DB, { sellerId: 1, productName: '정식', qty: 1, amount: 9000 })
    await notifySellerVoucherSale(env, DB, { sellerId: 1, productName: '정식', qty: 2, amount: 18000 })
    const m = bodies()
    expect(m).toHaveLength(2)
    expect(m[0].to).toBe('01011112222')
    expect(m[0].text).toContain('첫 이용권이 팔렸어요')
    expect(m[1].text).toContain('이용권 판매')
    expect(m[1].text).not.toContain('첫 이용권')
  })
  it('동시 두 건이어도 첫 판매 안내는 한 통', async () => {
    const { notifySellerVoucherSale } = await import('@/features/group-buy/api/seller-sale-notify')
    await Promise.all([1, 2].map(() => notifySellerVoucherSale(env, DB, { sellerId: 1, productName: '정식', qty: 1, amount: 9000 })))
    expect(bodies().filter(m => String(m.text).includes('첫 이용권'))).toHaveLength(1)
  })
  it('휴대폰이 없으면 보내지 않고 첫 판매 표시도 안 남긴다', async () => {
    const { notifySellerVoucherSale } = await import('@/features/group-buy/api/seller-sale-notify')
    await notifySellerVoucherSale(env, DB, { sellerId: 3, productName: 'x', qty: 1, amount: 1 })
    expect(fetchMock).not.toHaveBeenCalled()
    expect((raw.prepare('SELECT first_voucher_notified f FROM sellers WHERE id=3').get() as { f: number }).f).toBe(0)
  })
  it('첫 판매 문구에 옛 모델(식권·매장 전용 링크·7일 자동송금)이 없다', async () => {
    const src = readFileSync('src/features/group-buy/api/helpers.ts', 'utf8')
    const i = src.indexOf('첫 이용권이 팔렸어요')
    const block = src.slice(i, src.indexOf('문의: 유어딜 고객센터', i))
    expect(i).toBeGreaterThan(0)
    expect(block).not.toMatch(/식권|7일 후|store\/stats/)
  })
})

describe('③ 승인 = 등록증 확인', () => {
  it('사본 있고 대기면 verified, 반려·사본 없음은 그대로', async () => {
    raw.exec(`UPDATE sellers SET business_registration_image_url='/api/media/uploads/biz-cert/a', business_registration_status='pending' WHERE id=1;
      UPDATE sellers SET business_registration_image_url='/api/media/uploads/biz-cert/b', business_registration_status='rejected' WHERE id=2;
      UPDATE sellers SET business_registration_status='pending' WHERE id=3;`)
    const { markCertVerifiedOnApproval } = await import('@/features/admin/api/admin-sellers/seller-decision-notify')
    const dbx = DB as unknown as Parameters<typeof markCertVerifiedOnApproval>[0]
    expect(await markCertVerifiedOnApproval(dbx, 1)).toBe(true)
    expect(await markCertVerifiedOnApproval(dbx, 2)).toBe(false)
    expect(await markCertVerifiedOnApproval(dbx, 3)).toBe(false)
    const st = raw.prepare('SELECT id, business_registration_status s FROM sellers ORDER BY id').all() as { s: string }[]
    expect(st.map(r => r.s)).toEqual(['verified', 'rejected', 'pending'])
  })
})

describe('④ 배선', () => {
  const read = (p: string) => readFileSync(p, 'utf8')
  it('딜·카드·장바구니 셋이 같은 판매 알림 함수를 부른다', () => {
    const gb = read('src/features/group-buy/api/group-buy.routes.ts')
    expect(gb.match(/notifySellerVoucherSale\(c\.env, DB, \{/g)?.length).toBe(2)
    expect(read('src/features/group-buy/api/cart-checkout.routes.ts')).toMatch(/await notifySellerVoucherSale\(c\.env, DB, \{ sellerId: sid/)
  })
  it('존재하지 않는 sellers.store_owner_token 을 조회하지 않는다', () => {
    expect(read('src/features/group-buy/api/group-buy.routes.ts')).not.toMatch(/store_owner_token FROM sellers/)
  })
  it('사용 알림·승인 알림톡·등록증 알림톡이 SSOT 로 번호를 고른다', () => {
    expect(read('src/features/group-buy/api/group-buy-voucher.routes.ts')).toMatch(/const sellerRow = await resolveSellerNotifyTarget\(DB, merchantId\)/)
    const ad = read('src/features/admin/api/admin-sellers.routes.ts')
    expect(ad).toMatch(/m\.sendSellerApprovalAlimtalk\(c\.env, DB, sellerId, isReactivation\)/)
    expect(ad).toMatch(/m\.markCertVerifiedOnApproval\(DB, sellerId\)/)
    expect(ad).toMatch(/resolveSellerNotifyTarget\(env\.DB as unknown as globalThis\.D1Database, sellerId\)\)\?\.phone/)
    expect(ad).not.toMatch(/'SELECT name, phone FROM sellers WHERE id = \?'/)
  })
  it('반려가 위임 운영자에게도 사유와 함께 간다', () => {
    expect(read('src/features/admin/api/admin-sellers.routes.ts')).toMatch(/m\.notifyStoreOperatorsRejected\(DB, sellerId, linkedUserId, reason\)/)
  })
  it('손님 셀프 취소가 사장님 벨을 남긴다', () => {
    expect(read('src/features/group-buy/api/group-buy-voucher.routes.ts')).toMatch(/'voucher_cancelled'/)
  })
})

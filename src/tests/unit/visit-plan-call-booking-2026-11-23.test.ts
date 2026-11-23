/**
 * 📞 전화 예약형 이용권 1단계 (2026-11-23 대표 *"응 다 해줘"*) — `worker/utils/visit-plan.ts`
 *
 * 규칙을 **실제 함수 + 진짜 SQLite** 로 돌린다:
 *   ① 손님 번호는 동의 + 방문 다음 날까지만  ② 사장님은 동의를 못 바꾼다  ③ 날짜가 바뀌면 전날 알림이 다시 간다
 *   ④ 전날 알림은 한 번만 · 사용한 이용권엔 안 간다  ⑤ 전화 예약형이 팔렸을 때만 사장님 알림
 * + 배선(라우트 소유권·마운트·cron·화면).
 * ⚠️ 못 막는 것: 라우트의 인증 미들웨어 자체(다른 시험 몫) · 화면이 보기 좋은지 · 상세 페이지 사전 안내(잠금 파일 — 별도).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import {
  addDays, ensureVisitPlanTable, isCallBookingProduct, isVisitTime, phoneVisible, readVisitPlan, saveVisitPlan,
  visitDateError, visitWhenLabel,
} from '@/worker/utils/visit-plan'
import { runVisitEveReminder } from '@/worker/cron/visit-eve-reminder'
import { notifyCallBookingSale } from '@/features/group-buy/api/seller-sale-notify'
import { buildDetailMeta } from '@/features/group-buy/api/detail-meta-enrich'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => { const r = db.prepare(sql).run(...(binds as never[])); return { meta: { changes: Number(r.changes) } } },
    }
    return self
  }
  return { prepare: stmt } as unknown as D1Database
}

async function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, name TEXT, restaurant_name TEXT)')
  db.exec('CREATE TABLE product_supply_meta (product_id INTEGER, key TEXT, value TEXT, PRIMARY KEY (product_id, key))')
  db.exec("CREATE TABLE vouchers (id INTEGER PRIMARY KEY, product_id INTEGER, user_id TEXT, code TEXT, status TEXT DEFAULT 'unused')")
  db.exec("CREATE TABLE notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, user_type TEXT, type TEXT, title TEXT, message TEXT, link TEXT, created_at TEXT)")
  db.exec("CREATE TABLE dashboard_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_type TEXT, recipient_id TEXT, type TEXT, title TEXT, message TEXT, link TEXT)")
  db.exec("INSERT INTO products VALUES (31, 7, '필라테스 1회', '바른 필라테스'), (32, 7, '김밥 세트', '바른 필라테스')")
  db.exec("INSERT INTO product_supply_meta VALUES (31, 'call_booking', '1')")
  db.exec("INSERT INTO vouchers (id, product_id, user_id, code) VALUES (900, 31, '50', 'AAAA1111'), (901, 31, '51', 'BBBB2222')")
  const DB = d1(db)
  await ensureVisitPlanTable(DB)
  return { db, DB }
}

describe('① 손님 번호 — 동의 + 방문 다음 날까지', () => {
  const T = '2026-11-23'
  it('동의가 없으면 언제나 안 보인다(행이 없어도)', () => {
    expect(phoneVisible(null, T)).toBe(false)
    expect(phoneVisible({ sharePhone: false, visitDate: T }, T)).toBe(false)
  })
  it('동의했고 날짜가 아직 없으면 보인다(그 통화를 하려고 켠 동의)', () => {
    expect(phoneVisible({ sharePhone: true, visitDate: null }, T)).toBe(true)
  })
  it('방문 당일·다음 날까지 보이고 그 뒤엔 안 보인다', () => {
    expect(phoneVisible({ sharePhone: true, visitDate: '2026-11-23' }, T)).toBe(true)
    expect(phoneVisible({ sharePhone: true, visitDate: '2026-11-22' }, T)).toBe(true)
    expect(phoneVisible({ sharePhone: true, visitDate: '2026-11-21' }, T)).toBe(false)
  })
})

describe('입력 검증', () => {
  it('날짜: 오늘~400일 뒤만', () => {
    expect(visitDateError('2026-11-23', '2026-11-23')).toBeNull()
    expect(visitDateError('2026-11-22', '2026-11-23')).toMatch(/지난/)
    expect(visitDateError(addDays('2026-11-23', 401), '2026-11-23')).toMatch(/먼/)
    expect(visitDateError('11/30', '2026-11-23')).not.toBeNull()
    expect(visitDateError(undefined, '2026-11-23')).not.toBeNull()
  })
  it('시간: HH:MM 만', () => {
    expect(isVisitTime('14:00')).toBe(true)
    expect(isVisitTime('24:00')).toBe(false)
    expect(isVisitTime('2pm')).toBe(false)
  })
  it('사람이 읽는 날짜', () => {
    expect(visitWhenLabel('2026-11-28', '14:00')).toBe('11월 28일(토) 14:00')
    expect(visitWhenLabel('2026-11-28', null)).toBe('11월 28일(토)')
  })
})

describe('② 저장 — 넘긴 값만 바꾼다 · 사장님은 동의를 못 바꾼다', () => {
  it('손님이 동의를 켜고, 사장님이 날짜를 적어도 동의는 그대로다', async () => {
    const { DB } = await fresh()
    await saveVisitPlan(DB, 900, { sharePhone: true }, 'user')
    const p = await saveVisitPlan(DB, 900, { visitDate: '2026-12-01', visitTime: '10:30' }, 'seller')
    expect(p).toMatchObject({ visitDate: '2026-12-01', visitTime: '10:30', sharePhone: true, setBy: 'seller' })
    expect(await readVisitPlan(DB, 900)).toMatchObject({ sharePhone: true, visitDate: '2026-12-01' })
  })
  it('손님이 동의를 끄면 꺼진다 · 날짜는 그대로', async () => {
    const { DB } = await fresh()
    await saveVisitPlan(DB, 900, { visitDate: '2026-12-01', sharePhone: true }, 'user')
    const p = await saveVisitPlan(DB, 900, { sharePhone: false }, 'user')
    expect(p).toMatchObject({ sharePhone: false, visitDate: '2026-12-01' })
  })
  it('기본은 비공개(행이 처음 생길 때 동의 0)', async () => {
    const { DB } = await fresh()
    expect((await saveVisitPlan(DB, 901, { visitDate: '2026-12-05' }, 'seller')).sharePhone).toBe(false)
  })
  it('전화 예약형 판정은 메타 값이 1 일 때만', async () => {
    const { DB } = await fresh()
    expect(await isCallBookingProduct(DB, 31)).toBe(true)
    expect(await isCallBookingProduct(DB, 32)).toBe(false)
  })
})

describe('③④ 전날 알림 — 한 번만 · 날짜가 바뀌면 다시 · 사용한 이용권엔 안 간다', () => {
  const NOW = Date.parse('2026-11-23T03:00:00Z') // KST 11-23 정오
  it('내일이 방문일인 미사용 이용권에 1건, 두 번 돌려도 1건', async () => {
    const { db, DB } = await fresh()
    await saveVisitPlan(DB, 900, { visitDate: '2026-11-24', visitTime: '14:00' }, 'user')
    await saveVisitPlan(DB, 901, { visitDate: '2026-11-30' }, 'user') // 내일이 아니다
    expect((await runVisitEveReminder({ DB }, NOW)).sent).toBe(1)
    expect((await runVisitEveReminder({ DB }, NOW)).sent).toBe(0)
    const rows = db.prepare('SELECT user_id, title, message FROM notifications').all() as Array<{ user_id: string; title: string; message: string }>
    expect(rows).toHaveLength(1)
    expect(rows[0].user_id).toBe('50')
    expect(rows[0].message).toContain('11월 24일(화) 14:00')
  })
  it('날짜를 바꾸면 표시가 지워져 새 날짜 전날에 다시 간다', async () => {
    const { DB } = await fresh()
    await saveVisitPlan(DB, 900, { visitDate: '2026-11-24' }, 'user')
    await runVisitEveReminder({ DB }, NOW)
    await saveVisitPlan(DB, 900, { visitDate: '2026-11-25' }, 'user')
    expect((await runVisitEveReminder({ DB }, NOW + 86400_000)).sent).toBe(1)
  })
  it('동의만 바꾼 저장은 알림 표시를 건드리지 않는다(같은 날 두 번 안 간다)', async () => {
    const { DB } = await fresh()
    await saveVisitPlan(DB, 900, { visitDate: '2026-11-24' }, 'user')
    await runVisitEveReminder({ DB }, NOW)
    await saveVisitPlan(DB, 900, { sharePhone: true }, 'user')
    expect((await runVisitEveReminder({ DB }, NOW)).sent).toBe(0)
  })
  it('두 실행이 겹쳐도 한 번만 — 목록을 읽은 뒤 다른 실행이 먼저 찍었으면 건너뛴다', async () => {
    const { db, DB } = await fresh()
    await saveVisitPlan(DB, 900, { visitDate: '2026-11-24' }, 'user')
    // 목록 조회 직후(= 다른 실행이 먼저 선점한 순간)를 흉내 낸다.
    const racing = {
      prepare: (sql: string) => {
        const st = (DB as unknown as { prepare: (q: string) => { bind: (...a: unknown[]) => unknown; all: () => Promise<unknown> } }).prepare(sql)
        if (!sql.includes('FROM voucher_visit_plans vp')) return st
        const bound = st.bind as (...a: unknown[]) => { all: () => Promise<unknown> }
        return { bind: (...a: unknown[]) => { const b = bound(...a); return { all: async () => { const r = await b.all(); db.exec("UPDATE voucher_visit_plans SET eve_notified_at = 'x' WHERE voucher_id = 900"); return r } } } }
      },
    } as unknown as D1Database
    expect((await runVisitEveReminder({ DB: racing }, NOW)).sent).toBe(0)
    expect(db.prepare('SELECT COUNT(*) n FROM notifications').get()).toEqual({ n: 0 })
  })
  it('이미 사용한 이용권엔 안 간다', async () => {
    const { db, DB } = await fresh()
    await saveVisitPlan(DB, 900, { visitDate: '2026-11-24' }, 'user')
    db.exec("UPDATE vouchers SET status = 'used' WHERE id = 900")
    expect((await runVisitEveReminder({ DB }, NOW)).sent).toBe(0)
  })
})

describe('⑤ 판매 알림 — 전화 예약형이 팔렸을 때만', () => {
  it('전화 예약형 상품이면 사장님 대시보드 알림 1건(예약 탭으로)', async () => {
    const { db, DB } = await fresh()
    expect(await notifyCallBookingSale(DB, { sellerId: 7, productName: '필라테스 1회' })).toBe(true)
    const n = db.prepare('SELECT recipient_id, type, link FROM dashboard_notifications').all() as Array<{ recipient_id: string; type: string; link: string }>
    expect(n).toEqual([{ recipient_id: '7', type: 'call_booking_sold', link: '/seller/bookings?tab=call' }])
  })
  it('그 밖의 이용권·다른 매장이면 안 보낸다', async () => {
    const { db, DB } = await fresh()
    expect(await notifyCallBookingSale(DB, { sellerId: 7, productName: '김밥 세트' })).toBe(false)
    expect(await notifyCallBookingSale(DB, { sellerId: 8, productName: '필라테스 1회' })).toBe(false)
    expect(db.prepare('SELECT COUNT(*) n FROM dashboard_notifications').get()).toEqual({ n: 0 })
  })
})

describe('배선', () => {
  const routes = readFileSync('src/features/visit-plans/api/visit-plans.routes.ts', 'utf8')
  it('라우트가 마운트돼 있고 cron 이 등록돼 있다', () => {
    expect(readFileSync('src/worker/index.ts', 'utf8')).toMatch(/app\.route\('\/api', visitPlanRoutes\)/)
    expect(readFileSync('src/worker/scheduled.ts', 'utf8')).toMatch(/slotCron\('40 9 \* \* \*'\)\('visit-eve-reminder'/)
  })
  it('사장님 목록은 phoneVisible 을 통과한 행에만 번호를 싣는다', () => {
    expect(routes).toMatch(/const show = phoneVisible\(\{ sharePhone: r\.share_phone === 1, visitDate: r\.visit_date \}, today\)/)
    expect(routes).toMatch(/buyer_phone: show \? r\.buyer_phone : null/)
  })
  it('사장님 쓰기는 자기 상품일 때만 · 손님 쓰기는 자기 이용권일 때만', () => {
    expect(routes).toMatch(/String\(v\.seller_id\) !== String\(user\.id\)\) return c\.json\(\{ success: false, error: '해당 이용권의 권한이 없습니다\.' \}, 403\)/)
    expect(routes).toMatch(/WHERE v\.code = \? AND v\.user_id = \?/)
    expect(routes).toMatch(/saveVisitPlan\(DB, voucherId, when, 'seller'\)/) // 동의를 넘기지 않는다
  })
  it('판매 알림 SSOT 가 전화 예약형 알림을 부른다', () => {
    expect(readFileSync('src/features/group-buy/api/seller-sale-notify.ts', 'utf8')).toMatch(/await notifyCallBookingSale\(DB, sale\)\.catch/)
  })
  it('화면: 지갑·결제 완료가 블록을 쓰고, 등록·목록·예약 관리에 길이 있다', () => {
    expect(readFileSync('src/pages/my-vouchers/QRModal.tsx', 'utf8')).toMatch(/<CallBookingBlock code=\{voucher\.code\}/)
    expect(readFileSync('src/pages/group-buy/PaymentCompleteTicket.tsx', 'utf8')).toMatch(/<CallBookingBlock code=\{issued\.code\}/)
    expect(readFileSync('src/pages/seller-meal-voucher/booking-submit.ts', 'utf8')).toMatch(/form\.booking_mode === 'call'/)
    expect(readFileSync('src/pages/seller-group-buy/VoucherRow.tsx', 'utf8')).toMatch(/<CallBookingToggle productId=\{v\.id\} \/>/)
    expect(readFileSync('src/pages/SellerBookingsPage.tsx', 'utf8')).toMatch(/tab === 'call' \? <CallBookingsPanel \/>/)
    expect(readFileSync('src/pages/store-new/FirstVoucherPage.tsx', 'utf8')).toMatch(/if \(callBooking && newId > 0\)/)
  })
})

describe('⑥ 구매 전 안내 — 상세 응답과 화면 (2026-11-23 대표 허가, 잠금 파일에 값 하나)', () => {
  it('메타가 1 이면 call_booking true, 아니면 false(실제 함수)', async () => {
    const { DB } = await fresh()
    const on = await buildDetailMeta(DB, 31, new Map([[31, { call_booking: '1' }]]), null)
    const off = await buildDetailMeta(DB, 32, new Map([[32, {}]]), null)
    expect(on.call_booking).toBe(true)
    expect(off.call_booking).toBe(false)
  })
  it('상세 응답은 켠 이용권에만 키를 싣는다', () => {
    expect(readFileSync('src/features/group-buy/api/group-buy-public.routes.ts', 'utf8')).toMatch(/\.\.\.\(call_booking \? \{ call_booking: true \} : \{\}\)/)
  })
  it('상세 화면이 값을 이용 안내로 넘기고, 이용 안내가 그 줄을 그린다', () => {
    expect(readFileSync('src/pages/GroupBuyDetailPage.tsx', 'utf8')).toMatch(/callBooking=\{\(detail as \{ call_booking\?: boolean \}\)\.call_booking\}/)
    expect(readFileSync('src/pages/group-buy/UsageGuide.tsx', 'utf8')).toMatch(/\{callBooking && \(/)
  })
})

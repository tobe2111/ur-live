/**
 * 🏠 생활 견적(숨고식) — 참여권 원장 · 선착순 · 매칭 (2026-10-24, 결재 `docs/decisions/2026-10-24-home-service-quotes.md`)
 *
 * 참여권은 카드로 충전하는 **돈**이다. 그래서 문자열 검사가 아니라 **실제 SQLite 에 넣고 돌려** 잰다:
 *  - 같은 결제·같은 반환이 두 번 와도 잔액은 한 번만 움직이는가(원장 UNIQUE + changes() 게이트)
 *  - 자리가 다 찼거나 참여권이 없으면 **아무것도 안 빠지는가**(돈만 빠지고 자리를 못 얻는 경우 0)
 *  - 고른 견적은 돌려주지 않는가
 *  - 요청이 맞는 사장님(카테고리 + 지역 + 판매 승인)에게만 가는가
 *
 * ⚠️ 못 보는 것: D1 batch 의 실제 트랜잭션 의미(여기선 BEGIN/COMMIT 으로 흉내 낸다) · 토스 승인 ·
 *   알림톡이 실제로 나가는지 — 그건 STAGING_CHECKLIST S-HOME 이 본다.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readCode } from '../helpers/source-text'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as {
  DatabaseSync: new (p: string) => {
    exec: (sql: string) => void
    prepare: (sql: string) => {
      run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }
      get: (...a: never[]) => unknown
      all: (...a: never[]) => unknown[]
    }
  }
}
import {
  HS_TABLES_SQL, MATCH_PROS_SQL, OPEN_REQUESTS_FOR_PRO_SQL, chooseQuoteAtomic, creditAdd, creditBalance, refundAllQuotes, refundQuote, sendHouseQuoteAtomic, sendQuoteAtomic,
} from '@/features/home-service/api/home-service-db'
import { validateRequest, MAX_QUOTES_PER_REQUEST, parseCreditPackages, DEFAULT_CREDIT_PACKAGES } from '@/shared/home-service'
import { parseRegionFromAddress } from '@/shared/constants/region-slugs'

type Raw = InstanceType<typeof DatabaseSync>
function makeD1(): { DB: D1Database; raw: Raw } {
  const raw = new DatabaseSync(':memory:')
  const stmt = (sql: string) => {
    let args: unknown[] = []
    const api = {
      sql,
      get args() { return args },
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => {
        const r = raw.prepare(sql).run(...(args as never[]))
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
      first: async () => { const r = raw.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: raw.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  const DB = {
    prepare: stmt,
    // D1 batch = 한 트랜잭션. 같은 연결에서 차례로 → changes() 가 바로 앞 문장을 본다.
    batch: async (list: ReturnType<typeof stmt>[]) => {
      raw.exec('BEGIN')
      try {
        const out = list.map((s) => {
          const r = raw.prepare(s.sql).run(...(s.args as never[]))
          return { meta: { changes: Number(r.changes) } }
        })
        raw.exec('COMMIT')
        return out
      } catch (e) { raw.exec('ROLLBACK'); throw e }
    },
  } as unknown as D1Database
  raw.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT, phone TEXT, name TEXT, business_name TEXT)`)
  for (const s of HS_TABLES_SQL) raw.exec(s)
  return { DB, raw }
}

function addRequest(raw: Raw, o: Partial<Record<string, unknown>> = {}): number {
  const r = raw.prepare(
    `INSERT INTO home_service_requests (user_id, category, details, summary, sido, sigungu, sido2, sigungu2, desired_date, contact_phone, max_quotes)
     VALUES (?, ?, '{}', 's', ?, ?, ?, ?, ?, '01012345678', ?)`,
  ).run(...([o.user ?? 1, o.category ?? 'move', o.sido ?? '서울', o.sigungu ?? '강남구', o.sido2 ?? null, o.sigungu2 ?? null, o.date ?? '2099-01-01', o.max ?? MAX_QUOTES_PER_REQUEST] as never[]))
  return Number(r.lastInsertRowid)
}
function addPro(raw: Raw, id: number, o: { status?: string; cats?: string[]; areas?: [string, string][]; active?: number } = {}) {
  raw.prepare(`INSERT INTO sellers (id, status, phone, name) VALUES (?, ?, '01099998888', ?)`).run(...([id, o.status ?? 'approved', `pro${id}`] as never[]))
  raw.prepare(`INSERT INTO home_service_pros (seller_id, active) VALUES (?, ?)`).run(...([id, o.active ?? 1] as never[]))
  for (const c of o.cats ?? ['move']) raw.prepare(`INSERT INTO home_service_pro_categories VALUES (?, ?)`).run(...([id, c] as never[]))
  for (const [s, g] of o.areas ?? [['서울', '강남구']]) raw.prepare(`INSERT INTO home_service_pro_areas VALUES (?, ?, ?)`).run(...([id, s, g] as never[]))
}

let DB: D1Database, raw: Raw
beforeEach(() => { ({ DB, raw } = makeD1()) })

describe('💸 참여권 원장 — 같은 일은 한 번만', () => {
  it('같은 결제(ref)로 두 번 지급해도 잔액은 한 번만 오른다', async () => {
    expect(await creditAdd(DB, 7, 'charge', 5, 'pay:abc', 5000)).toBe(true)
    expect(await creditAdd(DB, 7, 'charge', 5, 'pay:abc', 5000)).toBe(false)
    expect(await creditBalance(DB, 7)).toBe(5)
    expect((raw.prepare(`SELECT COUNT(*) n FROM home_service_credit_tx`).get() as { n: number }).n).toBe(1)
  })
  it('가입 무료 참여권은 몇 번을 줘도 한 번', async () => {
    await creditAdd(DB, 7, 'grant', 3, 'signup:7')
    await creditAdd(DB, 7, 'grant', 3, 'signup:7')
    expect(await creditBalance(DB, 7)).toBe(3)
  })
})

describe('🏁 견적 보내기 — 차감·자리·견적이 한 번에', () => {
  it('참여권이 없으면 자리도 안 가져가고 아무것도 안 생긴다', async () => {
    addPro(raw, 1); const rid = addRequest(raw)
    const r = await sendQuoteAtomic(DB, rid, 1, null, '안녕하세요')
    expect(r).toEqual({ ok: false, reason: 'no_credit' })
    expect((raw.prepare(`SELECT quote_count FROM home_service_requests WHERE id = ?`).get(...([rid] as never[])) as { quote_count: number }).quote_count).toBe(0)
    expect((raw.prepare(`SELECT COUNT(*) n FROM home_service_quotes`).get() as { n: number }).n).toBe(0)
  })
  it('정상이면 1장 빠지고 자리 1개·견적 1줄·원장 spend 1줄', async () => {
    addPro(raw, 1); const rid = addRequest(raw); await creditAdd(DB, 1, 'grant', 3, 'signup:1')
    const r = await sendQuoteAtomic(DB, rid, 1, 450000, '포장이사 가능합니다')
    expect(r.ok).toBe(true)
    expect(await creditBalance(DB, 1)).toBe(2)
    expect((raw.prepare(`SELECT COUNT(*) n FROM home_service_credit_tx WHERE kind='spend'`).get() as { n: number }).n).toBe(1)
  })
  it('같은 사장님이 두 번 보내면 두 번째는 차감 없이 already', async () => {
    addPro(raw, 1); const rid = addRequest(raw); await creditAdd(DB, 1, 'grant', 3, 'signup:1')
    await sendQuoteAtomic(DB, rid, 1, null, '첫 견적입니다')
    expect(await sendQuoteAtomic(DB, rid, 1, null, '두 번째 견적')).toEqual({ ok: false, reason: 'already' })
    expect(await creditBalance(DB, 1)).toBe(2)
  })
  it(`선착순 ${MAX_QUOTES_PER_REQUEST}명 — 그 다음 사장님은 full 이고 참여권이 그대로다`, async () => {
    const rid = addRequest(raw)
    for (let i = 1; i <= MAX_QUOTES_PER_REQUEST + 1; i++) { addPro(raw, i); await creditAdd(DB, i, 'grant', 3, `signup:${i}`) }
    for (let i = 1; i <= MAX_QUOTES_PER_REQUEST; i++) expect((await sendQuoteAtomic(DB, rid, i, null, '견적 드립니다')).ok).toBe(true)
    expect(await sendQuoteAtomic(DB, rid, MAX_QUOTES_PER_REQUEST + 1, null, '늦은 견적')).toEqual({ ok: false, reason: 'full' })
    expect(await creditBalance(DB, MAX_QUOTES_PER_REQUEST + 1)).toBe(3)
  })
  it('닫힌 요청엔 못 보내고 차감도 없다', async () => {
    addPro(raw, 1); const rid = addRequest(raw); await creditAdd(DB, 1, 'grant', 3, 'signup:1')
    raw.prepare(`UPDATE home_service_requests SET status='cancelled'`).run()
    expect(await sendQuoteAtomic(DB, rid, 1, null, '견적입니다')).toEqual({ ok: false, reason: 'closed' })
    expect(await creditBalance(DB, 1)).toBe(3)
  })
})

describe('↩️ 반환', () => {
  it('보낸 견적은 한 번만 돌려준다(두 번 불러도 +1)', async () => {
    addPro(raw, 1); const rid = addRequest(raw); await creditAdd(DB, 1, 'grant', 3, 'signup:1')
    const r = await sendQuoteAtomic(DB, rid, 1, null, '견적입니다'); if (!r.ok) throw new Error('x')
    expect(await refundQuote(DB, r.quoteId, 1, '취소')).toBe(true)
    expect(await refundQuote(DB, r.quoteId, 1, '취소')).toBe(false)
    expect(await refundAllQuotes(DB, rid, '취소')).toBe(0)
    expect(await creditBalance(DB, 1)).toBe(3)
  })
  it('손님이 고른 견적은 돌려주지 않는다(손님을 실제로 받았다)', async () => {
    addPro(raw, 1); const rid = addRequest(raw); await creditAdd(DB, 1, 'grant', 3, 'signup:1')
    const r = await sendQuoteAtomic(DB, rid, 1, null, '견적입니다'); if (!r.ok) throw new Error('x')
    raw.prepare(`UPDATE home_service_quotes SET status='chosen'`).run()
    expect(await refundAllQuotes(DB, rid, '만료')).toBe(0)
    // 목록 반환만 보면 'sent' 만 고르는 SELECT 가 막아 줘서, 반환 함수 자체가 chosen 을 돌려줘도 모른다.
    expect(await refundQuote(DB, r.quoteId, 1, '직접 호출')).toBe(false)
    expect(await creditBalance(DB, 1)).toBe(2)
  })
})

describe('🏢 유어딜 직영 견적 · 대리 접수 (2026-10-24 대표 "실제 손님 있어. 두 기능 모두 만들어줘")', () => {
  const HOUSE = 900
  it('직영 견적은 참여권 없이 자리 하나를 차지하고 is_house=1 로 남는다', async () => {
    const rid = addRequest(raw)
    const r = await sendHouseQuoteAtomic(DB, rid, HOUSE, 390000, '유어딜이 직접 해 드립니다')
    expect(r.ok).toBe(true)
    expect((raw.prepare(`SELECT quote_count FROM home_service_requests WHERE id = ?`).get(...([rid] as never[])) as { quote_count: number }).quote_count).toBe(1)
    expect((raw.prepare(`SELECT is_house FROM home_service_quotes`).get() as { is_house: number }).is_house).toBe(1)
    expect((raw.prepare(`SELECT COUNT(*) n FROM home_service_credit_tx`).get() as { n: number }).n).toBe(0)
  })
  it('두 번 보내면 already · 다 찼으면 full · 닫혔으면 closed', async () => {
    const rid = addRequest(raw)
    await sendHouseQuoteAtomic(DB, rid, HOUSE, null, '첫 견적입니다')
    expect(await sendHouseQuoteAtomic(DB, rid, HOUSE, null, '또 보냄')).toEqual({ ok: false, reason: 'already' })
    const full = addRequest(raw, { max: 1 })
    addPro(raw, 1); await creditAdd(DB, 1, 'grant', 3, 'signup:1')
    expect((await sendQuoteAtomic(DB, full, 1, null, '견적입니다')).ok).toBe(true)
    expect(await sendHouseQuoteAtomic(DB, full, HOUSE, null, '늦은 직영')).toEqual({ ok: false, reason: 'full' })
    const closed = addRequest(raw); raw.prepare(`UPDATE home_service_requests SET status='cancelled' WHERE id = ?`).run(...([closed] as never[]))
    expect(await sendHouseQuoteAtomic(DB, closed, HOUSE, null, '닫힌 요청')).toEqual({ ok: false, reason: 'closed' })
  })
  it('반환은 직영 견적을 건너뛴다 — 쓴 적 없는 참여권을 만들지 않는다', async () => {
    const rid = addRequest(raw)
    const h = await sendHouseQuoteAtomic(DB, rid, HOUSE, null, '직영 견적입니다'); if (!h.ok) throw new Error('x')
    expect(await refundQuote(DB, h.quoteId, HOUSE, '직접 호출')).toBe(false)
    expect(await refundAllQuotes(DB, rid, '취소')).toBe(0)
    expect(await creditBalance(DB, HOUSE)).toBe(0)
  })
  it('운영팀 대리 선택은 source=admin 요청에서만 통한다', async () => {
    addPro(raw, 1); await creditAdd(DB, 1, 'grant', 3, 'signup:1')
    const mine = addRequest(raw, { user: 5 })
    const q1 = await sendQuoteAtomic(DB, mine, 1, null, '견적입니다'); if (!q1.ok) throw new Error('x')
    expect(await chooseQuoteAtomic(DB, mine, q1.quoteId, 0, true)).toBe(false)
    expect(await chooseQuoteAtomic(DB, mine, q1.quoteId, 99, false)).toBe(false)
    expect(await chooseQuoteAtomic(DB, mine, q1.quoteId, 5, false)).toBe(true)
    expect(await chooseQuoteAtomic(DB, mine, q1.quoteId, 5, false)).toBe(false)

    const proxy = addRequest(raw, { user: 0 })
    raw.prepare(`UPDATE home_service_requests SET source='admin' WHERE id = ?`).run(...([proxy] as never[]))
    const h = await sendHouseQuoteAtomic(DB, proxy, HOUSE, 380000, '직영'); if (!h.ok) throw new Error('x')
    expect(await chooseQuoteAtomic(DB, proxy, h.quoteId, 0, true)).toBe(true)
    expect((raw.prepare(`SELECT status FROM home_service_quotes WHERE id = ?`).get(...([h.quoteId] as never[])) as { status: string }).status).toBe('chosen')
  })
  it('대리 접수 라우트는 운영팀 인증 + 손님 동의 기록이 필수다', () => {
    const src = readCode('src/features/home-service/api/home-service-admin.routes.ts')
    expect(src).toMatch(/homeServiceAdminRoutes\.use\('\*', requireAdmin\(\)\)/)
    expect(src).toMatch(/consent_note/)
    expect(src).toMatch(/source, created_by_admin, consent_note|'admin'/)
  })
})

describe('🎯 매칭 — 맞는 사장님에게만', () => {
  async function match(rid: number) {
    const q = raw.prepare(`SELECT * FROM home_service_requests WHERE id = ?`).get(...([rid] as never[])) as Record<string, unknown>
    const { results } = await DB.prepare(MATCH_PROS_SQL).bind(q.category, q.sido, q.sigungu, q.sido2, q.sido2, q.sigungu2, rid, 30).all<{ seller_id: number }>()
    return (results ?? []).map((r) => r.seller_id).sort()
  }
  it('카테고리·시군구 일치 + 시/도 전체 + 도착지 일치는 받고, 다른 구·다른 일·미승인·비활성은 안 받는다', async () => {
    addPro(raw, 1)                                                // 서울 강남구 이사 ✅
    addPro(raw, 2, { areas: [['서울', '']] })                     // 서울 전체 ✅
    addPro(raw, 3, { areas: [['경기', '화성시']] })                // 도착지 ✅
    addPro(raw, 4, { areas: [['서울', '서초구']] })                // 다른 구 ❌
    addPro(raw, 5, { cats: ['aircon_clean'] })                    // 다른 일 ❌
    addPro(raw, 6, { status: 'pending' })                         // 심사 중 ❌
    addPro(raw, 7, { active: 0 })                                 // 꺼 둠 ❌
    const rid = addRequest(raw, { sido2: '경기', sigungu2: '화성시' })
    expect(await match(rid)).toEqual([1, 2, 3])
  })
  it('이미 알림을 보낸 사장님은 다시 고르지 않는다', async () => {
    addPro(raw, 1); const rid = addRequest(raw)
    raw.prepare(`INSERT INTO home_service_dispatch (request_id, seller_id) VALUES (?, 1)`).run(...([rid] as never[]))
    expect(await match(rid)).toEqual([])
  })
  it('보관된 요청 — 날짜 지난 것은 사장님 요청함에 안 뜬다', async () => {
    addPro(raw, 1)
    const ok = addRequest(raw, { date: '2099-01-01' }); addRequest(raw, { date: '2000-01-01' })
    const { results } = await DB.prepare(OPEN_REQUESTS_FOR_PRO_SQL).bind(1, '2026-10-24', '', 1, 1, 50).all<{ id: number }>()
    expect((results ?? []).map((r) => r.id)).toEqual([ok])
  })
})

describe('📝 요청서 검증', () => {
  const parse = (s: string) => { const r = parseRegionFromAddress(s); return r ? { sido: r.sido, sigungu: r.sigungu } : null }
  const base = { from: '서울 강남구 역삼동', to: '경기 화성시 동탄동', date: '2099-01-01', size: '투룸', kind: '포장이사', elevator: '둘 다 있음' }
  it('정상 — 지역 둘을 뽑는다', () => {
    const v = validateRequest('move', base, parse, '2026-10-24')
    expect(v.ok && v.value.regions.map((r) => `${r.sido} ${r.sigungu}`)).toEqual(['서울 강남구', '경기 화성시'])
  })
  it('🔒 번지·호수가 와도 동까지만 남긴다(사장님은 고르기 전 이 글만 본다)', () => {
    const v = validateRequest('move', { ...base, from: '서울 강남구 역삼동 123-45 101호' }, parse, '2026-10-24')
    expect(v.ok && v.value.details.from).toBe('서울 강남구 역삼동')
  })
  it('시·구가 없는 지역 · 지난 날짜 · 없는 선택지는 거절', () => {
    expect(validateRequest('move', { ...base, from: '서울' }, parse, '2026-10-24').ok).toBe(false)
    expect(validateRequest('move', { ...base, date: '2020-01-01' }, parse, '2026-10-24').ok).toBe(false)
    expect(validateRequest('move', { ...base, size: '대저택' }, parse, '2026-10-24').ok).toBe(false)
    expect(validateRequest('nope', base, parse, '2026-10-24').ok).toBe(false)
  })
  it('묶음 설정이 깨져 있으면 기본 묶음 — 충전이 통째로 막히지 않는다', () => {
    expect(parseCreditPackages('not json')).toEqual([...DEFAULT_CREDIT_PACKAGES])
    expect(parseCreditPackages('[{"key":"p5","credits":5,"price":5500}]')[0].price).toBe(5500)
  })
})

describe('💳 충전 경로 — 토스 SSOT · 게이트 · 남의 주문 차단', () => {
  const src = readCode('src/features/home-service/api/home-service-pro.routes.ts')
  it('승인은 confirmTossPayment 만 — 토스 주소를 직접 부르지 않는다', () => {
    expect(src).toMatch(/confirmTossPayment\(\{/)
    expect(src).not.toMatch(/api\.tosspayments\.com/)
  })
  it('충전 시작은 home_service_charge_enabled 가 true 일 때만', () => {
    const charge = src.slice(src.indexOf("'/credits/charge'"), src.indexOf("'/credits/confirm'"))
    expect(charge).toMatch(/home_service_charge_enabled'\)\) !== 'true'/)
  })
  it('승인 때 주문번호의 매장과 요청자가 같아야 하고, 금액은 서버 묶음 가격이다', () => {
    const confirm = src.slice(src.indexOf("'/credits/confirm'"))
    expect(confirm).toMatch(/parsed\.sellerId !== sid/)
    expect(confirm).toMatch(/Number\(body\.amount\) !== pkg\.price/)
    expect(confirm).toMatch(/amount: pkg\.price/)
  })
})

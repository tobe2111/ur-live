/**
 * 🏠 생활 견적 개선 넷 (2026-10-25 대표 "모두 개선해줘").
 *
 * 지키는 것:
 *  - 📷 요청서 사진은 **우리 업로드 주소 + 그 손님 것**만(남의 사진·외부 주소를 업체 화면에 못 띄운다), 5장까지.
 *  - 🎟️ 참여권 장수는 카테고리별(기본 1장) — 차감한 만큼 **견적에 남기고** 반환은 그 장수만큼.
 *    잔액이 모자라면 아무것도 안 빠진다. 값이 바뀌어도 이미 보낸 견적의 반환은 그때 쓴 장수.
 *  - 🧑‍🔧 업체 수 — 승인·켜 둔 업체만 세고, 제휴 업체 카테고리는 최소 1.
 *  - 📝 큰 공사(간판·인테리어)에만 계약 안내.
 *
 * ⚠️ 못 보는 것: 실제 업로드(R2) · 사진 시트 화면 · 장수 **값**(결재 대기 — 이 시험은 장치만 본다).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import { readCode } from '../helpers/source-text'
import {
  HS_TABLES_SQL, creditAdd, creditBalance, proCountsByCategory, refundQuote, sendQuoteAtomic,
} from '@/features/home-service/api/home-service-db'
import {
  HOME_SERVICE_CATEGORIES, MAX_CREDIT_COST, MAX_REQUEST_PHOTOS, categoryDef, creditCostFor, isRequestPhotoUrl,
  parseCreditCosts, photosOwnedBy, validateRequest,
} from '@/shared/home-service'
import { parseRegionFromAddress } from '@/shared/constants/region-slugs'

type Raw = { exec(s: string): void; prepare(s: string): { run(...a: never[]): { changes: number | bigint }; get(...a: never[]): unknown; all(...a: never[]): unknown[] } }
const req = createRequire(import.meta.url)

function makeD1(): { DB: D1Database; raw: Raw } {
  const { DatabaseSync } = req('node:sqlite') as { DatabaseSync: new (p: string) => Raw }
  const raw = new DatabaseSync(':memory:')
  const stmt = (sql: string, args: unknown[] = []) => ({
    sql, args,
    bind: (...a: unknown[]) => stmt(sql, a),
    run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...(args as never[])).changes) } }),
    first: async () => raw.prepare(sql).get(...(args as never[])) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...(args as never[])) }),
  })
  const DB = {
    prepare: (sql: string) => stmt(sql),
    batch: async (list: { sql: string; args: unknown[] }[]) => {
      raw.exec('BEGIN')
      try {
        const out = list.map((x) => ({ meta: { changes: Number(raw.prepare(x.sql).run(...(x.args as never[])).changes) } }))
        raw.exec('COMMIT'); return out
      } catch (e) { raw.exec('ROLLBACK'); throw e }
    },
  } as unknown as D1Database
  raw.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT, phone TEXT, name TEXT, business_name TEXT)`)
  raw.exec(`CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`)
  for (const s of HS_TABLES_SQL) raw.exec(s)
  return { DB, raw }
}

function addRequest(raw: Raw, category: string, sido = '부산', sigungu = '금정구'): number {
  raw.prepare(
    `INSERT INTO home_service_requests (user_id, category, details, summary, sido, sigungu, desired_date, contact_phone)
     VALUES (1, ?, '{}', 's', ?, ?, '2099-01-01', '01012345678')`,
  ).run(...([category, sido, sigungu] as never[]))
  return Number((raw.prepare(`SELECT MAX(id) AS id FROM home_service_requests`).get() as { id: number }).id)
}

let DB: D1Database, raw: Raw
beforeEach(() => { ({ DB, raw } = makeD1()) })

const parse = (s: string) => { const r = parseRegionFromAddress(s); return r ? { sido: r.sido, sigungu: r.sigungu } : null }
const PHOTO = (uid: number, k = 'abc') => `/api/media/uploads/user/${uid}/2026-10/${k}.jpg`

function signageInput(extra: Record<string, string> = {}): Record<string, string> {
  const def = categoryDef('signage')!
  const out: Record<string, string> = {}
  for (const f of def.fields) {
    if (!f.required) continue
    if (f.type === 'region') out[f.key] = '부산 금정구 청룡동'
    else if (f.type === 'date') out[f.key] = '2099-01-01'
    else if (f.type === 'number') out[f.key] = '5'
    else if (f.type === 'select') out[f.key] = f.options![0]
    else out[f.key] = '메모'
  }
  return { ...out, ...extra }
}

describe('📷 요청서 사진', () => {
  it('간판·인테리어·수리·냉장 설비에만 사진 칸이 있고, 전부 선택 칸이다', () => {
    const withPhotos = HOME_SERVICE_CATEGORIES.filter((d) => d.fields.some((f) => f.type === 'photos')).map((d) => d.key).sort()
    expect(withPhotos).toEqual(['home_interior', 'signage', 'store_fridge', 'store_interior', 'store_repair'])
    for (const d of HOME_SERVICE_CATEGORIES) for (const f of d.fields) if (f.type === 'photos') expect(f.required).toBe(false)
  })
  it('우리 업로드 주소만 — 같은 출처 · R2 공개 도메인', () => {
    expect(isRequestPhotoUrl(PHOTO(7))).toBe(true)
    expect(isRequestPhotoUrl('https://media.ur-team.com/uploads/user/7/2026-10/AbC_9-x.webp')).toBe(true)
  })
  it('남의 역할·외부 주소·경로 탈출은 거절', () => {
    expect(isRequestPhotoUrl('/api/media/uploads/seller/7/2026-10/abc.jpg')).toBe(false)
    expect(isRequestPhotoUrl('https://evil.example/x.jpg')).toBe(false)
    expect(isRequestPhotoUrl('/api/media/uploads/user/7/2026-10/../abc.jpg')).toBe(false)
    expect(isRequestPhotoUrl('http://media.ur-team.com/uploads/user/7/2026-10/abc.jpg')).toBe(false)
    expect(isRequestPhotoUrl('javascript:alert(1)//uploads/user/7/2026-10/a.jpg')).toBe(false)
  })
  it('검증: 중복은 하나로, 5장 넘으면 거절, 이상한 주소는 거절', () => {
    const ok = validateRequest('signage', signageInput({ photos: `${PHOTO(7)},${PHOTO(7)}` }), parse, '2026-10-25')
    expect(ok.ok && ok.value.details.photos).toBe(PHOTO(7))
    const six = Array.from({ length: MAX_REQUEST_PHOTOS + 1 }, (_, i) => PHOTO(7, `k${i}`)).join(',')
    expect(validateRequest('signage', signageInput({ photos: six }), parse, '2026-10-25').ok).toBe(false)
    expect(validateRequest('signage', signageInput({ photos: 'https://evil.example/x.jpg' }), parse, '2026-10-25').ok).toBe(false)
  })
  it('소유: 이 손님 것만 — user 1 이 user 12 의 사진을 못 쓴다', () => {
    expect(photosOwnedBy({ photos: PHOTO(12) }, 12)).toBe(true)
    expect(photosOwnedBy({ photos: PHOTO(12) }, 1)).toBe(false)
    expect(photosOwnedBy({ photos: `${PHOTO(1)},${PHOTO(12)}` }, 1)).toBe(false)
    expect(photosOwnedBy({ memo: 'x' }, 1)).toBe(true)
  })
  it('접수 API 가 소유 검사를 부른다', () => {
    const src = readCode('src/features/home-service/api/home-service.routes.ts')
    expect(src).toMatch(/if \(!photosOwnedBy\(v\.value\.details, userId\)\) return c\.json\(/)
  })
})

function addOpenRequest(category = 'signage'): number {
  raw.prepare(
    `INSERT INTO home_service_requests (user_id, category, details, summary, sido, sigungu, desired_date, contact_phone)
     VALUES (1, ?, '{}', 's', '부산', '금정구', '2099-01-01', '01012345678')`,
  ).run(...([category] as never[]))
  return Number((raw.prepare(`SELECT MAX(id) AS id FROM home_service_requests`).get() as { id: number }).id)
}

describe('🎟️ 카테고리별 참여권 장수', () => {
  it('기본 1장 · 범위 밖·모르는 카테고리는 버린다', () => {
    expect(creditCostFor('signage', {})).toBe(1)
    const c = parseCreditCosts(JSON.stringify({ signage: 3, store_interior: 0, move: MAX_CREDIT_COST + 1, nope: 5, home_interior: 2.5 }))
    expect(c).toEqual({ signage: 3 })
    expect(parseCreditCosts('not json')).toEqual({})
    expect(creditCostFor('signage', c)).toBe(3)
    expect(creditCostFor('move', c)).toBe(1)
  })
  it('3장짜리 견적: 3장 빠지고 견적에 3 이 남고, 반환하면 3장 돌아온다', async () => {
    await creditAdd(DB, 9, 'grant', 5, 'g1')
    const rid = addOpenRequest()
    const r = await sendQuoteAtomic(DB, rid, 9, null, 'hi', 3)
    expect(r.ok).toBe(true)
    expect(await creditBalance(DB, 9)).toBe(2)
    const q = raw.prepare(`SELECT id, credits FROM home_service_quotes WHERE request_id = ?`).get(...([rid] as never[])) as { id: number; credits: number }
    expect(q.credits).toBe(3)
    const tx = raw.prepare(`SELECT amount FROM home_service_credit_tx WHERE kind = 'spend'`).get() as { amount: number }
    expect(tx.amount).toBe(-3)
    expect(await refundQuote(DB, q.id, 9, 'test')).toBe(true)
    expect(await creditBalance(DB, 9)).toBe(5)
    expect(await refundQuote(DB, q.id, 9, 'test')).toBe(false)
    expect(await creditBalance(DB, 9)).toBe(5)
  })
  it('잔액이 장수보다 적으면 아무것도 안 빠지고 자리도 안 차지한다', async () => {
    await creditAdd(DB, 9, 'grant', 2, 'g1')
    const rid = addOpenRequest()
    const r = await sendQuoteAtomic(DB, rid, 9, null, 'hi', 3)
    expect(r).toEqual({ ok: false, reason: 'no_credit' })
    expect(await creditBalance(DB, 9)).toBe(2)
    expect((raw.prepare(`SELECT quote_count FROM home_service_requests WHERE id = ?`).get(...([rid] as never[])) as { quote_count: number }).quote_count).toBe(0)
  })
  it('이상한 장수(0·음수·소수)는 1장으로', async () => {
    await creditAdd(DB, 9, 'grant', 5, 'g1')
    expect((await sendQuoteAtomic(DB, addOpenRequest(), 9, null, 'a', 0)).ok).toBe(true)
    expect((await sendQuoteAtomic(DB, addOpenRequest(), 9, null, 'b', -4)).ok).toBe(true)
    expect((await sendQuoteAtomic(DB, addOpenRequest(), 9, null, 'c', 1.5)).ok).toBe(true)
    expect(await creditBalance(DB, 9)).toBe(2)
  })
  it('사장님 견적 경로가 카테고리 장수를 넘긴다', () => {
    const src = readCode('src/features/home-service/api/home-service-pro.routes.ts')
    expect(src).toMatch(/sendQuoteAtomic\(DB, id, sid, price, message, cat \? creditCostFor\(cat\.category, await loadCreditCosts\(DB\)\) : 1\)/)
  })
})

describe('🧑‍🔧 카테고리별 업체 수', () => {
  it('정지 아닌·켜 둔 업체만 센다(심사 중 포함 — 2026-10-25) · 제휴 카테고리는 최소 1', async () => {
    raw.exec(`INSERT INTO sellers (id, status) VALUES (1, 'approved'), (2, 'suspended'), (3, 'approved'), (4, 'pending')`)
    raw.exec(`INSERT INTO home_service_pros (seller_id, active) VALUES (1, 1), (2, 1), (3, 0), (4, 1)`)
    raw.exec(`INSERT INTO home_service_pro_categories (seller_id, category) VALUES (1, 'move'), (2, 'move'), (3, 'move'), (2, 'store_pest'), (4, 'move')`)
    raw.prepare(`INSERT INTO platform_settings (key, value) VALUES ('home_service_partners', ?)`).run(...([JSON.stringify({ signage: 77 })] as never[]))
    const c = await proCountsByCategory(DB)
    expect(c.move).toBe(2)
    expect(c.store_pest).toBeUndefined()
    expect(c.signage).toBe(1)
  })
})

describe('📝 큰 공사 계약 안내', () => {
  it('간판·인테리어에만', () => {
    expect(HOME_SERVICE_CATEGORIES.filter((d) => d.bigTicket).map((d) => d.key).sort()).toEqual(['home_interior', 'signage', 'store_interior'])
  })
  it('요청서와 견적 화면이 같은 안내를 쓴다', () => {
    expect(readCode('src/pages/life/LifeRequestFormPage.tsx')).toMatch(/\{def\.bigTicket && <BigTicketNote \/>\}/)
    expect(readCode('src/pages/life/LifeRequestDetailPage.tsx')).toMatch(/\?\.bigTicket && <div[^>]*><BigTicketNote \/><\/div>/)
  })
})

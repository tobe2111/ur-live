/**
 * 💬🏢📷 생활 견적 — 고르기 전 질문 · 업체 소개 페이지 · 후기 사진 · PC 화면 (2026-10-26 대표 "1,2,3 모두 진행해줘").
 *
 * 지키는 것:
 *  - 💬 질문에 전화번호·카톡 아이디를 적으면 거절(번호는 고른 뒤에만 열린다는 약속).
 *    마감·취소된 요청에는 못 쓴다 · 고른 견적은 계속 쓸 수 있다 · 견적 하나에 상한.
 *  - 🏢 업체 공개 페이지 응답에 연락처(phone)가 없다.
 *  - 📷 후기 사진은 우리 업로드 주소 + 그 손님이 올린 것만.
 *  - 🖥️ /life 와 그 아래는 PC 에서 430 액자를 벗는다.
 *
 * ⚠️ 못 보는 것: 화면 렌더 · 알림 실제 배달 · 사진 내용(사람이 숨김 처리).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readCode } from '../helpers/source-text'
import { HS_TABLES_SQL, addQuoteMessage, listQuoteMessages } from '@/features/home-service/api/home-service-db'
import { containsContact, parseChatBody } from '@/shared/home-service-chat'
import { parseReview, readReviewPhotos } from '@/shared/home-service-review'
import { isFullBleedPcPath } from '@/shared/pc-fullbleed'

type Raw = { exec(s: string): void; prepare(s: string): { run(...a: never[]): { changes: number | bigint }; get(...a: never[]): unknown; all(...a: never[]): unknown[] } }
const req = createRequire(import.meta.url)

function makeD1(): { DB: D1Database; raw: Raw } {
  const { DatabaseSync } = req('node:sqlite') as { DatabaseSync: new (p: string) => Raw }
  const raw = new DatabaseSync(':memory:')
  const stmt = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    run: async () => ({ meta: { changes: Number(raw.prepare(sql).run(...(args as never[])).changes) } }),
    first: async () => raw.prepare(sql).get(...(args as never[])) ?? null,
    all: async () => ({ results: raw.prepare(sql).all(...(args as never[])) }),
  })
  const DB = { prepare: (sql: string) => stmt(sql) } as unknown as D1Database
  raw.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT, phone TEXT, name TEXT, business_name TEXT)`)
  raw.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`)
  for (const s of HS_TABLES_SQL) raw.exec(s)
  raw.exec(`INSERT INTO home_service_requests (id, user_id, category, details, summary, sido, sigungu, desired_date, contact_phone, status)
            VALUES (1, 1, 'clean', '{}', 's', '서울', '강남구', '2026-01-01', '010', 'open'),
                   (2, 1, 'clean', '{}', 's', '서울', '강남구', '2026-01-01', '010', 'cancelled'),
                   (3, 1, 'clean', '{}', 's', '서울', '강남구', '2026-01-01', '010', 'chosen')`)
  raw.exec(`INSERT INTO home_service_quotes (id, request_id, seller_id, status) VALUES (10, 1, 7, 'sent'), (20, 2, 7, 'sent'), (30, 3, 7, 'chosen'), (31, 3, 8, 'sent')`)
  return { DB, raw }
}

describe('💬 고르기 전 질문', () => {
  it('연락처를 잡는다 — 띄어 써도 · 카톡 아이디 · 오픈채팅', () => {
    expect(containsContact('010-1234-5678 로 연락 주세요')).toBe(true)
    expect(containsContact('공일공 말고 0 1 0 1 2 3 4 5 6 7 8')).toBe(true)
    expect(containsContact('02.123.4567')).toBe(true)
    expect(containsContact('카톡 아이디 abc123')).toBe(true)
    expect(containsContact('https://open.kakao.com/o/abc')).toBe(true)
  })
  it('평범한 질문·금액·날짜는 통과', () => {
    expect(containsContact('주말에도 가능한가요? 2026-10-26 오후 3시요')).toBe(false)
    expect(containsContact('450000원에 에어컨 청소 포함인가요')).toBe(false)
    expect(parseChatBody('  주말 되나요  ')).toEqual({ ok: true, text: '주말 되나요' })
    expect(parseChatBody('').ok).toBe(false)
    expect(parseChatBody('가'.repeat(501)).ok).toBe(false)
    expect(parseChatBody('010 1234 5678').ok).toBe(false)
  })
  it('열린 요청의 견적 · 고른 견적만 쓸 수 있고 상한이 있다', async () => {
    const { DB } = makeD1()
    expect(await addQuoteMessage(DB, 10, 'customer', '주말 되나요', 60)).toBe(true)
    expect(await addQuoteMessage(DB, 20, 'customer', '취소된 요청', 60)).toBe(false)
    expect(await addQuoteMessage(DB, 30, 'pro', '고른 뒤에도 됨', 60)).toBe(true)
    expect(await addQuoteMessage(DB, 31, 'pro', '안 고른 견적은 마감', 60)).toBe(false)
    expect(await addQuoteMessage(DB, 10, 'pro', '네 됩니다', 2)).toBe(true)
    expect(await addQuoteMessage(DB, 10, 'customer', '세 번째', 2)).toBe(false)
    const list = await listQuoteMessages(DB, 10)
    expect(list.map((m) => m.sender)).toEqual(['customer', 'pro'])
  })
  it('서버 배선: 손님·사장님 둘 다 연락처 거절을 지나고, 소유자만', () => {
    const src = readCode('src/features/home-service/api/home-service-chat.ts')
    expect((src.match(/parseChatBody\(/g) || []).length).toBeGreaterThanOrEqual(2)
    expect(src).toMatch(/r\.user_id = \?|user_id = \?/)
    expect(src).toMatch(/seller_id = \?/)
    const routes = readCode('src/features/home-service/api/home-service.routes.ts')
    expect(routes.indexOf("'/requests/:id/quotes/:qid/messages'")).toBeGreaterThan(0)
  })
})

describe('🏢 업체 소개 페이지', () => {
  it('공개 응답에 연락처가 없다', () => {
    const src = readCode('src/features/home-service/api/home-service.routes.ts')
    const at = src.indexOf("homeServiceRoutes.get('/pros/:id'")
    expect(at).toBeGreaterThan(0)
    const block = src.slice(at, src.indexOf('homeServiceRoutes.get(', at + 10))
    expect(block).not.toMatch(/phone/)
    expect(block).toMatch(/PRO_OPEN_STATUS_SQL/)
    expect(readCode('src/App.tsx')).toMatch(/path="\/life\/biz\/:id"/)
  })
})

describe('📷 후기 사진', () => {
  const mine = '/api/media/uploads/user/5/2026-10/abcDEF12.jpg'
  it('그 손님이 올린 우리 주소만 · 5장까지', () => {
    expect(parseReview({ rating: 5, body: '깔끔했어요', photos: [mine] }, 5)).toEqual({ ok: true, rating: 5, text: '깔끔했어요', photos: [mine] })
    expect(parseReview({ rating: 5, body: '깔끔했어요', photos: [mine] }, 6).ok).toBe(false)               // 남의 사진
    expect(parseReview({ rating: 5, body: '깔끔했어요', photos: ['https://evil.com/a.jpg'] }, 5).ok).toBe(false)
    expect(parseReview({ rating: 5, body: '깔끔했어요', photos: Array.from({ length: 6 }, (_, i) => mine.replace('abc', `a${i}`)) }, 5).ok).toBe(false)
  })
  it('읽을 때 다시 거른다', () => {
    expect(readReviewPhotos(`${mine},javascript:alert(1)`)).toEqual([mine])
    expect(readReviewPhotos(null)).toEqual([])
  })
})

describe('🖥️ PC 화면', () => {
  it('/life 와 그 아래는 PC 에서 액자를 벗는다', () => {
    expect(isFullBleedPcPath('/life')).toBe(true)
    expect(isFullBleedPcPath('/life/requests/1')).toBe(true)
    expect(isFullBleedPcPath('/life/biz/7')).toBe(true)
    expect(isFullBleedPcPath('/lifestyle')).toBe(false)
  })
})

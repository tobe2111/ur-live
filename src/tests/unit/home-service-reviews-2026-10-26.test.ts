/**
 * ⭐ 생활 견적 후기 · 업체 소개 링크 (2026-10-26 대표 "숨고·미소 링크 · 후기 기능 만들어주고").
 *
 * 지키는 것:
 *  - 🔗 다른 곳 후기 링크는 **허용 목록**(숨고·미소·네이버·카카오맵·당근·인스타·유튜브)의 https 만.
 *    밖이면 저장을 거절한다(조용히 버리지 않는다). 읽을 때도 다시 걸러 옛 값이 화면에 안 나간다.
 *  - ⭐ 후기는 손님이 **고른 업체**에만, 요청 하나에 한 번. 남의 요청·고르기 전은 못 쓴다.
 *  - 숨긴 후기는 평균·목록에서 빠진다. 후기가 없으면 0점이 아니라 "아직 없음".
 *  - 소개·링크를 안 보낸 저장(가입 흐름)은 기존 값을 지우지 않는다.
 *
 * ⚠️ 못 보는 것: 화면 렌더 · 알림 실제 배달 · 링크 너머 페이지가 진짜 그 업체인지(사람이 판단).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readCode } from '../helpers/source-text'
import { HS_TABLES_SQL, reviewSummaries } from '@/features/home-service/api/home-service-db'
import { maskReviewer, parseProIntro, parseProLinks, parseReview, proLinkLabel, ratingText, readProLinks } from '@/shared/home-service-review'

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
  const DB = { prepare: (sql: string) => stmt(sql) } as unknown as D1Database
  raw.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, status TEXT, phone TEXT, name TEXT, business_name TEXT)`)
  raw.exec(`CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)`)
  for (const s of HS_TABLES_SQL) raw.exec(s)
  return { DB, raw }
}

/** 라우트의 후기 INSERT 를 소스에서 그대로 꺼내 돌린다(사본을 손으로 적으면 갈린다). */
function reviewInsertSql(): string {
  const src = readCode('src/features/home-service/api/home-service.routes.ts')
  const at = src.indexOf('INSERT OR IGNORE INTO home_service_reviews')
  const start = src.lastIndexOf('`', at)
  return src.slice(start + 1, src.indexOf('`', at))
}

describe('🔗 다른 곳 후기 링크', () => {
  it('허용 목록의 https 만 이름을 준다', () => {
    expect(proLinkLabel('https://soomgo.com/profile/users/123')).toBe('숨고')
    expect(proLinkLabel('https://www.miso.kr/pro/1')).toBe('미소')
    expect(proLinkLabel('https://m.place.naver.com/place/123')).toBe('네이버 플레이스')
    expect(proLinkLabel('https://place.map.kakao.com/123')).toBe('카카오맵')
    expect(proLinkLabel('http://soomgo.com/x')).toBeNull()                 // http
    expect(proLinkLabel('https://soomgo.com.evil.io/x')).toBeNull()       // 꼬리 위장
    expect(proLinkLabel('https://evilsoomgo.com/x')).toBeNull()           // 앞에 붙임
    expect(proLinkLabel('https://u:p@soomgo.com/x')).toBeNull()           // 자격 끼워 넣기
    expect(proLinkLabel('javascript:alert(1)')).toBeNull()
  })
  it('하나라도 밖이면 저장 거절 · 빈 칸·중복은 정리 · 5개까지', () => {
    expect(parseProLinks(['https://soomgo.com/a', 'https://bad.com']).ok).toBe(false)
    const ok = parseProLinks(['', 'https://soomgo.com/a', 'https://soomgo.com/a'])
    expect(ok).toEqual({ ok: true, links: ['https://soomgo.com/a'] })
    expect(parseProLinks(Array.from({ length: 6 }, (_, i) => `https://soomgo.com/${i}`)).ok).toBe(false)
  })
  it('읽을 때 다시 거른다(저장된 옛 값이 허용 밖이면 안 나간다)', () => {
    expect(readProLinks(JSON.stringify(['https://soomgo.com/a', 'https://bad.com/x']))).toEqual([{ url: 'https://soomgo.com/a', label: '숨고' }])
    expect(readProLinks('not json')).toEqual([])
  })
  it('소개: 안 보내면 null(그대로 둠) · 보내면 다듬어 300자', () => {
    expect(parseProIntro(undefined)).toBeNull()
    expect(parseProIntro('  ')).toBe('')
    expect(parseProIntro('가'.repeat(400))?.length).toBe(300)
  })
  it('저장 SQL 은 안 보낸 칸을 기존 값으로 둔다(COALESCE)', () => {
    const src = readCode('src/features/home-service/api/home-service-pro-profile.ts')
    expect(src).toMatch(/intro = COALESCE\(excluded\.intro, home_service_pros\.intro\)/)
    expect(src).toMatch(/links = COALESCE\(excluded\.links, home_service_pros\.links\)/)
  })
})

describe('⭐ 후기', () => {
  function seed(raw: Raw) {
    raw.exec(`INSERT INTO sellers (id, status, name) VALUES (7, 'approved', '깨끗청소'), (8, 'approved', '다른집')`)
    raw.exec(`INSERT INTO users (id, name) VALUES (1, '김철수'), (2, '남')`)
    raw.exec(`INSERT INTO home_service_requests (id, user_id, category, details, summary, sido, sigungu, desired_date, contact_phone, status, chosen_quote_id)
              VALUES (10, 1, 'clean', '{}', 's', '서울', '강남구', '2026-01-01', '010', 'chosen', 100),
                     (11, 1, 'clean', '{}', 's', '서울', '강남구', '2026-01-01', '010', 'open', NULL)`)
    raw.exec(`INSERT INTO home_service_quotes (id, request_id, seller_id, status) VALUES (100, 10, 7, 'chosen'), (101, 10, 8, 'sent'), (110, 11, 7, 'sent')`)
  }
  it('고른 업체에 한 번만, 내 요청만, 고르기 전엔 못 쓴다', async () => {
    const { DB, raw } = makeD1(); seed(raw)
    const sql = reviewInsertSql()
    const run = (reqId: number, uid: number) => DB.prepare(sql).bind(5, '친절하고 깔끔해요', reqId, uid).run()
    expect((await run(10, 2)).meta.changes).toBe(0)   // 남의 요청
    expect((await run(11, 1)).meta.changes).toBe(0)   // 아직 안 고름
    expect((await run(10, 1)).meta.changes).toBe(1)
    expect((await run(10, 1)).meta.changes).toBe(0)   // 두 번째
    const row = raw.prepare(`SELECT seller_id, quote_id FROM home_service_reviews`).get() as { seller_id: number; quote_id: number }
    expect(row).toEqual({ seller_id: 7, quote_id: 100 })   // 고른 업체에 붙는다(다른 견적 업체 아님)
  })
  it('요약: 숨긴 것 제외 · 없으면 count 0 · 작성자 가림', async () => {
    const { DB, raw } = makeD1(); seed(raw)
    raw.exec(`INSERT INTO home_service_reviews (request_id, quote_id, seller_id, user_id, rating, body, hidden) VALUES
              (10, 100, 7, 1, 5, '좋아요 정말', 0), (99, 1, 7, 1, 1, '광고글 광고', 1)`)
    const s = await reviewSummaries(DB, [7, 8], 3)
    expect(s[7].count).toBe(1)
    expect(s[7].avg).toBe(5)
    expect(s[7].recent[0].reviewer).toBe('김○○')
    expect(s[8]).toEqual({ avg: null, count: 0, recent: [] })
    expect(ratingText(s[8].avg, s[8].count)).toBeNull()
    expect(ratingText(4.666, 3)).toBe('★ 4.7 (3)')
  })
  it('입력 검증: 별점 1~5 정수 · 5자 이상', () => {
    expect(parseReview({ rating: 0, body: '좋아요 정말' }).ok).toBe(false)
    expect(parseReview({ rating: 4.5, body: '좋아요 정말' }).ok).toBe(false)
    expect(parseReview({ rating: 5, body: '좋아' }).ok).toBe(false)
    expect(parseReview({ rating: 5, body: '  좋아요 정말  ' })).toEqual({ ok: true, rating: 5, text: '좋아요 정말' })
    expect(maskReviewer('')).toBe('손님')
  })
  it('후기 부탁 알림은 review_asked_at CAS 로 한 번만', () => {
    const src = readCode('src/worker/cron/home-service-sweep.ts')
    expect(src).toMatch(/SET review_asked_at = datetime\('now'\) WHERE id = \? AND review_asked_at IS NULL/)
    expect(src).toMatch(/if \(!upd\.meta\?\.changes\) continue/)
  })
})

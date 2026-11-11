/**
 * 🎬 '다녀온 사람들' 유튜브 → 유어쇼츠 옮겨 싣기 (2026-11-11 대표 *"유어쇼츠 영역으로도 넣어주면 되지 않아?"*)
 *
 * **진짜 SQLite** 에 수집 표·유어쇼츠 표를 만들고 `syncCreatorShorts` 를 그대로 돌린다(유튜브만 가짜).
 * 지키는 것:
 *   ① 3분 이하만 싣는다(4분 영상은 안 실린다) · 가게의 이용권이 붙는다 · 직접 넣은 영상 뒤에 선다
 *   ② 잰 길이를 적어 다시 안 묻는다 · 유튜브가 실패하면 아무것도 적지 않는다
 *   ③ 가게 칸에서 숨긴 영상은 유어쇼츠에서도 꺼진다 · 한 번 끈 것을 다시 켜지 않는다
 *   ④ 상세 칸이 옮겨 실은 행을 '유어쇼츠' 로 다시 읽지 않는다(같은 영상 두 번)
 * ⚠️ 못 보는 것: 세로/가로 — 길이만 본다(어드민 '주소로 추가'와 같은 기준). 실제 유튜브 응답 모양은 라이브로만 확인된다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { exec: (s: string) => void; prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { syncCreatorShorts, durationMark, CREATOR_SHORTS_SORT } from '@/features/creator-content/api/content-urshorts'
import { ensureCreatorContentTables, storeKeyFor } from '@/features/creator-content/api/content-db'

function makeD1() {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => ({ results: db.prepare(sql).all(...(args as never[])) }),
    }
    return api
  }
  const D1 = { prepare: (sql: string) => wrap(sql), batch: async (st: { run: () => Promise<unknown> }[]) => { const out = []; for (const s of st) out.push(await s.run()); return out } }
  return { db, D1: D1 as unknown as D1Database }
}

const ADDR = '서울 서초구 방배중앙로 165'
const KEY = storeKeyFor('달빛한스푼', ADDR)
let db: ReturnType<typeof makeD1>['db']; let D1: D1Database
const durations: Record<string, string> = { aaaaaaaaaaa: 'PT45S', bbbbbbbbbbb: 'PT3M50S', ccccccccccc: 'PT2M' }
let ytOk = true

beforeEach(async () => {
  ({ db, D1 } = makeD1())
  await ensureCreatorContentTables(D1)
  db.exec(`CREATE TABLE home_shorts (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id TEXT NOT NULL UNIQUE, title TEXT, channel TEXT, thumb_url TEXT,
    product_id INTEGER, sort_order INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1, source TEXT NOT NULL DEFAULT 'manual',
    duration_sec INTEGER, consent INTEGER NOT NULL DEFAULT 0, region_si TEXT, region_area TEXT, category TEXT, created_at TEXT)`)
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, restaurant_name TEXT, restaurant_address TEXT, category TEXT, group_buy_status TEXT, is_active INTEGER, deal_only INTEGER, sold_count INTEGER)`)
  db.exec(`INSERT INTO products VALUES (11, '달빛한스푼', '${ADDR}', 'meal_voucher', 'active', 1, 0, 3), (12, '달빛한스푼', '${ADDR}', 'meal_voucher', 'active', 1, 0, 9)`)
  db.exec(`INSERT INTO store_content_crawl (store_key, seller_id, store_name, address) VALUES ('${KEY}', 0, '달빛한스푼', '${ADDR}')`)
  for (const [i, id] of ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'].entries()) {
    db.exec(`INSERT INTO store_creator_content (store_key, seller_id, platform, ext_id, url, title, status) VALUES ('${KEY}', 0, 'youtube', '${id}', 'u', '달빛한스푼 영상 ${i}', 'visible')`)
  }
  ytOk = true
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (!ytOk) return new Response('quota', { status: 403 })
    const ids = new URL(url).searchParams.get('id')!.split(',')
    return new Response(JSON.stringify({ items: ids.filter((x) => durations[x]).map((x) => ({ id: x, contentDetails: { duration: durations[x] } })) }))
  }))
})
afterEach(() => vi.unstubAllGlobals())

const env = { YOUTUBE_API_KEY: 'k' } as never
const shorts = () => db.prepare(`SELECT video_id, product_id, sort_order, is_active, source, duration_sec FROM home_shorts ORDER BY video_id`).all() as Record<string, unknown>[]

describe('유어쇼츠 옮겨 싣기', () => {
  it('① 3분 이하만 · 가장 많이 팔린 이용권 · 직접 넣은 영상 뒤', async () => {
    const r = await syncCreatorShorts(D1, env)
    expect(r.added).toBe(2)
    const s = shorts()
    expect(s.map((x) => x.video_id)).toEqual(['aaaaaaaaaaa', 'ccccccccccc'])
    expect(s.every((x) => x.product_id === 12 && x.sort_order === CREATOR_SHORTS_SORT && x.source === 'creator' && x.is_active === 1)).toBe(true)
    // 레일·뷰어와 같은 정렬(urshorts.routes PUBLIC_SQL)에서 **먼저 넣어 둔** 직접 영상이 자동 영상보다 앞이어야 한다
    //   (자동 영상은 id 가 더 커서, 순서값이 같으면 앞으로 튀어나온다).
  })
  it('①-b 먼저 넣어 둔 직접 영상이 자동 영상보다 앞', async () => {
    db.exec(`INSERT INTO home_shorts (video_id, source) VALUES ('mmmmmmmmmmm', 'manual')`)
    await syncCreatorShorts(D1, env)
    expect((db.prepare(`SELECT video_id FROM home_shorts WHERE is_active = 1 ORDER BY sort_order ASC, id DESC LIMIT 1`).get() as { video_id: string }).video_id).toBe('mmmmmmmmmmm')
  })
  it('② 잰 길이를 적어 다시 안 묻는다 · 실패하면 안 적는다', async () => {
    ytOk = false
    expect((await syncCreatorShorts(D1, env)).measured).toBe(0)
    expect(db.prepare(`SELECT COUNT(*) n FROM store_creator_content WHERE duration_sec IS NOT NULL`).get()).toEqual({ n: 0 })
    ytOk = true
    await syncCreatorShorts(D1, env)
    expect(db.prepare(`SELECT duration_sec d FROM store_creator_content WHERE ext_id = 'bbbbbbbbbbb'`).get()).toEqual({ d: 230 })
    expect((await syncCreatorShorts(D1, env)).measured).toBe(0)
    expect(durationMark(null)).toBe(-1)
  })
  it('③ 가게 칸에서 숨기면 꺼지고, 끈 것을 다시 켜지 않는다', async () => {
    await syncCreatorShorts(D1, env)
    db.exec(`UPDATE store_creator_content SET status = 'hidden' WHERE ext_id = 'aaaaaaaaaaa'`)
    expect((await syncCreatorShorts(D1, env)).off).toBe(1)
    db.exec(`UPDATE store_creator_content SET status = 'visible' WHERE ext_id = 'aaaaaaaaaaa'`)
    await syncCreatorShorts(D1, env)
    expect(shorts().find((x) => x.video_id === 'aaaaaaaaaaa')!.is_active).toBe(0)
  })
  it('직접 넣은 영상은 건드리지 않는다', async () => {
    db.exec(`INSERT INTO home_shorts (video_id, source) VALUES ('zzzzzzzzzzz', 'manual')`)
    await syncCreatorShorts(D1, env)
    expect(shorts().find((x) => x.video_id === 'zzzzzzzzzzz')!.is_active).toBe(1)
  })
  it('④ 상세 칸은 옮겨 실은 행을 다시 읽지 않는다 · 수집 회차에 배선돼 있다', () => {
    expect(readFileSync('src/features/creator-content/api/content.routes.ts', 'utf8')).toMatch(/FROM home_shorts[\s\S]{0,300}COALESCE\(source, 'manual'\) != 'creator'/)
    expect(readFileSync('src/features/creator-content/api/content-collect.ts', 'utf8')).toMatch(/await syncCreatorShorts\(DB, env\)/)
  })
})

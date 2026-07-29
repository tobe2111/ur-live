import { describe, it, expect, beforeEach } from 'vitest'
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import { saveKeyword, listSavedKeywords, listKeywordTags, deleteSavedKeyword, updateSavedKeyword } from '@/features/marketing/api/keyword-portfolio'
import { signAdsToken, ensureAdsAccountSchema } from '@/features/marketing/api/ads-account'
import { marketingRoutes } from '@/features/marketing/api/marketing.routes'

// 서버측 베타 게이트(access_unlocked) 통과용 — unlock·active 계정 시딩.
async function seedUnlocked(DB: D1Database, id: number): Promise<void> {
  await ensureAdsAccountSchema(DB)
  await DB.prepare("INSERT OR IGNORE INTO ad_accounts (id, email, password_hash, company_name, status, access_unlocked) VALUES (?, ?, 'x', 'co', 'active', 1)").bind(id, 'u' + id + '@x.com').run()
}

/**
 * 🆕 2026-06-30 유어애즈 키워드 포트폴리오 — 실제 SQLite 저장/태그/멱등/상한 검증.
 */
function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => { const r = db.prepare(sql).all(...(args as never[])); return { results: r } },
    }
    return api
  }
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}
const JWT = 'test-jwt-secret-0123456789'

describe('keyword-portfolio — 저장/태그/멱등', () => {
  let DB: D1Database
  beforeEach(() => { DB = makeD1() })

  it('저장 + 목록(신규 우선) + 필드 보존', async () => {
    expect((await saveKeyword(DB, 7, { keyword: '무선이어폰', monthly_total: 12000, comp_idx: '높음', tag: '가전' })).ok).toBe(true)
    expect((await saveKeyword(DB, 7, { keyword: '블루투스스피커', monthly_total: 5000 })).ok).toBe(true)
    const list = await listSavedKeywords(DB, 7)
    expect(list.map(k => k.keyword)).toEqual(['블루투스스피커', '무선이어폰'])
    expect(list[1]).toMatchObject({ keyword: '무선이어폰', monthly_total: 12000, comp_idx: '높음', tag: '가전' })
  })

  it('같은 키워드 재저장 → 멱등 upsert(중복행 없음, COALESCE 로 값 보존)', async () => {
    await saveKeyword(DB, 7, { keyword: '무선이어폰', monthly_total: 12000, tag: '가전' })
    await saveKeyword(DB, 7, { keyword: '무선이어폰', memo: '봄 시즌 집중' }) // tag/monthly 유지 + memo 추가
    const list = await listSavedKeywords(DB, 7)
    expect(list).toHaveLength(1)
    expect(list[0]).toMatchObject({ monthly_total: 12000, tag: '가전', memo: '봄 시즌 집중' })
  })

  it('태그 필터 + 태그 목록', async () => {
    await saveKeyword(DB, 7, { keyword: 'A', tag: '가전' })
    await saveKeyword(DB, 7, { keyword: 'B', tag: '패션' })
    await saveKeyword(DB, 7, { keyword: 'C', tag: '가전' })
    expect((await listSavedKeywords(DB, 7, '가전')).map(k => k.keyword)).toEqual(['C', 'A'])
    expect(await listKeywordTags(DB, 7)).toEqual(['가전', '패션'])
  })

  it('수정(태그/메모) + 삭제 + 계정 격리', async () => {
    await saveKeyword(DB, 7, { keyword: 'X' })
    await saveKeyword(DB, 99, { keyword: 'Y' }) // 다른 계정
    const x = (await listSavedKeywords(DB, 7))[0]
    await updateSavedKeyword(DB, 7, x.id, { tag: '중요', memo: 'note' })
    expect((await listSavedKeywords(DB, 7))[0]).toMatchObject({ tag: '중요', memo: 'note' })
    // 다른 계정이 남의 id 삭제 시도 → 안 지워짐(소유권 스코프)
    await deleteSavedKeyword(DB, 99, x.id)
    expect(await listSavedKeywords(DB, 7)).toHaveLength(1)
    await deleteSavedKeyword(DB, 7, x.id)
    expect(await listSavedKeywords(DB, 7)).toHaveLength(0)
  })

  it('빈 키워드 거부', async () => {
    expect((await saveKeyword(DB, 7, { keyword: '  ' })).ok).toBe(false)
  })

  it('라우트 POST /keywords/save + GET /keywords/saved (인증)', async () => {
    const env = { DB, JWT_SECRET: JWT } as unknown as Parameters<typeof marketingRoutes.request>[2]
    const token = await signAdsToken(7, JWT)
    await seedUnlocked(DB, 7)
    const headers = { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }
    const post = await marketingRoutes.request('/keywords/save', { method: 'POST', headers, body: JSON.stringify({ keyword: '캠핑용품', monthly_total: 8000, tag: '레저' }) }, env)
    expect(post.status).toBe(200)
    const get = await marketingRoutes.request('/keywords/saved', { headers }, env)
    const gj = await get.json() as { items: Array<{ keyword: string }>; tags: string[] }
    expect(gj.items[0].keyword).toBe('캠핑용품')
    expect(gj.tags).toEqual(['레저'])
    // 미인증 401
    expect((await marketingRoutes.request('/keywords/saved', {}, env)).status).toBe(401)
  })
})

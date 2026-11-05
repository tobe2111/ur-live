/**
 * 🎁 2026-11-05 — 교환권 사진 이관을 **러너 경유**로 끝낸다(giftishow 가 Cloudflare 를 막아 워커 cron 이 5일 동안 8장만 옮겼다).
 * 지키는 것: ① 토큰 없으면 403 ② 활성 교환권 · giftishow 원본 · 넘긴 주소와 같을 때만 바꾼다(CAS) ③ 이미지 서명이 아니면 거부
 *   ④ 성공하면 우리 주소(`/api/media/uploads/voucher/h/<해시>`)로 바뀌고 원래 주소를 기록한다 ⑤ 목록은 많이 팔린 것부터.
 * ⚠️ 못 보는 것: GitHub 러너가 giftishow 에 실제로 닿는지(첫 실행 요약 `옮김 N` 으로 판정) · 실제 R2.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { voucherImageUploadRoutes, tokenOk, sniffImageType } from '@/worker/routes/voucher-image-upload.routes'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const TOKEN = 'tok-0123456789abcdef'
const G = 'https://bizimg.giftishow.com/Resource/goods/2025/G1/G1.jpg'

function setup() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE products (id INTEGER PRIMARY KEY, deal_only INTEGER, is_active INTEGER, image_url TEXT, sold_count INTEGER, updated_at TEXT)`)
  db.exec(`CREATE TABLE gift_catalog (gift_code TEXT, brand_icon_url TEXT)`)
  db.exec(`INSERT INTO gift_catalog VALUES ('a','https://bizimg.giftishow.com/Resource/brand/b1.jpg'),('b','https://bizimg.giftishow.com/Resource/brand/b1.jpg'),('c','https://other.com/logo.png')`)
  db.exec(`INSERT INTO products VALUES (1,1,1,'${G}',5,NULL),(2,1,1,'https://bizimg.giftishow.com/b.jpg',50,NULL),(3,0,1,'${G}',99,NULL),(4,1,1,'https://other.com/x.jpg',1,NULL)`)
  const D1 = {
    prepare(sql: string) {
      let a: unknown[] = []
      const st = {
        bind: (...x: unknown[]) => { a = x; return st },
        first: async () => db.prepare(sql).get(...(a as never[])) ?? null,
        all: async () => ({ results: db.prepare(sql).all(...(a as never[])) }),
        run: async () => { const r = db.prepare(sql).run(...(a as never[])); return { meta: { changes: Number(r.changes) } } },
      }
      return st
    },
    batch: async (l: Array<{ run: () => Promise<unknown> }>) => { for (const s of l) await s.run(); return [] },
  } as unknown as D1Database
  const r2 = new Map<string, ArrayBuffer>()
  const MEDIA_BUCKET = { head: async (k: string) => (r2.has(k) ? {} : null), put: async (k: string, b: ArrayBuffer) => { r2.set(k, b) } } as unknown as R2Bucket
  const env = { DB: D1, MEDIA_BUCKET, REPAIR_SCHEMA_TOKEN: TOKEN }
  const call = (path: string, init: RequestInit = {}) => voucherImageUploadRoutes.request(path, init, env)
  return { db, r2, call }
}
const jpeg = () => { const b = new Uint8Array(2000); b.set([0xff, 0xd8, 0xff, 0xe0]); return b }
const up = (id: number, src: string, body: Uint8Array, token = TOKEN) => ({
  path: `/api/_internal/voucher-image/upload?id=${id}&src=${encodeURIComponent(src)}`,
  init: { method: 'POST', headers: { 'X-Repair-Token': token }, body } as RequestInit,
})

describe('교환권 사진 이관(러너 경유)', () => {
  it('① 토큰이 없거나 틀리면 403 — 목록도 업로드도', async () => {
    const { call } = setup()
    expect((await call('/api/_internal/voucher-image/candidates')).status).toBe(403)
    const u = up(1, G, jpeg(), 'wrong-token-xxxxxxx')
    expect((await call(u.path, u.init)).status).toBe(403)
    expect(tokenOk(undefined, 'x')).toBe(false)
    expect(tokenOk('abc', 'abd')).toBe(false)
  })
  it('⑤ 목록 = 활성 교환권의 giftishow 원본만, 많이 팔린 것부터', async () => {
    const { call } = setup()
    const r = await call('/api/_internal/voucher-image/candidates?limit=10', { headers: { 'X-Repair-Token': TOKEN } })
    const j = await r.json() as { remaining: number; data: { id: number }[] }
    expect(j.data.map((x) => x.id)).toEqual([2, 1])   // 3 은 교환권 아님 · 4 는 giftishow 아님
    expect(j.remaining).toBe(2)
  })
  it('④ 성공하면 우리 주소로 바꾸고 원래 주소를 남긴다', async () => {
    const { db, r2, call } = setup()
    const u = up(1, G, jpeg())
    const r = await call(u.path, u.init)
    expect(r.status).toBe(200)
    const { url } = await r.json() as { url: string }
    expect(url).toMatch(/^\/api\/media\/uploads\/voucher\/h\/[0-9a-f]{32}\.jpg$/)
    expect((db.prepare('SELECT image_url FROM products WHERE id=1').get() as { image_url: string }).image_url).toBe(url)
    expect(r2.size).toBe(1)
  })
  it('② 넘긴 주소와 지금 주소가 다르면(그 사이 바뀜) · 교환권이 아니면 · giftishow 가 아니면 409', async () => {
    const { call } = setup()
    for (const [id, src] of [[1, 'https://bizimg.giftishow.com/other.jpg'], [3, G], [4, 'https://other.com/x.jpg']] as const) {
      const u = up(id, src, jpeg())
      expect((await call(u.path, u.init)).status, `id=${id}`).toBe(409)
    }
  })
  it('③ 이미지 서명이 아니면 415 — 넘긴 쪽 Content-Type 을 믿지 않는다', async () => {
    const { call } = setup()
    const u = up(1, G, new TextEncoder().encode('<html>blocked</html>'.padEnd(2000, ' ')))
    expect((await call(u.path, u.init)).status).toBe(415)
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]))).toBe('image/png')
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp')
  })
})

describe('🏷️ 브랜드 로고 — 대응표(원천 표는 동기화가 덮어쓴다)', () => {
  const B = 'https://bizimg.giftishow.com/Resource/brand/b1.jpg'
  it('목록은 giftishow 로고만(중복 없이) · 옮긴 뒤에는 빠진다 · 대응표에 원본→우리 주소', async () => {
    const { db, call } = setup()
    const list = async () => (await (await call('/api/_internal/voucher-image/brand-candidates', { headers: { 'X-Repair-Token': TOKEN } })).json() as { data: string[] }).data
    expect(await list()).toEqual([B])
    const r = await call(`/api/_internal/voucher-image/brand-upload?src=${encodeURIComponent(B)}`, { method: 'POST', headers: { 'X-Repair-Token': TOKEN }, body: jpeg() })
    const { url } = await r.json() as { url: string }
    expect(url).toMatch(/^\/api\/media\/uploads\/voucher-brand\/h\//)
    expect(await list()).toEqual([])
    expect(db.prepare('SELECT url FROM brand_icon_rehost WHERE src = ?').get(B)).toEqual({ url })
  })
  it('모르는 로고 주소 · 토큰 없음은 거부', async () => {
    const { call } = setup()
    expect((await call(`/api/_internal/voucher-image/brand-upload?src=${encodeURIComponent('https://other.com/logo.png')}`, { method: 'POST', headers: { 'X-Repair-Token': TOKEN }, body: jpeg() })).status).toBe(409)
    expect((await call('/api/_internal/voucher-image/brand-candidates')).status).toBe(403)
  })
  it('브랜드 목록 API 가 대응표로 바꿔 낀다(표가 없으면 원본 그대로 — 실패해도 목록은 산다)', async () => {
    const src = (await import('node:fs')).readFileSync('src/worker/routes/public-utility.routes.ts', 'utf8')
    expect(src).toMatch(/const iconMapP = loadBrandIconMap\(DB\)[\s\S]*?const allRows = await DB\.prepare/)
    expect(src).toContain('if (r.brand_icon_url && iconMap.has(r.brand_icon_url)) r.brand_icon_url = iconMap.get(r.brand_icon_url)!')
    const { loadBrandIconMap } = await import('@/worker/utils/brand-icon-rehost')
    const broken = { prepare: () => ({ all: async () => { throw new Error('no such table') } }) } as unknown as D1Database
    expect(await loadBrandIconMap(broken)).toEqual(new Map())
  })
})

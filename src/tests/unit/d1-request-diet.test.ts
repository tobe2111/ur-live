/**
 * 📉 유어딜 요청 경로 D1 읽기 다이어트 — 2026-09-02 (9/1 계정 일일 읽기 한도 사고, 정적 감사 §2-2).
 *   ① sitemap.xml 1h 엣지 캐시  ② 봇 OG 셀러 조회 OR 분리  ③ 공구 상세 API TTL ≥120
 *   ④ flash-deals PRAGMA 메모 + 5분 캐시  ⑤ 어드민 헬스 폴링 60s  ⑥ 인덱스 3건
 * 못 막는 것: 실제 rows_read(런타임) — `D1_PROFILE_ENABLED` 로 배포 후 판정.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { INDEX_REPAIRS } from '@/worker/routes/repair-schema/index-repairs'

const INDEX = readFileSync('src/worker/index.ts', 'utf8')
const SITEMAP = readFileSync('src/worker/routes/sitemap.routes.ts', 'utf8')
const UTIL = readFileSync('src/worker/routes/public-utility.routes.ts', 'utf8')
const HEALTH = readFileSync('src/pages/AdminHealthPage.tsx', 'utf8')

describe('d1-request-diet', () => {
  it('① sitemap.xml 은 라우트 마운트보다 앞에서 publicCache(3600) 을 탄다', () => {
    const use = INDEX.indexOf("app.use('/sitemap.xml', publicCache(3600))")
    const mount = INDEX.indexOf("app.route('/', sitemapRoutes)")
    expect(use).toBeGreaterThan(-1); expect(mount).toBeGreaterThan(use)
    expect(SITEMAP).toContain("sitemapRoutes.get('/sitemap.xml'")
  })
  it('② 봇 OG 셀러 조회는 username 점 조회 하나(sellers 에 slug 컬럼은 없다)', () => {
    expect(INDEX).not.toContain("FROM sellers WHERE slug = ? OR username = ?")
    expect(INDEX).not.toMatch(/FROM sellers WHERE slug = \?/)
    expect(INDEX).toContain("FROM sellers WHERE username = ?').bind(param).first<any>()")
  })
  it('③ 공구 상세 API TTL 은 120 이상(참여자 수는 participants 60s 가 따로 본다)', () => {
    const m = /app\.use\('\/api\/group-buy\/products\/\*', publicCache\((\d+)\), cacheControl\((\d+)\)\)/.exec(INDEX)
    expect(m).toBeTruthy()
    expect(Number(m![1])).toBeGreaterThanOrEqual(120); expect(m![1]).toBe(m![2])
    expect(INDEX).toMatch(/app\.use\('\/api\/group-buy\/products\/\*\/participants', publicCache\(60\)/)
  })
  it('④ flash-deals 는 PRAGMA 를 D1 당 1회만 묻고 5분 캐시를 탄다', () => {
    expect(UTIL).toMatch(/const _flashCols = new WeakMap<object, Promise<Set<string>>>\(\)/)
    const handler = UTIL.slice(UTIL.indexOf("publicUtilityRoutes.get('/api/flash-deals'"))
    expect(handler.slice(0, 1200)).not.toContain('PRAGMA table_info')
    expect(handler.slice(0, 1200)).toContain('await productColumns(DB)')
    expect(UTIL.indexOf("publicUtilityRoutes.use('/api/flash-deals', publicCache(300))")).toBeLessThan(UTIL.indexOf("publicUtilityRoutes.get('/api/flash-deals'"))
  })
  it('⑤ 어드민 헬스 폴링은 60초 이상', () => {
    const m = /refetchInterval: (\d[\d_]*)/.exec(HEALTH)
    expect(Number(m![1].replace(/_/g, ''))).toBeGreaterThanOrEqual(60_000)
  })
  it('⑥ 인덱스 2건이 repair 목록에 있다', () => {
    const names = INDEX_REPAIRS.map((i) => i.name)
    for (const n of ['idx_products_deal_price', 'idx_products_deal_created']) expect(names).toContain(n)
    expect(names).not.toContain('idx_sellers_slug') // sellers.slug 는 존재하지 않는 컬럼
    expect(INDEX_REPAIRS.find((i) => i.name === 'idx_products_deal_price')!.sql).toMatch(/WHERE deal_only = 1 AND is_active = 1/)
  })
})

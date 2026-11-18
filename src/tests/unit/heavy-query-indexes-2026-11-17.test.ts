/**
 * 🗂️ 2026-11-17 라이브에서 가장 많이 읽던 조회들 — 색인이 **실제로 쓰이는지** 진짜 SQLite 플래너로 본다.
 * (대표 *"다른 문제들도 파악해줘"* · Cloudflare D1 분석 24시간 rows_read 상위)
 *
 * 지키는 것:
 *  1. 깨진 상호 수리 조회 → `idx_company_broken_name`(종전 하루 2,470만 줄)
 *  2. 유어쇼츠 끄기 문장의 NOT EXISTS → `idx_scc_platform_ext`(종전 하루 2,000만 줄)
 *  3. 공개 상권 리포트 지역 집계 → `idx_prospects_active_region`(덮는 색인)
 *  4. 카카오 로그인의 `LOWER(email)` 비교 → 식 색인이 매일 점검 목록에 있다
 *  5. 리드 점수 재계산이 바뀌지 않은 행을 다시 쓰지 않는다(종전 하루 ~27만 줄 쓰기)
 *
 * 못 막는 것: 라이브 D1 의 플래너가 다른 선택을 하는 것(같은 SQLite 엔진이라 대개 같다) · 색인 생성 자체의 1회 쓰기 비용.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { COMPANY_INDEX_DDL } from '@/features/marketing/api/company-ddl-indexes'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const plan = (db: InstanceType<typeof DatabaseSync>, q: string) =>
  (db.prepare('EXPLAIN QUERY PLAN ' + q).all() as Array<{ detail: string }>).map((r) => r.detail).join(' | ')
const read = (p: string) => fs.readFileSync(p, 'utf8')

describe('무거운 조회 — 색인이 실제로 쓰인다', () => {
  it('깨진 상호 수리', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE ad_company_leads(id INTEGER PRIMARY KEY, company_name TEXT, merged_into INT, status TEXT, tier INT, region TEXT, category TEXT, active INT)')
    for (const d of COMPANY_INDEX_DDL.filter((x) => /idx_company_broken_name|idx_company_leads_(tier|region|cat|active) /.test(x))) db.exec(d)
    const src = read('src/features/marketing/api/enrich-name-heal.ts')
    expect(src).toContain("WHERE merged_into IS NULL AND status = 'new' AND instr(company_name, char(65533)) > 0")
    expect(plan(db, "SELECT id FROM ad_company_leads WHERE merged_into IS NULL AND status = 'new' AND instr(company_name, char(65533)) > 0 ORDER BY id DESC LIMIT 8"))
      .toContain('idx_company_broken_name')
  })

  it('유어쇼츠 끄기 문장', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE home_shorts(id INTEGER PRIMARY KEY, source TEXT, is_active INT, video_id TEXT);
             CREATE TABLE store_creator_content(id INTEGER PRIMARY KEY, store_key TEXT, platform TEXT, ext_id TEXT, status TEXT, UNIQUE(store_key, platform, ext_id))`)
    const ddl = read('src/features/creator-content/api/content-db.ts').match(/CREATE INDEX IF NOT EXISTS idx_scc_platform_ext ON [^`]+/)?.[0]
    expect(ddl, '색인 DDL 이 사라졌다').toBeTruthy()
    db.exec(ddl!)
    const p = plan(db, `UPDATE home_shorts SET is_active = 0 WHERE source = 'creator' AND is_active = 1
      AND NOT EXISTS (SELECT 1 FROM store_creator_content c WHERE c.platform = 'youtube' AND c.ext_id = home_shorts.video_id AND c.status = 'visible')`)
    expect(p).toContain('idx_scc_platform_ext')
  })

  it('상권 리포트 지역 집계', () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE store_prospects(id INTEGER PRIMARY KEY, active INT, region TEXT)')
    const ddl = read('src/features/marketing/api/store-prospects.ts').match(/CREATE INDEX IF NOT EXISTS idx_prospects_active_region ON [^']+/)?.[0]
    expect(ddl).toBeTruthy()
    db.exec(ddl!)
    expect(plan(db, "SELECT region AS k, COUNT(*) AS n FROM store_prospects WHERE active = 1 AND region IS NOT NULL AND region != '' GROUP BY region"))
      .toContain('COVERING INDEX idx_prospects_active_region')
  })

  it('LOWER(email) 식 색인이 매일 점검 목록에 있다', () => {
    const r = read('src/worker/routes/repair-schema/column-repairs.ts')
    expect(r).toContain('CREATE INDEX IF NOT EXISTS idx_users_email_ci ON users(LOWER(email))')
    expect(r).toContain('CREATE INDEX IF NOT EXISTS idx_sellers_email_ci ON sellers(LOWER(email))')
  })

  it('리드 점수 재계산은 바뀐 행만 쓴다', () => {
    const q = read('src/features/marketing/api/influencer-quality.ts')
    const at = q.indexOf("UPDATE ad_influencer_leads SET is_brand = ?, lead_score = ?, opted_out = ? WHERE id = ?")
    expect(q.slice(at - 400, at)).toMatch(/=== score\) continue/)
    expect(q).toMatch(/opted_out, lead_score\n\s+FROM ad_influencer_leads/)
  })
})

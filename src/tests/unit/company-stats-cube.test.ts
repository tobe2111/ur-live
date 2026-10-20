/**
 * 📊 **집계 8번 → 큐브 1번, 그런데 숫자는 한 자리도 달라지면 안 된다** (2026-08-31).
 *
 * ## 왜 이 시험이 이 모양인가
 * 이건 성능 변경이 아니라 **같은 답을 다른 방법으로 구하는** 변경이다. 그러면 위험은 느려지는 게
 * 아니라 **조용히 틀린 숫자**다 — 화면 카드가 이 값들이라, 하나가 어긋나도 대표가 그걸 근거로
 * 판단하게 된다. 그래서 문자열이나 모양을 보지 않고, **예전 여덟 쿼리를 그대로 들고 와서
 * 같은 SQLite 에 태운 뒤 결과를 통째로 비교**한다.
 *
 * ## ⚠️ 못 막는 것
 * - 라이브 플래너의 선택(D1 의 SQLite 버전·통계가 다를 수 있다) — `meta.rows_read` 로만 판정된다.
 * - `byDay`/`todayKst` 는 시각 의존이라 여기서 비교하지 않는다(별도 쿼리로 남아 있다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { COMPANY_CUBE_SQL, foldCube, type CubeRow } from '@/features/marketing/api/company-stats-cube'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const CREATE = `CREATE TABLE ad_company_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, company_key TEXT NOT NULL, company_name TEXT NOT NULL,
  category TEXT, subcategory TEXT, tier INTEGER, region TEXT, website TEXT, email TEXT, phone TEXT,
  address TEXT, source TEXT NOT NULL DEFAULT 'manual', status TEXT NOT NULL DEFAULT 'new',
  active INTEGER NOT NULL DEFAULT 1, lead_type TEXT, enrich_checked_at DATETIME,
  collected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, merged_into INTEGER, UNIQUE(company_key))`

/** 라이브 분포를 흉내낸다 — **모든 축에 NULL·빈문자·병합행이 섞여야** 접기 실수가 드러난다. */
function seed(rows: number) {
  const db = new DatabaseSync(':memory:')
  db.exec(CREATE)
  const ins = db.prepare(`INSERT INTO ad_company_leads
    (id, company_key, company_name, category, tier, website, email, phone, source, status, active, lead_type, enrich_checked_at, collected_at, merged_into)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const CATS = ['대행사', '온라인판매', '간판', '인테리어', null, '']
  const SRCS = ['webkr', 'local', 'storeinfo', 'commerce', 'nara', null, '']
  const TYPES = ['partner', 'store', 'org', 'unknown', null, '']
  let r = 20260831
  const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648
  for (let i = 1; i <= rows; i++) {
    const merged = rnd() > 0.03 ? null : 1
    ins.run(i, `k${i}`, `회사${i}`,
      CATS[Math.floor(rnd() * CATS.length)], [1, 2, 3, 4, null][Math.floor(rnd() * 5)],
      rnd() < 0.2 ? 'https://x.kr' : (rnd() < 0.5 ? '' : null),
      rnd() < 0.25 ? 'a@b.com' : (rnd() < 0.5 ? '' : null),
      rnd() < 0.3 ? '02-1234-5678' : null,
      SRCS[Math.floor(rnd() * SRCS.length)] ?? 'manual',
      ['new', 'rejected', 'contacted', 'replied'][Math.floor(rnd() * 4)],
      rnd() < 0.7 ? 1 : 0, TYPES[Math.floor(rnd() * TYPES.length)],
      rnd() < 0.4 ? '2026-08-01 00:00:00' : null,
      // 최근/오래된 행을 섞는다 — recent7 집계가 실제로 갈리도록.
      rnd() < 0.3 ? new Date().toISOString().slice(0, 19).replace('T', ' ') : '2026-01-01 00:00:00',
      merged)
  }
  return db
}

/** 예전 구현 그대로 — 여기가 **정답지**다. 바꾸면 시험의 의미가 사라진다. */
function legacy(db: InstanceType<typeof DatabaseSync>) {
  const t = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 ELSE 0 END) AS with_contact,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS with_email,
      SUM(CASE WHEN active = 0 AND merged_into IS NULL THEN 1 ELSE 0 END) AS held_no_contact,
      SUM(CASE WHEN merged_into IS NOT NULL THEN 1 ELSE 0 END) AS merged_away,
      SUM(CASE WHEN status NOT IN ('new','rejected') THEN 1 ELSE 0 END) AS active_pipeline,
      SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7,
      SUM(CASE WHEN lead_type IS NULL OR lead_type = 'unknown' THEN 1 ELSE 0 END) AS needs_review
    FROM ad_company_leads`).get() as Record<string, number>
  const byCategory = db.prepare("SELECT COALESCE(category,'?') AS k, COUNT(*) AS n FROM ad_company_leads GROUP BY category ORDER BY n DESC LIMIT 20").all() as Array<{ k: string; n: number }>
  const byTier = db.prepare('SELECT tier AS k, COUNT(*) AS n FROM ad_company_leads GROUP BY tier ORDER BY (tier IS NULL) ASC, tier ASC').all() as Array<{ k: number | null; n: number }>
  const byLeadType = db.prepare("SELECT COALESCE(NULLIF(lead_type,''),'unknown') AS k, COUNT(*) AS n FROM ad_company_leads GROUP BY 1 ORDER BY n DESC").all() as Array<{ k: string; n: number }>
  const bySource = db.prepare(`SELECT COALESCE(NULLIF(source,''),'?') AS source, COUNT(*) AS n,
      SUM(CASE WHEN phone IS NOT NULL AND phone != '' THEN 1 ELSE 0 END) AS with_phone,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS with_email,
      SUM(CASE WHEN (phone IS NOT NULL AND phone != '') OR (email IS NOT NULL AND email != '') THEN 1 ELSE 0 END) AS with_any
    FROM ad_company_leads WHERE merged_into IS NULL GROUP BY 1 ORDER BY n DESC LIMIT 20`).all() as Array<Record<string, number | string>>
  const s = db.prepare(`SELECT
      SUM(CASE WHEN category = '온라인판매' AND email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS payback_ready,
      SUM(CASE WHEN category = '대행사' AND ((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '')) THEN 1 ELSE 0 END) AS agency_ready
    FROM ad_company_leads WHERE merged_into IS NULL AND active = 1`).get() as Record<string, number>
  const af = db.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS with_email,
      SUM(CASE WHEN (email IS NULL OR email = '') AND website IS NOT NULL AND website != '' THEN 1 ELSE 0 END) AS site_no_email,
      SUM(CASE WHEN (email IS NULL OR email = '') AND website IS NOT NULL AND website != '' AND enrich_checked_at IS NOT NULL THEN 1 ELSE 0 END) AS site_tried,
      SUM(CASE WHEN (email IS NULL OR email = '') AND (website IS NULL OR website = '') THEN 1 ELSE 0 END) AS no_site
    FROM ad_company_leads WHERE category = '대행사' AND merged_into IS NULL`).get() as Record<string, number>
  return { t, byCategory, byTier, byLeadType, bySource, s, af }
}

describe('🧊 큐브 1번 = 예전 8번 (node:sqlite 로 직접 대조)', () => {
  const db = seed(4000)
  const old = legacy(db)
  const cube = foldCube(db.prepare(COMPANY_CUBE_SQL).all() as unknown as CubeRow[])

  it('🔒 헤드라인 숫자 8개가 전부 같다', () => {
    expect(cube.stats).toEqual({
      total: old.t.total, with_contact: old.t.with_contact, with_email: old.t.with_email,
      held_no_contact: old.t.held_no_contact, merged_away: old.t.merged_away,
      active_pipeline: old.t.active_pipeline, recent7: old.t.recent7, needs_review: old.t.needs_review,
    })
  })

  it('🔒 카테고리별 — 값도 **순서도** 같다(화면이 이 순서를 그대로 그린다)', () => {
    expect(cube.byCategory).toEqual(old.byCategory)
  })

  it('🔒 tier별 — NULL 이 뒤로 가는 정렬까지 같다', () => {
    expect(cube.byTier).toEqual(old.byTier)
  })

  it('🔒 종류별 — 빈 문자열이 unknown 으로 접히는 것까지 같다', () => {
    expect(cube.byLeadType).toEqual(old.byLeadType)
  })

  it('🔒 소스별 — 병합행 제외라는 **비대칭**까지 같다(카테고리는 포함, 소스는 제외)', () => {
    expect(cube.bySource).toEqual(old.bySource)
  })

  it('🔒 세그먼트(즉시 발송 가능) 두 숫자가 같다', () => {
    expect(cube.seg).toEqual({ payback_ready: old.s.payback_ready, agency_ready: old.s.agency_ready })
  })

  it('🔒 대행사 이메일 퍼널 다섯 숫자가 같다', () => {
    expect(cube.agencyEmailFunnel).toEqual({
      total: old.af.total, with_email: old.af.with_email,
      site_no_email: old.af.site_no_email, site_tried: old.af.site_tried, no_site: old.af.no_site,
    })
  })

  it('🔒 묶음 수가 원본 행 수보다 훨씬 작다 — 아니면 이 설계는 무의미하다', () => {
    // 이 픽스처는 축마다 NULL·빈문자까지 섞어 **일부러 최악**으로 흩어 놓았다(라이브 실측은 175묶음).
    // 지키는 것은 "묶음이 행보다 훨씬 적다" 이지 특정 숫자가 아니다.
    const groups = (db.prepare(COMPANY_CUBE_SQL).all() as unknown[]).length
    expect(groups, `묶음 ${groups}개 — 축을 늘렸는가?`).toBeLessThan(4000 / 4)
  })

  it('🔒 큐브가 실제로 **한 번만** 훑는다(예전 8번의 자리)', () => {
    const plan = (db.prepare('EXPLAIN QUERY PLAN ' + COMPANY_CUBE_SQL).all() as Array<{ detail: string }>)
      .map(r => r.detail).join(' | ')
    expect((plan.match(/SCAN ad_company_leads/g) || []).length, plan).toBe(1)
  })
})

describe('빈 테이블 — 0 이 나와야지 NaN 이 나오면 화면이 깨진다', () => {
  it('모든 숫자가 0', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(CREATE)
    const c = foldCube(db.prepare(COMPANY_CUBE_SQL).all() as unknown as CubeRow[])
    expect(c.stats.total).toBe(0)
    expect(c.byCategory).toEqual([])
    expect(Number.isNaN(c.agencyEmailFunnel.total)).toBe(false)
  })
})

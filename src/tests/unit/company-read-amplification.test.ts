/**
 * 📉 **업체 DB 읽기 증폭 가드** (2026-08-27).
 *
 * ## 무엇을 지키나
 * D1 무료 한도는 **읽은 행 수**로 매겨진다. 업체 DB 는 하루 읽기쿼리가 1,571건뿐인데 **3.91억 행**을
 * 읽고 있었다 — 쿼리당 24.9만 행(테이블 373,336행) = 거의 모든 읽기가 전수 스캔이었다. 세 수리를 했고,
 * 셋 다 **되돌려도 에러가 안 난다**(배포는 초록이고 한도만 조용히 다시 찬다). 그래서 가드가 필요하다.
 *
 * ## 🔬 이 파일이 실제 SQLite 를 띄우는 이유
 * "인덱스를 DDL 에 넣었다"는 **아무것도 보장하지 않는다** — 컬럼 순서나 `DESC` 하나만 어긋나도
 * 플래너가 그냥 무시하고 예전처럼 전수 정렬한다(경고 없음). 문자열 비교로는 그걸 못 본다.
 * ⇒ `node:sqlite` 로 같은 스키마·같은 인덱스를 만들고 **`EXPLAIN QUERY PLAN` 이 실제로 그 인덱스를
 *   쓰는지**, 그리고 **결과 집합이 인덱스 유무와 동일한지**를 본다.
 *
 * ## ⚠️ 이 테스트가 못 막는 것
 * - 라이브 플래너의 선택(D1 의 SQLite 버전·통계가 다를 수 있다). 배포 후 `meta.rows_read` 가 유일한 판정.
 * - 인덱스가 **실제로 생성됐는지**(DDL 은 `ensureCompanySchema` 가 돌아야 적용된다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { COMPANY_INDEX_DDL } from '@/features/marketing/api/company-ddl-indexes'
import { COMPANY_DDL } from '@/features/marketing/api/company-discovery'
import { shouldRecountRemaining, prevRemaining, REMAINING_TTL_MS } from '@/features/marketing/api/enrich-telemetry'

// ⚠️ `import 'node:sqlite'` 를 직접 쓰면 vite 가 번들하려다 실패한다(builtin 목록에 아직 없음).
//   `createRequire` 로 **런타임에** 집어 온다 — 이 파일이 실제 SQLite 플래너를 보는 유일한 경로다.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const enrichSrc = readFileSync('src/features/marketing/api/enrich-lane.ts', 'utf8')
const reclassifySrc = readFileSync('src/features/marketing/api/reclassify-priority.ts', 'utf8')

/** 라이브 스키마에서 그대로 옮긴 최소 형태(이 쿼리들이 만지는 컬럼 전부 포함). */
const CREATE = `CREATE TABLE ad_company_leads (
  id INTEGER PRIMARY KEY AUTOINCREMENT, company_key TEXT NOT NULL, company_name TEXT NOT NULL,
  category TEXT, subcategory TEXT, tier INTEGER, region TEXT, website TEXT, email TEXT, phone TEXT,
  address TEXT, description TEXT, source TEXT NOT NULL DEFAULT 'manual', source_keyword TEXT,
  status TEXT NOT NULL DEFAULT 'new', memo TEXT, active INTEGER NOT NULL DEFAULT 1,
  nps_checked_at DATETIME, enrich_checked_at DATETIME, classified_v INTEGER, enrich_v INTEGER,
  merged_into INTEGER, name_norm TEXT, kakao_checked_at DATETIME, UNIQUE(company_key))`

/** 라이브 분포를 대략 흉내낸 표본(이메일 11%·홈페이지 1.8%·접힌 행 0.5%). 결정론적 시드. */
function seed(rows: number): InstanceType<typeof DatabaseSync> {
  const db = new DatabaseSync(':memory:')
  db.exec(CREATE)
  const ins = db.prepare(`INSERT INTO ad_company_leads
    (id, company_key, company_name, tier, website, email, active, classified_v, merged_into, source)
    VALUES (?,?,?,?,?,?,?,?,?,?)`)
  let r = 12345
  const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648
  for (let i = 1; i <= rows; i++) {
    const merged = rnd() > 0.005 ? null : 1
    ins.run(i, `k${i}`, `회사${i}`, [1, 2, 3, null][Math.floor(rnd() * 4)],
      rnd() < 0.018 ? 'https://x.kr' : null, rnd() < 0.11 ? 'a@b.com' : null,
      rnd() < 0.86 ? 0 : 1, merged === null ? 9 : 3, merged, 'webkr')
  }
  return db
}

const plan = (db: InstanceType<typeof DatabaseSync>, sql: string) =>
  db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((r: Record<string, unknown>) => String(r.detail)).join(' | ')

// enrich-lane 이 실제로 쓰는 대상 쿼리(소스에서 읽어 오지 않고 여기 고정 — 소스가 바뀌면 아래 짝-검사가 잡는다)
const ENRICH_Q = `SELECT id FROM ad_company_leads
  WHERE (active = 0 OR email IS NULL OR email = '') AND merged_into IS NULL
    AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now', '-7 days') OR COALESCE(enrich_v, 0) < 9)
  ORDER BY (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END), (CASE WHEN tier = 1 THEN 0 ELSE 1 END), active ASC, id DESC LIMIT 400`

const RECLASSIFY_PROBE = 'SELECT 1 AS x FROM ad_company_leads WHERE merged_into IS NULL AND COALESCE(classified_v, -1) < 9 LIMIT 1'

describe('① 인덱스가 DDL 에 등재돼 있다', () => {
  it('두 인덱스가 COMPANY_DDL 로 펼쳐진다 — 여기서 빠지면 라이브에 생성되지 않는다', () => {
    const all = COMPANY_DDL.join('\n')
    expect(all).toContain('idx_company_leads_classify_todo')
    expect(all).toContain('idx_company_leads_enrich_order')
    // 기존 인덱스도 함께 살아 있어야 한다(모듈로 옮기며 잃어버리지 않았는지)
    for (const n of ['idx_company_leads_tier', 'idx_company_leads_region', 'idx_company_leads_cat', 'idx_company_leads_active', 'idx_company_leads_name_norm'])
      expect(all).toContain(n)
  })
})

describe('② 플래너가 실제로 그 인덱스를 쓴다 (node:sqlite 실증)', () => {
  const idx = COMPANY_INDEX_DDL.filter(s => /classify_todo|enrich_order/.test(s))

  it('보강 대상 쿼리: 인덱스 없으면 전수 정렬 → 있으면 인덱스 순회 + 결과 동일', () => {
    const db = seed(4000)
    const before = plan(db, ENRICH_Q)
    expect(before).toMatch(/SCAN ad_company_leads(?! USING)/)
    expect(before).toContain('TEMP B-TREE FOR ORDER BY') // 33만 행을 통째로 정렬하던 그 비용
    const rowsBefore = db.prepare(ENRICH_Q).all()
    for (const s of idx) db.exec(s)
    db.exec('ANALYZE')
    const after = plan(db, ENRICH_Q)
    expect(after).toContain('idx_company_leads_enrich_order')
    expect(after).not.toContain('TEMP B-TREE FOR ORDER BY') // ← 이게 사라지는 것이 수리의 전부다
    expect(db.prepare(ENRICH_Q).all()).toEqual(rowsBefore) // 순서·내용 모두 동일
  })

  it('재분류 선검사: 인덱스를 짚어 1행으로 끝난다(전수 스캔이 아니다)', () => {
    const db = seed(4000)
    for (const s of idx) db.exec(s)
    db.exec('ANALYZE')
    expect(plan(db, RECLASSIFY_PROBE)).toContain('idx_company_leads_classify_todo')
    // 할 일이 없을 땐 0건, 생기면 잡아낸다 — 거짓 음성이면 재분류가 조용히 멎는다
    expect(db.prepare(RECLASSIFY_PROBE).all()).toHaveLength(0)
    db.exec('UPDATE ad_company_leads SET classified_v = NULL WHERE id = 2000 AND merged_into IS NULL')
    expect(db.prepare(RECLASSIFY_PROBE).all()).toHaveLength(1) // NULL 도 대상이다(COALESCE -1)
  })
})

describe('③ 인덱스와 쿼리의 짝 — 한쪽만 바뀌면 인덱스가 조용히 무시된다', () => {
  it('enrich-lane 의 ORDER BY 와 인덱스의 정렬 키가 같다', () => {
    const order = enrichSrc.match(/ORDER BY \(CASE WHEN website[\s\S]*?LIMIT \$\{targetCap\}/)
    expect(order, 'enrich-lane 의 대상 ORDER BY 를 못 찾았다 — 쿼리가 바뀌었으면 인덱스도 함께 고칠 것').toBeTruthy()
    const idxSql = COMPANY_INDEX_DDL.find(s => s.includes('idx_company_leads_enrich_order'))!
    const norm = (s: string) => s.replace(/\s+/g, ' ')
    // 정렬 키 4개가 인덱스에도 같은 순서로 들어 있어야 한다
    expect(norm(idxSql)).toContain("(CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END)")
    expect(norm(idxSql)).toContain('(CASE WHEN tier = 1 THEN 0 ELSE 1 END)')
    expect(norm(idxSql)).toContain('active, id DESC')
    expect(norm(idxSql)).toContain('WHERE merged_into IS NULL') // 부분 인덱스 조건 = 쿼리의 WHERE 항
  })
})

describe('④ 재분류 선검사가 배치 앞에 실제로 배선돼 있다', () => {
  it('두 배치 함수 모두 선검사 후 조기 반환한다', () => {
    // 파일 어딘가에 있나가 아니라 **그 분기 문장**을 잡아 조기 반환을 확인한다
    const prio = reclassifySrc.match(/if \(!await hasReclassifyWork\(DB, rulesVersion\)\)[^\n]*/g) || []
    expect(prio.length, '선검사 호출이 두 배치(우선순위·전체크롤) 모두에 있어야 한다').toBe(2)
    expect(prio[0]).toMatch(/return null/)      // pickPriorityBatch → 호출부가 전체크롤로 폴백
    expect(prio[1]).toMatch(/return \{ rows: \[\], cursor \}/) // pickCrawlBatch → 커서 **전진 없이** 빈 배치
  })
  it('조회 실패는 "일이 있다"로 답한다 — 못 물어봤다고 재분류를 멈추면 안 된다', () => {
    const body = reclassifySrc.slice(reclassifySrc.indexOf('export async function hasReclassifyWork'))
    expect(body.slice(0, 600)).toMatch(/catch\(\(\) => 'err' as const\)[\s\S]{0,120}?return true/)
  })
})

describe('⑤ 잔여 백로그 COUNT 는 시간당 1회', () => {
  const now = 1_800_000_000_000
  it('직전 값이 신선하면 다시 세지 않는다', () => {
    expect(shouldRecountRemaining(JSON.stringify({ remaining: 320131, remaining_at: now - 60_000 }), now)).toBe(false)
  })
  it('TTL 이 지났으면 다시 센다', () => {
    expect(shouldRecountRemaining(JSON.stringify({ remaining: 1, remaining_at: now - REMAINING_TTL_MS }), now)).toBe(true)
  })
  it('모르면 센다 — 없음/파손/미래 시각', () => {
    expect(shouldRecountRemaining(null, now)).toBe(true)
    expect(shouldRecountRemaining('{짜부', now)).toBe(true)
    expect(shouldRecountRemaining(JSON.stringify({ remaining: 1 }), now)).toBe(true)
    expect(shouldRecountRemaining(JSON.stringify({ remaining_at: now - 1000 }), now)).toBe(true)
    expect(shouldRecountRemaining(JSON.stringify({ remaining: 1, remaining_at: now + 60_000 }), now)).toBe(true)
  })
  it('안 세는 회차는 직전 값을 이어 쓴다(0 으로 떨어뜨리지 않는다)', () => {
    expect(prevRemaining(JSON.stringify({ remaining: 320131, remaining_at: now }))).toEqual({ remaining: 320131, at: now })
    expect(prevRemaining('{짜부')).toBeNull()
  })
  it('enrich-lane 이 스냅샷에 remaining_at 을 실어 보낸다 — 빠뜨리면 매 회차 다시 세게 된다', () => {
    expect(enrichSrc).toMatch(/remaining_at: remainingAt/)
    expect(enrichSrc).toMatch(/await snapshot\(false, Number\(rem\?\.n\) \|\| 0, remainingAt\)/)
    // COUNT 자체가 게이트 뒤에 있어야 한다(게이트만 계산하고 그대로 세면 아무것도 안 아낀다)
    const gate = enrichSrc.match(/const rem = recount[\s\S]{0,400}/)
    expect(gate?.[0]).toMatch(/\?\s*await DB\.prepare\("SELECT COUNT\(\*\) AS n FROM ad_company_leads/)
    expect(gate?.[0]).toMatch(/:\s*\{ n: carried\?\.remaining/) // 안 세는 쪽은 직전 값
  })
})

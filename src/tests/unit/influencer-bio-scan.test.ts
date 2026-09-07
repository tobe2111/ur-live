import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// ⚠️ `import 'node:sqlite'` 를 직접 쓰면 vite 가 번들하려다 실패한다 — 런타임에 집어 온다.
import { createRequire } from 'module'

/**
 * 🔗 **링크인바이오 보강이 15.3만 행을 읽고 0건을 내던 것** — 2026-08-27, 라이브 실측.
 *
 * ## 실측
 * ```
 *   대상 선택 쿼리 1회  →  rows_read 153,223 · 168ms · 결과 0건
 *   전체 153,312 · bio_checked_at IS NULL 153,221(99.9%) · links 보유 2,410(1.6%) · 링크트리류 74(0.05%)
 * ```
 * `idx_ad_inf_leads_bio(account_id, bio_checked_at)` 는 **거르는 일을 못 한다** — 99.9%가 통과한다.
 * 거기에 `ORDER BY subscriber_count DESC` 가 붙어 그 전부를 임시 B-트리로 정렬했다.
 * ⇒ **0.05%를 찾으려고 100%를 읽고 정렬**했고, 결과가 0건이라 상태줄엔 아무 흔적도 안 남았다.
 *
 * ## 왜 인덱스가 LIKE 를 겨냥하지 않나
 * `links LIKE '%linktr.ee%'` 는 앞에 `%` 라 **어떤 인덱스도 원리적으로 못 돕는다.** 노리는 것은 그 앞
 * 단계다 — `links` 보유자 2,410명으로 63배 좁힌 뒤 LIKE 를 그 안에서만 돌린다.
 *
 * ## 🩸 2026-09-01 — 위 수리는 **한 달 내내 안 먹었다**
 * 라이브 실측: 하루 41,114,785행 / 238회(회당 172,751). 15.3만이 그대로였다.
 * 원인은 부분 인덱스가 아니라 **그 옆의 `idx_ad_inf_leads_bio(account_id, bio_checked_at)`** 였다 —
 * 99.9%를 통과시켜 거르는 일은 못 하면서, 플래너에겐 *동등 조건 두 개*로 보여 **부분 인덱스를 이긴다.**
 * ⇒ 그 인덱스를 지웠다(WHERE 로 쓰는 곳은 이 쿼리 하나뿐 — 전수 grep).
 *
 * 그리고 이 파일이 원래 *"인덱스가 실제로 쓰이는지는 레포에서 확인 불가"* 라고 적어 두고 넘어간 것이
 * 한 달을 벌게 했다. **확인 가능하다** — `node:sqlite` 로 플래너를 직접 돌리면 된다(업체 쪽
 * `company-read-amplification.test.ts` 가 이미 쓰던 방법이다). 아래 ③ 이 그것이다.
 *
 * ## 이 테스트가 **못** 막는 것
 * - 실제 감소폭 — 라이브 `rows_read` 로만 판정된다(기준: 회당 17.3만 → 수천 대).
 * - 다른 레인의 스캔. 이 파일은 이 쿼리 하나만 지킨다.
 */
const schema = readFileSync('src/features/marketing/api/influencer-schema.ts', 'utf8')
// 2026-08-27: 600줄 래칫으로 `influencer-bio-enrich.ts` 로 분리됐다(로직 이동뿐).
const lane = readFileSync('src/features/marketing/api/influencer-bio-enrich.ts', 'utf8')
const code = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')

/** 대상 선택 쿼리 본문만 잘라낸다 — 파일 어딘가가 아니라 **이 쿼리**를 봐야 한다. */
function bioQuery(): string {
  const body = code(lane)
  const at = body.indexOf('bio_checked_at IS NULL AND (email IS NULL OR instagram IS NULL)')
  expect(at, '대상 선택 쿼리를 못 찾았다(코드가 옮겼으면 이 앵커를 고칠 것)').toBeGreaterThan(-1)
  return body.slice(Math.max(0, at - 300), at + 700)
}

describe('부분 인덱스 배선', () => {
  it('🩸 links 보유자로 좁히는 부분 인덱스가 있다 — 없으면 99.9%가 그대로 통과한다', () => {
    const ddl = code(schema)
    expect(ddl).toMatch(/CREATE INDEX IF NOT EXISTS idx_ad_inf_leads_bio_links[\s\S]*?WHERE links IS NOT NULL AND bio_checked_at IS NULL/)
  })

  it('🩸 인덱스 컬럼이 (account_id, id) 다 — ORDER BY id 를 정렬 없이 받으려면 이 형태여야 한다', () => {
    expect(code(schema)).toMatch(/idx_ad_inf_leads_bio_links ON ad_influencer_leads\(account_id, id\)/)
  })

  it('🪦 거르지 못하면서 부분 인덱스를 이기던 `idx_ad_inf_leads_bio` 를 되살리지 않았다', () => {
    const ddl = code(schema)
    expect(ddl, '지우는 문장이 있어야 라이브에서 실제로 사라진다').toContain('DROP INDEX IF EXISTS idx_ad_inf_leads_bio')
    expect(ddl, '다시 만들면 플래너가 또 그쪽을 고른다').not.toMatch(/CREATE INDEX[^\n]*idx_ad_inf_leads_bio ON/)
  })
})

describe('쿼리가 그 인덱스를 탈 수 있는 모양인가', () => {
  it('🩸 인덱스 못 타는 정렬(subscriber_count)이 없다 — 붙는 순간 전수 임시정렬로 돌아간다', () => {
    const q = bioQuery()
    expect(q, 'subscriber_count 정렬은 이 쿼리의 비용 전부였다').not.toMatch(/ORDER BY[^`]*subscriber_count/)
    expect(q).toMatch(/ORDER BY id DESC/)
  })

  it('🩸 WHERE 가 부분 인덱스 조건을 함의한다 — 둘 중 하나만 빠져도 인덱스가 안 쓰인다', () => {
    const q = bioQuery()
    expect(q, 'links IS NOT NULL 이 있어야 부분 인덱스가 적용된다').toMatch(/links IS NOT NULL/)
    expect(q, 'bio_checked_at IS NULL 도 같은 이유로 필요하다').toMatch(/bio_checked_at IS NULL/)
  })

  it('LIKE 필터는 그대로 남는다 — 인덱스가 겨냥하는 건 LIKE 가 아니라 그 앞 단계다', () => {
    expect(bioQuery()).toMatch(/links LIKE '%linktr\.ee%'/)
  })
})

/**
 * ③ **플래너를 실제로 돌려 본다** (2026-09-01 신설).
 *
 * 이 파일이 한 달 동안 초록이었는데 라이브는 안 고쳐져 있었다 — 문자열만 봤기 때문이다.
 * `node:sqlite` 로 같은 스키마·같은 인덱스를 세우고 `EXPLAIN QUERY PLAN` 을 읽으면
 * "인덱스를 정말 타는가"가 레포 안에서 판정된다.
 *
 * ⚠️ 못 보는 것: 라이브의 실제 데이터 분포(플래너는 통계 없이 판단하므로 형태만 같으면 되지만,
 *   결정이 데이터에 따라 달라질 여지는 남는다). 최종 판정은 `rows_read` 다.
 */
describe('③ 플래너 실증 (node:sqlite)', () => {
  const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
  /** 스키마 SSOT 에서 이 테이블에 관한 문장만 실제로 실행한다 — 손으로 베끼면 또 갈린다. */
  const ddlStatements = (): string[] => {
    const out: string[] = []
    for (const m of code(schema).matchAll(/'((?:CREATE|DROP|ALTER)[^']*ad_influencer_leads[^']*)'|`((?:CREATE|DROP|ALTER)[\s\S]*?ad_influencer_leads[\s\S]*?)`/g))
      out.push((m[1] || m[2]).replace(/\s+/g, ' ').trim())
    expect(out.length, 'SSOT 에서 DDL 을 하나도 못 읽었다 — 정규식이 낡았다').toBeGreaterThan(4)
    return out
  }
  const seed = () => {
    const db = new DatabaseSync(':memory:')
    for (const sql of ddlStatements()) { try { db.exec(sql) } catch { /* CREATE TABLE 뒤 ALTER 중복 등 — 라이브와 같은 관용 */ } }
    const ins = db.prepare('INSERT INTO ad_influencer_leads (id,account_id,platform,handle,channel_id,name,url,email,instagram,links,region,source_keyword,bio_checked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    let r = 9; const rnd = () => (r = (r * 1103515245 + 12345) % 2147483648) / 2147483648
    for (let i = 1; i <= 20000; i++)
      ins.run(i, 0, 'naver_blog', 'h' + i, 'c' + i, '이름' + i, 'https://u/' + i, rnd() < 0.15 ? `A${i}@B.com` : null, rnd() < 0.1 ? `IG${i}` : null,
        rnd() < 0.016 ? 'https://linktr.ee/x' : null, rnd() < 0.5 ? null : '서울', 'kw' + i, rnd() < 0.999 ? null : '2026-01-01')
    return db
  }
  const plan = (db: InstanceType<typeof DatabaseSync>, sql: string) =>
    db.prepare('EXPLAIN QUERY PLAN ' + sql).all().map((x: Record<string, unknown>) => String(x.detail)).join(' | ')

  it('🔒 링크인바이오 대상 선택이 **부분 인덱스**를 탄다 (한 달을 놓친 자리)', () => {
    const db = seed()
    const q = `SELECT id, links, email, instagram, tiktok FROM ad_influencer_leads
      WHERE account_id = 0 AND bio_checked_at IS NULL AND (email IS NULL OR instagram IS NULL)
        AND links IS NOT NULL AND (links LIKE '%linktr.ee%') ORDER BY id DESC LIMIT 30`
    expect(plan(db, q)).toContain('idx_ad_inf_leads_bio_links')
    db.close()
  })

  it('🔒 대소문자 무시 조회 두 건이 **식 인덱스**를 탄다 (하루 4,626만 행)', () => {
    const db = seed()
    for (const [q, idx] of [
      [`SELECT id FROM ad_influencer_leads WHERE account_id = 0 AND LOWER(email) = LOWER('A7@b.com')`, 'idx_ad_inf_leads_email_ci'],
      [`SELECT id FROM ad_influencer_leads WHERE account_id = 0 AND LOWER(instagram) = 'ig7'`, 'idx_ad_inf_leads_instagram_ci'],
    ] as const) {
      const p = plan(db, q)
      expect(p, q).toContain(idx)
      expect(p, '식 자체를 짚어야 탐색이 된다').toMatch(/<expr>=\?/)
    }
    db.close()
  })

  it('🔒 핸들 존재 확인이 세 번째 키까지 짚는다 (하루 1,655만 행)', () => {
    const db = seed()
    const q = `SELECT handle AS k FROM ad_influencer_leads WHERE account_id = 0 AND platform = 'naver_blog'
      AND handle IN ('h1','h2') AND (COALESCE(email,'') <> '' OR COALESCE(instagram,'') <> '')`
    expect(plan(db, q)).toMatch(/idx_ad_inf_leads_handle .*handle=\?/)
    db.close()
  })

  it('🔒 지역 미확인 대상이 부분 인덱스를 탄다 (하루 1,211만 행)', () => {
    const db = seed()
    const q = `SELECT id, source_keyword FROM ad_influencer_leads
      WHERE account_id = 0 AND region IS NULL AND source_keyword IS NOT NULL AND source_keyword != '' LIMIT 200`
    expect(plan(db, q)).toContain('idx_ad_inf_leads_region_todo')
    db.close()
  })

  it('🔒 빠르기만 하고 답이 달라지면 고친 게 아니다 — 인덱스 없는 사본과 결과가 같다', () => {
    const withIdx = seed()
    const bare = new DatabaseSync(':memory:')
    for (const sql of ddlStatements()) { if (/^(CREATE TABLE|ALTER)/.test(sql)) { try { bare.exec(sql) } catch { /* 중복 컬럼 */ } } }
    for (const row of withIdx.prepare('SELECT id,account_id,platform,handle,channel_id,name,url,email,instagram,links,region,source_keyword,bio_checked_at FROM ad_influencer_leads').all())
      bare.prepare('INSERT INTO ad_influencer_leads (id,account_id,platform,handle,channel_id,name,url,email,instagram,links,region,source_keyword,bio_checked_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .run(...Object.values(row as Record<string, never>))
    for (const q of [
      `SELECT id FROM ad_influencer_leads WHERE account_id = 0 AND LOWER(email) = LOWER('A7@b.com') ORDER BY id`,
      `SELECT id FROM ad_influencer_leads WHERE account_id = 0 AND LOWER(instagram) = 'ig7' ORDER BY id`,
      `SELECT id, source_keyword FROM ad_influencer_leads WHERE account_id = 0 AND region IS NULL AND source_keyword IS NOT NULL AND source_keyword != '' ORDER BY id LIMIT 200`,
    ]) expect(withIdx.prepare(q).all(), q).toEqual(bare.prepare(q).all())
    withIdx.close(); bare.close()
  })
})

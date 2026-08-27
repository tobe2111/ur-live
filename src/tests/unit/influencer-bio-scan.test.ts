import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

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
 * ## 이 테스트가 **못** 막는 것
 * - 인덱스가 실제로 쓰이는지 — SQLite 옵티마이저의 판단이라 레포에서 확인 불가.
 *   **배포 후 `rows_read` 로만 판정된다**(기준: 15.3만 → 수천 대).
 * - 다른 레인의 스캔. 이 파일은 이 쿼리 하나만 지킨다.
 */
const schema = readFileSync('src/features/marketing/api/influencer-schema.ts', 'utf8')
const lane = readFileSync('src/features/marketing/api/influencer-enrich-lane.ts', 'utf8')
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

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FRESH_KEYWORD_SLOTS, FRESH_MAX_SHARE, pickCompanyKeywords } from '@/features/marketing/api/company-keyword-pick'

/**
 * 🌱 **신규 키워드 우선 자리** — 새로 넣은 키워드가 커서를 기다리지 않게 한다.
 *
 * ## 왜 (2026-08-18 실측)
 * ```
 * 활성 4,555 중 미실행 3,279   ·   커서 1,276   ·   시간당 ~1.9칸   →  끝 도달까지 ≈ 72일
 * 대표가 요청한 체험단 9개 = 전부 last_run_at IS NULL, 그 줄 끝
 * ```
 * tier 우선 정렬은 이미 있었지만 부족했다 — 새 키워드는 **같은 tier 안에서 id 가 뒤**라 맨 끝에 선다.
 *
 * ## 못 막는 것
 * - 자리 수(4)가 적절한지 — 회전 지연 대 신규 반영의 트레이드오프라 라이브 추이로만 안다.
 * - 실제로 체험단 리드가 잡히는지 — 배포 후 `ad_company_leads.subcategory` 로 확인.
 */
const src = readFileSync('src/features/marketing/api/company-keyword-pick.ts', 'utf8')

describe('배선', () => {
  it('미실행 키워드를 먼저 뽑는다', () => {
    expect(src).toContain('last_run_at IS NULL')
    // 2026-08-23: 자리 수가 고정(4) → 재고에 따라 스스로 넓히는 식으로 바뀌었다. 지키는 것은 그대로 —
    //   미실행을 **먼저** 뽑는다는 것. (배분 규칙 자체는 아래 '자리를 스스로 넓힌다' 가 검사한다.)
    expect(src).toContain('const freshLimit = Math.max(0, Math.min(batchSize,')
  })

  it('🩸 정렬을 바꾸지 않는다 — ORDER BY 에 넣으면 OFFSET 창에 건너뜀·중복이 생긴다', () => {
    // 회전 창 쿼리의 ORDER BY 는 불변(tier, id)이어야 한다.
    const rot = src.slice(src.indexOf('for (const w of rotationWindow'))
    expect(src).toContain("ORDER = 'ORDER BY (tier IS NULL) ASC, tier ASC, id ASC'")
    expect(rot).toContain('LIMIT ? OFFSET ?')
    expect(rot).not.toContain('last_run_at IS NULL')
  })

  it('🔒 같은 키워드를 한 회차에 두 번 호출하지 않는다(id dedup)', () => {
    expect(src).toContain('const seen = new Set(kws.map(k => k.id))')
    expect(src).toContain('if (!seen.has(r.id))')
  })

  it('🔒 커서는 안 건드린다 — 우선 픽은 커서 시퀀스 밖이라 회전 진행분이 남는다', () => {
    const block = src.slice(src.indexOf('const freshLimit'))
    expect(block).not.toMatch(/cursor\s*=/)
  })

  it('🔒 회차 예산을 넘기지 않는다 — 우선 픽만큼 회전 창을 줄인다', () => {
    expect(src).toContain('rotationWindow(total, cursor, Math.max(1, batchSize - kws.length))')
  })

  /**
   * 🔁 **재고가 배분을 정한다** (2026-08-23 대표 "자동으로 계속 가능하게").
   *   자리를 4로 고정했더니 미실행 2,843개를 다 훑는 데 30일이 걸렸고, 그동안 회전은 가장 마른
   *   구간을 돌아 회차 신규율이 7.8% 까지 떨어졌다(실측: 이미 훑은 키워드 saved 0 vs 첫 실행 saved 10/10).
   *
   *   ## 이 테스트가 못 막는 것
   *   - 75% 가 최적인지 — 신선도 대 회전의 트레이드오프라 라이브 추이로만 안다.
   *   - 두 레인이 같은 미실행 줄을 동시에 집는 경우(중복 호출 몇 건, 저장은 dedup 이라 무해).
   */
  it('🌱 미실행이 많으면 자리를 스스로 넓힌다 — 카운트 쿼리 없이', async () => {
    const asked: number[] = []
    const db = {
      prepare(sql: string) {
        return {
          bind(...v: unknown[]) {
            if (/last_run_at IS NULL/.test(sql)) asked.push(Number(v[0]))
            return this
          },
          async all() { return { results: [] } },
        }
      },
    } as unknown as D1Database
    await pickCompanyKeywords(db, 4555, 0, 12)
    expect(asked[0], '배치 12 × 75% = 9 (고정 4가 아니라)').toBe(9)
    // 백로그를 세는 쿼리를 새로 만들지 않았다 — 재고는 DB 가 주는 행 수로 드러난다(서브리퀘스트 0 추가).
    expect(readFileSync('src/features/marketing/api/company-keyword-pick.ts', 'utf8'))
      .not.toMatch(/COUNT\(\*\)/)
  })

  it('🔒 회전 몫을 남긴다 — 신선도만 쫓으면 이미 도는 키워드가 다음 백로그가 된다', () => {
    expect(FRESH_MAX_SHARE).toBeLessThan(1)
    expect(FRESH_MAX_SHARE).toBeLessThanOrEqual(0.75)
    expect(src).toContain('Math.floor(batchSize * FRESH_MAX_SHARE)')
  })

  it('🔒 전부를 앞세우지 않는다 — 그러면 회전이 몇 주 멈춘다', () => {
    expect(FRESH_KEYWORD_SLOTS).toBeGreaterThan(0)
    expect(FRESH_KEYWORD_SLOTS).toBeLessThan(12 / 2)   // 기본 배치(12)의 절반 미만
  })
})

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FRESH_KEYWORD_SLOTS } from '@/features/marketing/api/company-keyword-pick'

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
    expect(src).toContain('const freshLimit = Math.max(0, Math.min(batchSize, FRESH_KEYWORD_SLOTS))')
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

  it('🔒 전부를 앞세우지 않는다 — 그러면 회전이 몇 주 멈춘다', () => {
    expect(FRESH_KEYWORD_SLOTS).toBeGreaterThan(0)
    expect(FRESH_KEYWORD_SLOTS).toBeLessThan(12 / 2)   // 기본 배치(12)의 절반 미만
  })
})

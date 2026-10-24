/**
 * 🏁 **원부 끝에 닿은 것은 '완주' 이고 '사망' 이 아니다** — `collect-franchise` (2026-10-24 라이브 실측).
 *
 * ## 라이브가 말한 것
 * ```
 *   collect-franchise : total_runs 86 · total_saved 0 · fail_streak 39 · first_failed_at 2026-09-12
 *   diag.error        : "응답은 정상(rc=00)인데 items 0 — totalCount=11175"
 *   cursor(page)      : 113          numOfRows = 100   ⇒ 마지막 유효 페이지는 112
 * ```
 * 두 가지가 겹쳐 있었다:
 * 1. **커서가 끝을 넘어 113 에 주차**했고 되돌리는 코드가 없다 → 새로 등록된 가맹본부가 **영영 안 들어온다**.
 * 2. 그 정상 응답을 `diag.error` 로 올려 레인 건강이 **86회 연속 가짜 적색**을 냈다 —
 *    그리고 그 가짜 적색이 **진짜 죽은 레인을 가렸다**(화면에 하나만 뜬다).
 *
 * 전례: `commerce` 레인이 2026-07-29 에 같은 이유로 **신규/재확인을 분리**했다 —
 * *"원부를 다 훑으면 신규는 0 에 수렴한다. 그건 '죽음'이 아니라 '완주'다."*
 *
 * ⚠️ **못 막는 것**: 공공 API 를 이 환경에서 못 때리므로 "정말 112 페이지가 끝인지" 는 못 잰다.
 * 막는 것은 **끝에 닿았을 때의 처리**(커서 되돌림 · 오류로 올리지 않음 · 건강 판정)다.
 * 라이브 판정은 배포 뒤 `ads_franchise_cursor` 가 1 로 돌아오는지 + `laneHealth` 에서 사라지는지.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { judgeLaneYield, DEAD_AFTER_RUNS } from '@/features/marketing/api/lane-yield-health'

const SRC = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/franchise-collect.ts'), 'utf8')

describe('레인 건강 — 완주를 사망으로 읽지 않는다', () => {
  it('🔴 재확인(upserted)이 있으면 저장 0 이어도 건강하다', () => {
    expect(judgeLaneYield('collect-franchise', {
      total_runs: 86, total_saved: 0, total_upserted: 11_175, found: 0,
      diag: { configured: true },
    })).toBeNull()
  })

  it('🔴 이번 회차가 원부 끝에 닿았으면(completed) 저장 0 이어도 건강하다', () => {
    expect(judgeLaneYield('collect-franchise', {
      total_runs: 86, total_saved: 0, completed: true, found: 0, diag: { configured: true },
    })).toBeNull()
  })

  it('🔒 진짜로 한 번도 성공한 적 없는 레인은 **여전히** 사망으로 잡는다', () => {
    const v = judgeLaneYield('collect-nps', {
      total_runs: 86, total_saved: 0, found: 0,
      diag: { configured: true, error: 'API: 네트워크 오류' },
    })
    expect(v?.severity).toBe('dead')
    expect(v?.message).toContain('86회')
  })

  it('🔒 신규가 있으면 그대로 건강 — 그리고 회차 수 하한은 유지된다', () => {
    expect(judgeLaneYield('x', { total_runs: 99, total_saved: 5, found: 3, diag: {} })).toBeNull()
    expect(judgeLaneYield('x', { total_runs: DEAD_AFTER_RUNS - 1, total_saved: 0, found: 0, diag: { configured: true, error: 'e' } }))
      .toBeNull() // 막 켠 레인을 사고로 오인하지 않는다
  })
})

describe('franchise 레인 — 끝에 닿으면 커서를 되돌린다', () => {
  it('🔴 완주 판정이 **정상 응답 + items 0 + totalCount>0** 셋을 모두 본다', () => {
    expect(SRC).toContain('const endOfRegistry = arr.length === 0')
    expect(SRC).toContain('Number(total) > 0')
    // 에러로 끝난 0건(404·네트워크)은 완주가 아니다 — rc 정상 조건이 그걸 가른다.
    expect(SRC).toMatch(/rc === '00'|\/\^0\+\$\/\.test\(rc\)/)
  })

  it('🔴 완주면 커서를 1 로 되돌린다(안 되돌리면 새 가맹본부가 영영 안 들어온다)', () => {
    expect(SRC).toContain('if (endOfRegistry) { completed = true; page = 1 }')
    // 그리고 그 값이 실제로 저장된다.
    expect(SRC).toMatch(/bind\(CURSOR_KEY, String\(page\)\)/)
  })

  it('🔴 완주 회차는 `diag.error` 를 올리지 않는다(가짜 적색의 원인)', () => {
    expect(SRC).toContain('found === 0 && lastMsg && !completed')
  })

  it('🔴 신규/재확인을 분리해 센다(commerce 전례)', () => {
    expect(SRC).toContain('saveCompanyLeadsCounted')
    expect(SRC).toContain('saved += c.inserted; upserted += c.upserted')
    expect(SRC).toMatch(/total_upserted: \(prev\?\.total_upserted \|\| 0\) \+ upserted/)
  })

  it('검사 대상이 실제로 존재한다 — 0건 통과를 성공으로 오인하지 않게', () => {
    expect(SRC).toContain('runFranchiseCollect')
    expect(SRC.length).toBeGreaterThan(3000)
  })
})

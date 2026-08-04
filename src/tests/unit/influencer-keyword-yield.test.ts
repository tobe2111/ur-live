/**
 * 🎯 키워드 목적함수 — "몇 명 모았나"가 아니라 "몇 명 부를 수 있나" (2026-08-04 대표 지시).
 *
 * 이 시험이 지키는 것은 **목적함수 자체**다. 라이브 실측이 근거다:
 * ```
 *   금천 네일  리드 118 · 이메일   0  → 옛 기준으로 "우수"(barren_streak 0 · yieldPenalty 0)
 *   먹방       리드  50 · 이메일  33  (66%)
 * ```
 * ⚠️ 이 시험이 **못** 보는 것: 재계산이 실제 라이브에서 도는가(그건 배선 검사 + 어드민 `kwyield` 관측).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  contactPenalty, CONTACT_EVIDENCE_MIN, CONTACT_OK_RATE, CONTACT_PENALTY_MAX, KEYWORD_YIELD_DDL,
} from '@/features/marketing/api/influencer-keyword-yield'
import { pickYtKeywords, type YtPickKeyword } from '@/features/marketing/api/influencer-keyword-rotation'

describe('연락처 확보율 감점', () => {
  it('증거가 부족하면 벌주지 않는다 — 갓 만든 키워드를 0%로 낙인찍으면 탐색이 죽는다', () => {
    expect(contactPenalty(CONTACT_EVIDENCE_MIN - 1, 0)).toBe(0)
    expect(contactPenalty(0, 0)).toBe(0)
    expect(contactPenalty(null, null)).toBe(0)
  })

  it('확보율이 기준 이상이면 감점 0', () => {
    expect(contactPenalty(100, Math.ceil(CONTACT_OK_RATE * 100))).toBe(0)
    expect(contactPenalty(100, 66)).toBe(0) // 먹방 급
  })

  it('0% 는 최대 감점 — 우선 카테고리 보너스(+50)를 **혼자서** 상쇄해야 한다', () => {
    expect(contactPenalty(118, 0)).toBe(CONTACT_PENALTY_MAX) // 금천 네일(실측)
    expect(CONTACT_PENALTY_MAX).toBeGreaterThan(50)
  })

  it('중간값은 비례한다 — 절벽이 아니라 기울기', () => {
    const half = contactPenalty(100, Math.round(CONTACT_OK_RATE * 100 / 2))
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(CONTACT_PENALTY_MAX)
  })

  it("빈 문자열 이메일을 연락처로 세지 않는다 — 집계 SQL 이 `email <> ''` 를 갖는다", () => {
    const src = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/influencer-keyword-yield.ts'), 'utf8')
    expect(src).toMatch(/email IS NOT NULL AND email <> ''/)
  })
})

describe('🎚️ 선택 점수가 실제로 바뀐다 — 연락처 0% 키워드가 밀려난다', () => {
  const base = (o: Partial<YtPickKeyword>): YtPickKeyword => ({
    id: 1, keyword: 'k', category: '맛집', source: 'seed',
    saved_total: 100, last_saved: 5, found_total: 200, barren_streak: 0,
    last_run_at: '2020-01-01 00:00:00', ...o,
  } as YtPickKeyword)

  it('리드는 잘 물어오지만 **연락처 0%** 인 키워드는 연락처 있는 키워드에 밀린다', () => {
    const barren = base({ id: 1, keyword: '금천 네일', yt_leads: 118, yt_contacts: 0 })
    const good = base({ id: 2, keyword: '먹방', saved_total: 50, last_saved: 3, yt_leads: 50, yt_contacts: 33 })
    const [first] = pickYtKeywords([barren, good], 1, Date.parse('2026-08-04T00:00:00Z'))
    expect(first.keyword, '연락처 0% 키워드가 아직도 먼저 뽑힌다 — 목적함수가 옛것이다').toBe('먹방')
  })

  it('연락처 성과가 **없는**(미측정) 키워드는 기존 동작 그대로 — 감점이 조용히 끼어들지 않는다', () => {
    const a = base({ id: 1, keyword: 'A', saved_total: 100 })
    const b = base({ id: 2, keyword: 'B', saved_total: 10, last_saved: 0 })
    const [first] = pickYtKeywords([a, b], 1, Date.parse('2026-08-04T00:00:00Z'))
    expect(first.keyword).toBe('A') // yt_leads/yt_contacts 미지정 → 감점 0 → 누적 성과가 이긴다
  })
})

describe('🔌 배선 — 재계산이 안 돌면 감점이 영원히 0 이다(조용한 무효화)', () => {
  const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

  it('정비 단계가 재계산을 호출한다', () => {
    const m = SRC('src/features/marketing/api/influencer-maintenance.ts')
    expect(m).toContain('recomputeKeywordContactYield')
    // 예산 래퍼(bdb)가 아니라 **원본 DB** 로 불러야 앞 작업이 예산을 다 써도 살아남는다
    expect(m).toMatch(/recomputeKeywordContactYield\(DB\)/)
  })

  it('키워드 SELECT 가 성과 컬럼을 실어 온다 — 안 실으면 점수식이 항상 undefined 를 본다', () => {
    const c = SRC('src/features/marketing/api/influencer-auto-collect.ts')
    expect(c).toContain('yt_leads')
    expect(c).toContain('yt_contacts')
  })

  it('점수식이 감점을 **실제로 뺀다**', () => {
    const r = SRC('src/features/marketing/api/influencer-keyword-rotation.ts')
    const score = r.slice(r.indexOf('const score = (k: YtPickKeyword)'))
    expect(score.slice(0, 400)).toContain('contactPenalty(')
  })

  it('DDL 이 두 컬럼을 만든다(멱등 ALTER)', () => {
    expect(KEYWORD_YIELD_DDL.join(' ')).toContain('yt_leads')
    expect(KEYWORD_YIELD_DDL.join(' ')).toContain('yt_contacts')
  })
})

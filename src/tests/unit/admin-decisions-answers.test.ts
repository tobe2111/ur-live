/**
 * 📥 2026-09-08 어드민 결재함 답 우편함 — 순수 검증 + 배선 계약.
 *   못 막는 것: D1 실제 upsert 동작(통합), rateLimit 실동작. 그건 배포 후 어드민에서 답 1회(E4).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { isValidDecisionSlug, normalizeDecisionAnswer, DECISION_ANSWER_MAX, DECISION_ANSWERS_TABLE_SQL } from '@/worker/utils/decision-answers'
import { stripComments as codeOnly } from '../helpers/source-text'

const root = process.cwd()
const read = (p: string) => readFileSync(join(root, p), 'utf8')

describe('decision-answers 순수 검증', () => {
  it('slug 는 파일명 규약(YYYY-MM-DD-kebab)만 통과 — 경로 조작·대문자·공백 차단', () => {
    expect(isValidDecisionSlug('2026-09-07-seller-auto-approval')).toBe(true)
    expect(isValidDecisionSlug('../etc/passwd')).toBe(false)
    expect(isValidDecisionSlug('2026-09-07-Seller')).toBe(false)
    expect(isValidDecisionSlug('2026-09-07-a b')).toBe(false)
    expect(isValidDecisionSlug('')).toBe(false)
    expect(isValidDecisionSlug(42)).toBe(false)
  })

  it('답은 앞뒤 공백만 벗기고 원문 보존 — 빈 값·초과 길이·비문자열은 null', () => {
    expect(normalizeDecisionAnswer('  1  ')).toBe('1')
    expect(normalizeDecisionAnswer('2번, 단 N=10')).toBe('2번, 단 N=10')
    expect(normalizeDecisionAnswer('')).toBeNull()
    expect(normalizeDecisionAnswer('   ')).toBeNull()
    expect(normalizeDecisionAnswer('x'.repeat(DECISION_ANSWER_MAX + 1))).toBeNull()
    expect(normalizeDecisionAnswer(123)).toBeNull()
  })

  it('테이블 SQL 이 repair-schema 와 마이그레이션에 같은 컬럼으로 미러돼 있다', () => {
    const cols = ['slug TEXT PRIMARY KEY', 'answer TEXT NOT NULL', 'answered_by TEXT', 'synced_at TEXT', 'synced_ref TEXT']
    for (const src of [DECISION_ANSWERS_TABLE_SQL, read('src/worker/routes/repair-schema/aux-tables.ts'), read('migrations/0287_decision_answers.sql')]) {
      for (const c of cols) expect(src).toContain(c)
    }
  })
})

describe('decision-answers 배선', () => {
  it('어드민 라우트가 adminApp 아래 마운트돼 requireAdmin 을 상속한다', () => {
    const idx = codeOnly(read('src/worker/index.ts'))
    expect(idx).toMatch(/adminApp\.route\('\/',\s*adminDecisionsRoutes\)/)
  })
  it('답 저장 엔드포인트는 slug 검증 + 원문 정규화 + rateLimit 을 거친다', () => {
    const src = codeOnly(read('src/features/admin/api/admin-decisions.routes.ts'))
    expect(src).toContain("'/decisions/:slug/answer'")
    expect(src).toContain('isValidDecisionSlug(slug)')
    expect(src).toContain('normalizeDecisionAnswer(body.answer)')
    expect(src).toMatch(/rateLimit\(\{\s*action:\s*'decision_answer'/)
  })
  it('페이지는 open 카드에만 AnswerBox 를 그리고 답 목록을 어드민 API 에서 읽는다', () => {
    const page = codeOnly(read('src/pages/admin/AdminDecisionsPage.tsx'))
    expect(page).toContain("api.get('/api/admin/decisions/answers')")
    expect(page).toMatch(/d\.status === 'open'[\s\S]{0,80}<AnswerBox/)
    const box = codeOnly(read('src/pages/admin/decisions/AnswerBox.tsx'))
    expect(box).toContain('/api/admin/decisions/${encodeURIComponent(slug)}/answer')
  })
})

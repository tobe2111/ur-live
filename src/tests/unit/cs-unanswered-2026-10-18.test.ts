/**
 * 💬 카카오 봇 미답변 질문 수집 — 실제 SQLite 로 판정.
 * 지키는 것: 개인정보(번호 4자리+·이메일) 가림 · 같은 질문은 한 줄로 모여 횟수만 증가 ·
 * 인사/상담원 요청은 저장 안 함 · 봇 폴백 경로에 배선 · 어드민 조회 경로 존재.
 * ⚠️ 못 막는 것: 이름·주소 같은 숫자 아닌 개인정보(발화에 직접 적으면 그대로 남는다).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { CS_UNANSWERED_DDL, maskUtterance, normalizeUnanswered } from '@/worker/utils/cs-unanswered'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

describe('미답변 질문 수집', () => {
  it('번호·이메일을 가린다', () => {
    expect(maskUtterance('010-1234-5678 로 연락주세요 a@b.com')).toBe('# 로 연락주세요 [이메일]')
    expect(maskUtterance('이용권 123456 안돼요')).toBe('이용권 # 안돼요')
    expect(maskUtterance('3명 예약 가능해요?')).toBe('3명 예약 가능해요?')
  })
  it('인사·상담원 요청·너무 짧은 말은 저장 안 한다', () => {
    expect(normalizeUnanswered('상담원 연결')).toBeNull()
    expect(normalizeUnanswered('안녕하세요')).toBeNull()
    expect(normalizeUnanswered('?')).toBeNull()
    expect(normalizeUnanswered('주차 되나요?')).not.toBeNull()
  })
  it('번호만 다른 같은 질문은 한 줄로 모여 횟수가 는다', () => {
    const db = new DatabaseSync(':memory:')
    db.exec(CS_UNANSWERED_DDL)
    const sql = readFileSync('src/worker/utils/cs-unanswered.ts', 'utf8').match(/`(INSERT INTO cs_unanswered_questions[\s\S]*?)`/)![1]
    for (const u of ['코드 111111 안돼요', '코드 222222 안돼요!', '주차 되나요']) {
      const n = normalizeUnanswered(u)!
      db.prepare(sql).run(n.norm, n.sample)
    }
    const rows = db.prepare('SELECT sample, hits FROM cs_unanswered_questions ORDER BY hits DESC').all() as { sample: string; hits: number }[]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ hits: 2 })
    expect(rows[0].sample).not.toMatch(/\d{4}/)
  })
  it('봇 폴백 경로와 어드민 조회에 배선돼 있다', () => {
    const hook = readFileSync('src/worker/routes/kakao-skill-webhook.routes.ts', 'utf8')
    const i = hook.lastIndexOf('recordUnanswered(DB, utterance)')
    expect(i).toBeGreaterThan(0)
    expect(hook.slice(i, i + 200)).toMatch(/skillResponse\(CS_FAQ_FALLBACK\)/)
    const admin = readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
    expect(admin).toMatch(/get\('\/cs-unanswered'[\s\S]{0,200}listUnanswered\(/)
  })
})

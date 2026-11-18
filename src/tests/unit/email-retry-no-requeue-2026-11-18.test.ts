/**
 * 🩸 2026-11-18 메일 재시도가 실패할 때마다 새 실패 행을 만들던 것 — 대표 "더 개선할 것들 찾아줘".
 *   라이브: email_failures 미해결 147건 중 142건이 시험 메일 1통이 불어난 것(10-12 2.5시간에 9 → 49 → 84행).
 * 지키는 것: ① `noQueue` 면 실패해도 email_failures 에 INSERT 하지 않는다 ② 보통 호출은 종전대로 실패를 큐에 넣는다
 *   ③ 재시도 cron 이 `noQueue: true` 로 부른다.
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.mock('@/services/email', () => ({ sendEmail: vi.fn(async () => ({ success: false, error: 'boom' })) }))
import { sendSystemEmail } from '@/lib/system-email'

function db() {
  const sql: string[] = []
  return { sql, DB: { prepare: (s: string) => { sql.push(s); return { bind: () => ({ run: async () => ({}), first: async () => null }), run: async () => ({}) } } } }
}

describe('메일 재시도는 실패 행을 불리지 않는다', () => {
  it('noQueue 면 실패해도 INSERT 0', async () => {
    const d = db()
    const r = await sendSystemEmail({ RESEND_API_KEY: 'x', DB: d.DB }, 'a@example.com', { subject: 's', html: 'h' }, { ignorePreference: true, noQueue: true })
    expect(r.success).toBe(false)
    expect(d.sql.some((s) => /INSERT INTO email_failures/.test(s))).toBe(false)
  })
  it('보통 호출은 종전대로 실패를 큐에 넣는다', async () => {
    const d = db()
    await sendSystemEmail({ RESEND_API_KEY: 'x', DB: d.DB }, 'a@example.com', { subject: 's', html: 'h' }, { ignorePreference: true })
    expect(d.sql.some((s) => /INSERT INTO email_failures/.test(s))).toBe(true)
  })
  it('재시도 cron 이 noQueue 로 부른다', () => {
    expect(readFileSync('src/worker/cron/retry-notifications.ts', 'utf8')).toMatch(/sendSystemEmail\(env, row\.recipient, \{[\s\S]{0,120}\}, \{ noQueue: true \}\)/)
  })
})

import { createRequire } from 'node:module'
describe('묵은 중복 실패 행 정리(매일 청소 29)', () => {
  it('재시도를 다 쓴 같은 메일은 가장 최근 1건만 열어 둔다 · 진행 중 행은 그대로', async () => {
    const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
    const src = readFileSync('src/worker/cron/scheduled-cleanup-daily.ts', 'utf8')
    const sql = /`(UPDATE email_failures SET resolved = 1[\s\S]*?GROUP BY recipient, subject\))`/.exec(src)?.[1]
    expect(sql).toBeTruthy()
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE email_failures (id INTEGER PRIMARY KEY, recipient TEXT, subject TEXT, error TEXT, retry_count INT, max_retries INT, resolved INT DEFAULT 0)')
    const ins = db.prepare('INSERT INTO email_failures (recipient, subject, retry_count, max_retries) VALUES (?, ?, ?, 3)')
    for (let i = 0; i < 5; i++) ins.run('a@x.com', '시험', 3)
    ins.run('b@x.com', '다른 메일', 3)
    ins.run('c@x.com', '진행 중', 1)
    ins.run('c@x.com', '진행 중', 3)
    db.exec(sql!)
    const open = db.prepare('SELECT recipient, COUNT(*) n FROM email_failures WHERE resolved = 0 GROUP BY recipient ORDER BY recipient').all()
    expect(open).toEqual([{ recipient: 'a@x.com', n: 1 }, { recipient: 'b@x.com', n: 1 }, { recipient: 'c@x.com', n: 2 }])
  })
})

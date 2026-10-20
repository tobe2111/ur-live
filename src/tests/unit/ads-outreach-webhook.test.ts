import { describe, it, expect } from 'vitest'
import { applyResendEventToPool, applyInboundReplyToPool, runFollowupReminder } from '@/features/marketing/api/outreach-webhook'

/**
 * 🆕 2026-07-21 아웃리치 자동 감지 — Resend 웹훅 이벤트 → 공용 풀(account_id=0) 리드 반영.
 *   ⚖️ [LEGAL] 신규 발송 0(이미 보낸 메일 결과만). 이메일 매칭은 LOWER(email), 풀 sentinel=0 검증.
 */

// SQL/binds 를 캡처하는 목 D1(UPDATE 는 changes=1, SELECT 는 지정 행 반환).
function mockDB(opts: { agg?: Record<string, number>; preview?: unknown[] } = {}) {
  const updates: { sql: string; binds: unknown[] }[] = []
  const db = {
    _updates: () => updates,
    prepare(sql: string) {
      return {
        bind(...binds: unknown[]) {
          return {
            async run() {
              if (/^\s*UPDATE/i.test(sql)) { updates.push({ sql, binds }); return { meta: { changes: 1 } } }
              return { meta: { changes: 0 } }
            },
            async first() { return opts.agg ?? null },
            async all() { return { results: opts.preview ?? [] } },
          }
        },
        // ALTER (ensureOutreachColumns) — bind 없이 run.
        async run() { return { meta: { changes: 0 } } },
      }
    },
  }
  return db
}

describe('applyResendEventToPool — 이벤트 → 풀 반영', () => {
  it('bounce → email_status=bounced, 풀(0)+소문자 이메일로 매칭', async () => {
    const db = mockDB()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = await applyResendEventToPool(db as any, 'email.bounced', 'Foo@Bar.COM')
    expect(n).toBe(1)
    const u = db._updates()[0]
    expect(u.sql).toMatch(/email_status='bounced'/)
    expect(u.binds).toEqual([0, 'foo@bar.com']) // POOL sentinel + 소문자화
  })

  it('complained → rejected 로 승격(계약 제외 CASE 포함)', async () => {
    const db = mockDB()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await applyResendEventToPool(db as any, 'email.complained', 'a@b.com')
    const u = db._updates()[0]
    expect(u.sql).toMatch(/email_status='complained'/)
    expect(u.sql).toMatch(/status=CASE WHEN status='contracted'/)
  })

  it('opened → opened_at 기록(악화 금지 CASE)', async () => {
    const db = mockDB()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await applyResendEventToPool(db as any, 'email.opened', 'a@b.com')
    expect(db._updates()[0].sql).toMatch(/opened_at=COALESCE\(opened_at/)
  })

  it('알 수 없는 타입/빈 이메일 → 0건(무동작)', async () => {
    const db = mockDB()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await applyResendEventToPool(db as any, 'email.sent', 'a@b.com')).toBe(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await applyResendEventToPool(db as any, 'email.bounced', '')).toBe(0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(await applyResendEventToPool(db as any, 'email.bounced', 'not-an-email')).toBe(0)
    expect(db._updates().length).toBe(0)
  })
})

describe('applyInboundReplyToPool — 회신 → 관심 승격', () => {
  it('보낸사람 매칭 → status interested + replied_at', async () => {
    const db = mockDB()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = await applyInboundReplyToPool(db as any, 'Lead@Example.com')
    expect(n).toBe(1)
    const u = db._updates()[0]
    expect(u.sql).toMatch(/replied_at=COALESCE\(replied_at/)
    expect(u.sql).toMatch(/status=CASE WHEN status IN \('rejected','contracted'\)/)
    expect(u.binds).toEqual([0, 'lead@example.com'])
  })
})

describe('runFollowupReminder — 0건 무발송', () => {
  it('need=0 & interested=0 → sent=false(무발송)', async () => {
    const db = mockDB({ agg: { need: 0, interested: 0 } })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await runFollowupReminder({ DB: db, DISCORD_WEBHOOK_URL: '' } as any)
    expect(r).toEqual({ need: 0, interested: 0, sent: false })
  })

  it('회신/무응답 있으면 집계 반환(웹훅 URL 없으면 sent=false)', async () => {
    const db = mockDB({ agg: { need: 3, interested: 2 }, preview: [] })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const r = await runFollowupReminder({ DB: db, DISCORD_WEBHOOK_URL: '' } as any)
    expect(r.need).toBe(3)
    expect(r.interested).toBe(2)
    expect(r.sent).toBe(false) // URL 미설정 → 무발송
  })
})

// ⚖️ 2026-07-23 전수조사 — 수신거부 회신이 '관심'으로 승격되던 결함 수리(거부 감지 → rejected + 억제).
import { isOptOutMessage } from '@/features/marketing/api/outreach-webhook'

describe('isOptOutMessage — 수신거부 표현 감지', () => {
  it('명확한 거부 표현 감지', () => {
    expect(isOptOutMessage('수신거부합니다')).toBe(true)
    expect(isOptOutMessage('메일 보내지 마세요')).toBe(true)
    expect(isOptOutMessage('unsubscribe please')).toBe(true)
  })
  it('일반 회신은 오탐 없음', () => {
    expect(isOptOutMessage('제안 감사합니다, 조건이 궁금해요')).toBe(false)
    expect(isOptOutMessage('')).toBe(false)
  })
})
describe('applyInboundReplyToPool — 거부 회신 → rejected', () => {
  it('거부 내용이면 status=rejected + opt_out (interested 승격 안 함)', async () => {
    const db = mockDB()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = await applyInboundReplyToPool(db as any, 'Lead@Example.com', '광고 메일 수신거부합니다')
    expect(n).toBe(1)
    const u = db._updates()[0]
    expect(u.sql).toMatch(/email_status='opt_out'/)
    expect(u.sql).toMatch(/ELSE 'rejected'/)
    expect(u.sql).not.toMatch(/'interested'/)
    expect(u.binds).toEqual([0, 'lead@example.com'])
  })
  it('일반 회신은 기존대로 interested 승격', async () => {
    const db = mockDB()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const n = await applyInboundReplyToPool(db as any, 'a@b.com', '네 관심 있습니다')
    expect(n).toBe(1)
    expect(db._updates()[0].sql).toMatch(/'interested'/)
  })
})

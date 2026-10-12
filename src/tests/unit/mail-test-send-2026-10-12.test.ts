/**
 * ✉️ 어드민 메일 발송 시험 — 2026-10-12 urdeal.kr 메일 도메인 인증(소유·SPF·DKIM·DMARC) 직후.
 *
 * 거래성 메일이 실제로 타는 경로(`sendSystemEmail` → `sendEmail` → SENS)를 그대로 타는지, 그리고
 * 남용 경로가 없는지를 **동작으로** 잰다:
 *  ① super_admin 만 · ② 가입된 유저의 등록 이메일로만(본문으로 받은 주소로 안 보낸다)
 *  ③ 알림 수신 끔과 무관하게 보낸다(시험이 '꺼 둬서 안 감'으로 거짓 실패하지 않게)
 *  ④ 응답에 SENS 결과 원문 + 가린 주소
 *
 * ⚠️ 못 보는 것: 네이버 클라우드가 실제로 받아 주는지·받은편지함/스팸함 — 라이브 호출과 받는 사람만 판정한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Hono } from 'hono'
import { adminSystemMonitoringRoutes } from '@/features/admin/api/admin-system-monitoring.routes'
import { _setSensMailEnvForTest } from '@/services/email'

const SENS = { NCP_ACCESS_KEY: 'AK', NCP_SECRET_KEY: 'SK', NCP_MAIL_SENDER: 'no-reply@urdeal.kr' }

function fakeDb(role: string, user: { email: string | null } | null) {
  const reads: string[] = []
  return {
    reads,
    prepare(sql: string) {
      let args: unknown[] = []
      const stmt = {
        bind(...a: unknown[]) { args = a; return stmt },
        async first() {
          reads.push(sql)
          if (sql.includes('FROM admins')) return { role }
          if (sql.includes('FROM users WHERE id')) return user
          if (sql.includes('email_enabled')) return { enabled: 0 } // 수신 끔 — 시험은 그래도 보내야 한다
          return null
        },
        async run() { return { meta: { changes: 1 } } },
        async all() { return { results: [] } },
        _args: () => args,
      }
      return stmt
    },
  }
}

function app(db: unknown) {
  const a = new Hono()
  a.use('*', async (c, next) => { c.set('user' as never, { id: 10 } as never); await next() })
  a.route('/', adminSystemMonitoringRoutes as never)
  return { req: (body: unknown) => a.request('/mail-test-send', { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }, { DB: db, ...SENS }) }
}

let sent: Array<{ url: string; body: { recipients?: Array<{ address: string }>; title?: string } }> = []
beforeEach(() => {
  sent = []
  _setSensMailEnvForTest(SENS as never)
  vi.stubGlobal('fetch', vi.fn(async (u: string, init: { body: string }) => {
    sent.push({ url: String(u), body: JSON.parse(String(init.body)) })
    return new Response(JSON.stringify({ requestId: 'r1', count: 1 }), { status: 201, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.unstubAllGlobals(); _setSensMailEnvForTest(null) })

describe('메일 발송 시험', () => {
  it('super_admin 이 아니면 403, 아무것도 안 보낸다', async () => {
    const r = await app(fakeDb('admin', { email: 'boss@example.com' })).req({ user_id: 3 })
    expect(r.status).toBe(403)
    expect(sent).toHaveLength(0)
  })
  it('유저의 등록 이메일로 SENS 메일을 보낸다 — 본문에 다른 주소를 넣어도 무시', async () => {
    const r = await app(fakeDb('super_admin', { email: 'boss@example.com' })).req({ user_id: 3, to: 'stranger@evil.test' })
    const j = await r.json() as { success: boolean; to: string }
    expect(sent).toHaveLength(1)
    expect(sent[0].url).toContain('mail.apigw.ntruss.com')
    expect(sent[0].body.recipients?.map((x) => x.address)).toEqual(['boss@example.com'])
    expect(JSON.stringify(sent[0].body)).not.toContain('stranger@evil.test')
    expect(j.success).toBe(true)
    expect(j.to).toBe('b***@example.com')
  })
  it('수신 끔(email_enabled=0)이어도 시험은 보낸다', async () => {
    await app(fakeDb('super_admin', { email: 'boss@example.com' })).req({ user_id: 3 })
    expect(sent).toHaveLength(1)
  })
  it('user_id 가 없거나 이메일이 없으면 보내지 않는다', async () => {
    expect((await app(fakeDb('super_admin', { email: 'a@b.c' })).req({})).status).toBe(400)
    expect((await app(fakeDb('super_admin', { email: null })).req({ user_id: 3 })).status).toBe(400)
    expect((await app(fakeDb('super_admin', null)).req({ user_id: 3 })).status).toBe(404)
    expect(sent).toHaveLength(0)
  })
})

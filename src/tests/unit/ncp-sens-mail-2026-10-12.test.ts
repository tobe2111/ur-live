/**
 * ✉️ 메일을 네이버 클라우드 SENS 로 — 2026-10-12 대표 "메일, 알림톡 … 최대한 설정하고" (월 1,000건 무료)
 *
 * 고정하는 것:
 *  ① 요청 본문·서명 — 알림톡과 같은 키·같은 서명 형식(v2: /mail/v2/services/{인코딩된 서비스ID}/requests)
 *  ② 키(NCP 2종 + 발신 주소)가 다 있으면 거래성 메일은 SENS 로 간다
 *  ③ 대량·홍보 메일(List-Unsubscribe 헤더·회신 주소)은 SENS 로 보내지 않는다 — Resend 그대로
 *  ④ SENS 가 거절하면 Resend 키가 있을 때 한 번 더 보낸다(메일이 사라지지 않게)
 *
 * ⚠️ 못 보는 것: SENS 가 실제로 받아 주는지(발신 도메인 등록·SPF/DKIM) — 라이브 발송으로만 판정된다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { buildSensMailBody, interpretSensMailResponse, sensMailConfigured, SENS_MAIL_HOST, sensMailUri } from '@/lib/ncp-sens-mail'
import { sensSignatureMessage } from '@/lib/ncp-sens'
import { sendEmail, _setSensMailEnvForTest } from '@/services/email'

const SENS = { NCP_ACCESS_KEY: 'AK', NCP_SECRET_KEY: 'SK', NCP_MAIL_SENDER: 'no-reply@urdeal.kr', NCP_SENS_MAIL_SERVICE_ID: 'ncp:mail:kr:123:main' }
const URI = '/mail/v2/services/ncp%3Amail%3Akr%3A123%3Amain/requests'
type Call = { url: string; headers: Record<string, string>; body: string }
let calls: Call[] = []
let sensReply: { status: number; json: unknown } = { status: 201, json: { requestId: 'r1', count: 1 } }

beforeEach(() => {
  calls = []
  sensReply = { status: 201, json: { requestId: 'r1', count: 1 } }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url, headers: init.headers, body: String(init.body) })
    if (url.startsWith(SENS_MAIL_HOST)) {
      return new Response(JSON.stringify(sensReply.json), { status: sensReply.status, headers: { 'Content-Type': 'application/json' } })
    }
    return new Response(JSON.stringify({ id: 'resend-1' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => { vi.unstubAllGlobals(); _setSensMailEnvForTest(null) })

describe('① 본문·서명', () => {
  it('한 통에 한 명, 홍보 아님, 발신자 이름 기본 유어딜', () => {
    expect(buildSensMailBody(SENS, { to: 'a@b.com', subject: 's', html: '<p>h</p>' })).toEqual({
      senderAddress: 'no-reply@urdeal.kr', senderName: '유어딜', title: 's', body: '<p>h</p>',
      recipients: [{ address: 'a@b.com', type: 'TO' }], individual: true, advertising: false,
    })
  })
  it('발신 주소가 없으면 SENS 메일로 안 간다', () => {
    expect(sensMailConfigured(SENS)).toBe(true)
    expect(sensMailConfigured({ ...SENS, NCP_MAIL_SENDER: '' })).toBe(false)
    expect(sensMailConfigured({ ...SENS, NCP_SENS_MAIL_SERVICE_ID: '' })).toBe(false)
    expect(sensMailConfigured(null)).toBe(false)
  })
  it('응답 — 2xx + requestId 만 성공, 실패는 원문', () => {
    expect(interpretSensMailResponse(201, { requestId: 'x' })).toEqual({ success: true })
    expect(interpretSensMailResponse(201, {}).success).toBe(false)
    expect(interpretSensMailResponse(400, { error: { errorCode: '77101', message: 'invalid sender' } }).error).toContain('invalid sender')
  })
})

describe('② ③ ④ sendEmail 경로', () => {
  it('키가 다 있으면 거래성 메일은 SENS 로 — 서명이 알림톡과 같은 형식', async () => {
    _setSensMailEnvForTest(SENS)
    const r = await sendEmail({ to: 'a@b.com', subject: '주문 완료', html: '<p>x</p>' }, 're_key')
    expect(r).toEqual({ success: true })
    expect(calls).toHaveLength(1)
    expect(sensMailUri(SENS.NCP_SENS_MAIL_SERVICE_ID)).toBe(URI)
    expect(calls[0].url).toBe(`https://sens.apigw.ntruss.com${URI}`)
    expect(SENS_MAIL_HOST).toBe('https://sens.apigw.ntruss.com')
    const ts = calls[0].headers['x-ncp-apigw-timestamp']
    const expected = createHmac('sha256', 'SK').update(sensSignatureMessage('POST', URI, ts, 'AK')).digest('base64')
    expect(calls[0].headers['x-ncp-apigw-signature-v2']).toBe(expected)
  })
  it('Resend 키가 없어도 SENS 가 있으면 보낸다', async () => {
    _setSensMailEnvForTest(SENS)
    expect((await sendEmail({ to: 'a@b.com', subject: 's', html: 'h' }, '')).success).toBe(true)
  })
  it('List-Unsubscribe 헤더(대량·홍보)가 붙은 메일은 SENS 로 보내지 않는다', async () => {
    _setSensMailEnvForTest(SENS)
    await sendEmail({ to: 'a@b.com', subject: 's', html: 'h', headers: { 'List-Unsubscribe': '<mailto:x>' } }, 're_key')
    expect(calls.some((c) => c.url.startsWith(SENS_MAIL_HOST))).toBe(false)
    expect(calls.some((c) => c.url.includes('resend.com'))).toBe(true)
  })
  it('회신 주소가 붙은 메일(아웃리치)도 SENS 로 보내지 않는다', async () => {
    _setSensMailEnvForTest(SENS)
    await sendEmail({ to: 'a@b.com', subject: 's', html: 'h', replyTo: 'me@urdeal.kr' }, 're_key')
    expect(calls.some((c) => c.url.startsWith(SENS_MAIL_HOST))).toBe(false)
  })
  it('SENS 가 거절하면 Resend 로 한 번 더', async () => {
    _setSensMailEnvForTest(SENS)
    sensReply = { status: 400, json: { error: { errorCode: '77101', message: 'domain not verified' } } }
    const r = await sendEmail({ to: 'a@b.com', subject: 's', html: 'h' }, 're_key')
    expect(r.success).toBe(true)
    expect(calls.map((c) => new URL(c.url).host)).toEqual(['sens.apigw.ntruss.com', 'api.resend.com'])
  })
  it('SENS 가 없으면 종전 Resend 그대로', async () => {
    _setSensMailEnvForTest(null)
    await sendEmail({ to: 'a@b.com', subject: 's', html: 'h' }, 're_key')
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('resend.com')
  })
})

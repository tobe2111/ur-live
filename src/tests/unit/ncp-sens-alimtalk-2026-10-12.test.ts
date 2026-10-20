/**
 * 📨 알림톡을 네이버 클라우드 SENS 로 — 2026-10-12 대표 "이걸로 가자"
 *
 * 종전 발송사는 서버 고정 IP 등록이 필수라 Cloudflare(나가는 IP 가 매번 다름)에서 막혔다(라이브 -99/-101).
 * SENS 는 API 키 서명 인증이고 허용 IP 는 선택이다. 이 시험이 고정하는 것:
 *  ① 서명 원문 형식("POST {uri}\n{ts}\n{key}")과 HMAC — 한 글자만 틀려도 401 인데 에러가 늦게 드러난다
 *  ② SENS 키가 넷 다 있으면 SENS 로 간다 · 하나라도 없으면 보내지 않는다(2026-10-12 알리고 제거)
 *  ③ 승인 전 템플릿은 SENS 로도 안 보낸다(앱 알림만, `pending:` 기록)
 *  ④ 응답 해석 — 202 + A000 만 성공, 실패는 SENS 원문을 싣는다
 *
 * ⚠️ 못 보는 것: SENS 가 실제로 받아 주는지(채널 연결·템플릿 검수·잔액). 라이브 `alimtalk-test-send` 로만 판정된다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  sensSignature, sensSignatureMessage, sensAlimtalkUri, interpretSensResponse, normalizeChannelId, sensConfigured, SENS_HOST,
} from '@/lib/ncp-sens'
import { sendTextNotice, _resetApprovedTemplatesCache } from '@/lib/text-notice'

type Call = { url: string; headers: Record<string, string>; body: string }
let calls: Call[] = []
let reply: { status: number; json: unknown } = { status: 202, json: { messages: [{ requestStatusCode: 'A000' }] } }

beforeEach(() => {
  calls = []
  _resetApprovedTemplatesCache()
  reply = { status: 202, json: { messages: [{ requestStatusCode: 'A000', requestStatusName: 'success' }] } }
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls.push({ url, headers: init.headers, body: String(init.body) })
    return new Response(JSON.stringify(reply.json), { status: reply.status, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => vi.unstubAllGlobals())

function fakeDb(approved = '') {
  const writes: { sql: string; args: unknown[] }[] = []
  return {
    writes,
    prepare(sql: string) {
      let args: unknown[] = []
      const stmt = {
        bind(...a: unknown[]) { args = a; return stmt },
        async first() {
          if (!sql.includes('platform_settings')) return null
          if (args[0] === 'notice_sms_enabled') return null
          return approved ? { value: approved } : null
        },
        async run() { writes.push({ sql, args }); return { meta: { changes: 1 } } },
      }
      return stmt
    },
  }
}

const SENS = { NCP_ACCESS_KEY: 'AK', NCP_SECRET_KEY: 'SK', NCP_SENS_ALIMTALK_SERVICE_ID: 'ncp:kkobizmsg:kr:1:urdeal', NCP_KAKAO_CHANNEL_ID: '유어딜' }

describe('① 서명', () => {
  it('원문은 "METHOD URI\\nTIMESTAMP\\nACCESSKEY"', () => {
    expect(sensSignatureMessage('POST', '/alimtalk/v2/services/x/messages', '123', 'AK'))
      .toBe('POST /alimtalk/v2/services/x/messages\n123\nAK')
  })
  it('HMAC-SHA256 base64 — 독립 구현(node crypto)과 같다', async () => {
    const msg = sensSignatureMessage('POST', sensAlimtalkUri('svc'), '1700000000000', 'AK')
    const expected = createHmac('sha256', 'secret').update(msg).digest('base64')
    expect(await sensSignature('secret', msg)).toBe(expected)
  })
  it('서비스 ID 의 콜론은 경로에서 인코딩된다(서명과 요청이 같은 문자열을 쓴다)', () => {
    expect(sensAlimtalkUri('ncp:kkobizmsg:kr:1:a')).toBe('/alimtalk/v2/services/ncp%3Akkobizmsg%3Akr%3A1%3Aa/messages')
  })
  it('채널 ID 는 @ 를 붙여 보낸다', () => {
    expect(normalizeChannelId('유어딜')).toBe('@유어딜')
    expect(normalizeChannelId(' @유어딜 ')).toBe('@유어딜')
  })
})

describe('② 경로 선택', () => {
  it('SENS 키가 넷 다 있으면 SENS 로 보낸다', async () => {
    const db = fakeDb('voucher_issued')
    const r = await sendTextNotice({ ...SENS, DB: db }, '010-1234-5678', { tpl: 'voucher_issued', title: 't', text: '본문' })
    expect(r).toEqual({ ok: true, via: 'alimtalk' })
    expect(calls).toHaveLength(1)
    expect(calls[0].url.startsWith(SENS_HOST)).toBe(true)
    const body = JSON.parse(calls[0].body)
    // 🔘 버튼은 lib/alimtalk-buttons 표에서 템플릿 이름으로 실린다(손님 이용권 → [내 이용권 보기]).
    const myVouchers = { type: 'WL', name: '내 이용권 보기', linkMobile: 'https://urdeal.kr/my-vouchers', linkPc: 'https://urdeal.kr/my-vouchers' }
    expect(body).toEqual({ plusFriendId: '@유어딜', templateCode: 'voucher_issued', messages: [{ to: '01012345678', content: '본문', buttons: [myVouchers] }] })
    expect(calls[0].headers['x-ncp-iam-access-key']).toBe('AK')
    const ts = calls[0].headers['x-ncp-apigw-timestamp']
    const expected = createHmac('sha256', 'SK').update(sensSignatureMessage('POST', new URL(calls[0].url).pathname, ts, 'AK')).digest('base64')
    expect(calls[0].headers['x-ncp-apigw-signature-v2']).toBe(expected)
    expect(db.writes.some(w => String(w.args[1]) === 'alimtalk:voucher_issued')).toBe(true)
  })
  it('설정에 `이름=코드` 로 다르게 적었으면 그 코드로 보낸다', async () => {
    await sendTextNotice({ ...SENS, DB: fakeDb('voucher_issued=UD001') }, '01012345678', { tpl: 'voucher_issued', title: 't', text: 'x' })
    expect(JSON.parse(calls[0].body).templateCode).toBe('UD001')
  })
  it('SENS 키가 하나라도 없으면 SENS 로 안 간다', () => {
    expect(sensConfigured(SENS)).toBe(true)
    for (const k of Object.keys(SENS)) expect(sensConfigured({ ...SENS, [k]: '' })).toBe(false)
  })
  it('SENS 키가 없으면 보내지 않는다', async () => {
    const r = await sendTextNotice({ DB: fakeDb('voucher_issued') }, '01012345678', { tpl: 'voucher_issued', title: 't', text: 'x' })
    expect(r).toEqual({ ok: false, skipped: 'no_credentials' })
    expect(calls).toHaveLength(0)
  })
})

describe('③ 승인 전 템플릿', () => {
  it('승인 목록에 없으면 SENS 로도 안 보내고 pending 으로 남긴다', async () => {
    const db = fakeDb('')
    const r = await sendTextNotice({ ...SENS, DB: db }, '01012345678', { tpl: 'voucher_issued', title: 't', text: 'x' })
    expect(r).toEqual({ ok: false, skipped: 'template_not_approved' })
    expect(calls).toHaveLength(0)
    expect(db.writes.some(w => String(w.args[1]) === 'pending:voucher_issued')).toBe(true)
  })
  it('시험 발송(forceAlimtalk)은 승인과 무관하게 보낸다', async () => {
    const r = await sendTextNotice({ ...SENS, DB: fakeDb('') }, '01012345678', { tpl: 'admin_test_send', title: 't', text: 'x', forceAlimtalk: true })
    expect(r.ok).toBe(true)
    expect(calls).toHaveLength(1)
  })
})

describe('④ 응답 해석', () => {
  it('202 + A000 만 성공', () => {
    expect(interpretSensResponse(202, { messages: [{ requestStatusCode: 'A000' }] })).toEqual({ success: true })
    expect(interpretSensResponse(200, { messages: [{ requestStatusCode: 'A000' }] }).success).toBe(false)
  })
  it('접수 거절은 SENS 원문을 싣는다', () => {
    const r = interpretSensResponse(202, { messages: [{ requestStatusCode: 'A013', requestStatusDesc: '템플릿 불일치' }] })
    expect(r.success).toBe(false)
    expect(r.error).toContain('A013')
    expect(r.error).toContain('템플릿 불일치')
    expect(interpretSensResponse(401, { error: { errorCode: '200', message: 'Authentication Failed' } }).error).toContain('Authentication Failed')
  })
  it('실패 응답이면 sendTextNotice 가 실패로 돌려주고 기록한다', async () => {
    reply = { status: 401, json: { error: { errorCode: '200', message: 'Authentication Failed' } } }
    const db = fakeDb('voucher_issued')
    const r = await sendTextNotice({ ...SENS, DB: db }, '01012345678', { tpl: 'voucher_issued', title: 't', text: 'x' })
    expect(r.ok).toBe(false)
    expect(db.writes.some(w => String(w.sql).includes('alimtalk_failures'))).toBe(true)
  })
})

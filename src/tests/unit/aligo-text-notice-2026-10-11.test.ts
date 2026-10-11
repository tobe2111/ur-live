/**
 * 📨 알림은 알리고 하나로 — 2026-10-11 대표 "알리고로만 하는건데? 솔라피는 뭐야?"
 *
 * 라이브 실측으로 드러난 세 구멍을 고정한다:
 *  ① 사장님·손님 이용권 알림 7종이 솔라피로 가게 돼 있었는데 그 키가 라이브에 없어 **조용히 건너뜀**
 *  ② 시스템 알림톡이 틀린 주소(`smartsms.aligo.in/admin/api`)로 가 HTML 을 받음 — 성공 기록 0건
 *  ③ 발신번호 env 이름이 라이브(`ALIGO_SENDER`)와 코드(`ALIGO_SENDER_PHONE`)에서 갈림
 *
 * ⚠️ 이 시험이 못 보는 것: 알리고가 **실제로** 받아 주는지(발신번호 등록·IP 제한·잔액)는 라이브
 *   `alimtalk_dispatch_log`/`alimtalk_failures` 로만 판정된다 — 이 컨테이너에선 알리고에 닿지 않는다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { aligoOk, sendAlimtalk, sendAligoSms, smsByteLength, ALIGO_KAKAO_BASE, ALIGO_SMS_URL } from '@/lib/aligo'
import { sendTextNotice, parseApprovedTemplates, _resetApprovedTemplatesCache } from '@/lib/text-notice'
import { kakaoLoginScope } from '@/features/auth/services/kakao-login-scope'
import { sendSellerVoucherSoldAlimtalk } from '@/features/group-buy/api/helpers'

type Call = { url: string; body: URLSearchParams }
let calls: Call[] = []
let smsReply: Record<string, unknown> = { result_code: '1', message: 'success', msg_id: 'm1' }
let sendReply: Record<string, unknown> = { code: 0, message: '성공', info: { mid: 'k1' } }

function installFetch() {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: URLSearchParams | string }) => {
    const body = new URLSearchParams(String(init.body))
    calls.push({ url, body })
    let json: Record<string, unknown>
    if (url.endsWith('/token/create/30/s/')) json = { code: 0, token: 'tok', urtime: 1 }
    else if (url === ALIGO_SMS_URL) json = smsReply
    else json = sendReply
    return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } })
  }))
}

function fakeDb(approved = '') {
  const writes: { sql: string; args: unknown[] }[] = []
  return {
    writes,
    prepare(sql: string) {
      let args: unknown[] = []
      const stmt = {
        bind(...a: unknown[]) { args = a; return stmt },
        async first() { return sql.includes('platform_settings') ? (approved ? { value: approved } : null) : null },
        async run() { writes.push({ sql, args }); return { meta: { changes: 1 } } },
      }
      return stmt
    },
  }
}

const ENV = { ALIGO_API_KEY: 'k', ALIGO_USER_ID: 'u', ALIGO_SENDER_KEY: 'sk', ALIGO_SENDER: '01011112222' }

beforeEach(() => { installFetch(); _resetApprovedTemplatesCache(); smsReply = { result_code: '1', message: 'success', msg_id: 'm1' }; sendReply = { code: 0, message: '성공', info: { mid: 'k1' } } })
afterEach(() => { vi.unstubAllGlobals() })

describe('알리고 응답 판정', () => {
  it('카카오 API 는 code 0, 문자 API 는 result_code 1 이 성공이다', () => {
    expect(aligoOk({ code: 0 })).toBe(true)
    expect(aligoOk({ code: '0' })).toBe(true)
    expect(aligoOk({ code: -99 })).toBe(false)
    expect(aligoOk({ result_code: '1' })).toBe(true)
    expect(aligoOk({ result_code: 1 })).toBe(true)
    expect(aligoOk({ result_code: '-101' })).toBe(false)
  })
  it('빈 code 를 성공으로 읽지 않는다(Number("") === 0 함정)', () => {
    expect(aligoOk({ code: '' })).toBe(false)
    expect(aligoOk({})).toBe(false)
  })
})

describe('알림톡 발송 주소·필수값', () => {
  it('정본 주소(kakaoapi.aligo.in/akv10)로 apikey·token·sender 를 싣는다', async () => {
    const r = await sendAlimtalk({ ALIGO_API_KEY: 'k', ALIGO_USER_ID: 'u', ALIGO_SENDER: '01011112222' }, { senderKey: 'sk', templateCode: 't', to: '01033334444', message: 'hi' })
    expect(r.success).toBe(true)
    const send = calls.find((c) => c.url.endsWith('/alimtalk/send/'))!
    expect(send.url).toBe(`${ALIGO_KAKAO_BASE}/alimtalk/send/`)
    expect(send.body.get('apikey')).toBe('k')
    expect(send.body.get('token')).toBe('tok')
    expect(send.body.get('sender')).toBe('01011112222')
    expect(calls.every((c) => !c.url.includes('smartsms.aligo.in/admin/api'))).toBe(true)
  })
  it('실패 응답을 성공으로 읽지 않는다', async () => {
    sendReply = { code: -99, message: '템플릿 없음' }
    const r = await sendAlimtalk({ ALIGO_API_KEY: 'k', ALIGO_USER_ID: 'u' }, { senderKey: 'sk', templateCode: 't', to: '01033334444', message: 'hi' })
    expect(r.success).toBe(false)
    expect(r.error).toContain('-99')
  })
})

describe('문자 발송', () => {
  it('90바이트 이하는 단문, 넘으면 장문(제목 포함)', async () => {
    expect(smsByteLength('가a')).toBe(3)
    await sendAligoSms(ENV, { to: '01033334444', text: '짧은 알림' })
    expect(calls[0].body.get('msg_type')).toBe('SMS')
    await sendAligoSms(ENV, { to: '01033334444', text: '가'.repeat(46), title: '이용권 판매' })
    expect(calls[1].body.get('msg_type')).toBe('LMS')
    expect(calls[1].body.get('title')).toBe('이용권 판매')
    expect(calls[1].body.get('sender')).toBe('01011112222')
  })
  it('발신번호가 없으면 보내지 않는다(알리고가 거부할 요청을 만들지 않는다)', async () => {
    const r = await sendAligoSms({ ALIGO_API_KEY: 'k', ALIGO_USER_ID: 'u' }, { to: '01033334444', text: 'x' })
    expect(r.success).toBe(false)
    expect(calls).toHaveLength(0)
  })
})

describe('sendTextNotice — 승인 전엔 문자, 승인 후엔 알림톡(+문자 대체)', () => {
  it('승인 목록에 없으면 문자로 보낸다', async () => {
    const DB = fakeDb('')
    const r = await sendTextNotice({ ...ENV, DB }, '010-3333-4444', { tpl: 'seller_voucher_sold', title: '이용권 판매', text: '판매' })
    expect(r).toEqual({ ok: true, via: 'sms' })
    expect(calls.map((c) => c.url)).toEqual([ALIGO_SMS_URL])
    expect(DB.writes.some((w) => w.sql.includes('alimtalk_dispatch_log') && w.args[1] === 'sms:seller_voucher_sold')).toBe(true)
  })
  it('승인 목록에 있으면 알림톡 + 실패 시 문자 대체(failover=Y)', async () => {
    const DB = fakeDb('voucher_used, seller_voucher_sold')
    const r = await sendTextNotice({ ...ENV, DB }, '01033334444', { tpl: 'seller_voucher_sold', title: '이용권 판매', text: '판매' })
    expect(r).toEqual({ ok: true, via: 'alimtalk' })
    const send = calls.find((c) => c.url.endsWith('/alimtalk/send/'))!
    expect(send.body.get('tpl_code')).toBe('seller_voucher_sold')
    expect(send.body.get('failover')).toBe('Y')
    expect(send.body.get('fmessage_1')).toBe('판매')
  })
  it('키가 없거나 휴대폰이 아니면 건너뛴다', async () => {
    expect(await sendTextNotice({}, '01033334444', { tpl: 't', title: 't', text: 'x' })).toEqual({ ok: false, skipped: 'no_credentials' })
    expect(await sendTextNotice(ENV, '02-123-4567', { tpl: 't', title: 't', text: 'x' })).toEqual({ ok: false, skipped: 'invalid_phone' })
    expect(calls).toHaveLength(0)
  })
  it('실패는 기록하되 재시도 큐에 태우지 않는다(max_retries 0)', async () => {
    smsReply = { result_code: '-101', message: '발신번호 미등록' }
    const DB = fakeDb('')
    const r = await sendTextNotice({ ...ENV, DB }, '01033334444', { tpl: 'voucher_issued', title: 't', text: 'x' })
    expect(r.ok).toBe(false)
    const fail = DB.writes.find((w) => w.sql.includes('INSERT INTO alimtalk_failures'))!
    expect(fail.sql).toMatch(/max_retries\) VALUES \(\?, \?, \?, \?, 0\)/)
    expect(fail.args[1]).toBe('sms:voucher_issued')
  })
  it('승인 목록 파싱 — 쉼표·공백·줄바꿈', () => {
    expect([...parseApprovedTemplates(' a, b\nc ,, ')]).toEqual(['a', 'b', 'c'])
    expect(parseApprovedTemplates(null).size).toBe(0)
  })
})

describe('사장님 판매 알림이 실제로 알리고에 닿는다', () => {
  it('sendSellerVoucherSoldAlimtalk → 알리고 문자(솔라피 키 없이도)', async () => {
    await sendSellerVoucherSoldAlimtalk({ ...ENV, DB: fakeDb('') }, '01033334444', { restaurantName: '가게', productName: '돈가스', qty: 1, amount: 9000 })
    expect(calls.map((c) => c.url)).toEqual([ALIGO_SMS_URL])
    expect(calls[0].body.get('msg')).toContain('돈가스')
  })
})

describe('소스 불변식', () => {
  const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx' 'src/*.ts'", { encoding: 'utf8' }).split('\n').filter((f) => f && !f.startsWith('src/tests/'))
  it('검사 대상이 비어 있지 않다', () => { expect(files.length).toBeGreaterThan(500) })
  it('솔라피로 보내는 코드가 없다(쓰지 않는 회사·라이브에 키 없음)', () => {
    const hits = files.filter((f) => readFileSync(f, 'utf8').includes('api.solapi.com'))
    expect(hits).toEqual([])
  })
  it('알리고 옛 주소(HTML 을 돌려주던 smartsms…/admin/api)로 보내는 코드가 없다', () => {
    const hits = files.filter((f) => /fetch\([^)]*smartsms\.aligo\.in\/admin\/api/.test(readFileSync(f, 'utf8')))
    expect(hits).toEqual([])
  })
})

describe('로그인 동의 항목 — 채널 추가', () => {
  it('OIDC 꺼짐이면 scope 를 보내지 않는다(콘솔 동의항목 전부 표시)', () => {
    expect(kakaoLoginScope({})).toBeNull()
    expect(kakaoLoginScope({ KAKAO_CHANNEL_ADD_ENABLED: 'true' })).toBeNull()
  })
  it('채널 플래그는 기본 OFF — plusfriends 를 요청하지 않는다(콘솔 미설정이면 KOE205 로 로그인이 막힌다)', () => {
    expect(kakaoLoginScope({ KAKAO_OIDC_ENABLED: '1' })).toBe('openid,account_email,profile_nickname,profile_image')
  })
  it('채널 플래그가 켜지면 plusfriends 를 더한다', () => {
    expect(kakaoLoginScope({ KAKAO_OIDC_ENABLED: '1', KAKAO_CHANNEL_ADD_ENABLED: 'true' })).toContain(',plusfriends')
  })
  it('로그인 시작점이 이 규칙을 쓴다', () => {
    const src = readFileSync('src/features/auth/api/kakao.routes.ts', 'utf8')
    expect(src).toMatch(/const loginScope = kakaoLoginScope\(c\.env\)/)
    expect(src).not.toMatch(/searchParams\.set\('scope', 'openid/)
  })
})

describe('어드민 발송 시험 엔드포인트', () => {
  const src = readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
  const block = src.slice(src.indexOf("post('/alimtalk-test-send'"), src.indexOf('// ── 🚦 2026-07-05'))
  it('super_admin 만 보낸다', () => {
    expect(block).toMatch(/admin\?\.role !== 'super_admin'\) return c\.json\(\{[^}]*\}, 403\)/)
  })
  it('실제 발송 경로(sendTextNotice)를 그대로 탄다 — 시험용 우회 경로가 아니다', () => {
    expect(block).toContain('sendTextNotice(c.env, user.phone')
    expect(block).not.toMatch(/sendAligoSms|api\.solapi|fetch\(/)
  })
  it('가입된 유저 번호로만 보낸다(임의 번호 입력 없음)', () => {
    expect(block).toContain("SELECT phone FROM users WHERE id = ?")
    expect(block).not.toMatch(/body\.phone|body\.to\b/)
  })
})

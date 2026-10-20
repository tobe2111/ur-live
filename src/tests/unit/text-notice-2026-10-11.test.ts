/**
 * 📨 알림은 카톡 알림톡 하나로 — 2026-10-11 대표 "알리고로만 하는건데? 솔라피는 뭐야?" ·
 *    2026-10-12 대표 "이걸로 가자"(네이버 클라우드 SENS) · "알리고 잔해들 빼고"
 *
 * 고정하는 것:
 *  ① 승인된 템플릿만 알림톡, 승인 전은 보내지 않고 `pending:` 으로 기록 · 문자(SMS)는 없다
 *  ② 실패는 기록하되 재시도 큐에 태우지 않는다(max_retries 0)
 *  ③ 사장님 판매 알림이 실제 발송 경로(SENS)에 닿는다(솔라피·알리고로 새지 않는다)
 *  ④ 소스 어디에도 솔라피·알리고로 보내는 코드가 없다
 *
 * ⚠️ 이 시험이 못 보는 것: SENS 가 **실제로** 받아 주는지(채널 연결·템플릿 검수·잔액)는 라이브
 *   `POST /api/admin/alimtalk-test-send` 와 `alimtalk_dispatch_log`/`alimtalk_failures` 로만 판정된다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { sendTextNotice, parseApprovedTemplates, parseTemplateCodeMap, _resetApprovedTemplatesCache } from '@/lib/text-notice'
import { kakaoLoginScope } from '@/features/auth/services/kakao-login-scope'
import { sendSellerVoucherSoldAlimtalk } from '@/features/group-buy/api/helpers'
import { stripComments } from '../helpers/source-text'

type Call = { url: string; body: { templateCode: string; messages: Array<{ to: string; content: string }> } }
let calls: Call[] = []
let reply: { status: number; json: unknown } = { status: 202, json: { messages: [{ requestStatusCode: 'A000' }] } }

function installFetch() {
  calls = []
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: { body: string }) => {
    calls.push({ url, body: JSON.parse(String(init.body)) })
    return new Response(JSON.stringify(reply.json), { status: reply.status, headers: { 'Content-Type': 'application/json' } })
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
        async first() {
          if (!sql.includes('platform_settings')) return null
          return approved ? { value: approved } : null
        },
        async run() { writes.push({ sql, args }); return { meta: { changes: 1 } } },
      }
      return stmt
    },
  }
}

const ENV = { NCP_ACCESS_KEY: 'AK', NCP_SECRET_KEY: 'SK', NCP_SENS_ALIMTALK_SERVICE_ID: 'svc', NCP_KAKAO_CHANNEL_ID: '@유어딜' }

beforeEach(() => { installFetch(); _resetApprovedTemplatesCache(); reply = { status: 202, json: { messages: [{ requestStatusCode: 'A000' }] } } })
afterEach(() => { vi.unstubAllGlobals() })

describe('sendTextNotice — 카톡만: 승인된 템플릿만 알림톡, 문자는 없다', () => {
  it('승인 전 템플릿은 보내지 않는다 — 놓친 것은 기록', async () => {
    const DB = fakeDb('')
    const r = await sendTextNotice({ ...ENV, DB }, '010-3333-4444', { tpl: 'seller_voucher_sold', title: '이용권 판매', text: '판매' })
    expect(r).toEqual({ ok: false, skipped: 'template_not_approved' })
    expect(calls).toHaveLength(0)
    const miss = DB.writes.find((w) => w.sql.includes('INSERT INTO alimtalk_failures'))!
    expect(miss.args[1]).toBe('pending:seller_voucher_sold')
  })
  it('승인된 템플릿은 알림톡으로 — 우리 이름이 곧 템플릿 코드', async () => {
    const DB = fakeDb('voucher_used, seller_voucher_sold')
    const r = await sendTextNotice({ ...ENV, DB }, '01033334444', { tpl: 'seller_voucher_sold', title: '이용권 판매', text: '판매', sellerId: 7 })
    expect(r).toEqual({ ok: true, via: 'alimtalk' })
    expect(calls).toHaveLength(1)
    expect(calls[0].body.templateCode).toBe('seller_voucher_sold')
  })
  it('시험 발송(forceAlimtalk)은 승인 목록과 무관하게 보낸다 — SENS 가 어디서 막는지 보려고', async () => {
    const r = await sendTextNotice({ ...ENV, DB: fakeDb('') }, '01033334444', { tpl: 'admin_test_send', title: 't', text: 'x', forceAlimtalk: true })
    expect(r).toEqual({ ok: true, via: 'alimtalk' })
  })
  it('키가 없거나 휴대폰이 아니면 건너뛴다', async () => {
    expect(await sendTextNotice({}, '01033334444', { tpl: 't', title: 't', text: 'x' })).toEqual({ ok: false, skipped: 'no_credentials' })
    expect(await sendTextNotice(ENV, '02-123-4567', { tpl: 't', title: 't', text: 'x' })).toEqual({ ok: false, skipped: 'invalid_phone' })
    expect(calls).toHaveLength(0)
  })
  it('실패는 기록하되 재시도 큐에 태우지 않는다(max_retries 0)', async () => {
    reply = { status: 202, json: { messages: [{ requestStatusCode: 'A013', requestStatusDesc: '템플릿 불일치' }] } }
    const DB = fakeDb('voucher_issued')
    const r = await sendTextNotice({ ...ENV, DB }, '01033334444', { tpl: 'voucher_issued', title: 't', text: 'x' })
    expect(r.ok).toBe(false)
    const fail = DB.writes.find((w) => w.sql.includes('INSERT INTO alimtalk_failures'))!
    expect(fail.sql).toMatch(/max_retries\) VALUES \(\?, \?, \?, \?, 0\)/)
    expect(fail.args[1]).toBe('alimtalk:voucher_issued')
  })
  it('승인 목록 파싱 — 쉼표·공백·줄바꿈', () => {
    expect([...parseApprovedTemplates(' a, b\nc ,, ')]).toEqual(['a', 'b', 'c'])
    expect(parseApprovedTemplates(null).size).toBe(0)
  })
  it('등록 코드를 다르게 지었으면 `우리이름=등록코드` 로 적고 그 코드로 보낸다', async () => {
    expect([...parseTemplateCodeMap('voucher_issued = UD_1234, voucher_used=UD_5678\nseller_voucher_sold')])
      .toEqual([['voucher_issued', 'UD_1234'], ['voucher_used', 'UD_5678'], ['seller_voucher_sold', 'seller_voucher_sold']])
    const r = await sendTextNotice({ ...ENV, DB: fakeDb('voucher_issued=UD_1234') }, '01033334444', { tpl: 'voucher_issued', title: 't', text: 'x' })
    expect(r.ok).toBe(true)
    expect(calls[0].body.templateCode).toBe('UD_1234')
  })
  it('대표가 끈 알림(ALIMTALK_OFF_TEMPLATES)은 승인돼 있어도 안 나가고, 놓친 것으로 기록하지도 않는다', async () => {
    const DB = fakeDb('voucher_used=UD_5678')
    const r = await sendTextNotice({ ...ENV, DB }, '01033334444', { tpl: 'voucher_used', title: 't', text: 'x' })
    expect(r).toEqual({ ok: false, skipped: 'turned_off' })
    expect(calls).toHaveLength(0)
    expect(DB.writes).toHaveLength(0)
  })
})

describe('사장님 판매 알림이 실제 발송 경로에 닿는다', () => {
  it('sendSellerVoucherSoldAlimtalk → SENS 알림톡(템플릿 승인 시)', async () => {
    await sendSellerVoucherSoldAlimtalk({ ...ENV, DB: fakeDb('seller_voucher_sold') }, '01033334444', { restaurantName: '가게', productName: '돈가스', qty: 1, amount: 9000, sellerId: 7 })
    expect(calls).toHaveLength(1)
    expect(calls[0].body.messages[0].content).toContain('돈가스')
  })
})

describe('소스 불변식', () => {
  const files = execSync("git ls-files 'src/**/*.ts' 'src/**/*.tsx' 'src/*.ts'", { encoding: 'utf8' }).split('\n').filter((f) => f && !f.startsWith('src/tests/'))
  it('검사 대상이 비어 있지 않다', () => { expect(files.length).toBeGreaterThan(500) })
  it('솔라피로 보내는 코드가 없다(쓰지 않는 회사·라이브에 키 없음)', () => {
    const hits = files.filter((f) => readFileSync(f, 'utf8').includes('api.solapi.com'))
    expect(hits).toEqual([])
  })
  it('알리고로 보내는 코드가 없다(2026-10-12 SENS 로 이전 — 고정 IP 없이는 알리고가 거부한다)', () => {
    const hits = files.filter((f) => {
      const code = stripComments(readFileSync(f, 'utf8'))
      return /aligo\.in|\bALIGO_[A-Z_]+|from '[^']*\/aligo'|import\('[^']*\/aligo'\)/.test(code)
    })
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
  // 끝 경계는 바로 다음 라우트 등록. 🩸 2026-10-12: 종전엔 '다음 구역 주석'(🚦 2026-07-05)까지 잘랐는데, 그 사이에
  //   메일 시험 라우트가 생기자 그쪽의 super_admin 줄이 이 블록에 섞여 이 엔드포인트의 확인을 지워도 통과했다(주입이 잡았다).
  const start = src.indexOf("post('/alimtalk-test-send'")
  const block = src.slice(start, src.indexOf('\nadminSystemMonitoringRoutes.', start))
  it('super_admin 만 보낸다', () => {
    expect(block).toMatch(/admin\?\.role !== 'super_admin'\) return c\.json\(\{[^}]*\}, 403\)/)
  })
  it('실제 발송 경로(sendTextNotice)를 그대로 탄다 — 시험용 우회 경로가 아니다', () => {
    expect(block).toContain('sendTextNotice(c.env, user.phone')
    expect(block).not.toMatch(/aligo|api\.solapi|fetch\(/)
  })
  it('가입된 유저 번호로만 보낸다(임의 번호 입력 없음)', () => {
    expect(block).toContain("SELECT phone FROM users WHERE id = ?")
    expect(block).not.toMatch(/body\.phone|body\.to\b/)
  })
})

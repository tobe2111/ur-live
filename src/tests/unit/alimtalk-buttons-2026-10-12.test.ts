/**
 * 🔘 알림톡 버튼 — 2026-10-12 대표 "알림톡을 보낼 때 유어딜 링크도 넣어야 되지 않을까? … 각각 링크 넣어줘"
 *
 * 카카오는 **등록한 버튼과 발송 때 실은 버튼이 같아야** 받는다. 어긋나면 에러가 우리 쪽에 안 남고(SENS 원문만)
 * 그 알림이 조용히 안 간다. 그래서 고정한다:
 *  ① 표(`lib/alimtalk-buttons.ts`)가 만드는 버튼 — 손님은 고정 주소, 사장님은 매장 번호가 든 `/store/go` 링크
 *  ② 등록용 문서의 버튼 줄 = 표 (이름·순서·링크 모양까지)
 *  ③ 발송이 버튼을 싣는다 · 매장 번호가 없으면 보내지 않고 기록한다
 *  ④ 호출부가 매장 번호를 넘긴다
 *  ⑤ 버튼이 있는 템플릿의 본문엔 주소를 다시 적지 않는다(같은 링크가 두 번)
 *
 * ⚠️ 못 보는 것: 대표님이 콘솔에 실제로 같은 값을 넣었는지(레포 밖) — 첫 실발송의 SENS 응답만이 판정한다.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { ALIMTALK_BUTTONS, alimtalkButtons, registeredButtonLink, STORE_ID_VAR } from '@/lib/alimtalk-buttons'
import { storeGoUrl } from '@/shared/store-deep-link'
import { sendTextNotice, _resetApprovedTemplatesCache } from '@/lib/text-notice'
import { stripComments } from '../helpers/source-text'

const read = (p: string) => readFileSync(p, 'utf8')
const DOC = read('docs/alimtalk-register-list.md')

describe('① 표가 만드는 버튼', () => {
  it('손님 템플릿은 매장 번호 없이도 [내 이용권 보기]', () => {
    for (const t of ['voucher_issued', 'voucher_refunded', 'voucher_expire_soon']) {
      expect(alimtalkButtons(t)).toEqual([
        { type: 'WL', name: '내 이용권 보기', linkMobile: 'https://urdeal.kr/my-vouchers', linkPc: 'https://urdeal.kr/my-vouchers' },
      ])
    }
  })
  it('사장님 템플릿은 매장 번호가 든 링크 — 등록한 모양에 번호만 들어간다', () => {
    for (const [tpl, specs] of Object.entries(ALIMTALK_BUTTONS)) {
      const bs = alimtalkButtons(tpl, { sellerId: 42 })!
      expect(bs).toHaveLength(specs.length)
      bs.forEach((b, i) => {
        expect(b.linkMobile).toBe(registeredButtonLink(specs[i].link).replace(STORE_ID_VAR, '42'))
        expect(b.linkPc).toBe(b.linkMobile)
        if (specs[i].link.kind === 'store') expect(b.linkMobile).toBe(storeGoUrl(42, specs[i].link.to))
      })
    }
  })
  it('매장 버튼인데 매장 번호가 없으면 null(보내면 카카오가 거절한다)', () => {
    expect(alimtalkButtons('seller_voucher_sold')).toBeNull()
    expect(alimtalkButtons('seller_approved', { sellerId: 0 })).toBeNull()
    expect(alimtalkButtons('seller_approved', { sellerId: 'abc' })).toBeNull()
  })
  it('버튼이 없는 템플릿은 빈 배열', () => {
    expect(alimtalkButtons('admin_test_send')).toEqual([])
    expect(alimtalkButtons('payout_completed')).toEqual([])
  })
  it('버튼 이름은 카카오 한도(14자) 안', () => {
    for (const specs of Object.values(ALIMTALK_BUTTONS)) for (const b of specs) expect(b.name.length).toBeLessThanOrEqual(14)
  })
})

/** 문서에서 그 템플릿 절의 "버튼(웹링크)" 줄을 꺼낸다. */
function docButtonLine(tpl: string): string {
  const head = DOC.search(new RegExp('^### \\d+\\. `' + tpl + '` ', 'm'))
  expect(head).toBeGreaterThanOrEqual(0)
  const rest = DOC.slice(head)
  const next = rest.slice(4).search(/^### /m)
  const section = next >= 0 ? rest.slice(0, next + 4) : rest
  const line = section.split('\n').find((l) => l.startsWith('- **버튼(웹링크)**:'))
  expect(line, `${tpl} 문서에 버튼 줄이 없다`).toBeTruthy()
  return line!
}

describe('② 등록용 문서 = 표', () => {
  it('표의 템플릿마다 문서 버튼 줄이 이름·링크·순서까지 같다', () => {
    for (const [tpl, specs] of Object.entries(ALIMTALK_BUTTONS)) {
      const expected = '- **버튼(웹링크)**: ' + specs.map((b) => `\`${b.name}\` → \`${registeredButtonLink(b.link)}\``).join(' · ')
      expect(docButtonLine(tpl)).toBe(expected)
    }
  })
  it('지금 등록하는 10개 중 표에 없는 것은 문서도 "없음"', () => {
    for (const tpl of ['admin_test_send', 'payout_completed']) {
      expect(ALIMTALK_BUTTONS[tpl]).toBeUndefined()
      expect(docButtonLine(tpl)).toMatch(/^- \*\*버튼\(웹링크\)\*\*: 없음/)
    }
  })
  it('버튼이 있는 템플릿의 등록 본문엔 주소가 없다(⑤ — 버튼과 같은 링크를 두 번 쓰지 않는다)', () => {
    for (const tpl of Object.keys(ALIMTALK_BUTTONS)) {
      const head = DOC.search(new RegExp('^### \\d+\\. `' + tpl + '` ', 'm'))
      if (head < 0) continue // 나중에 등록할 템플릿(아직 절이 없음)
      const a = DOC.indexOf('```', head), b = DOC.indexOf('```', a + 3)
      expect(DOC.slice(a, b), tpl).not.toMatch(/https?:\/\//)
    }
  })
})

function fakeDb(approved: string) {
  const writes: { sql: string; args: unknown[] }[] = []
  return {
    writes,
    prepare(sql: string) {
      let args: unknown[] = []
      const stmt = {
        bind(...a: unknown[]) { args = a; return stmt },
        async first() { return sql.includes('platform_settings') ? { value: approved } : null },
        async run() { writes.push({ sql, args }); return { meta: { changes: 1 } } },
      }
      return stmt
    },
  }
}
const ENV = { NCP_ACCESS_KEY: 'AK', NCP_SECRET_KEY: 'SK', NCP_SENS_ALIMTALK_SERVICE_ID: 'svc', NCP_KAKAO_CHANNEL_ID: '@유어딜' }
let bodies: Array<{ templateCode: string; messages: Array<{ buttons?: unknown[] }> }> = []

beforeEach(() => {
  bodies = []
  _resetApprovedTemplatesCache()
  vi.stubGlobal('fetch', vi.fn(async (_u: string, init: { body: string }) => {
    bodies.push(JSON.parse(String(init.body)))
    return new Response(JSON.stringify({ messages: [{ requestStatusCode: 'A000' }] }), { status: 202, headers: { 'Content-Type': 'application/json' } })
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('③ 발송이 버튼을 싣는다', () => {
  it('사장님 판매 — 매장 번호로 만든 버튼 두 개, 등록 코드로', async () => {
    const DB = fakeDb('seller_voucher_sold=sellervouchersold')
    const r = await sendTextNotice({ ...ENV, DB }, '01033334444', { tpl: 'seller_voucher_sold', title: 't', text: 'x', sellerId: 9 })
    expect(r).toEqual({ ok: true, via: 'alimtalk' })
    expect(bodies[0].templateCode).toBe('sellervouchersold')
    expect(bodies[0].messages[0].buttons).toEqual(alimtalkButtons('seller_voucher_sold', { sellerId: 9 }))
  })
  it('매장 번호가 빠지면 보내지 않고 기록한다(조용히 거절당하지 않게)', async () => {
    const DB = fakeDb('seller_approved')
    const r = await sendTextNotice({ ...ENV, DB }, '01033334444', { tpl: 'seller_approved', title: 't', text: 'x' })
    expect(r).toEqual({ ok: false, via: 'alimtalk', error: 'missing_store_id_for_buttons' })
    expect(bodies).toHaveLength(0)
    expect(DB.writes.some((w) => w.sql.includes('alimtalk_failures') && w.args.includes('missing_store_id_for_buttons'))).toBe(true)
  })
  it('버튼 없는 템플릿은 buttons 키 자체가 없다', async () => {
    await sendTextNotice({ ...ENV, DB: fakeDb('payout_completed') }, '01033334444', { tpl: 'payout_completed', title: 't', text: 'x' })
    expect(bodies[0].messages[0]).not.toHaveProperty('buttons')
  })
})

describe('④ 호출부가 매장 번호를 넘긴다', () => {
  const code = (p: string) => stripComments(read(p))
  it('첫 판매·판매(helpers)', () => {
    const h = code('src/features/group-buy/api/helpers.ts')
    expect(h).toMatch(/tpl: 'seller_first_voucher'[^}]*sellerId: data\.sellerId/)
    expect(h).toMatch(/tpl: 'seller_voucher_sold'[^}]*sellerId: data\.sellerId/)
  })
  it('매장 승인 · 서류 반려 · 계좌 변경', () => {
    expect(code('src/features/admin/api/admin-sellers/seller-decision-notify.ts')).toMatch(/\{ sellerId \},/)
    expect(code('src/features/admin/api/admin-sellers.routes.ts')).toMatch(/sendSystemAlimtalk\(env, phone, templateCode, message, \{ sellerId \}\)/)
    expect(code('src/features/seller/api/seller-profile.routes.ts')).toMatch(/'seller_bank_changed',[\s\S]{0,400}\{ sellerId \}\)/)
  })
  it('sendSystemAlimtalk 이 매장 번호를 발송까지 전달한다', () => {
    expect(code('src/lib/system-alimtalk.ts')).toMatch(/sellerId: opts\?\.sellerId/)
  })
})

describe('⑤ 코드 본문에도 주소를 다시 적지 않는다', () => {
  it('손님 발급·만료 안내, 사장님 첫 판매·판매', () => {
    const h = read('src/features/group-buy/api/helpers.ts')
    for (const fn of ['sendBuyerVoucherIssuedAlimtalk', 'sendSellerFirstVoucherAlimtalk', 'sendSellerVoucherSoldAlimtalk']) {
      const at = h.indexOf(`export async function ${fn}`)
      expect(at, fn).toBeGreaterThan(0)
      const body = h.slice(at, h.indexOf('\nexport ', at + 10))
      expect(body.slice(body.indexOf('const message'), body.indexOf('await sendTextNotice')), fn).not.toMatch(/https?:\/\//)
    }
    const e = read('src/worker/cron/voucher-expire.ts')
    const m = e.slice(e.indexOf('const message ='), e.indexOf("tpl: 'voucher_expire_soon'"))
    expect(m.length).toBeGreaterThan(50)
    expect(m).not.toMatch(/https?:\/\//)
  })
})

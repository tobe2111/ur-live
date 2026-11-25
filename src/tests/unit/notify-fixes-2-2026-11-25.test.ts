/**
 * 🔔 알림 2차 (2026-11-25 대표 *"이어서 다 고쳐줘."* — 인계 표의 알림 영역 '열림')
 *
 *  ① 보내다 실패한 알림톡은 다시 보낸다 — 종전엔 모든 실패가 "재시도 0회" 라 한 건도 재시도되지 않았다.
 *     다시 보낼 때는 처음과 같은 등록 코드(`이름=코드`)와 버튼으로 보낸다.
 *  ② 만료 자동 환불을 손님에게 알린다(알림톡). 실패한 환불에는 "환불 완료" 를 보내지 않는다.
 *  ③ "환불 완료" 알림톡은 돈이 돌아간 뒤에만 · 이용권마다 따로(한 시간 한 통 제한에 둘째가 막혔다).
 *  ④ 매장에 가는 알림은 담당자 휴대폰 우선(남은 호출부).
 *  ⑤ 만료 알림이 앱 안 목록에 두 줄씩 생기지 않는다.
 *  ⑥ 영수증 메일 문구.
 *
 * SENS(카카오 알림톡 발송처)는 가짜 응답으로 바꾸고 **요청 본문**을 본다. DB 는 라이브 구조.
 * 못 보는 것: 실제 카카오 발송 · 승인 목록에 없는 템플릿(여전히 안 나간다) · 웹 푸시(구독이 없으면 건너뛴다).
 */
import { describe, it, expect, afterEach } from 'vitest'
import { d1, openLiveSchema, insert, q, q1, stubOutbound } from '../helpers/live-d1'
import { readCode } from '../helpers/source-text'
import { sendTextNotice, retryCode, parseRetryCode, _resetApprovedTemplatesCache } from '@/lib/text-notice'
import { handleRetryAlimtalk } from '@/worker/cron/retry-alimtalk'
import { handleExpiredVoucherRefunds } from '@/worker/cron/auto-settlement'
import { sendRefundAlimtalk } from '@/features/group-buy/api/helpers'
import { expiredRefundPushBody } from '@/worker/utils/expired-refund-notify'
import { runSellerApprovedHooks } from '@/worker/utils/seller-approved-hooks'
import { setSellerMeta } from '@/worker/utils/seller-meta'

type SensCall = { templateCode: string; to: string; content: string; buttons?: Array<{ name: string }> }

/** SENS 를 가짜로 — `statuses` 순서대로 응답한다(다 쓰면 마지막 값 반복). 보낸 본문을 모은다. */
function fakeSens(statuses: number[]) {
  const calls: SensCall[] = []
  const out = stubOutbound()
  const inner = globalThis.fetch
  let n = 0
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url.includes('/alimtalk/v2/services/')) {
      const body = JSON.parse(String(init?.body || '{}')) as { templateCode: string; messages: Array<{ to: string; content: string; buttons?: Array<{ name: string }> }> }
      calls.push({ templateCode: body.templateCode, to: body.messages[0].to, content: body.messages[0].content, buttons: body.messages[0].buttons })
      const status = statuses[Math.min(n++, statuses.length - 1)]
      return new Response(JSON.stringify(status === 202 ? { statusCode: '202', statusName: 'success', messages: [{ requestStatusCode: 'A000' }] } : { status: status, error: { message: 'boom' } }), { status, headers: { 'Content-Type': 'application/json' } })
    }
    return inner(input as never, init)
  }) as typeof fetch
  return { calls, restore: () => out.restore() }
}

function world(approved: string) {
  const raw = openLiveSchema()
  const DB = d1(raw)
  insert(raw, 'platform_settings', { key: 'alimtalk_approved_templates', value: approved })
  _resetApprovedTemplatesCache()
  const env = { DB, NCP_ACCESS_KEY: 'ak', NCP_SECRET_KEY: 'sk', NCP_SENS_ALIMTALK_SERVICE_ID: 'svc', NCP_KAKAO_CHANNEL_ID: '@urdeal', TOSS_SECRET_KEY: 'test_sk_local', ENVIRONMENT: 'development' } as Record<string, unknown>
  return { raw, DB, env }
}
afterEach(() => { _resetApprovedTemplatesCache() })

describe('① 보내다 실패한 알림톡은 다시 보낸다', () => {
  it('재시도 코드는 이름과 매장 번호를 왕복한다', () => {
    expect(retryCode('seller_first_voucher', 12)).toBe('alimtalk:seller_first_voucher#s12')
    expect(retryCode('voucher_refunded')).toBe('alimtalk:voucher_refunded')
    expect(parseRetryCode('alimtalk:seller_first_voucher#s12')).toEqual({ tpl: 'seller_first_voucher', sellerId: 12 })
    expect(parseRetryCode('pending:voucher_issued')).toBeNull()
    expect(parseRetryCode('voucher_used')).toBeNull()
  })

  it('발송 실패는 재시도 3회로 적힌다 · 승인 전(pending)은 0회 그대로', async () => {
    const w = world('voucher_refunded=VR01')
    const sens = fakeSens([500])
    await sendTextNotice(w.env, '010-1234-5678', { tpl: 'voucher_refunded', title: 't', text: '환불 안내' })
    await sendTextNotice(w.env, '010-1234-5678', { tpl: 'voucher_expire_soon', title: 't', text: '만료 안내' })
    sens.restore()
    const rows = q<{ template_code: string; max_retries: number }>(w.raw, 'SELECT template_code, max_retries FROM alimtalk_failures ORDER BY id')
    expect(rows).toEqual([
      { template_code: 'alimtalk:voucher_refunded', max_retries: 3 },
      { template_code: 'pending:voucher_expire_soon', max_retries: 0 },
    ])
  })

  it('재시도는 처음과 같은 등록 코드·버튼으로 다시 보내고, 성공하면 해결로 닫는다', async () => {
    const w = world('seller_first_voucher=SFV01')
    const S = insert(w.raw, 'sellers', { username: 'st1', email: 'st1@example.test', password_hash: '', name: '사장', business_name: '시험식당', status: 'approved' })
    const first = fakeSens([500])
    await sendTextNotice(w.env, '01012345678', { tpl: 'seller_first_voucher', title: 't', text: '첫 판매', sellerId: S })
    first.restore()
    const firstButtons = first.calls[0].buttons?.map((b) => b.name)
    expect(firstButtons?.length, '이 템플릿에 버튼이 없다 — 시험이 버튼 경로를 못 본다').toBeGreaterThan(0)
    w.raw.exec("UPDATE alimtalk_failures SET next_retry_at = datetime('now', '-1 minute')")
    const again = fakeSens([202])
    await handleRetryAlimtalk(w.env as never)
    again.restore()
    expect(again.calls.length, JSON.stringify(q(w.raw, 'SELECT template_code, retry_count, max_retries, resolved, error, next_retry_at FROM alimtalk_failures'))).toBe(1)
    expect(again.calls[0].templateCode, '이름을 그대로 넘겼다 — 등록 코드가 아니다').toBe('SFV01')
    expect(again.calls[0].buttons?.map((b) => b.name)).toEqual(firstButtons)
    expect(again.calls[0].content).toBe('첫 판매')
    expect(q1<{ resolved: number }>(w.raw, 'SELECT resolved FROM alimtalk_failures')?.resolved).toBe(1)
  })

  it('카카오가 내용을 거절한 것(202 인데 거절 코드)·4xx 는 재시도에 태우지 않는다 — 통신 예외·5xx·429 만', async () => {
    const { isTransientSensError } = await import('@/lib/text-notice')
    expect(isTransientSensError('[SENS 500] boom')).toBe(true)
    expect(isTransientSensError('[SENS 429] too many')).toBe(true)
    expect(isTransientSensError('[SENS] fetch failed')).toBe(true)
    expect(isTransientSensError('[SENS 202] A013 템플릿 불일치')).toBe(false)
    expect(isTransientSensError('[SENS 401] unauthorized')).toBe(false)
    expect(isTransientSensError('missing_store_id_for_buttons')).toBe(false)
  })

  it('다시 보내도 같은 결과인 것(옛 형식 · 승인이 풀림)은 보내지 않고 그만 집는다', async () => {
    const w = world('voucher_refunded')
    insert(w.raw, 'alimtalk_failures', { phone: '01012345678', template_code: 'voucher_used', message: 'm', error: 'e', max_retries: 3, next_retry_at: '2026-01-01 00:00:00' })
    insert(w.raw, 'alimtalk_failures', { phone: '01012345678', template_code: 'alimtalk:voucher_issued', message: 'm', error: 'e', max_retries: 3, next_retry_at: '2026-01-01 00:00:00' })
    const sens = fakeSens([202])
    await handleRetryAlimtalk(w.env as never)
    sens.restore()
    expect(sens.calls).toEqual([])
    expect(q<{ retry_count: number; resolved: number }>(w.raw, 'SELECT retry_count, resolved FROM alimtalk_failures ORDER BY id')).toEqual([
      { retry_count: 3, resolved: 0 }, { retry_count: 3, resolved: 0 },
    ])
  })
})

describe('② 만료 자동 환불 — 손님이 안다', () => {
  const seed = (w: ReturnType<typeof world>, pay: { method: string; key?: string }) => {
    const U = insert(w.raw, 'users', { name: '손님', email: `u${Math.random().toString(36).slice(2, 7)}@example.test`, phone: '01055557777' })
    const S = insert(w.raw, 'sellers', { username: `s${Math.random().toString(36).slice(2, 7)}`, email: `s${Math.random().toString(36).slice(2, 7)}@example.test`, password_hash: '', name: '사장', business_name: '시험식당', status: 'approved' })
    const P = insert(w.raw, 'products', { seller_id: S, name: '시험 이용권', price: 10000, stock: 10, is_active: 1, category: 'meal_voucher', group_buy_status: 'active', deal_only: 0 })
    const O = insert(w.raw, 'orders', { order_number: `GB-${U}-1`, user_id: String(U), seller_id: S, status: 'PREPARING', total_amount: 10000, payment_method: pay.method, ...(pay.key ? { payment_key: pay.key } : {}) })
    insert(w.raw, 'vouchers', { code: String(100000 + U), order_id: O, product_id: P, user_id: String(U), status: 'unused', applied_price: 10000, expires_at: '2026-01-01 00:00:00' })
    return { U }
  }
  const withToss = (status: number) => {
    const inner = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (/tosspayments\.com\/v1\/payments\/.+\/cancel$/.test(url)) {
        return new Response(JSON.stringify(status === 200 ? { status: 'CANCELED', cancels: [{ cancelAmount: 10000 }] } : { code: 'NOT_CANCELABLE_PAYMENT', message: '취소할 수 없는 결제' }), { status, headers: { 'Content-Type': 'application/json' } })
      }
      return inner(input as never, init)
    }) as typeof fetch
  }

  it('카드 환불이 성공하면 "환불 완료" 알림톡이 손님 휴대폰으로 간다', async () => {
    const w = world('voucher_refunded')
    seed(w, { method: 'toss', key: 'pk_ok_1' })
    const sens = fakeSens([202])
    withToss(200)
    await handleExpiredVoucherRefunds(w.env as never).catch(() => undefined)
    sens.restore()
    const refunds = sens.calls.filter((c) => c.templateCode === 'voucher_refunded')
    expect(refunds.length, JSON.stringify(q(w.raw, 'SELECT status, refund_status FROM vouchers'))).toBe(1)
    expect(refunds[0].to).toBe('01055557777')
    expect(refunds[0].content).toContain('10,000원')
  })

  it('카드 환불이 실패하면 "환불 완료" 를 보내지 않는다', async () => {
    const w = world('voucher_refunded')
    seed(w, { method: 'toss', key: 'pk_fail_1' })
    const sens = fakeSens([202])
    withToss(400)
    await handleExpiredVoucherRefunds(w.env as never).catch(() => undefined)
    sens.restore()
    expect(sens.calls.filter((c) => c.templateCode === 'voucher_refunded'), '환불이 안 됐는데 손님에게 환불 완료라고 말했다').toEqual([])
  })

  it('푸시 문구는 돌려준 방법을 말한다', () => {
    expect(expiredRefundPushBody({ amount: 10000, via: 'deal', productName: '김밥' })).toBe('유효기간이 지나 10,000딜을 돌려드렸어요 (김밥)')
    expect(expiredRefundPushBody({ amount: 10000, via: 'card', productName: null })).toContain('카드 환불은 영업일 3~5일')
  })
})

describe('③ "환불 완료" 는 돈이 돌아간 뒤에만 · 이용권마다 따로', () => {
  it('같은 사람에게 한 시간 안에 두 장을 환불하면 두 통이 간다(이용권 번호로 구분)', async () => {
    const w = world('voucher_refunded')
    const U = insert(w.raw, 'users', { name: '손님', email: 'two@example.test', phone: '01077778888' })
    const sens = fakeSens([202])
    await sendRefundAlimtalk(w.env, w.DB, String(U), '이용권', 5000, 'voucher:1')
    await sendRefundAlimtalk(w.env, w.DB, String(U), '이용권', 5000, 'voucher:2')
    await sendRefundAlimtalk(w.env, w.DB, String(U), '이용권', 5000, 'voucher:2') // 같은 이용권은 한 번만
    sens.restore()
    expect(sens.calls.length).toBe(2)
  })

  it('부분 환불: 카드 취소가 대기 중이면 알림톡을 보내지 않는다', () => {
    const src = readCode('src/features/group-buy/api/group-buy-voucher.routes.ts')
    expect(src).toContain('cardPending ? Promise.resolve() : sendRefundAlimtalk(')
  })

  it('미달성 환불: 카드 취소를 걸기 전에는 알림톡이 없다 — 성공 분기 안에서만 보낸다', () => {
    const src = readCode('src/features/group-buy/api/group-buy-seller.routes.ts')
    // 카드: 취소 성공 분기의 **마지막 줄**에서만 보낸다(실패 분기 · 취소 전에는 없다)
    expect(src, '카드 취소 성공 분기 밖에서 보낸다').toMatch(/status = 'REFUNDED'[^\n]*\n\s*await tellRefunded\(\)\n\s*\} else \{/)
    // 부르는 곳은 둘뿐이다 — 딜 환불 직후(waitUntil) · 카드 취소 성공 뒤
    expect(src.split('tellRefunded()').length - 1).toBe(2)
    expect(src).toContain('c.executionCtx?.waitUntil(tellRefunded())')
    expect(src, '옛 문장이 남아 있다 — 취소 전에 "환불 완료" 를 보낸다').not.toContain("await sendSystemAlimtalk(c.env as unknown as Record<string, unknown>, user.phone, 'voucher_refunded', msg)")
  })
})

describe('④ 매장 알림은 담당자 휴대폰 우선', () => {
  it('승인 통보 줄 세우기: 대표번호가 유선이어도 담당자 휴대폰으로 잡힌다', async () => {
    const w = world('seller_approved')
    const S = insert(w.raw, 'sellers', { username: 'ap1', email: 'ap1@example.test', password_hash: '', name: '사장', business_name: '시험식당', status: 'approved', phone: '02-123-4567' })
    await setSellerMeta(w.DB, S, { manager_phone: '01099990000' })
    const r = await runSellerApprovedHooks(w.DB, S, 'pending')
    expect(r.notice, '유선 번호만 봐서 통보를 건너뛰었다').toBe('queued')
    expect(q1<{ phone: string }>(w.raw, 'SELECT phone FROM store_owner_notices WHERE seller_id = ?', S)?.phone).toBe('01099990000')
  })

  it('남은 호출부가 한 곳(`resolveSellerNotifyTarget`)으로 번호를 고른다', () => {
    for (const f of [
      'src/worker/utils/seller-approved-hooks.ts',
      'src/features/admin/api/admin-settlements.routes.ts',
      'src/features/settlement/api/restaurant-settlement.routes.ts',
      'src/features/agency-console/api/agency-influencer-deals.routes.ts',
      'src/features/appointments/api/appointments.routes.ts',
      'src/features/referral/api/referral-tree.routes.ts',
    ]) expect(readCode(f), f).toContain('resolveSellerNotifyTarget(')
    expect(readCode('src/features/appointments/api/appointments.routes.ts')).not.toContain("'SELECT phone FROM sellers WHERE id = ?'")
    expect(readCode('src/worker/cron/appointment-noshow-alert.ts'), '손님 이름이 없으면 내부 번호가 매장에 간다').not.toContain('apt.user_name || apt.user_id')
  })
})

describe('⑤ 만료 알림이 앱 안 목록에 두 줄씩 생기지 않는다', () => {
  it('시간별 정리 작업은 푸시만 맡는다(앱 안 알림은 만료 알림 cron 한 곳)', () => {
    const src = readCode('src/worker/cron/scheduled-cleanup.ts')
    expect(src).not.toContain("VALUES (?, 'voucher_expiring', ?, ?, ?)")
    expect(src).toContain("tag: `voucher-d7-${v.id}`")
    expect(src).toContain("tag: `voucher-d1-${v.id}`")
    expect(readCode('src/worker/cron/voucher-expire.ts')).toContain('INSERT INTO notifications (user_id, user_type, type, title, message, link, created_at)')
  })
})

describe('⑥ 영수증 메일 문구', () => {
  it('교환권에는 "매장 방문 시 코드" 를 말하지 않는다 · "바우처"·"공동구매 참여" 가 없다', () => {
    const gb = readCode('src/features/group-buy/api/group-buy.routes.ts')
    expect(gb).toContain("=== 1 ? '💡 교환권은 ")
    expect(gb).not.toContain('공동구매 참여를 확인했어요')
    expect(gb).not.toContain('발급된 바우처 코드')
    expect(gb).not.toContain('내 바우처 보기')
  })
})

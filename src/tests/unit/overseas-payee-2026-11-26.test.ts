/**
 * 🌍 해외 거주 소개자 — 받는 곳 등록 · 해외 원천징수 · 해외 송금 기록 (2026-11-26 대표 *"응 만들어줘"*)
 *
 * 고정하는 것:
 *   ① 입력 검사(나라·영문 이름·방법·SWIFT·이메일) · 한국 거주는 거부 · 가린 표시
 *   ② **평문 저장 금지** — 키 없으면 거부, 저장값은 암호문(v1:)이고 계좌·이메일 원문이 표에 없다
 *   ③ 실제 라우트: 해외 등록 소개자는 국내 계좌·주민번호 없이 현금 지급 처리 → 해외 원천징수율(기본 22%) ·
 *      거주자 원천징수 장부(간이지급명세서)에는 안 들어가고 해외 지급 기록에 남는다 · 두 번 눌러도 한 번
 *   ④ 월 정산 cron: 해외 등록자는 "주민번호 필요" 로 막지 않고 해외 송금 대기 알림
 *   ⑤ 받는 곳 원문 보기는 2FA 미들웨어·감사 로그 뒤(2FA 는 2026-07-19 대표 지시로 전체 꺼짐 — 지금 보호는 관리자 로그인·권한·기록)
 * ⚠️ 못 보는 것: 실제 해외송금(사람이 Wise·은행에서 한다) · 원화→외화 환율 · 원천징수율의 세법상 정답(세무사 확인 대상).
 */
import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { readFileSync } from 'node:fs'
import { sign } from 'hono/jwt'
import { d1, openLiveSchema, insert, q, q1, userToken, makeCtx, SECRET } from '../helpers/live-d1'
import { influencerSettlementRoutes, adminPayoutRoutes } from '@/features/group-buy/api/marketing.routes'
import { handleInfluencerPayout } from '@/worker/cron/influencer-payout'
import {
  normalizeOverseasPayee, maskOverseasDestination, resolveOverseasWithholdingPct, saveOverseasPayee, getOverseasPayee, OverseasPayeeError,
} from '@/worker/utils/overseas-payee'
import { computeCashPayout } from '@/shared/influencer-payout-math'

const KEK = 'test-kek-0123456789abcdef'

describe('① 입력 검사', () => {
  it('정상 입력은 정리되고, 틀리면 사유와 함께 거부한다', () => {
    expect(normalizeOverseasPayee({ country: 'us', legalNameEn: ' John  Doe ', method: 'wise', destination: { email: 'John@Example.com' } }))
      .toEqual({ country: 'US', legalNameEn: 'John Doe', method: 'wise', currency: 'USD', destination: { email: 'john@example.com' } })
    const bank = normalizeOverseasPayee({ country: 'JP', legalNameEn: 'Taro Yamada', method: 'bank', currency: 'jpy', destination: { account: 'gb33 bukb 2020 1555 5555 55', swift: 'bukbgb22', bankName: 'Barclays' } })
    expect(bank.destination).toMatchObject({ account: 'GB33BUKB20201555555555', swift: 'BUKBGB22' })
    expect(bank.currency).toBe('JPY')
    const bad: Array<[Record<string, unknown>, string]> = [
      [{ country: 'KR', legalNameEn: 'Kim', method: 'wise', destination: { email: 'a@b.co' } }, 'INVALID_COUNTRY'],
      [{ country: 'USA', legalNameEn: 'Kim Lee', method: 'wise', destination: { email: 'a@b.co' } }, 'INVALID_COUNTRY'],
      [{ country: 'US', legalNameEn: '김철수', method: 'wise', destination: { email: 'a@b.co' } }, 'INVALID_NAME'],
      [{ country: 'US', legalNameEn: 'Kim Lee', method: 'cash', destination: {} }, 'INVALID_METHOD'],
      [{ country: 'US', legalNameEn: 'Kim Lee', method: 'paypal', destination: { email: 'nope' } }, 'INVALID_DESTINATION'],
      [{ country: 'US', legalNameEn: 'Kim Lee', method: 'bank', destination: { account: '12345678', swift: 'BAD', bankName: 'Chase' } }, 'INVALID_DESTINATION'],
    ]
    for (const [input, code] of bad) {
      try { normalizeOverseasPayee(input as never); throw new Error('통과하면 안 된다: ' + JSON.stringify(input)) } catch (e) { expect((e as OverseasPayeeError).code).toBe(code) }
    }
  })
  it('가린 표시 · 원천징수율 해석(비거나 범위 밖이면 22)', () => {
    expect(maskOverseasDestination('bank', { bankName: 'Chase', account: '000123456789' })).toBe('Chase ****6789')
    expect(maskOverseasDestination('wise', { email: 'john@example.com' })).toBe('Wise jo***@example.com')
    expect(resolveOverseasWithholdingPct(undefined)).toBe(22)
    expect(resolveOverseasWithholdingPct('')).toBe(22)
    expect(resolveOverseasWithholdingPct('0')).toBe(0)
    expect(resolveOverseasWithholdingPct('11')).toBe(11)
    expect(resolveOverseasWithholdingPct('99')).toBe(22)
  })
  it('계산 SSOT: 해외 세율을 주면 국내 3.3% 판정을 건너뛴다(안 주면 종전과 같다)', () => {
    expect(computeCashPayout({ gross: 200000, withholdingRateOverride: 0.22 })).toMatchObject({ withholding: 44000, net: 156000 })
    expect(computeCashPayout({ gross: 200000 })).toMatchObject({ withholding: 6600, net: 193400 })
  })
})

describe('② 저장', () => {
  it('키 없으면 거부 · 암호문 저장 · 상태는 가린 값만', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const input = { country: 'US', legalNameEn: 'John Doe', method: 'bank', destination: { account: '000123456789', swift: 'CHASUS33', bankName: 'Chase' } }
    await expect(saveOverseasPayee(DB, undefined, 'influencer', '7', input)).rejects.toBeInstanceOf(OverseasPayeeError)
    await saveOverseasPayee(DB, KEK, 'influencer', '7', input)
    const row = q1<{ destination_enc: string }>(raw, 'SELECT destination_enc FROM overseas_payees WHERE payee_id = ?', '7')!
    expect(row.destination_enc.startsWith('v1:')).toBe(true)
    expect(row.destination_enc).not.toContain('123456789')
    expect(await getOverseasPayee(DB, 'influencer', '7')).toMatchObject({ registered: true, country: 'US', masked: 'Chase ****6789' })
  })
})

describe('③④⑤ 실제 라우트 · cron', () => {
  it('해외 등록 소개자: 계좌·주민번호 없이 지급 · 22% · 해외 기록 · 한 번만 · cron 은 해외 대기', async () => {
    const raw = openLiveSchema()
    const DB = d1(raw)
    const env = { DB, JWT_SECRET: SECRET, DATA_ENCRYPTION_KEY: KEK, ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>
    const app = new Hono()
    app.route('/api/influencer-settlement', influencerSettlementRoutes)
    app.route('/api/admin-payouts', adminPayoutRoutes)
    const call = async (method: string, path: string, token: string, body?: unknown) => {
      const { ctx, drain } = makeCtx()
      raw.exec('DELETE FROM rate_limit_attempts')
      const res = await app.request(path, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 overseas' }, body: body === undefined ? undefined : JSON.stringify(body) }, env, ctx)
      await drain()
      const text = await res.text()
      let json: Record<string, unknown> = {}
      try { json = JSON.parse(text) } catch { json = { _raw: text.slice(0, 200) } }
      return { status: res.status, json, text }
    }
    const now = () => Math.floor(Date.now() / 1000)
    const adminId = insert(raw, 'admins', { username: 'adm-finance', email: 'finance@example.test', password_hash: 'x', name: 'finance', role: 'finance' })
    const fin = await sign({ type: 'admin', sub: String(adminId), admin_id: adminId, userId: adminId, role: 'finance', iat: now(), exp: now() + 3600 }, SECRET)
    const INFL = insert(raw, 'users', { name: 'John', email: 'john@example.test', handle: 'johnabroad' })
    const iTok = await userToken(INFL)
    insert(raw, 'influencer_balances', { influencer_id: String(INFL), available_amount: 200000, total_paid_out: 0, payout_method: 'cash', tax_type: 'business_income' })

    const reg = await call('PUT', '/api/influencer-settlement/overseas', iTok, { country: 'US', legal_name_en: 'John Doe', method: 'wise', currency: 'USD', destination: { email: 'john@example.com' } })
    expect(reg.status, reg.text).toBe(200)
    const me = await call('GET', '/api/influencer-settlement/overseas', iTok)
    expect(me.json.data).toMatchObject({ registered: true, country: 'US', withholding_pct: 22 })
    expect(me.text).not.toContain('john@example.com')

    // ④ cron — 해외 등록자는 주민번호로 막지 않고 해외 송금 대기 알림(정산일 = 매월 10일 KST 로 시계를 맞춘다)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-10T03:00:00Z'))
    try { await handleInfluencerPayout(env as never) } finally { vi.useRealTimers() }
    const notes = q<{ title: string }>(raw, "SELECT title FROM dashboard_notifications WHERE type = 'influencer_payout_pending'")
    expect(notes.map((n) => n.title)).toContain(`🌍 해외 송금 대기: ${INFL}`)
    expect(q(raw, "SELECT 1 FROM notifications WHERE type = 'tax_id_required'").length).toBe(0)

    // 어드민 목록에 해외 표시 + 해외 세율
    const list = await call('GET', '/api/admin-payouts/payouts', fin)
    const row = ((list.json.data as { list: Array<{ influencer_id: string; overseas?: { country: string } }> }).list || []).find((r) => String(r.influencer_id) === String(INFL))
    expect(row?.overseas?.country).toBe('US')
    expect((list.json.data as { overseas_withholding_pct: number }).overseas_withholding_pct).toBe(22)
    expect(list.text).not.toContain('john@example.com')

    // ⑤ 원문 보기 — 2FA 미들웨어 + 감사 로그를 거친다(2FA 는 2026-07-19 대표 지시로 전체 꺼짐 — 다시 켜면 이 문도 막힌다).
    const route = readFileSync('src/features/group-buy/api/marketing/payouts.ts', 'utf8')
    expect(route).toMatch(/overseas-destination', require2FA\(\), auditLog\('influencer\.overseas_destination_view'\)/)
    const shown = await call('GET', `/api/admin-payouts/payouts/${INFL}/overseas-destination`, fin)
    expect((shown.json.data as { destination: { email: string } }).destination.email).toBe('john@example.com')

    // ③ 지급 처리
    const pay = await call('POST', '/api/admin-payouts/payouts/process', fin, { influencer_id: String(INFL), method: 'cash', reference: 'WISE-123' })
    expect(pay.status, pay.text).toBe(200)
    expect(pay.json.cash).toMatchObject({ gross: 200000, withholding: 44000, net: 156000 })
    expect(q1<{ available_amount: number }>(raw, 'SELECT available_amount FROM influencer_balances WHERE influencer_id = ?', String(INFL))?.available_amount).toBe(0)
    const rec = q<{ country: string; withholding: number; net: number; reference: string }>(raw, 'SELECT country, withholding, net, reference FROM overseas_payouts')
    expect(rec).toEqual([{ country: 'US', withholding: 44000, net: 156000, reference: 'WISE-123' }])
    const resident = q(raw, "SELECT 1 FROM sqlite_master WHERE name = 'influencer_withholding_log'").length
      ? q(raw, 'SELECT 1 FROM influencer_withholding_log') : []
    expect(resident.length, '비거주자는 간이지급명세서(거주자) 장부에 들어가면 안 된다').toBe(0)
    const again = await call('POST', '/api/admin-payouts/payouts/process', fin, { influencer_id: String(INFL), method: 'cash' })
    expect(again.status).toBeGreaterThanOrEqual(400)
    expect(q(raw, 'SELECT 1 FROM overseas_payouts').length).toBe(1)

    // 국내로 돌아오면 다시 국내 규칙(주민번호)
    const back = await call('DELETE', '/api/influencer-settlement/overseas', iTok)
    expect(back.status).toBe(200)
    expect((await getOverseasPayee(DB, 'influencer', String(INFL))).registered).toBe(false)
  }, 60_000)
})

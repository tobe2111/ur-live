/**
 * 🚪 로그인 문 점검 3차 (2026-11-25 대표 *"이어서 다 고쳐줘."* — 인계 표의 로그인 영역 '열림' 전부)
 *
 * 실제 라우트를 라이브 구조 DB(`fixtures/live-main-ddl.json`) 위에서 돌린다. 카카오는 가짜 응답으로 바꾼다.
 *  ① 로그인 문(`POST /callback`)은 state 없는 코드를 받지 않는다 · 동의 문은 세션을 바꾸지 않고 **같은 카카오 번호**일 때만 토큰을 적는다
 *  ② 손님 전용 경로 여섯 곳은 셀러 토큰을 받지 않는다
 *  ③ 이메일로 직원을 초대할 때 카카오가 확인한 이메일만 본다(이메일 가입은 주소 확인이 없다)
 *  ④ 잊은 매장 PIN 은 어드민이 초기화한다 · 역할은 계좌와 같다
 *  ⑤ 내보낸 에이전시 직원의 이메일은 다시 쓸 수 있다
 *  ⑥ 탈퇴: 받을 소개비·처리 중 출금이 막는다 · 대기 추천 커미션을 거둔다 · 복구는 한 묶음 · 탈퇴 여부 조회는 본인만 · 되살리기 안내는 카카오 계정만
 *
 * 못 보는 것: 진짜 카카오의 응답과 콘솔에 등록된 redirect URI · 브라우저에서 버튼이 실제로 도는지(카카오 연결 버튼은 소스만 본다)
 *   · 셀러 비밀번호 찾기 문(그 라우트 파일은 이 환경의 보호 장치 때문에 시험이 읽지 않는다 — 소스 한 줄만 본다).
 */
import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { d1, openLiveSchema, insert, q, q1, makeCtx, stubOutbound, SECRET, userToken, sellerToken } from '../helpers/live-d1'
import { readCode } from '../helpers/source-text'
import { kakaoRoutes, __signOauthStateForTest } from '@/features/auth/api/kakao.routes'
import { accountRoutes } from '@/features/account/api/account.routes'
import { gbProposalsRoutes } from '@/features/group-buy/api/gb-proposals.routes'
import { gbMarketplaceRoutes } from '@/features/group-buy/api/gb-marketplace.routes'
import { fcfsRoutes } from '@/features/group-buy/api/fcfs.routes'
import { registerOwnerViewerEndpoints } from '@/features/group-buy/api/owner-viewer.routes'
import { registerDealPlanEndpoint } from '@/features/group-buy/api/deal-plan.routes'
import { shippingRoutes } from '@/worker/routes/shipping.routes'
import { findInviteeByVerifiedEmail } from '@/features/seller/api/seller-operators.routes'
import { adminStoreBankRoutes } from '@/features/admin/api/admin-store-bank.routes'
import { canAdminRoleMutate } from '@/shared/admin-roles'
import { ensureSellerMetaTable, getSellerMeta, setSellerMeta } from '@/worker/utils/seller-meta'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import { countAccountDeleteBlockers, isAccountDeleteBlocked, needsCommissionForfeit } from '@/worker/utils/account-delete-blockers'
import { forfeitEarnedCommission, FORFEIT_ACCOUNT } from '@/worker/utils/commission-forfeit'
import { deleteUserAccount, restoreUser } from '@/worker/services/delete-account.service'
import { sign } from 'hono/jwt'

type Raw = ReturnType<typeof openLiveSchema>
const now = () => Math.floor(Date.now() / 1000)
const sessionCookie = async (userId: number) =>
  `ur_session=${await sign({ sub: String(userId), type: 'user', isDbId: true, name: 'n', email: '', iat: now(), exp: now() + 3600 }, SECRET)}`

function harness(mount: (app: Hono) => void) {
  const raw = openLiveSchema()
  const env = { DB: d1(raw), JWT_SECRET: SECRET, KAKAO_REST_API_KEY: 'test-kakao-key', ENVIRONMENT: 'development', FRONTEND_URL: 'https://urdeal.kr' } as Record<string, unknown>
  const app = new Hono()
  mount(app)
  const out = stubOutbound()
  const call = async (method: string, path: string, opts: { cookie?: string; bearer?: string; body?: unknown } = {}) => {
    const { ctx, drain } = makeCtx()
    raw.exec('DELETE FROM rate_limit_attempts')
    const headers: Record<string, string> = { 'CF-Connecting-IP': '203.0.113.9', 'User-Agent': 'Mozilla/5.0 authdoors3', 'Content-Type': 'application/json' }
    if (opts.cookie) headers.Cookie = opts.cookie
    if (opts.bearer) headers.Authorization = `Bearer ${opts.bearer}`
    const res = await app.request(`https://urdeal.kr${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body) }, env, ctx)
    await drain()
    const text = await res.text()
    let json: Record<string, unknown> = {}
    try { json = JSON.parse(text) } catch { /* 본문이 JSON 이 아니다 */ }
    return { status: res.status, json, setCookie: res.headers.get('Set-Cookie') || '' }
  }
  const kakaoCalls = () => out.other.filter((u) => u.includes('kauth.kakao.com') || u.includes('kapi.kakao.com'))
  const kakaoSays = (kakaoId: number) => {
    const inner = globalThis.fetch
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.includes('kauth.kakao.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at-new', refresh_token: 'rt-new', expires_in: 3600, token_type: 'bearer' }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      if (url.includes('kapi.kakao.com/v2/user/me')) return new Response(JSON.stringify({ id: kakaoId, kakao_account: { email: `k${kakaoId}@example.test`, is_email_verified: true, name: '카카오', profile: { nickname: '카카오' } }, properties: { nickname: '카카오' } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      return inner(input as never, init)
    }) as typeof fetch
  }
  return { raw, call, out, kakaoCalls, kakaoSays }
}

describe('① 카카오 — 로그인 문은 state 를 확인하고, 동의 문은 세션을 바꾸지 않는다', () => {
  const mount = (app: Hono) => { app.route('/api/auth/kakao', kakaoRoutes) }

  it('state 없는 코드를 로그인 문에 넣으면 400 — 카카오에 코드를 바꾸러 가지 않는다', async () => {
    const h = harness(mount)
    const r = await h.call('POST', '/api/auth/kakao/callback', { body: { code: 'ATTACKER_CODE', redirect_uri: 'https://urdeal.kr/auth/kakao/callback' } })
    h.out.restore()
    expect(r.status).toBe(400)
    expect(r.json.code).toBe('OAUTH_STATE_INVALID')
    expect(h.kakaoCalls(), '코드를 토큰으로 바꾸러 갔다 = 로그인이 진행됐다').toEqual([])
    expect(r.setCookie).not.toContain('ur_session=')
  })

  it('우리가 서명한 state 가 있으면 로그인 문은 종전대로 진행한다', async () => {
    const h = harness(mount)
    const state = await __signOauthStateForTest('/', 'user', 'nonce-3', SECRET)
    await h.call('POST', '/api/auth/kakao/callback', { body: { code: 'REAL', state, redirect_uri: 'https://urdeal.kr/auth/kakao/callback' } })
    h.out.restore()
    expect(h.kakaoCalls().length).toBeGreaterThan(0)
  })

  it('동의 문: 로그인 없이는 401', async () => {
    const h = harness(mount)
    const r = await h.call('POST', '/api/auth/kakao/consent-callback', { body: { code: 'C' } })
    h.out.restore()
    expect(r.status).toBe(401)
    expect(h.kakaoCalls()).toEqual([])
  })

  it('동의 문: 코드의 카카오 번호가 지금 로그인한 손님과 다르면 409 — 토큰도 세션도 그대로', async () => {
    const h = harness(mount)
    const me = insert(h.raw, 'users', { name: '피해자', email: 'v@example.test', kakao_id: '111', kakao_access_token: 'old-token' })
    h.kakaoSays(999)
    const r = await h.call('POST', '/api/auth/kakao/consent-callback', { cookie: await sessionCookie(me), body: { code: 'ATTACKER_CODE' } })
    h.out.restore()
    expect(r.status).toBe(409)
    expect(r.json.code).toBe('KAKAO_ACCOUNT_MISMATCH')
    expect(q1<{ t: string }>(h.raw, 'SELECT kakao_access_token t FROM users WHERE id = ?', me)?.t, '남의 카카오 토큰이 피해자 계정에 적혔다').toBe('old-token')
    expect(q(h.raw, "SELECT id FROM users WHERE kakao_id = '999'"), '코드의 주인으로 새 계정이 만들어졌다').toEqual([])
    expect(r.setCookie, '세션을 갈아 끼웠다').not.toContain('ur_session=')
  })

  it('동의 문: 같은 카카오 번호면 토큰만 적는다 — 세션 쿠키는 새로 굽지 않는다', async () => {
    const h = harness(mount)
    const me = insert(h.raw, 'users', { name: '본인', email: 'me@example.test', kakao_id: '222', kakao_access_token: 'old-token' })
    h.kakaoSays(222)
    const r = await h.call('POST', '/api/auth/kakao/consent-callback', { cookie: await sessionCookie(me), body: { code: 'MINE' } })
    h.out.restore()
    expect(r.status).toBe(200)
    expect(q1<{ t: string }>(h.raw, 'SELECT kakao_access_token t FROM users WHERE id = ?', me)?.t).not.toBe('old-token')
    expect(r.setCookie).not.toContain('ur_session=')
  })

  it('동의 화면은 로그인 문이 아니라 동의 문을 부른다 · 옛 콜백 화면은 state 를 실어 보낸다', () => {
    const consent = readCode('src/pages/KakaoConsentCallbackPage.tsx')
    expect(consent).toContain("api.post('/api/auth/kakao/consent-callback'")
    expect(consent).not.toContain("api.post('/api/auth/kakao/callback'")
    expect(readCode('src/pages/KakaoCallbackPage.tsx')).toMatch(/api\.post\('\/api\/auth\/kakao\/callback', \{\s*code,\s*state,/)
  })
})

describe('② 손님 전용 경로 — 셀러 토큰의 번호를 손님 번호로 읽지 않는다', () => {
  const mount = (app: Hono) => {
    app.route('/api/gb-proposals', gbProposalsRoutes)
    app.route('/api/gb-marketplace', gbMarketplaceRoutes)
    app.route('/api/fcfs', fcfsRoutes)
    app.route('/api/shipping', shippingRoutes)
    const gb = new Hono()
    registerOwnerViewerEndpoints(gb as never)
    registerDealPlanEndpoint(gb as never)
    app.route('/api/group-buy', gb)
  }
  const PATHS: Array<[string, string]> = [
    ['GET', '/api/gb-proposals/mine'],
    ['POST', '/api/gb-proposals'],
    ['GET', '/api/gb-marketplace/my-performance'],
    ['GET', '/api/fcfs/1/me'],
    ['GET', '/api/shipping/order/1/track'],
    ['GET', '/api/group-buy/viewer/1'],
    ['POST', '/api/group-buy/viewer/1/active'],
    ['GET', '/api/group-buy/deal-plan/1'],
  ]

  it('셀러 토큰으로는 여덟 주소 모두 403', async () => {
    const h = harness(mount)
    const sid = insert(h.raw, 'sellers', { name: '가게', email: 's@store.invalid', password_hash: '', status: 'approved' })
    insert(h.raw, 'users', { name: '손님', email: 'u@example.test' }) // 셀러와 같은 번호를 갖게 될 손님
    const tok = await sellerToken(sid)
    const got: Record<string, number> = {}
    for (const [m, p] of PATHS) got[`${m} ${p}`] = (await h.call(m, p, { bearer: tok, body: m === 'POST' ? {} : undefined })).status
    h.out.restore()
    expect(got).toEqual(Object.fromEntries(PATHS.map(([m, p]) => [`${m} ${p}`, 403])))
  })

  it('손님 토큰은 인증을 통과한다(403·401 이 아니다)', async () => {
    const h = harness(mount)
    const uid = insert(h.raw, 'users', { name: '손님', email: 'u2@example.test' })
    const tok = await userToken(uid)
    // 인증이 막은 것만 센다 — 핸들러가 스스로 내는 403(예: 공구 엔진이 꺼져 있다)은 문을 통과한 뒤의 답이다.
    const blocked: string[] = []
    for (const [m, p] of PATHS) {
      const r = await h.call(m, p, { bearer: tok, body: m === 'POST' ? {} : undefined })
      const authCode = (r.json.error as { code?: string } | undefined)?.code
      if (r.status === 401 || authCode === 'FORBIDDEN' || authCode === 'UNAUTHORIZED') blocked.push(`${m} ${p} → ${r.status}`)
    }
    h.out.restore()
    expect(blocked, '손님이 인증에서 막혔다').toEqual([])
  })
})

describe('③ 직원 이메일 초대 — 카카오가 확인한 이메일만', () => {
  it('이메일로만 가입한 사람은 이메일 초대로 잡히지 않는다(남의 주소를 선점해 둔 계정)', async () => {
    const raw = openLiveSchema()
    insert(raw, 'users', { name: '선점', email: 'owner-friend@example.test', password_hash: 'pbkdf2$x' })
    expect(await findInviteeByVerifiedEmail(d1(raw), 'owner-friend@example.test')).toBeNull()
  })
  it('카카오로 가입한 사람은 잡힌다 · 탈퇴한 카카오 계정은 안 잡힌다', async () => {
    const raw = openLiveSchema()
    const id = insert(raw, 'users', { name: '친구', email: 'Friend@Example.test', kakao_id: '777', handle: 'friend' })
    insert(raw, 'users', { name: '탈퇴', email: 'gone@example.test', kakao_id: 'deleted_1_888' })
    expect(await findInviteeByVerifiedEmail(d1(raw), 'friend@example.test')).toMatchObject({ id })
    expect(await findInviteeByVerifiedEmail(d1(raw), 'gone@example.test')).toBeNull()
  })
  it('같은 주소의 카카오 계정이 둘이면 고르지 않는다', async () => {
    const raw = openLiveSchema()
    // `users.email` 은 유일이지만 대소문자를 가린다 — 초대는 소문자로 맞춰 찾으므로 둘이 걸릴 수 있다
    insert(raw, 'users', { name: 'a', email: 'dup@example.test', kakao_id: '1001' })
    insert(raw, 'users', { name: 'b', email: 'Dup@Example.test', kakao_id: '1002' })
    expect(await findInviteeByVerifiedEmail(d1(raw), 'dup@example.test')).toBe('ambiguous')
  })
  it('초대 라우트가 그 함수로 찾는다(옛 첫-행 조회가 남아 있지 않다)', () => {
    const src = readCode('src/features/seller/api/seller-operators.routes.ts')
    expect(src).toContain(': await findInviteeByVerifiedEmail(c.env.DB, email)')
    expect(src).not.toContain("'SELECT id, name, handle FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1'")
  })
})

describe('④ 잊은 매장 PIN — 어드민이 초기화한다', () => {
  const mount = (app: Hono) => { app.route('/api/admin', adminStoreBankRoutes) }

  it('PIN 을 지우고 사장님에게 알린다 — 그 뒤 PIN 은 "없음" 으로 읽힌다', async () => {
    const h = harness(mount)
    const sid = insert(h.raw, 'sellers', { name: '가게', email: 'p@store.invalid', password_hash: '', status: 'approved' })
    await ensureSellerMetaTable(d1(h.raw))
    await setSellerMeta(d1(h.raw), sid, { pin_hash: 'hash-of-forgotten-pin' })
    const r = await h.call('POST', `/api/admin/sellers/${sid}/bank-account/reset-pin`, { body: {} })
    h.out.restore()
    expect(r.status).toBe(200)
    expect((await getSellerMeta(d1(h.raw), [sid])).get(sid)?.pin_hash || null).toBeNull()
    expect(q(h.raw, "SELECT type FROM dashboard_notifications WHERE recipient_type = 'seller' AND recipient_id = ?", String(sid)).map((x) => x.type)).toEqual(['seller_pin_reset'])
  })

  it('PIN 이 없던 매장은 아무것도 쓰지 않는다(알림도 없다)', async () => {
    const h = harness(mount)
    const sid = insert(h.raw, 'sellers', { name: '가게2', email: 'p2@store.invalid', password_hash: '', status: 'approved' })
    const r = await h.call('POST', `/api/admin/sellers/${sid}/bank-account/reset-pin`, { body: {} })
    h.out.restore()
    expect(r.status).toBe(200)
    expect(q(h.raw, "SELECT id FROM dashboard_notifications WHERE recipient_type = 'seller'")).toEqual([])
  })

  it('역할은 계좌와 같다 — 운영·고객응대 계정은 못 누른다', () => {
    const p = '/api/admin/sellers/5/bank-account/reset-pin'
    expect(canAdminRoleMutate('finance', p)).toBe(true)
    expect(canAdminRoleMutate('ops', p)).toBe(false)
    expect(canAdminRoleMutate('cs', p)).toBe(false)
  })
})

describe('⑤ 내보낸 에이전시 직원의 이메일은 다시 쓸 수 있다', () => {
  it('내보내기 문장이 이메일 자리를 비운다 — 같은 주소로 새 직원을 넣을 수 있다', async () => {
    const raw = openLiveSchema()
    await ensureAgencyConsoleTables(d1(raw))
    const src = readCode('src/features/agency-console/api/agency-staff.routes.ts')
    const m = src.match(/`(UPDATE agency_staff SET status = 'removed'[\s\S]*?)`/)
    expect(m, '내보내기 문장을 못 찾았다').toBeTruthy()
    const agency = insert(raw, 'agency_accounts', { name: 'A', status: 'active' })
    const staff = insert(raw, 'agency_staff', { agency_id: agency, email: 'staff@example.test', role: 'staff', is_owner: 0, status: 'active' })
    const r = raw.prepare(String(m![1])).run(now(), now(), staff, agency)
    expect(Number(r.changes)).toBe(1)
    const row = q1<{ email: string; status: string }>(raw, 'SELECT email, status FROM agency_staff WHERE id = ?', staff)
    expect(row?.status).toBe('removed')
    expect(row?.email, '원래 주소가 기록에서 사라졌다').toContain('staff@example.test')
    expect(row?.email).not.toBe('staff@example.test')
    // 같은 주소가 다시 들어간다(이메일은 유일 인덱스) — 종전엔 여기서 UNIQUE 로 막혔다
    expect(() => insert(raw, 'agency_staff', { agency_id: agency, email: 'staff@example.test', role: 'staff', is_owner: 0, status: 'invited' })).not.toThrow()
  })
})

describe('⑥ 탈퇴 — 돈이 남으면 막고, 정리는 실제로 된다', () => {
  it('받을 소개비는 막지 않고 포기 동의를 요구한다 · 처리 중 출금은 막는다 · 없으면 연다', async () => {
    const raw = openLiveSchema()
    const a = insert(raw, 'users', { name: 'a', email: 'a@example.test', kakao_id: '31' })
    const b = insert(raw, 'users', { name: 'b', email: 'b@example.test', kakao_id: '32' })
    const c = insert(raw, 'users', { name: 'c', email: 'c@example.test', kakao_id: '33' })
    insert(raw, 'influencer_balances', { influencer_id: String(a), pending_amount: 1200, available_amount: 3800 })
    insert(raw, 'user_withdrawals', { user_id: String(b), amount: 50000, withholding_tax: 1650, net_amount: 48350, bank_name: '국민', bank_account: '1', account_holder: 'b', status: 'requested' })
    insert(raw, 'user_withdrawals', { user_id: String(c), amount: 50000, withholding_tax: 1650, net_amount: 48350, bank_name: '국민', bank_account: '1', account_holder: 'c', status: 'paid' })
    const ra = await countAccountDeleteBlockers(d1(raw), a, true)
    const rb = await countAccountDeleteBlockers(d1(raw), b, true)
    const rc = await countAccountDeleteBlockers(d1(raw), c, true)
    expect(ra.ok && ra.blockers.earned_commission).toBe(5000)
    expect(ra.ok && isAccountDeleteBlocked(ra.blockers), '소개비가 탈퇴를 막는다(2026-11-25 대표: 포기 동의 후 탈퇴)').toBe(false)
    expect(ra.ok && needsCommissionForfeit(ra.blockers)).toBe(true)
    expect(rc.ok && needsCommissionForfeit(rc.blockers)).toBe(false)
    expect(rb.ok && rb.blockers.withdrawals_pending).toBe(1)
    expect(rb.ok && isAccountDeleteBlocked(rb.blockers)).toBe(true)
    expect(rc.ok && isAccountDeleteBlocked(rc.blockers), '끝난 출금이 탈퇴를 막았다').toBe(false)
  })

  it('탈퇴하면 아직 지급 전인 추천 커미션이 거둬진다(종전 문장은 조용히 실패했다)', async () => {
    const raw = openLiveSchema()
    const u = insert(raw, 'users', { name: '탈퇴자', email: 'bye@example.test', kakao_id: '41' })
    const pend = insert(raw, 'referral_commissions', { order_id: 1, order_amount: 10000, tier: 1, beneficiary_id: String(u), beneficiary_type: 'user', source_user_id: '99', commission_rate: 0.5, commission_amount: 50, status: 'pending' })
    const other = insert(raw, 'referral_commissions', { order_id: 2, order_amount: 10000, tier: 1, beneficiary_id: '12345', beneficiary_type: 'user', source_user_id: '99', commission_rate: 0.5, commission_amount: 50, status: 'pending' })
    await deleteUserAccount({ userId: u, reason: 'test' } as never, d1(raw))
    expect(q1<{ status: string }>(raw, 'SELECT status FROM referral_commissions WHERE id = ?', pend)?.status).toBe('withdrawn')
    expect(q1<{ status: string }>(raw, 'SELECT status FROM referral_commissions WHERE id = ?', other)?.status, '남의 커미션을 건드렸다').toBe('pending')
  })

  it('복구: 옛 계정을 살리는 문장이 실패하면 새 계정도 그대로 남는다(둘 다 잃지 않는다)', async () => {
    const raw = openLiveSchema()
    const oldId = insert(raw, 'users', { name: '탈퇴회원', email: 'deleted_1@deleted.invalid', kakao_id: 'deleted_1_5151' })
    const newId = insert(raw, 'users', { name: '새계정', email: 'new@example.test', kakao_id: '5151' })
    insert(raw, 'deleted_accounts', { user_id: oldId, kakao_id: '5151', email: 'old@example.test', name: '옛이름', deleted_at: new Date().toISOString(), reregister_available_at: new Date(Date.now() + 86400000).toISOString() })
    // 옛 행을 살리는 UPDATE 만 실패시킨다
    raw.exec(`CREATE TRIGGER fail_revive BEFORE UPDATE ON users WHEN OLD.id = ${oldId} BEGIN SELECT RAISE(ABORT, 'revive failed'); END`)
    const r = await restoreUser('5151', '이름', 'new@example.test', null, d1(raw), newId)
    expect(r.success).toBe(false)
    expect(q1<{ k: string }>(raw, 'SELECT kakao_id k FROM users WHERE id = ?', newId)?.k, '새 계정이 이미 죽어 있다 — 쓸 수 있는 계정이 없다').toBe('5151')
  })

  it('복구가 성공하면 옛 계정이 카카오 번호를 되찾는다', async () => {
    const raw = openLiveSchema()
    const oldId = insert(raw, 'users', { name: '탈퇴회원', email: 'deleted_2@deleted.invalid', kakao_id: 'deleted_2_6161' })
    const newId = insert(raw, 'users', { name: '새계정', email: 'new2@example.test', kakao_id: '6161' })
    insert(raw, 'deleted_accounts', { user_id: oldId, kakao_id: '6161', email: 'old2@example.test', name: '옛이름', deleted_at: new Date().toISOString(), reregister_available_at: new Date(Date.now() + 86400000).toISOString() })
    const r = await restoreUser('6161', '이름', 'new2@example.test', null, d1(raw), newId)
    expect(r.success, `복구 실패: ${r.error}`).toBe(true)
    expect(q1<{ k: string }>(raw, 'SELECT kakao_id k FROM users WHERE id = ?', oldId)?.k).toBe('6161')
    expect(q1<{ k: string }>(raw, 'SELECT kakao_id k FROM users WHERE id = ?', newId)?.k).toMatch(/^restored_dup_/)
    // 새 계정의 이메일을 옛 계정이 그대로 받는다(이메일은 유일 — 종전엔 여기서 충돌해 복구가 언제나 실패했다)
    expect(q1<{ e: string }>(raw, 'SELECT email e FROM users WHERE id = ?', oldId)?.e).toBe('new2@example.test')
  })

  const mountAccount = (app: Hono) => { app.route('/api/account', accountRoutes) }

  it('받을 소개비가 있는 사람: 동의 없이는 탈퇴 안 됨 → 동의하면 탈퇴되고 소개비는 0 · 원장에 한 줄', async () => {
    const h = harness(mountAccount)
    const u = insert(h.raw, 'users', { name: '소개자', email: 'earner@example.test', kakao_id: '91' })
    insert(h.raw, 'influencer_balances', { influencer_id: String(u), pending_amount: 1200, available_amount: 3800 })
    const cookie = await sessionCookie(u)
    const no = await h.call('DELETE', '/api/account/delete', { cookie, body: {} })
    expect([no.status, no.json.code], JSON.stringify(no.json).slice(0, 300)).toEqual([409, 'COMMISSION_FORFEIT_REQUIRED'])
    expect((no.json.data as { earned_commission?: number }).earned_commission).toBe(5000)
    expect(q1<{ e: string }>(h.raw, 'SELECT email e FROM users WHERE id = ?', u)?.e, '동의 없이 탈퇴됐다').toBe('earner@example.test')
    const yes = await h.call('DELETE', '/api/account/delete', { cookie, body: { forfeit_commission: true } })
    h.out.restore()
    expect(yes.status, JSON.stringify(yes.json).slice(0, 300)).toBe(200)
    expect(q1<{ e: string }>(h.raw, 'SELECT email e FROM users WHERE id = ?', u)?.e).toMatch(/@deleted\.invalid$/)
    expect(q1<{ p: number; a: number }>(h.raw, 'SELECT pending_amount p, available_amount a FROM influencer_balances WHERE influencer_id = ?', String(u))).toEqual({ p: 0, a: 0 })
    const led = q<{ amount: number; debit_account: string; credit_account: string }>(h.raw, "SELECT amount, debit_account, credit_account FROM ledger_entries WHERE event_type = 'commission_forfeit'")
    expect(led).toEqual([{ amount: 5000, debit_account: `influencer:${u}`, credit_account: FORFEIT_ACCOUNT }])
  })

  it('포기 처리는 두 번 불려도 원장에 한 번만 적힌다 · 소개비가 없으면 아무것도 안 한다', async () => {
    const raw = openLiveSchema()
    insert(raw, 'influencer_balances', { influencer_id: '77', pending_amount: 0, available_amount: 900 })
    insert(raw, 'influencer_balances', { influencer_id: '78', pending_amount: 0, available_amount: 0 })
    expect(await forfeitEarnedCommission(d1(raw), ['77', 77])).toBe(900)
    expect(await forfeitEarnedCommission(d1(raw), ['77'])).toBe(0)
    expect(await forfeitEarnedCommission(d1(raw), ['78'])).toBe(0)
    expect(q(raw, "SELECT id FROM ledger_entries WHERE event_type = 'commission_forfeit'").length).toBe(1)
  })

  it('읽은 뒤 다른 요청이 먼저 내렸으면(동시 탈퇴 요청) 원장에 적지 않는다', async () => {
    const raw = openLiveSchema()
    insert(raw, 'influencer_balances', { influencer_id: '79', pending_amount: 0, available_amount: 700 })
    const real = d1(raw)
    // 잔액을 내리는 문장 직전에 "다른 요청" 이 먼저 0 으로 내린 상황을 만든다
    const racing = { ...real, prepare: (sql: string) => { if (/^UPDATE influencer_balances/.test(sql.trim())) raw.exec("UPDATE influencer_balances SET available_amount = 0 WHERE influencer_id = '79'"); return real.prepare(sql) } } as typeof real
    expect(await forfeitEarnedCommission(racing, ['79'])).toBe(0)
    expect(q(raw, "SELECT id FROM ledger_entries WHERE event_type = 'commission_forfeit'"), '선점에 진 요청이 원장에 한 줄을 더 적었다').toEqual([])
  })

  it('탈퇴 화면: 받을 소개비가 있으면 포기 동의 칸이 있어야 버튼이 열린다 · 차단 목록에는 안 넣는다', () => {
    const page = readCode('src/pages/AccountDeleteWarningPage.tsx')
    expect(page).toContain("(earnedCommission === 0 || forfeitAgreed)")
    expect(page).toContain("earnedCommission > 0 ? { data: { forfeit_commission: true } } : undefined")
    expect(page).toContain('data-testid="forfeit-commission"')
    expect(readCode('src/pages/account-delete/DeleteBlockers.tsx')).not.toContain('accountDeleteWarning.blockCommission')
  })

  it('탈퇴 여부 조회: 로그인 없이는 401 · 남의 이메일은 403', async () => {
    const h = harness(mountAccount)
    const u = insert(h.raw, 'users', { name: '본인', email: 'self@example.test', kakao_id: '71' })
    const anon = await h.call('GET', '/api/account/check-restriction?email=victim@example.test')
    const other = await h.call('GET', '/api/account/check-restriction?email=victim@example.test', { cookie: await sessionCookie(u) })
    const mine = await h.call('GET', '/api/account/check-restriction?email=SELF@example.test', { cookie: await sessionCookie(u) })
    h.out.restore()
    expect(anon.status).toBe(401)
    expect(other.status).toBe(403)
    expect(mine.status).toBe(200)
  })

  it('되살리기 안내: 카카오 계정만 "돌아올 수 있다" 고 듣는다', async () => {
    const h = harness(mountAccount)
    const kakao = insert(h.raw, 'users', { name: '카카오', email: 'k@example.test', kakao_id: '81' })
    const email = insert(h.raw, 'users', { name: '이메일', email: 'e@example.test', password_hash: 'pbkdf2$x' })
    const rk = await h.call('GET', '/api/account/delete-blockers', { cookie: await sessionCookie(kakao) })
    const re = await h.call('GET', '/api/account/delete-blockers', { cookie: await sessionCookie(email) })
    h.out.restore()
    expect((rk.json.data as { can_restore?: boolean }).can_restore).toBe(true)
    expect((re.json.data as { can_restore?: boolean }).can_restore).toBe(false)
    const page = readCode('src/pages/AccountDeleteWarningPage.tsx')
    expect(page).toContain("const canRestore = blockersQ.data?.can_restore === true")
    expect(page).toContain('accountDeleteWarning.headlineSubNoRestore')
  })
})

describe('화면·문 — 소스로만 보는 것', () => {
  it('카카오 연결 버튼은 팝업 콜백 주소를 쓰지 않고, 지금 세션으로 바로 연결한다', () => {
    const btn = readCode('src/components/auth/KakaoLinkButton.tsx')
    expect(btn, '로그인 복귀 검사가 막는 주소(`/auth/…`)로 돌아오려 한다').not.toContain("encodeURIComponent('/auth/kakao/link/callback')")
    expect(btn).toContain('await api.post(`${basePath}/link-kakao`, {})')
    expect(btn).toContain("code === 'LOGIN_REQUIRED'")
    expect(readCode('src/features/seller/api/seller-kakao-link.routes.ts')).toContain("code: 'LOGIN_REQUIRED'")
  })
  it('PIN 시트는 잊었을 때 갈 길을 말한다 · 어드민 화면에 초기화 버튼이 있다', () => {
    expect(readCode('src/pages/user-profile/seller-section/PinSheet.tsx')).toContain('PIN 을 잊었다면 고객센터로 알려 주세요')
    expect(readCode('src/pages/admin-merchant-commissions/StoreBankCard.tsx')).toContain('/bank-account/reset-pin')
  })
  it('어드민 2단계 인증 화면은 꺼져 있다는 사실을 먼저 말한다', () => {
    const page = readCode('src/pages/Admin2FASetupPage.tsx')
    expect(page).toContain('data-testid="twofa-off-notice"')
    expect(page).not.toContain('환불 / 분쟁 / 강제 처리 endpoint 보호')
  })
})

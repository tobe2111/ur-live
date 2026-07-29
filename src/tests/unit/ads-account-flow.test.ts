import { describe, it, expect, beforeEach } from 'vitest'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import {
  createAdsAccount, loginAdsAccount, adsAccountIdFrom, signAdsToken,
  updateAdsAccount, changeAdsPassword, adminSetPassword,
  requestPasswordReset, resetPasswordWithToken,
  unlockAdsAccount, getAdsAccount, ensureAdsAccountSchema, kakaoLoginAdsAccount,
  requestAdsAccess, getAdsAccessRequest,
} from '@/features/marketing/api/ads-account'
import { saveAlertSettings, getAlertSettings } from '@/features/marketing/api/alerts'
import { marketingRoutes } from '@/features/marketing/api/marketing.routes'
import { adsKakaoAuthRoutes } from '@/features/marketing/api/ads-kakao-auth.routes'
import { createSessionCookie } from '@/worker/utils/session'

/**
 * 🆕 2026-06-28 유어애즈 독립 계정 — 실제 SQLite(node:sqlite) 통합 테스트.
 *   가드/타입은 구조만 보장 → 인증·암호·SQL 가 실제로 동작하는지 "실행"으로 검증.
 *   + 순위 알림 rank_drop 배선 버그(라우트가 값을 안 넘기던 것) 회귀 잠금.
 */

// ── node:sqlite → D1Database 호환 어댑터 ─────────────────────────────────────
function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  // 프로덕션에 상시 존재하는 rate_limit_attempts 를 테스트 DB 에도 생성 —
  //   없으면 rateLimit() 미들웨어의 INSERT 가 throw → sensitive 라우트(ads-unlock 등)가
  //   fail-CLOSED(429) 로 떨어져 라우트 assertion(200/400)이 깨진다(실제 동작 아님).
  db.prepare(`CREATE TABLE IF NOT EXISTS rate_limit_attempts (
    key TEXT NOT NULL, action TEXT NOT NULL, window_start INTEGER NOT NULL, count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(key, action, window_start)
  )`).run()
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => { const r = db.prepare(sql).all(...(args as never[])); return { results: r } },
    }
    return api
  }
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}

const PW = 'Abcd1234!@' // 복잡도 통과
const JWT = 'test-jwt-secret-0123456789'
// 서버측 베타 게이트(access_unlocked) 통과용 — unlock·active 계정 시딩(데이터 라우트 테스트 전용).
async function seedUnlocked(DB: D1Database, id: number): Promise<void> {
  await ensureAdsAccountSchema(DB)
  await DB.prepare("INSERT OR IGNORE INTO ad_accounts (id, email, password_hash, company_name, status, access_unlocked) VALUES (?, ?, 'x', 'co', 'active', 1)").bind(id, 'u' + id + '@x.com').run()
}

describe('UR Ads 독립 계정 — 실제 SQLite 통합', () => {
  let DB: D1Database
  beforeEach(() => { DB = makeD1() })

  it('가입 → 로그인(대소문자 무시) → 토큰 발급/검증', async () => {
    const r = await createAdsAccount(DB, { email: 'Foo@Bar.com', password: PW, company_name: '루미스토어' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(await (await loginAdsAccount(DB, 'foo@bar.com', 'wrong')).ok).toBe(false)
    expect((await loginAdsAccount(DB, 'FOO@bar.com', PW)).ok).toBe(true) // 대소문자 무시
    const token = await signAdsToken(r.account.id, JWT)
    expect(await adsAccountIdFrom('Bearer ' + token, JWT)).toBe(r.account.id)
    expect(await adsAccountIdFrom('Bearer ' + token, 'other-secret')).toBeNull() // 서명 위조 차단
    expect(await adsAccountIdFrom(undefined, JWT)).toBeNull()
  })

  it('중복 이메일(대소문자 무시) 거부 + 비번 복잡도 강제', async () => {
    expect((await createAdsAccount(DB, { email: 'a@b.com', password: PW, company_name: 'X' })).ok).toBe(true)
    const dup = await createAdsAccount(DB, { email: 'A@B.com', password: PW, company_name: 'Y' })
    expect(dup.ok).toBe(false)
    if (!dup.ok) expect(dup.status).toBe(409)
    expect((await createAdsAccount(DB, { email: 'c@d.com', password: 'short', company_name: 'X' })).ok).toBe(false)
    // 2026-07-10 대표 결정 잠금: 완화 정책(8자+·2종+) — 대문자 없는 비번(숫자+소문자+특수) 허용.
    expect((await createAdsAccount(DB, { email: 'relaxed@x.com', password: '358533aa!!'.replace('358533', '999888'), company_name: 'X' })).ok).toBe(true)
  })

  it('프로필 수정 + 비밀번호 변경(현재 비번 검증)', async () => {
    const r = await createAdsAccount(DB, { email: 'e@f.com', password: PW, company_name: 'Old' })
    if (!r.ok) throw new Error('setup')
    const id = r.account.id
    const u = await updateAdsAccount(DB, id, { company_name: 'New', phone: '010-1' })
    expect(u.ok && u.account.company_name).toBe('New')
    expect((await changeAdsPassword(DB, id, 'wrong', 'Zxcv5678!@')).ok).toBe(false) // 현재 비번 틀림
    expect((await changeAdsPassword(DB, id, PW, 'Zxcv5678!@')).ok).toBe(true)
    expect((await loginAdsAccount(DB, 'e@f.com', 'Zxcv5678!@')).ok).toBe(true)
    expect((await loginAdsAccount(DB, 'e@f.com', PW)).ok).toBe(false) // 옛 비번 무효
  })

  it('비밀번호 재설정 토큰: 1회용·만료가드·열거방지', async () => {
    await createAdsAccount(DB, { email: 'g@h.com', password: PW, company_name: 'X' })
    const req = await requestPasswordReset(DB, 'g@h.com')
    expect(req).not.toBeNull()
    expect(await requestPasswordReset(DB, 'nobody@x.com')).toBeNull() // 미가입 → null(열거 방지)
    if (!req) return
    expect((await resetPasswordWithToken(DB, req.token, 'Newpass99!@')).ok).toBe(true)
    expect((await resetPasswordWithToken(DB, req.token, 'Another99!@')).ok).toBe(false) // 재사용 차단
    expect((await resetPasswordWithToken(DB, 'badtoken'.repeat(5), 'Newpass99!@')).ok).toBe(false)
    expect((await loginAdsAccount(DB, 'g@h.com', 'Newpass99!@')).ok).toBe(true)
  })

  it('어드민 강제 비번 재설정: 현재 비번 없이 세팅 → 새 비번 로그인', async () => {
    const r = await createAdsAccount(DB, { email: 'admin-reset@x.com', password: PW, company_name: 'X' })
    if (!r.ok) throw new Error('setup')
    const id = r.account.id
    // 완화 정책 준수 비번(대문자 없음)도 어드민 세팅 허용
    expect((await adminSetPassword(DB, id, '999888aa!!')).ok).toBe(true)
    expect((await loginAdsAccount(DB, 'admin-reset@x.com', '999888aa!!')).ok).toBe(true)
    expect((await loginAdsAccount(DB, 'admin-reset@x.com', PW)).ok).toBe(false) // 옛 비번 무효
    // 복잡도 미달은 거부
    expect((await adminSetPassword(DB, id, 'short')).ok).toBe(false)
    // 없는 계정은 404
    const nf = await adminSetPassword(DB, 999999, '999888aa!!')
    expect(nf.ok).toBe(false)
    if (!nf.ok) expect(nf.status).toBe(404)
  })

  it('알림 설정 함수 round-trip — rank_drop 포함 전 필드 영속', async () => {
    await saveAlertSettings(DB, 42, { enabled: true, budget_pace_pct: 80, price_undercut: false, rank_drop: 3 })
    const s = await getAlertSettings(DB, 42)
    expect(s).toMatchObject({ enabled: 1, budget_pace_pct: 80, price_undercut: 0, rank_drop: 3 })
    await saveAlertSettings(DB, 42, { enabled: false }) // 부분 수정은 rank_drop 보존
    expect((await getAlertSettings(DB, 42)).rank_drop).toBe(3)
  })

  it('회귀: PATCH /alerts/settings 라우트가 rank_drop 을 실제로 저장한다(버그 잠금)', async () => {
    const DB2 = makeD1()
    await seedUnlocked(DB2, 42)
    const env = { DB: DB2, JWT_SECRET: JWT } as unknown as Parameters<typeof marketingRoutes.request>[2]
    const token = await signAdsToken(42, JWT)
    const headers = { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }
    const patch = await marketingRoutes.request('/alerts/settings', {
      method: 'PATCH', headers, body: JSON.stringify({ enabled: true, budget_pace_pct: 75, price_undercut: true, rank_drop: 5 }),
    }, env)
    expect(patch.status).toBe(200)
    const pj = await patch.json() as { success: boolean; settings: { rank_drop: number; budget_pace_pct: number } }
    expect(pj.success).toBe(true)
    expect(pj.settings.rank_drop).toBe(5) // ← 수정 전엔 0 (라우트가 안 넘김)
    // GET 으로 영속 확인
    const get = await marketingRoutes.request('/alerts/settings', { headers }, env)
    const gj = await get.json() as { settings: { rank_drop: number; budget_pace_pct: number } }
    expect(gj.settings.rank_drop).toBe(5)
    expect(gj.settings.budget_pace_pct).toBe(75)
  })

  it('베타 액세스 코드 게이트: 신규 계정은 잠금, 코드 검증 후 해제', async () => {
    const r = await createAdsAccount(DB, { email: 'gate@x.com', password: PW, company_name: 'X' })
    if (!r.ok) throw new Error('setup')
    expect(r.account.access_unlocked).toBe(0) // 가입 직후 잠김
    const id = r.account.id
    expect((await getAdsAccount(DB, id))?.access_unlocked).toBe(0)
    // 틀린 코드 → 잠김 유지
    expect((await unlockAdsAccount(DB, id, '000000', '358533')).ok).toBe(false)
    expect((await getAdsAccount(DB, id))?.access_unlocked).toBe(0)
    // 맞는 코드 → 해제
    expect((await unlockAdsAccount(DB, id, '358533', '358533')).ok).toBe(true)
    expect((await getAdsAccount(DB, id))?.access_unlocked).toBe(1)
    // 로그인 응답에도 해제 상태 반영
    expect((await loginAdsAccount(DB, 'gate@x.com', PW) as { ok: true; account: { access_unlocked: number } }).account.access_unlocked).toBe(1)
  })

  it('서버측 베타 게이트: 잠긴 계정은 데이터 라우트 403(locked) → 해제 후 통과', async () => {
    const DB2 = makeD1()
    const acc = await createAdsAccount(DB2, { email: 'lock@x.com', password: PW, company_name: 'X' })
    if (!acc.ok) throw new Error('setup')
    // 🔒 베타 게이트는 env ADS_ACCESS_CODE 전용(공개 폴백 358533 제거) — 테스트가 코드를 env 로 주입.
    const env = { DB: DB2, JWT_SECRET: JWT, ADS_ACCESS_CODE: '358533' } as unknown as Parameters<typeof marketingRoutes.request>[2]
    const headers = { Authorization: 'Bearer ' + await signAdsToken(acc.account.id, JWT), 'content-type': 'application/json' }
    // 잠긴 계정(access_unlocked=0) → 데이터 라우트 403 + locked 플래그
    const locked = await marketingRoutes.request('/alerts/settings', { headers }, env)
    expect(locked.status).toBe(403)
    expect((await locked.json() as { locked?: boolean }).locked).toBe(true)
    // /auth/* 는 잠금상태에서도 접근 가능(면제) — unlock 으로 해제
    const un = await marketingRoutes.request('/auth/unlock', { method: 'POST', headers, body: JSON.stringify({ code: '358533' }) }, env)
    expect(un.status).toBe(200)
    // 해제 후 동일 데이터 라우트 통과(200)
    expect((await marketingRoutes.request('/alerts/settings', { headers }, env)).status).toBe(200)
  })

  it('회귀: POST /auth/unlock 라우트 — 틀린 코드 400 / env 설정코드 해제', async () => {
    // 🔒 env ADS_ACCESS_CODE 로 게이트 코드 주입(공개 폴백 358533 제거 후 fail-closed).
    const env = { DB: makeD1(), JWT_SECRET: JWT, ADS_ACCESS_CODE: '358533' } as unknown as Parameters<typeof marketingRoutes.request>[2]
    const acc = await createAdsAccount((env as unknown as { DB: D1Database }).DB, { email: 'u@x.com', password: PW, company_name: 'X' })
    if (!acc.ok) throw new Error('setup')
    const headers = { Authorization: 'Bearer ' + await signAdsToken(acc.account.id, JWT), 'content-type': 'application/json' }
    const bad = await marketingRoutes.request('/auth/unlock', { method: 'POST', headers, body: JSON.stringify({ code: '111111' }) }, env)
    expect(bad.status).toBe(400)
    const ok = await marketingRoutes.request('/auth/unlock', { method: 'POST', headers, body: JSON.stringify({ code: '358533' }) }, env)
    expect(ok.status).toBe(200)
    expect((await getAdsAccount((env as unknown as { DB: D1Database }).DB, acc.account.id))?.access_unlocked).toBe(1)
  })

  it('🟡 카카오 로그인: 신규 생성 → 재로그인 → verified 이메일 연결 → 미verified takeover 차단', async () => {
    // ① 신규 생성 — kakao_id 로 계정 생성(닉네임=회사명, 잠금 상태)
    const r1 = await kakaoLoginAdsAccount(DB, { kakaoId: '777', email: 'k@x.com', emailVerified: true, nickname: '방배카페' })
    expect(r1.ok).toBe(true)
    if (!r1.ok) return
    expect(r1.created).toBe(true)
    expect(r1.account.company_name).toBe('방배카페')
    expect(r1.account.access_unlocked).toBe(0) // 베타 게이트 유지
    // ② 재로그인 — 같은 kakao_id 는 같은 계정(중복 생성 0)
    const r2 = await kakaoLoginAdsAccount(DB, { kakaoId: '777', email: 'k@x.com', emailVerified: true, nickname: '방배카페' })
    expect(r2.ok && !r2.created && r2.account.id === r1.account.id).toBe(true)
    // ③ 기존 이메일 계정에 카카오 연결(verified 일 때만)
    const em = await createAdsAccount(DB, { email: 'link@x.com', password: PW, company_name: '기존회사' })
    if (!em.ok) throw new Error('setup')
    const r3 = await kakaoLoginAdsAccount(DB, { kakaoId: '888', email: 'Link@X.com', emailVerified: true, nickname: '무시됨' })
    expect(r3.ok && !r3.created && r3.account.id === em.account.id).toBe(true) // 대소문자 무시 연결
    // ④ 미verified 이메일은 기존 계정 takeover 불가 — 별도 신규 계정(플레이스홀더 이메일)
    const em2 = await createAdsAccount(DB, { email: 'victim@x.com', password: PW, company_name: '피해자' })
    if (!em2.ok) throw new Error('setup')
    const r4 = await kakaoLoginAdsAccount(DB, { kakaoId: '999', email: 'victim@x.com', emailVerified: false, nickname: '공격자' })
    expect(r4.ok && r4.created && r4.account.id !== em2.account.id).toBe(true)
    expect(r4.ok && r4.account.email.includes('kakao999')).toBe(true) // 플레이스홀더로 격리
    // ⑤ 이미 다른 카카오가 연결된 이메일은 409 거부(탈취 여지 0) + 원 카카오는 계속 로그인 가능
    const dbl = await kakaoLoginAdsAccount(DB, { kakaoId: '111', email: 'link@x.com', emailVerified: true, nickname: 'X' })
    expect(dbl.ok).toBe(false)
    if (!dbl.ok) expect(dbl.status).toBe(409)
    const orig = await kakaoLoginAdsAccount(DB, { kakaoId: '888', email: 'link@x.com', emailVerified: true, nickname: 'X' })
    expect(orig.ok && !orig.created && orig.account.id === em.account.id).toBe(true)
    // ⑥ 발급 토큰은 기존 ads_token 파이프라인과 동일하게 검증됨
    const token = await signAdsToken(r1.account.id, JWT)
    expect(await adsAccountIdFrom('Bearer ' + token, JWT)).toBe(r1.account.id)
  })

  it('🌉 유어딜 세션 브리지: ur_session → ads 계정 생성/재로그인 · 미로그인 401 need_login', async () => {
    const DB2 = makeD1()
    await DB2.prepare('CREATE TABLE users (id INTEGER PRIMARY KEY, kakao_id TEXT, name TEXT, email TEXT, email_verified INTEGER)').run()
    await DB2.prepare("INSERT INTO users (id, kakao_id, name, email, email_verified) VALUES (1, '77700', '방배사장', 'boss@x.com', 1), (2, NULL, '비카카오', 'nk@x.com', 0)").run()
    const env = { DB: DB2, JWT_SECRET: JWT } as unknown as Parameters<typeof adsKakaoAuthRoutes.request>[2]
    const cookie = (await createSessionCookie(1, '방배사장', 'boss@x.com', null, JWT, 'user')).split(';')[0]
    // ① 유어딜 세션 → ads 계정 자동 생성(회사명=유저 이름, 잠금 게이트 유지)
    const r1 = await adsKakaoAuthRoutes.request('/kakao/bridge', { method: 'POST', headers: { Cookie: cookie } }, env)
    expect(r1.status).toBe(200)
    const j1 = await r1.json() as { success: boolean; token: string; created: boolean; account: { id: number; company_name: string; access_unlocked: number } }
    expect(j1.success && !!j1.token && j1.created).toBe(true)
    expect(j1.account.company_name).toBe('방배사장')
    expect(j1.account.access_unlocked).toBe(0) // 2차 게이트(액세스 코드) 유지
    // ② 재호출 → 같은 계정 재로그인(중복 생성 0)
    const r2 = await adsKakaoAuthRoutes.request('/kakao/bridge', { method: 'POST', headers: { Cookie: cookie } }, env)
    const j2 = await r2.json() as { created: boolean; account: { id: number } }
    expect(!j2.created && j2.account.id === j1.account.id).toBe(true)
    // ③ 직접 OAuth 경로(kakao_id 77700)로 와도 같은 ads 계정(매칭 SSOT 일치)
    const direct = await kakaoLoginAdsAccount(DB2, { kakaoId: '77700', email: 'boss@x.com', emailVerified: true, nickname: '방배사장' })
    expect(direct.ok && !direct.created && direct.account.id === j1.account.id).toBe(true)
    // ④ 비카카오 유어딜 유저도 안정 키(urdeal:u{id})로 브리지 가능
    const cookie2 = (await createSessionCookie(2, '비카카오', 'nk@x.com', null, JWT, 'user')).split(';')[0]
    const r3 = await adsKakaoAuthRoutes.request('/kakao/bridge', { method: 'POST', headers: { Cookie: cookie2 } }, env)
    const j3 = await r3.json() as { success: boolean; created: boolean; account: { id: number } }
    expect(j3.success && j3.created && j3.account.id !== j1.account.id).toBe(true)
    // ⑤ 세션 없음 → 401 need_login
    const un = await adsKakaoAuthRoutes.request('/kakao/bridge', { method: 'POST' }, env)
    expect(un.status).toBe(401)
    expect((await un.json() as { need_login?: boolean }).need_login).toBe(true)
  })

  it('📥 입장 요청 큐: 접수(멱등) → 거절 후 재요청 → 해제 계정은 unlocked', async () => {
    const r = await createAdsAccount(DB, { email: 'req@x.com', password: PW, company_name: '요청사' })
    if (!r.ok) throw new Error('setup')
    const id = r.account.id
    expect(await requestAdsAccess(DB, id)).toBe('created')       // 신규 접수
    expect(await requestAdsAccess(DB, id)).toBe('pending')       // 중복 요청 멱등
    expect((await getAdsAccessRequest(DB, id))?.status).toBe('pending')
    // 거절 → 재요청 가능
    await DB.prepare("UPDATE ad_access_requests SET status='rejected' WHERE account_id = ?").bind(id).run()
    expect(await requestAdsAccess(DB, id)).toBe('created')       // 거절 이력 되살림
    expect((await getAdsAccessRequest(DB, id))?.status).toBe('pending')
    // 승인(해제) 후엔 요청 자체가 unlocked 단락
    await DB.prepare('UPDATE ad_accounts SET access_unlocked = 1 WHERE id = ?').bind(id).run()
    expect(await requestAdsAccess(DB, id)).toBe('unlocked')
  })

  it('미인증 요청은 401', async () => {
    const env = { DB: makeD1(), JWT_SECRET: JWT } as unknown as Parameters<typeof marketingRoutes.request>[2]
    const res = await marketingRoutes.request('/alerts/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' }, env)
    expect(res.status).toBe(401)
  })
})

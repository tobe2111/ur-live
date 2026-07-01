import { describe, it, expect, beforeEach } from 'vitest'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import {
  createAdsAccount, loginAdsAccount, adsAccountIdFrom, signAdsToken,
  updateAdsAccount, changeAdsPassword,
  requestPasswordReset, resetPasswordWithToken,
  unlockAdsAccount, getAdsAccount, ensureAdsAccountSchema,
} from '@/features/marketing/api/ads-account'
import { saveAlertSettings, getAlertSettings } from '@/features/marketing/api/alerts'
import { marketingRoutes } from '@/features/marketing/api/marketing.routes'

/**
 * 🆕 2026-06-28 유어애즈 독립 계정 — 실제 SQLite(node:sqlite) 통합 테스트.
 *   가드/타입은 구조만 보장 → 인증·암호·SQL 가 실제로 동작하는지 "실행"으로 검증.
 *   + 순위 알림 rank_drop 배선 버그(라우트가 값을 안 넘기던 것) 회귀 잠금.
 */

// ── node:sqlite → D1Database 호환 어댑터 ─────────────────────────────────────
function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
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
    const env = { DB: DB2, JWT_SECRET: JWT } as unknown as Parameters<typeof marketingRoutes.request>[2]
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

  it('회귀: POST /auth/unlock 라우트 — 틀린 코드 400 / 기본코드 358533 해제', async () => {
    const env = { DB: makeD1(), JWT_SECRET: JWT } as unknown as Parameters<typeof marketingRoutes.request>[2]
    const acc = await createAdsAccount((env as unknown as { DB: D1Database }).DB, { email: 'u@x.com', password: PW, company_name: 'X' })
    if (!acc.ok) throw new Error('setup')
    const headers = { Authorization: 'Bearer ' + await signAdsToken(acc.account.id, JWT), 'content-type': 'application/json' }
    const bad = await marketingRoutes.request('/auth/unlock', { method: 'POST', headers, body: JSON.stringify({ code: '111111' }) }, env)
    expect(bad.status).toBe(400)
    const ok = await marketingRoutes.request('/auth/unlock', { method: 'POST', headers, body: JSON.stringify({ code: '358533' }) }, env)
    expect(ok.status).toBe(200)
    expect((await getAdsAccount((env as unknown as { DB: D1Database }).DB, acc.account.id))?.access_unlocked).toBe(1)
  })

  it('미인증 요청은 401', async () => {
    const env = { DB: makeD1(), JWT_SECRET: JWT } as unknown as Parameters<typeof marketingRoutes.request>[2]
    const res = await marketingRoutes.request('/alerts/settings', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: '{}' }, env)
    expect(res.status).toBe(401)
  })
})

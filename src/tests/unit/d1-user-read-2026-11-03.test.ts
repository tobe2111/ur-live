/**
 * 👤 2026-11-03 대표 *"1,3,4 다 해줘"* — 1 = 로그인한 손님 화면도 한국 근처 DB 사본에서 읽기.
 *
 * 사본은 원본보다 잠깐 늦을 수 있다. 그래서 규칙은 둘이다:
 *   ① 이 브라우저가 방금 무언가를 바꿨으면(`/api/*` 의 GET·HEAD 아닌 요청 성공 → 30초 쿠키) 원본에서 읽는다.
 *   ② 돈 화면(딜 잔액·주문·결제·정산·사장님 매출)은 사본을 아예 안 쓴다 — 허용 파일 목록으로 고정.
 * ⚠️ 못 보는 것: 실제 사본 지연 시간(라이브 X-D1-Served·Server-Timing 으로 판정) · 다른 사람이 바꾼 값(사장님 사용처리)이
 *   사본에 늦게 닿는 1초 안팎 · GET 인데 쓰는 새 핸들러(쿠폰 받기처럼 직접 표시해야 한다 — 아래 시험이 알려진 하나를 고정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { Hono } from 'hono'
import { hasRecentWrite, recentWriteCookie, userReadDb, recentWriteMarker, dbKey, D1_FRESH_SECONDS } from '@/worker/utils/d1-read-replica'
import { stripComments } from '../helpers/source-text'

const code = (f: string) => stripComments(readFileSync(f, 'utf-8'))

describe('로그인 읽기 사본 — 방금 쓴 브라우저는 원본', () => {
  it('쿠키 판정 — 정확히 ur_d1_fresh=1 만', () => {
    expect(hasRecentWrite('ur_d1_fresh=1')).toBe(true)
    expect(hasRecentWrite('a=b; ur_d1_fresh=1; c=d')).toBe(true)
    expect(hasRecentWrite('xur_d1_fresh=1')).toBe(false)
    expect(hasRecentWrite('ur_d1_fresh=10')).toBe(false)
    expect(hasRecentWrite('')).toBe(false)
    expect(hasRecentWrite(null)).toBe(false)
    expect(recentWriteCookie()).toBe(`ur_d1_fresh=1; Path=/; Max-Age=${D1_FRESH_SECONDS}; SameSite=Lax; Secure; HttpOnly`)
    expect(D1_FRESH_SECONDS).toBeGreaterThanOrEqual(10)
  })

  it('userReadDb — 쿠키 있으면 원본 그대로, 없으면 세션(사본), 세션 API 없으면 원본', () => {
    const session = { prepare: () => null }
    const primary = { prepare: () => null, withSession: () => session } as unknown as D1Database
    expect(userReadDb(primary, 'ur_d1_fresh=1')).toBe(primary)
    const s = userReadDb(primary, 'other=1')
    expect(s).toBe(session)
    expect(dbKey(s)).toBe(primary) // isolate 메모가 원본 기준
    const plain = { prepare: () => null } as unknown as D1Database
    expect(userReadDb(plain, null)).toBe(plain)
  })

  it('미들웨어 — 쓰기 성공에만 쿠키, 읽기·실패엔 없음', async () => {
    const app = new Hono()
    app.use('/api/*', recentWriteMarker() as never)
    app.get('/api/x', (c) => c.json({ ok: 1 }))
    app.post('/api/x', (c) => c.json({ ok: 1 }))
    app.patch('/api/bad', (c) => c.json({ ok: 0 }, 400))
    const has = (r: Response) => (r.headers.get('set-cookie') ?? '').includes('ur_d1_fresh=1')
    expect(has(await app.request('/api/x'))).toBe(false)
    expect(has(await app.request('/api/x', { method: 'POST' }))).toBe(true)
    expect(has(await app.request('/api/bad', { method: 'PATCH' }))).toBe(false)
  })

  it('워커가 /api/* 전체에 표시 미들웨어를 단다', () => {
    expect(code('src/worker/index.ts')).toMatch(/app\.use\('\/api\/\*', recentWriteMarker\(\)/)
  })

  it('userReadDb 는 허용된 로그인 읽기 파일에서만 — 돈 화면 금지', () => {
    const ALLOWED = new Set([
      'src/features/group-buy/api/group-buy-public.routes.ts', // 내 이용권 목록(GET /my)
      'src/features/coupons/api/coupons.routes.ts', // 내 쿠폰함(GET /my)
      'src/features/account/api/account.routes.ts', // 알림 설정 조회
      'src/features/group-buy/api/review-bonus.routes.ts', // 리뷰 레벨
      'src/worker/routes/curator.routes.ts', // 유어샵(로그인 방문·주인)
    ])
    const hits = execSync(`grep -rlE "userReadDb\\(" src --include=*.ts --include=*.tsx`, { encoding: 'utf-8' })
      .split('\n').filter(Boolean).filter((f) => !f.includes('/tests/') && !f.endsWith('d1-read-replica.ts'))
    expect(hits.length).toBeGreaterThan(0)
    for (const f of hits) expect(ALLOWED.has(f), `${f} 는 허용 목록 밖 — 돈·관리 경로가 아닌지 판단 후 추가`).toBe(true)
    for (const money of ['src/features/points/api/points.routes.ts', 'src/worker/routes/payment.routes.ts']) {
      expect(readFileSync(money, 'utf-8')).not.toMatch(/userReadDb|publicReadDb/)
    }
  })

  it('내 이용권 — 로그인 GET /my 만 userReadDb, 색인 메모는 원본 기준, 사용처리(POST)는 원본', () => {
    const src = code('src/features/group-buy/api/group-buy-public.routes.ts')
    const handlers = src.split(/\n  router\./)
    const using = handlers.filter((h) => h.includes('userReadDb(')).map((h) => h.slice(0, h.indexOf(',')))
    expect(using).toEqual(["get('/my'"])
    const my = handlers.find((h) => h.startsWith("get('/my'"))!
    expect(my).toMatch(/_voucherIdxDone\.has\(dbKey\(DB\)\)/)
    expect(my).not.toMatch(/\b(INSERT|UPDATE|DELETE)\b/)
  })

  it('쿠폰 — 받기(GET 인데 쓴다)는 직접 쿠키를 붙인다 · 쿠폰함은 userReadDb', () => {
    const src = code('src/features/coupons/api/coupons.routes.ts')
    const claim = src.slice(src.indexOf("couponRoutes.get('/claim/:code'"))
    expect(claim.slice(0, claim.indexOf('\n})'))).toMatch(/INSERT OR IGNORE INTO user_coupons[\s\S]*recentWriteCookie\(\)/)
    const my = src.slice(src.indexOf("couponRoutes.get('/my'"), src.indexOf("couponRoutes.get('/seed'"))
    expect(my).toMatch(/ensureTables\(c\.env\.DB\)/)
    expect(my).toMatch(/userReadDb\(c\.env\.DB, c\.req\.header\('cookie'\)\)/)
  })

  it('리뷰 레벨 표 확인 메모는 원본 기준(사본 세션마다 DDL 금지)', () => {
    expect(code('src/worker/utils/review-level.ts')).toMatch(/_ensured\.has\(dbKey\(DB\)\)/)
  })
})

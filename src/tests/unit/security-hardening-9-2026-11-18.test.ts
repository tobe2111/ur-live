/**
 * 🔐 2026-11-18 보안 점검 9차 — 대표 *"이후 문제들도 파악해줘"*.
 *
 * ① 이메일 가입(주소 확인 없음) 계정이 같은 이메일의 미연결 매장을 넘겨받지 못한다.
 * ② 어드민 역할 검사(RBAC)가 모든 /api/admin/* 라우트 등록보다 먼저 온다 · 후기 보너스 승인도 역할 검사를 받는다.
 * ③ 재발급 토큰 전량 폐기는 "행 0" 을 만들지 않는다(행 0 = 서명만 보고 통과 = 옛 토큰 부활).
 * ④ 선물 결제 한 건은 선물 한 건에만 쓰인다.
 * ⑤ 넓은 도메인(ops 의 sellers·tools)에 실려 새던 민감 변경.
 *
 * ## ⚠️ 못 보는 것
 * - ②는 **등록 순서**를 글자로 본다 — index.ts 밖(다른 진입 파일)에서 /api/admin/* 를 더 먼저 붙이면 못 잡는다.
 * - ③ 재발급 경로의 "행 0 이면 통과" 호환 자체는 남아 있다(카카오로 받은 좌석 토큰은 행을 안 만든다) —
 *   폐기 지점이 `revokeAllRefreshTokens` 를 안 거치고 DELETE 만 하면 같은 구멍이 다시 열린다(아래 시험이 그걸 센다).
 * - ④ 사전 조회는 동시 요청 두 건을 원자적으로 막지 못한다(라이브에 `gifts` 표가 없어 지금은 죽은 경로다).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { readCode } from '@/tests/helpers/source-text'
import { canAdminRoleMutate } from '@/shared/admin-roles'
import { revokeAllRefreshTokens, filterAliveRefreshRows, REFRESH_TOMBSTONE_HASH } from '@/worker/utils/refresh-rotation'
import { verifyPassword } from '@/lib/password'

describe('① 이메일만 맞춰서 매장 주인이 되지 못한다', () => {
  it('유어샵 대시보드의 이메일 매칭은 카카오가 확인한 이메일만', () => {
    const code = readCode('src/worker/routes/curator.routes.ts')
    const at = code.indexOf('FROM sellers s JOIN users u ON u.email = s.email')
    expect(at).toBeGreaterThan(0)
    expect(code.slice(at, at + 400)).toMatch(/AND u\.kakao_id IS NOT NULL AND u\.email_verified = 1/)
  })
  it('내 매장 상태 조회의 이메일 매칭도 같다', () => {
    const code = readCode('src/features/seller/api/seller-registration/session-routes.ts')
    expect(code).toMatch(/SELECT email FROM users WHERE id = \? AND kakao_id IS NOT NULL AND email_verified = 1/)
    expect(code).not.toMatch(/'SELECT email FROM users WHERE id = \?'/)
  })
  it('이메일 가입은 email_verified 를 세우지 않는다', () => {
    const code = readCode('src/worker/routes/auth.routes.ts')
    const seg = code.slice(code.indexOf("authRouter.post('/register'"), code.indexOf("authRouter.post('/register'") + 4000)
    expect(seg).toMatch(/INSERT INTO users \(email, password_hash, name, phone\)/)
    expect(seg).not.toMatch(/email_verified/)
  })
})

describe('② 어드민 역할 검사는 모든 /api/admin/* 등록보다 먼저', () => {
  const raw = readFileSync('src/worker/index.ts', 'utf8')
  const gate = raw.indexOf("app.use('/api/admin/*', adminRbacMiddleware());")
  it('게이트가 한 번만 있고, 내부 도구 라우터보다 앞이다', () => {
    expect(gate).toBeGreaterThan(0)
    expect(raw.indexOf("app.use('/api/admin/*', adminRbacMiddleware());", gate + 1)).toBe(-1)
    for (const mount of ['internalDiagnosticsRoutes', 'opsAlertRoutes', 'internalAdminToolsRoutes', 'smokeTestRoutes', 'repairSchemaRoutes']) {
      const at = raw.indexOf(`app.route('/', ${mount})`)
      expect(at, mount).toBeGreaterThan(gate)
    }
  })
  it("게이트보다 앞에서 붙는 app.route 중 /api/admin 을 정의하는 파일이 없다", () => {
    const before = raw.slice(0, gate)
    const mounted = [...before.matchAll(/app\.route\('\/', (\w+)\)/g)].map((m) => m[1])
    for (const name of mounted) {
      const imp = raw.match(new RegExp(`import (?:\\{[^}]*\\b${name}\\b[^}]*\\}|${name}) from '([^']+)'`))
      if (!imp) continue
      const file = join('src/worker', imp[1]) + '.ts'
      let src = ''
      try { src = readFileSync(file, 'utf8') } catch { continue }
      // 라우트 **정의**만 본다 — 클라이언트 스크립트 문자열 속의 fetch('/api/admin/…') 는 라우트가 아니다.
      expect(/\.(?:get|post|put|patch|delete|all|on|use)\(\s*(?:\[[^\]]*\],\s*)?['"`]\/api\/admin[/-]/.test(src), `${name} (${file})`).toBe(false)
    }
  })
  it('후기 보너스 승인도 역할 검사를 받는다 · 표 밖 DDL 은 super 만', () => {
    expect(raw).toMatch(/app\.use\('\/api\/admin-review-bonus\/\*', adminRbacMiddleware\(\)\)/)
    expect(canAdminRoleMutate('viewer', '/api/admin-review-bonus/3/approve')).toBe(false)
    expect(canAdminRoleMutate('cs', '/api/admin-review-bonus/3/approve')).toBe(false)
    expect(readCode('src/worker/routes/internal-admin-tools.routes.ts'))
      .toMatch(/\.get\('\/api\/_internal\/repair-new-tables', requireAdminRole\('super'\)/)
  })
})

describe('③ 재발급 토큰 전량 폐기 — 행 0 을 만들지 않는다', () => {
  it('폐기 뒤 묘비 한 줄이 남고, 어떤 토큰과도 맞지 않는다', async () => {
    const rows: Array<{ user_type: string; user_id: number; token_hash: string; expires_at: string }> = [
      { user_type: 'seller', user_id: 7, token_hash: 'old', expires_at: new Date(Date.now() + 1e9).toISOString() },
      { user_type: 'seller', user_id: 8, token_hash: 'other', expires_at: new Date(Date.now() + 1e9).toISOString() },
    ]
    const DB = {
      prepare: (sql: string) => {
        let a: unknown[] = []
        const api = {
          bind: (...v: unknown[]) => { a = v; return api },
          run: async () => {
            if (sql.startsWith('DELETE')) { for (let i = rows.length - 1; i >= 0; i--) if (rows[i].user_type === a[0] && rows[i].user_id === a[1]) rows.splice(i, 1) }
            else rows.push({ user_type: a[0] as string, user_id: a[1] as number, token_hash: a[2] as string, expires_at: a[3] as string })
            return { meta: { changes: 1 } }
          },
        }
        return api
      },
    } as unknown as D1Database
    await revokeAllRefreshTokens(DB, 'seller', 7)
    const mine = rows.filter((r) => r.user_id === 7)
    expect(mine.length).toBe(1) // 행 0 이 아니다 → 재발급 경로의 대조가 돈다
    expect(mine[0].token_hash).toBe(REFRESH_TOMBSTONE_HASH)
    expect(filterAliveRefreshRows(mine, Date.now()).length).toBe(1)
    expect(Date.parse(mine[0].expires_at) - Date.now()).toBeGreaterThan(30 * 86400_000) // 토큰 수명(30일)보다 길다
    expect((await verifyPassword('eyJhbGciOiJIUzI1NiJ9.anything.sig', mine[0].token_hash)).valid).toBe(false)
    expect(rows.filter((r) => r.user_id === 8).length).toBe(1) // 남의 행은 그대로
  })
  it('admin·seller 의 전량 DELETE 는 이 함수 안에만 있다', () => {
    const hits: string[] = []
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f)
        if (statSync(p).isDirectory()) { if (f !== 'tests') walk(p); continue }
        if (!p.endsWith('.ts')) continue
        // 줄 단위 — `refresh-delete-ok` 표식(이유 포함)이 붙은 줄은 예외(주석이라 원문으로 본다).
        for (const line of readFileSync(p, 'utf8').split('\n')) {
          if (/^\s*(?:\/\/|\*)/.test(line)) continue
          if (/DELETE FROM auth_refresh_tokens WHERE user_type = '(?:admin|seller)' AND user_id = \?[`"']/.test(line) && !/refresh-delete-ok:/.test(line)) hits.push(p)
        }
      }
    }
    walk('src/features'); walk('src/worker')
    expect(hits).toEqual([])
  })
})

describe('④ 선물 결제 한 건 = 선물 한 건', () => {
  const code = readCode('src/features/gifts/api/gifts.routes.ts')
  const seg = code.slice(code.indexOf("giftsRoutes.post('/:id/confirm'"))
  it('주문 번호가 이 선물에 묶이고, 같은 결제 키가 다른 선물에 쓰였는지 토스 호출 전에 본다', () => {
    const bind = seg.indexOf("startsWith(`gift_${giftId}_`)")
    const dup = seg.indexOf('SELECT id FROM gifts WHERE toss_payment_key = ? AND id != ? LIMIT 1')
    const toss = seg.indexOf('await confirmTossPayment(')
    expect(bind).toBeGreaterThan(0)
    expect(dup).toBeGreaterThan(bind)
    expect(toss).toBeGreaterThan(dup)
  })
})

describe('⑤ 넓은 도메인에 실려 새던 민감 변경', () => {
  it('매장 주인 지정·잔액 병합·원장 잠금 해제는 super·admin 만', () => {
    for (const p of ['/api/admin/sellers/29/link-user', '/api/admin/tools/points-reconcile', '/api/admin/tools/point-ledger-unlock']) {
      for (const r of ['ops', 'cs', 'finance', 'viewer'] as const) expect(canAdminRoleMutate(r, p), `${r} ${p}`).toBe(false)
      for (const r of ['super', 'admin'] as const) expect(canAdminRoleMutate(r, p), `${r} ${p}`).toBe(true)
    }
  })
  it('계좌 재인증(출금 재개)은 재무만 — 운영 역할은 못 한다', () => {
    expect(canAdminRoleMutate('ops', '/api/admin/sellers/29/verify-account')).toBe(false)
    expect(canAdminRoleMutate('finance', '/api/admin/sellers/29/verify-account')).toBe(true)
  })
  it('운영 역할의 평범한 매장 변경은 그대로 된다', () => {
    expect(canAdminRoleMutate('ops', '/api/admin/sellers/29/approve')).toBe(true)
    expect(canAdminRoleMutate('ops', '/api/admin/tools/cache-clear')).toBe(true)
  })
  it('관리자가 주인을 바꾸면 좌석 토큰·스캔 기기 키를 끊는다', () => {
    const code = readCode('src/features/admin/api/admin-sellers.routes.ts')
    const seg = code.slice(code.indexOf("adminSellersRoutes.patch('/sellers/:id/link-user'"))
    expect(seg).toMatch(/Number\(prevLink\.linked_user_id\) !== Number\(userId\)\) \{[\s\S]{0,400}bumpStoreSeatEpoch\(DB, Number\(sellerId\), 'admin_link_user'\);\s*await revokeAllScanDevices\(DB, Number\(sellerId\)\);/)
  })
})

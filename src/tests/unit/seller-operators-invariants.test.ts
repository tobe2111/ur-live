import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { deriveDashboardSeat, SINGLE_SESSION_ROLES } from '@/worker/utils/dashboard-session'

/**
 * 🏪 매장 운영 주체(operator) — 불변식 가드 (2026-08-19)
 *   설계 SSOT: docs/design/store-operator-model.md 2단계
 *
 * ## 이 기능의 진짜 위험은 돈이 아니라 **인가**다
 * 셀러 대시보드의 모든 라우트는 `seller_token` 의 seller_id 로 자동 스코프된다.
 * 즉 **다른 매장 토큰을 받는 순간 그 매장의 주문·정산·상품이 전부 열린다.**
 * 그래서 `POST /stores/:sellerId/token` 의 권한 검사가 유일한 방어선이고, 그게 이 파일의 대부분이다.
 *
 * ## ⚠️ 이 테스트가 **못 막는 것**(과신 금지)
 *   - 실제 D1 권한 판정(쿼리가 맞는지)은 라이브/스테이징에서만 확인된다. 여기선 **배선**만 본다.
 *   - Workers 런타임 라우팅(마운트가 실제로 붙었는지)도 배포 후 curl 로만 판정된다.
 *   - 세션 좌석은 순수함수라 실제로 검증하지만, `dashboard_sessions` 테이블 동작은 못 본다.
 */

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const routes = read('src/features/seller/api/seller-operators.routes.ts')
const util = read('src/worker/utils/seller-operators.ts')
const workerIndex = read('src/worker/index.ts')

describe('🔐 매장 전환 — 토큰 발급이 유일한 방어선', () => {
  it('토큰 발급 핸들러가 canOperateStore 를 통과해야만 진행한다', () => {
    const at = routes.indexOf("app.post('/stores/:sellerId/token'")
    expect(at, '토큰 발급 핸들러를 못 찾음').toBeGreaterThan(-1)
    const body = routes.slice(at, routes.indexOf('app.', at + 10))
    // 검사 → 실패 시 403 → 그 다음에야 서명. 순서가 뒤집히면 뚫린다.
    const checkAt = body.indexOf('canOperateStore')
    const denyAt = body.indexOf('403')
    const signAt = body.indexOf('jwtSign')
    expect(checkAt, 'canOperateStore 검사가 없다').toBeGreaterThan(-1)
    expect(denyAt, '거부(403) 분기가 없다').toBeGreaterThan(checkAt)
    expect(signAt, '권한 검사보다 먼저 토큰을 서명하고 있다').toBeGreaterThan(denyAt)
  })

  it('클라이언트가 보낸 user_id 를 권한 근거로 쓰지 않는다', () => {
    // 주체는 세션/토큰에서만 나온다. body/query 의 user_id 를 읽는 순간 그건 위조 가능한 값이다.
    expect(routes).not.toMatch(/req\.(json|query|param)[^\n]*user_id/)
    expect(routes).toMatch(/function resolveActorUserId/)
  })

  it('주체 확정은 세션 쿠키 또는 seller_token 에서만 나온다', () => {
    const at = routes.indexOf('async function resolveActorUserId')
    const body = routes.slice(at, at + 900)
    expect(body).toMatch(/parseSessionCookie/)
    expect(body).toMatch(/getSellerIdFromToken/)
    expect(body).toMatch(/linked_user_id/)
  })

  it('승인되지 않은 매장은 토큰을 받지 못한다', () => {
    const at = routes.indexOf("app.post('/stores/:sellerId/token'")
    const body = routes.slice(at, routes.indexOf('app.', at + 10))
    expect(body).toMatch(/status !== 'active' && [^\n]*status !== 'approved'/)
  })

  it('전환 엔드포인트에 rate limit 이 걸려 있다', () => {
    expect(routes).toMatch(/app\.post\('\/stores\/:sellerId\/token',\s*rateLimit\(/)
  })
})

describe('🪑 운영자 좌석 분리 — 운영자가 사장님을 튕기지 않는다', () => {
  // 안 나누면 시트가 ('seller', 매장id) 라 운영자가 들어가는 순간 소유자가 SESSION_SUPERSEDED 로 끊긴다.
  it('operator_user_id 가 있으면 seller_operator 좌석', () => {
    expect(deriveDashboardSeat({ type: 'seller', sub: '77', operator_user_id: 12 }))
      .toEqual({ role: 'seller_operator', id: 12 })
  })

  it('소유자 토큰(operator_user_id 없음)은 기존 seller 좌석 그대로', () => {
    expect(deriveDashboardSeat({ type: 'seller', sub: '77' })).toEqual({ role: 'seller', id: 77 })
  })

  it('같은 매장이라도 운영자와 소유자의 좌석이 다르다', () => {
    const owner = deriveDashboardSeat({ type: 'seller', sub: '77' })
    const operator = deriveDashboardSeat({ type: 'seller', sub: '77', operator_user_id: 12 })
    expect(owner).not.toEqual(operator)
  })

  it('seller_operator 도 단일 세션 강제 대상이다', () => {
    expect(SINGLE_SESSION_ROLES.has('seller_operator')).toBe(true)
  })

  it('토큰 발급부가 위임(grant)일 때만 별도 좌석을 준다', () => {
    const at = routes.indexOf("app.post('/stores/:sellerId/token'")
    const body = routes.slice(at, routes.indexOf('app.', at + 10))
    expect(body).toMatch(/access\.source === 'grant'[\s\S]{0,120}operator_user_id/)
  })
})

describe('🛡️ 권한 확산 방지 — 운영자는 운영자를 못 부른다', () => {
  it('운영자 관리 3종이 전부 소유자 게이트를 지난다', () => {
    for (const ep of ["app.get('/operators'", "app.post('/operators'", "app.post('/operators/:userId/revoke'"]) {
      const at = routes.indexOf(ep)
      expect(at, `${ep} 없음`).toBeGreaterThan(-1)
      const body = routes.slice(at, at + 700)
      expect(body, `${ep} 에 소유자 게이트가 없다`).toMatch(/requireOwnerOfCurrentStore/)
    }
  })

  it('소유자 게이트는 isStoreOwner 로 판정한다(역할 문자열 직접 비교 금지)', () => {
    const at = routes.indexOf('async function requireOwnerOfCurrentStore')
    const body = routes.slice(at, at + 700)
    expect(body).toMatch(/isStoreOwner/)
    expect(body).toMatch(/403/)
  })
})

describe('🔁 소유·회수 규칙', () => {
  it('소유(linked_user_id)가 위임을 덮어쓴다 — 남이 내 매장에서 나를 강등시킬 수 없다', () => {
    const at = util.indexOf('export async function listOperableStores')
    const body = util.slice(at, util.indexOf('export async function canOperateStore'))
    // grant 를 먼저 넣고 owned 를 나중에 넣어야 Map 에서 소유가 이긴다.
    expect(body.indexOf('for (const r of granted.results')).toBeLessThan(body.indexOf('for (const r of owned.results'))
  })

  it('canOperateStore 는 소유를 먼저 보고, 회수된 위임은 통과시키지 않는다', () => {
    const at = util.indexOf('export async function canOperateStore')
    const body = util.slice(at, util.indexOf('export async function isStoreOwner'))
    expect(body).toMatch(/linked_user_id = \?/)
    expect(body).toMatch(/revoked_at IS NULL/)
  })

  it('회수는 조건 없이 가능하다 (불변원칙 #2) — 기간·잔액 같은 게이트가 붙지 않았다', () => {
    const at = util.indexOf('export async function revokeOperator')
    const body = util.slice(at, at + 700)
    expect(body).toMatch(/UPDATE seller_operators SET revoked_at/)
    expect(body).not.toMatch(/balance|settle|payout|잔액/)
  })

  it('부여는 멱등이다 — UNIQUE index + INSERT OR IGNORE (머니 룰 #3)', () => {
    expect(util).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_operators_pair/)
    expect(util).toMatch(/INSERT OR IGNORE INTO seller_operators/)
  })

  it('revoked_at 은 행 삭제 대신이다 — DELETE 로 이력을 지우지 않는다', () => {
    expect(util).not.toMatch(/DELETE FROM seller_operators/)
  })
})

describe('🔌 배선', () => {
  it('라우터가 /api/seller 에 마운트돼 있다', () => {
    expect(workerIndex).toMatch(/^app\.route\('\/api\/seller', sellerOperatorsRoutes\);/m)
  })

  it('테이블이 repair-schema 에 등록돼 있다 (런타임 ensure 와 이중 방어)', () => {
    const repairs = read('src/worker/routes/repair-schema/column-repairs.ts')
    expect(repairs).toMatch(/CREATE TABLE IF NOT EXISTS seller_operators/)
    expect(repairs).toMatch(/idx_seller_operators_pair/)
  })

  it('매장 전환 UI 는 매장이 2곳 미만이면 렌더하지 않는다', () => {
    const sw = read('src/components/seller/StoreSwitcher.tsx')
    expect(sw).toMatch(/if \(stores\.length < 2\) return null/)
    // 전환은 반드시 서버 발급 토큰으로 — 클라가 seller_id 만 바꿔치기하면 안 된다.
    expect(sw).toMatch(/api\.post\(`\/api\/seller\/stores\/\$\{s\.seller_id\}\/token`\)/)
    expect(sw).toMatch(/localStorage\.setItem\('seller_token', d\.seller_token\)/)
  })
})

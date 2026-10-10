/**
 * 🪑 **옛 단일 좌석 경로 셋도 `/store/new` 사장님을 찾는다** (2026-10-10 — 조회 통일 ④, 대표 *"모두 고치고"*)
 *
 * ## 무엇을 지키나
 * `/store/new` 는 `sellers.linked_user_id` 를 비우고 `seller_operators(role='owner')` 로 소유권을 준다.
 * 그런데 `GET /my-seller-status` · `POST /switch-to-seller` · 카카오 로그인 `issueLinkedRoleTokens` 는
 * `WHERE linked_user_id = ?` 하나만 봐서, 직접 등록한 사장님에게 **"셀러 아님"** 이라고 답했다:
 *   - 대기 화면이 "새로 등록하세요" 를 띄운다(이미 등록했는데)
 *   - 카카오로 로그인해도 셀러 토큰이 안 나와 대시보드에서 튕긴다
 *
 * ## 규칙
 * ① linked 가 먼저 이긴다 ② 그다음 **owner 좌석만**(operator=중개는 아니다) ③ 회수된 좌석은 아니다
 * ④ 그 좌석으로 토큰을 줄 때 시트·클레임은 매장 전환 API 의 grant 분기와 **같은 값**
 * ⑤ 대기 화면은 이 조회를 **이메일 자동 연결(데이터를 바꾸는 폴백)보다 먼저** 한다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - HTTP 층 전체(세션 쿠키 파싱·응답 모양). 배선은 호출 자리(인자 포함)로 앵커를 잡는다.
 * - D1 과 node:sqlite 의 차이.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { findOwnerSeatSellerId, ownerGrantSeat } from '@/worker/utils/seller-operators'
import { stripComments } from '../helpers/source-text'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  return {
    prepare(sql: string) {
      let binds: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { binds = a; return self },
        first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
        all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
        run: async () => ({ meta: { changes: Number(db.prepare(sql).run(...(binds as never[])).changes) } }),
      }
      return self
    },
  } as unknown as D1Database
}

function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, status TEXT)`)
  db.exec(`CREATE TABLE seller_operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL, granted_at TEXT, revoked_at TEXT)`)
  db.exec(`INSERT INTO sellers VALUES (2, NULL, 'pending'), (3, NULL, 'approved'), (4, NULL, 'approved'), (5, NULL, 'approved')`)
  // 22: 직접 등록 사장님(주인 좌석 둘 — 먼저 받은 것이 나온다)
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role, granted_at) VALUES
    (4, 22, 'owner', '2026-10-02'), (2, 22, 'owner', '2026-10-01')`)
  // 33: 중개자(operator) — 주인이 아니다
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role, granted_at) VALUES (3, 33, 'operator', '2026-10-01')`)
  // 44: 회수된 주인 좌석
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role, granted_at, revoked_at) VALUES (5, 44, 'owner', '2026-10-01', '2026-10-05')`)
  return d1(db)
}

describe('🪑 findOwnerSeatSellerId — 주인 좌석만, 먼저 받은 것', () => {
  it('🔴 직접 등록 사장님의 매장을 찾는다 (이게 깨져 있던 것)', async () => {
    expect(await findOwnerSeatSellerId(fresh(), 22)).toBe(2)
  })
  it('중개자(operator)는 주인이 아니다 — 옛 경로가 남의 가게를 "내 셀러"로 내밀면 안 된다', async () => {
    expect(await findOwnerSeatSellerId(fresh(), 33)).toBeNull()
  })
  it('회수된 주인 좌석은 아니다', async () => {
    expect(await findOwnerSeatSellerId(fresh(), 44)).toBeNull()
  })
  it('아무 좌석도 없으면 null · 잘못된 id 도 null', async () => {
    expect(await findOwnerSeatSellerId(fresh(), 99)).toBeNull()
    expect(await findOwnerSeatSellerId(fresh(), 0)).toBeNull()
  })
  it('테이블이 없어도 던지지 않고 null — 종전 동작("없음")으로 돌아간다', async () => {
    expect(await findOwnerSeatSellerId(d1(new DatabaseSync(':memory:')), 22)).toBeNull()
  })
})

describe('🪑 시트·클레임 — 매장 전환 API 의 grant 분기와 같은 값', () => {
  it('operator_user_id + store_role=owner, 시트는 (seller_operator, userId)', () => {
    expect(ownerGrantSeat(22)).toEqual({
      claims: { operator_user_id: 22, store_role: 'owner' },
      seat: { role: 'seller_operator', id: 22 },
    })
  })
  it('매장 전환 API 도 grant 일 때 같은 시트를 쓴다(두 벌이면 서로 튕긴다)', () => {
    const s = stripComments(readFileSync('src/features/seller/api/seller-operators.routes.ts', 'utf8'))
    expect(s).toMatch(/access\.source === 'grant'\s*\?\s*\{ role: 'seller_operator', id: userId \}/)
    expect(s).toMatch(/if \(access\.source === 'grant'\) payload\.operator_user_id = userId/)
  })
})

describe('🔌 배선 — 옛 경로 셋이 linked 다음에 주인 좌석을 본다', () => {
  const kakao = stripComments(readFileSync('src/features/auth/api/kakao.routes.ts', 'utf8'))
  const sess = stripComments(readFileSync('src/features/seller/api/seller-registration/session-routes.ts', 'utf8'))

  it('카카오 로그인 issueLinkedRoleTokens: linked 조회 → 없으면 주인 좌석 → 같은 시트', () => {
    const fn = kakao.slice(kakao.indexOf('export async function issueLinkedRoleTokens'), kakao.indexOf('agencies WHERE linked_user_id'))
    const linked = fn.indexOf('FROM sellers WHERE linked_user_id = ?')
    const grant = fn.indexOf('findOwnerSeatSellerRow<Row>(DB, userId, SELLER_COLS)')
    expect(linked).toBeGreaterThan(-1)
    expect(grant).toBeGreaterThan(linked)
    expect(fn).toMatch(/const ownerGrant = !seller && !!\(seller = await findOwnerSeatSellerRow<Row>\(DB, userId, SELLER_COLS\)\)/)
    expect(fn).toMatch(/ownerGrant \? ownerGrantSeat\(userId\)\.claims/)
    expect(fn).toMatch(/const seat = ownerGrant \? ownerGrantSeat\(userId\)\.seat : \{ role: 'seller', id: seller\.id \}/)
    expect(fn).toMatch(/startDashboardSession\(DB, seat\.role, seat\.id, payload\.iat\)/)
  })

  it('my-seller-status: 주인 좌석을 이메일 자동 연결보다 먼저 본다', () => {
    const fn = sess.slice(sess.indexOf("app.get('/my-seller-status'"), sess.indexOf("app.post('/switch-to-seller'"))
    const grant = fn.indexOf('findOwnerSeatSellerId(db, Number(sessionUser.userId))')
    const email = fn.indexOf('WHERE LOWER(email) = ?')
    expect(grant).toBeGreaterThan(-1)
    expect(email).toBeGreaterThan(grant)
  })

  it('switch-to-seller: 주인 좌석이면 같은 클레임·시트로 토큰을 준다', () => {
    const fn = sess.slice(sess.indexOf("app.post('/switch-to-seller'"), sess.indexOf("app.post('/switch-to-user'"))
    expect(fn).toMatch(/if \(!seller\) \{\s*const grantId = await findOwnerSeatSellerId\(db, Number\(sessionUser\.userId\)\)/)
    expect(fn).toMatch(/ownerGrant \? ownerGrantSeat\(Number\(sessionUser\.userId\)\)\.claims/)
    expect(fn).toMatch(/const seat = ownerGrant \? ownerGrantSeat\(Number\(sessionUser\.userId\)\)\.seat/)
    expect(fn).toMatch(/startDashboardSession\(c\.env\.DB, seat\.role, seat\.id/)
  })
})

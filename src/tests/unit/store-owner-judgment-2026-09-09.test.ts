/**
 * 🪑 **직접 등록한 사장님이 자기 매장의 소유자인가** — 실제 함수로 돌려서 판정 (2026-09-09)
 *
 * ## 무엇이 틀렸었나 (라이브 잠복 결함)
 * `/store/new` 는 설계상 `sellers.linked_user_id` 를 **비워 두고**(UNIQUE 1인1행) 등록자에게
 * `seller_operators` 행을 준다 — **직접(direct)=`role:'owner'` · 중개(brokered)=`role:'operator'`**
 * (`seller-stores.routes.ts:479`).
 *
 * 그런데 소유 판정이 **토큰을 거치며 무너졌다**:
 *   `canOperateStore` → `{ role:'owner', source:'grant' }`   ← 역할은 맞게 나온다
 *   토큰            → `if (source === 'grant') operator_user_id = userId`  ← **역할을 안 싣는다**
 *   `resolveStoreActor` → `isOwner = operatorUserId === null`             ← 그래서 **false**
 *
 * ⇒ 직접 등록한 **진짜 사장님이 운영자로 오판**되고, 소유자 전용 게이트가 전부 닫힌다:
 *   ① 정산 계좌 변경 403 → **돈을 아예 못 받는다**(가장 큰 피해)
 *   ② 자기 사업자정보가 마스킹됨  ③ 탈퇴 불가  ④ 자기 매장 정산 내역이 합류 이후로 잘림
 *
 * 라이브에 직접 등록 매장이 아직 0이라(유일한 매장 14 는 brokered) 오늘 터지진 않았다 —
 * **다음에 "직접(업주)"로 등록하는 첫 사장님이 바로 밟는다.** 그게 주 경로다(수수료 10%).
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * 실제 JWT 서명·만료·HTTP 층. 여기서 보는 것은 **역할이 토큰을 건너 살아남는가** 하나다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { sign as jwtSign } from 'hono/jwt'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { canOperateStore } from '@/worker/utils/seller-operators'
import { resolveStoreActor } from '@/worker/utils/store-actor'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

/** D1 최소 어댑터 — 실제 함수를 고치지 않고 태운다. */
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
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, linked_user_id INTEGER, business_name TEXT)`)
  db.exec(`CREATE TABLE seller_operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER,
    granted_at DATETIME DEFAULT (datetime('now')), revoked_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now')))`)
  db.exec(`CREATE UNIQUE INDEX idx_seller_operators_pair ON seller_operators(seller_id, user_id)`)
  return db
}

const TOKEN_ROUTE = 'src/features/seller/api/seller-operators.routes.ts'

/**
 * 토큰 발급부가 하는 일 그대로 — **사본이다.**
 * ⚠️ 사본이라 진짜 발급부가 역할을 안 실어도 이 시험은 초록이 뜬다(주입 검증이 잡았다).
 *   그래서 아래 '발급부가 실제로 역할을 싣는다' 가 배선을 소스로 못 박는다. 둘은 짝이다.
 */
const buildPayload = (access: { role?: string; source?: string }, userId: number) => {
  const p: Record<string, unknown> = { type: 'seller', seller_id: 7 }
  if (access.source === 'grant') p.operator_user_id = userId
  if (access.role) p.store_role = access.role      // ← 이번 수리: 역할을 함께 싣는다
  return p
}

/**
 * 🔑 판정은 **실제 `resolveStoreActor`** 가 한다 — 규칙을 여기서 다시 쓰지 않는다.
 *   재구현하면 소스가 틀려도 시험이 자기 사본을 보고 초록을 낸다(이 레포가 반복해 당한 클래스).
 *   그래서 진짜 JWT 를 서명해 태운다.
 */
const SECRET = 'test-secret-store-owner-judgment'
const judge = async (p: Record<string, unknown>) => {
  const token = await jwtSign({ ...p, exp: Math.floor(Date.now() / 1000) + 600 }, SECRET)
  return resolveStoreActor(`Bearer ${token}`, SECRET)
}

describe('🪑 직접 등록 사장님 = 소유자 (역할이 토큰을 건너 살아남는다)', () => {
  it('직접(direct) 등록자는 role owner 인데 source 는 grant 다 — 여기가 함정이었다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, NULL, '내 가게')`).run()
    db.prepare(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (7, 100, 'owner')`).run()

    const access = await canOperateStore(d1(db), 100, 7)
    expect(access.ok).toBe(true)
    expect(access.role, '직접 등록은 owner 여야 한다').toBe('owner')
    expect(access.source, 'linked_user_id 를 안 쓰므로 grant 로 나온다 — 이게 오판의 씨앗이었다').toBe('grant')
  })

  it('그 사장님이 소유자로 판정된다 (수리 확인)', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, NULL, '내 가게')`).run()
    db.prepare(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (7, 100, 'owner')`).run()

    const access = await canOperateStore(d1(db), 100, 7)
    const actor = await judge(buildPayload(access, 100))
    expect(actor.isOwner, '자기 매장인데 운영자로 오판되면 정산 계좌를 못 넣는다(=돈을 못 받는다)').toBe(true)
  })

  it('위임받은 운영자는 여전히 소유자가 아니다 (게이트가 헐거워지면 안 된다)', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, NULL, '남의 가게')`).run()
    db.prepare(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (7, 200, 'operator')`).run()

    const access = await canOperateStore(d1(db), 200, 7)
    expect(access.role).toBe('operator')
    const actor = await judge(buildPayload(access, 200))
    expect(actor.isOwner, '운영자가 소유자가 되면 남의 매장 계좌를 갈아끼울 수 있다').toBe(false)
    expect(actor.operatorUserId, '시트 분리용 claim 은 그대로 있어야 한다(사장님이 튕기지 않게)').toBe(200)
  })

  it('linked_user_id 로 연결된 옛 소유자도 그대로 소유자다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, 100, '옛 방식')`).run()
    const access = await canOperateStore(d1(db), 100, 7)
    expect(access.source).toBe('link')
    const actor = await judge(buildPayload(access, 100))
    expect(actor.isOwner).toBe(true)
    expect(actor.operatorUserId, 'link 경로는 시트를 안 가른다').toBeNull()
  })

  it('옛 토큰(store_role 없음)은 종전 규칙으로 판정된다 — 하위호환', async () => {
    // 이미 발급된 토큰은 30일 유효하다. 새 claim 이 없다고 갑자기 권한이 바뀌면 안 된다.
    expect((await judge({ type: 'seller', seller_id: 7, operator_user_id: 200 })).isOwner).toBe(false)
    expect((await judge({ type: 'seller', seller_id: 7 })).isOwner).toBe(true)
  })

  it('셀러 타입이 아닌 토큰은 아무 권한도 없다', async () => {
    expect((await judge({ store_role: 'owner' })).sellerId).toBeNull()
  })

  it('발급부가 실제로 역할을 싣는다 (위 사본이 못 보는 층)', () => {
    // 🩸 이 단언이 없으면 발급 한 줄을 지워도 위 시험들이 전부 통과한다 — 판정 코드는 멀쩡한 채
    //   입력만 비어 조용히 옛 규칙으로 떨어진다("실패가 아니라 부재").
    // 🔴 주석 제거는 레포 SSOT(`stripComments`) — 직접 쓴 정규식은 문자열 안의 `/*` 에 걸려
    //   파일 가운데를 삼킨다(2026-09-09 에 실제로 밟았다).
    const src = stripComments(readFileSync(TOKEN_ROUTE, 'utf8'))
    expect(src, `${TOKEN_ROUTE}: 역할을 안 실으면 사장님이 다시 운영자로 오판된다`)
      .toMatch(/payload\.store_role = access\.role/)
    expect(src, '시트 분리용 claim 은 그대로 있어야 한다 — 빼면 운영자 진입 시 사장님이 튕긴다')
      .toMatch(/access\.source === 'grant'[\s\S]{0,80}operator_user_id = userId/)
  })

  it('권한 없는 사람은 아무것도 못 연다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, NULL, '남의 가게')`).run()
    expect((await canOperateStore(d1(db), 999, 7)).ok).toBe(false)
  })

  it('회수된 운영자는 접근이 끊긴다', async () => {
    const db = fresh()
    db.prepare(`INSERT INTO sellers VALUES (7, NULL, '가게')`).run()
    db.prepare(`INSERT INTO seller_operators (seller_id, user_id, role, revoked_at) VALUES (7, 200, 'operator', datetime('now'))`).run()
    expect((await canOperateStore(d1(db), 200, 7)).ok).toBe(false)
  })
})

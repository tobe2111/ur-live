/**
 * 🪑 **매장 주인 신호는 하나다** — 실제로 돌려서 판정한다 (2026-09-09)
 *
 * ## 무엇을 지키나
 * `/store/new` 는 설계상 `sellers.linked_user_id` 를 **비워 두고** `seller_operators.role='owner'`
 * 로 소유권을 준다. 그래서 `WHERE linked_user_id = ?` 하나로 "이 사람이 사업자인가"를 묻는 코드는
 * **직접 등록한 사장님을 전부 남으로 본다.** 오늘 실측으로 걸린 자리가 넷이었고 전부 돈에 닿았다:
 *
 *   - 실제 돈 출금 자격        → 403 "사업자 셀러만 가능합니다" (자기 매장 매출인데)
 *   - 출금 UI 분기            → "일반 회원, 딜로만 적립"
 *   - 사업자 인증 표시         → 등록증을 냈는데 콘솔이 계속 '사업자 등록' 요구
 *   - 자가구매·주인=추천인 가드 → **조용히 통과**(판매수익 + 추천수수료 이중지급)
 *
 * ## 왜 배선 검사가 아니라 행동 시험인가
 * 오늘 이 세션에서만 **헛도는 가드를 넷** 만들었다(정규식이 import 줄·주석·`if(false)` 안의
 * 문자열에 걸렸다). "그 함수 이름이 파일에 있다"는 아무것도 증명하지 않는다. 그래서 여기서는
 * **실제 SQLite 에 두 종류의 매장을 놓고 실제 함수를 태운다.**
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - D1 과 node:sqlite 의 차이(플래너·동시성).
 * - HTTP 층(인증·권한). 호출부가 이 함수를 **부르는지**는 아래 배선 단언이 본다 —
 *   단, 호출 자리(인자 포함)로 앵커를 잡는다. 이름만 찾으면 import 줄에 걸린다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { findOwnedApprovedSeller, resolveStoreOwnerUserId } from '@/worker/utils/seller-operators'
import { resolveCurrentOwner } from '@/worker/utils/store-handover-guard'
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

/** 매장 둘을 놓는다: 옛 방식(linked) · 지금 방식(operators). */
function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (
    id INTEGER PRIMARY KEY AUTOINCREMENT, linked_user_id INTEGER,
    business_name TEXT, business_number TEXT, status TEXT)`)
  db.exec(`CREATE TABLE seller_operators (
    id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    role TEXT NOT NULL, granted_at TEXT DEFAULT CURRENT_TIMESTAMP, revoked_at TEXT)`)
  // 1: 옛 방식 — linked_user_id 로 주인(유저 11)
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, business_number, status)
           VALUES (1, 11, '옛날분식', '1112233333', 'approved')`)
  // 2: 지금 방식 — /store/new 직접 등록. linked 는 NULL, owner 는 유저 22
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, business_number, status)
           VALUES (2, NULL, '직접등록카페', '2223344444', 'approved')`)
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (2, 22, 'owner')`)
  // 3: 중개 등록 — 중개자(유저 33)는 operator 일 뿐 주인이 아니다
  db.exec(`INSERT INTO sellers (id, linked_user_id, business_name, business_number, status)
           VALUES (3, NULL, '중개돈까스', '3334455555', 'approved')`)
  db.exec(`INSERT INTO seller_operators (seller_id, user_id, role) VALUES (3, 33, 'operator')`)
  return d1(db)
}

describe('🪑 매장 주인 판정 — 두 신호를 함께 본다', () => {
  it('옛 방식(linked_user_id) 주인은 그대로 통과한다 — 넓히다 되던 걸 깨면 안 된다', async () => {
    expect((await findOwnedApprovedSeller(fresh(), 11))?.id).toBe(1)
  })

  it('🔴 직접 등록 사장님이 자기 매장의 사업자로 인정된다 (이게 깨져 있던 것)', async () => {
    const row = await findOwnedApprovedSeller(fresh(), 22)
    expect(row?.id).toBe(2)
    // 사업자 인증 표시가 쓰는 값까지 함께 온다 — 따로 조회하면 또 갈린다.
    expect(row?.business_number).toBe('2223344444')
  })

  it('🚫 중개(operator)는 주인이 아니다 — 남의 가게 돈을 출금하면 안 된다', async () => {
    expect(await findOwnedApprovedSeller(fresh(), 33)).toBeNull()
  })

  it('아무 매장도 없는 유저는 null', async () => {
    expect(await findOwnedApprovedSeller(fresh(), 99)).toBeNull()
  })

  it('미승인 매장은 인정하지 않는다', async () => {
    const DB = fresh()
    await DB.prepare(`UPDATE sellers SET status = 'pending' WHERE id = 2`).bind().run()
    expect(await findOwnedApprovedSeller(DB, 22)).toBeNull()
  })

  it('회수된 owner 는 더 이상 주인이 아니다', async () => {
    const DB = fresh()
    await DB.prepare(`UPDATE seller_operators SET revoked_at = '2026-01-01' WHERE seller_id = 2`).bind().run()
    expect(await findOwnedApprovedSeller(DB, 22)).toBeNull()
  })
})

describe('🔗 매장 → 주인 (자가구매·손바뀜이 함께 쓰는 규칙)', () => {
  it('두 방식 모두 주인을 찾는다', async () => {
    const DB = fresh()
    expect(await resolveStoreOwnerUserId(DB, 1)).toBe(11)
    expect(await resolveStoreOwnerUserId(DB, 2)).toBe(22)
  })

  it('중개만 있는 매장은 주인 없음(null) — "모름"(undefined)과 구분된다', async () => {
    const v = await resolveStoreOwnerUserId(fresh(), 3)
    expect(v).toBeNull()
    expect(v).not.toBeUndefined()
  })

  it('회수된 owner 는 매장 → 주인 방향에서도 사라진다', async () => {
    // 🩸 첫 판에서 이 경우를 findOwnedApprovedSeller(유저→매장) 에서만 봤다. 주입이 반대 방향
    //    (resolveStoreOwnerUserId)의 revoked_at 을 지웠는데 **시험이 통과**했다 — 헛도는 가드였다.
    const DB = fresh()
    expect(await resolveStoreOwnerUserId(DB, 2)).toBe(22)
    await DB.prepare(`UPDATE seller_operators SET revoked_at = '2026-01-01' WHERE seller_id = 2`).bind().run()
    expect(await resolveStoreOwnerUserId(DB, 2)).toBeNull()
  })

  it('🔒 손바뀜 자물쇠와 출금 판정이 같은 함수를 쓴다 — 한쪽만 고쳐지면 어긋난다', async () => {
    const DB = fresh()
    // resolveCurrentOwner 는 위임체다. 같은 입력에 같은 답이어야 한다.
    for (const id of [1, 2, 3]) {
      expect(await resolveCurrentOwner(DB, id)).toEqual(await resolveStoreOwnerUserId(DB, id))
    }
  })
})

describe('🔌 배선 — 호출 자리로 앵커를 잡는다(이름만 찾으면 import 줄에 걸린다)', () => {
  const src = (p: string) => stripComments(readFileSync(p, 'utf8'))

  it('출금 자격·UI 분기·사업자 인증 셋 다 SSOT 를 부른다', () => {
    const s = src('src/worker/routes/curator.routes.ts')
    expect((s.match(/findOwnedApprovedSeller\(\s*(c\.env\.DB|DB)\s*,\s*userId\s*\)/g) || []).length).toBe(3)
  })

  it('출금 판정에 옛 단독 쿼리가 되살아나지 않는다', () => {
    const s = src('src/worker/routes/curator.routes.ts')
    expect(s).not.toMatch(/SELECT id FROM sellers WHERE linked_user_id = \? AND status = 'approved'/)
  })

  it('자가구매 가드가 매장 주인을 SSOT 로 찾는다', () => {
    const s = src('src/worker/utils/affiliate-credit.ts')
    expect(s).toMatch(/resolveStoreOwnerUserId\(\s*DB\s*,\s*Number\(ownerRow\.seller_id\)\s*\)/)
    // 옛 방식(단독 linked_user_id 조인)으로 되돌아가지 않는다
    expect(s).not.toMatch(/s\.linked_user_id AS user_id FROM orders/)
  })
})

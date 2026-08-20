/**
 * 🏪 매장 운영 주체(operator) 관계 — 설계 SSOT: `docs/design/store-operator-model.md`
 *   (2026-08-19 대표 확정 "에이전시 대시보드를 없애고 셀러 대시보드가 여러 매장을 운영하게" → 2단계)
 *
 * ## 이 모듈이 푸는 문제
 * `sellers` 한 행에 **로그인 정체성**(`linked_user_id`·`password_hash`)과 **매장 실체**
 * (`business_number`·`bank_account`·정산주기)가 같이 있다. 그래서 중개자가 식당을 대신 올리면
 * 그 식당의 사업자등록증과 통장이 중개자 계정 소유가 되고, 사장님이 나중에 직접 하겠다고 하면
 * 승계 방법이 **계정 비밀번호 넘기기**밖에 없다.
 *
 * ⇒ "누가 이 매장을 운영하는가"를 **계정 소유권이 아니라 관계**로 뺀다. 그러면 승계가
 *    데이터 수술이 아니라 **행 하나 바꾸기**가 된다(상품·주문·리뷰·정산 이력 전부 매장에 남는다).
 *
 * ## 💰 돈은 움직이지 않는다
 * 정산 목적지는 여전히 `sellers.bank_account` 다. operator 는 **볼 수 있는 매장**을 넓힐 뿐
 * 정산 귀속을 바꾸지 않는다. (설계 문서가 2단계를 "머니 경로"라고 적었는데, 구현해 보니
 * 실제 위험은 돈이 아니라 **인가(IDOR)** 다 — 잘못하면 남의 매장 주문·정산이 보인다.)
 *
 * ## 🔐 그래서 보안 급소는 딱 한 곳이다
 * 셀러 대시보드는 `seller_token` 의 `sub`(=seller id)로 **모든 라우트가 자동 스코프**된다.
 * 즉 다른 매장 토큰을 받는 순간 그 매장 전부가 열린다 → **토큰 발급 시점의 `canOperateStore`
 * 검사가 유일한 방어선**이다. 이 파일 밖에서 seller_token 을 새로 mint 하지 말 것.
 */

/** 매장에 대한 계정의 권한. owner = 실소유(1명), operator = 위임받아 운영. */
export type OperatorRole = 'owner' | 'operator'

export const OPERATOR_ROLES: readonly OperatorRole[] = ['owner', 'operator'] as const

export function isOperatorRole(v: unknown): v is OperatorRole {
  return v === 'owner' || v === 'operator'
}

export interface OperableStore {
  seller_id: number
  role: OperatorRole
  /** 'link' = sellers.linked_user_id(기존 소유) · 'grant' = seller_operators 행 */
  source: 'link' | 'grant'
  business_name: string | null
  name: string | null
  status: string | null
  username: string | null
}

// 🛡️ per-worker 메모이제이션 (per-request DDL 금지 — 머니/정합성 부수 룰)
const _done_ensureSellerOperators = new WeakSet<object>()

/**
 * `seller_operators` 보장 — repair-schema 에도 동일 CREATE 등록(이중 방어).
 *
 * ⚠️ `revoked_at` 은 **행 삭제 대신**이다. 누가 언제 이 매장을 운영했는지가 분쟁 시 유일한 근거다.
 */
export async function ensureSellerOperators(DB: D1Database): Promise<void> {
  if (_done_ensureSellerOperators.has(DB)) return
  _done_ensureSellerOperators.add(DB)
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS seller_operators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      seller_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT NOT NULL DEFAULT 'operator',
      granted_by_user_id INTEGER,
      granted_at DATETIME DEFAULT (datetime('now')),
      revoked_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    // 멱등의 근거 — INSERT OR IGNORE 가 기대는 UNIQUE (머니 룰 #3: SELECT 후 INSERT 금지)
    await DB.prepare(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_seller_operators_pair ON seller_operators(seller_id, user_id)`
    ).run()
    await DB.prepare(
      `CREATE INDEX IF NOT EXISTS idx_seller_operators_user ON seller_operators(user_id, revoked_at)`
    ).run()
  } catch { /* 권한/레거시 — 호출부는 fail-soft 로 다룬다 */ }
}

/**
 * 이 유저가 운영할 수 있는 매장 목록.
 *
 * 두 출처를 합친다:
 *   ① `sellers.linked_user_id = userId` — 기존 소유(카카오 연결). **항상 owner.**
 *   ② `seller_operators` 의 미회수 행 — 위임받은 매장.
 * ①이 있으면 ①이 이긴다(자기 매장을 남이 operator 로 강등시킬 수 없다).
 */
export async function listOperableStores(DB: D1Database, userId: number): Promise<OperableStore[]> {
  if (!Number.isFinite(userId) || userId <= 0) return []
  await ensureSellerOperators(DB)

  const owned = await DB.prepare(
    `SELECT id AS seller_id, business_name, name, status, username
       FROM sellers WHERE linked_user_id = ? LIMIT 50`
  ).bind(userId).all<{ seller_id: number; business_name: string | null; name: string | null; status: string | null; username: string | null }>()
    .catch(() => ({ results: [] as never[] }))

  const granted = await DB.prepare(
    `SELECT o.seller_id, o.role, s.business_name, s.name, s.status, s.username
       FROM seller_operators o
       JOIN sellers s ON s.id = o.seller_id
      WHERE o.user_id = ? AND o.revoked_at IS NULL
      LIMIT 50`
  ).bind(userId).all<{ seller_id: number; role: string; business_name: string | null; name: string | null; status: string | null; username: string | null }>()
    .catch(() => ({ results: [] as never[] }))

  const out = new Map<number, OperableStore>()
  for (const r of granted.results || []) {
    out.set(r.seller_id, {
      seller_id: r.seller_id,
      role: isOperatorRole(r.role) ? r.role : 'operator',
      source: 'grant',
      business_name: r.business_name, name: r.name, status: r.status, username: r.username,
    })
  }
  // ① 이 뒤 — 소유가 위임을 덮어쓴다.
  for (const r of owned.results || []) {
    out.set(r.seller_id, {
      seller_id: r.seller_id, role: 'owner', source: 'link',
      business_name: r.business_name, name: r.name, status: r.status, username: r.username,
    })
  }
  return [...out.values()]
}

/**
 * 🔐 **이 함수가 유일한 방어선이다** — seller_token 발급 전에 반드시 통과할 것.
 * 통과하면 그 매장의 주문·정산·상품이 전부 열린다.
 */
export async function canOperateStore(
  DB: D1Database, userId: number, sellerId: number
): Promise<{ ok: boolean; role?: OperatorRole; source?: 'link' | 'grant' }> {
  if (!Number.isFinite(userId) || userId <= 0) return { ok: false }
  if (!Number.isFinite(sellerId) || sellerId <= 0) return { ok: false }
  await ensureSellerOperators(DB)

  const owned = await DB.prepare(
    `SELECT id FROM sellers WHERE id = ? AND linked_user_id = ? LIMIT 1`
  ).bind(sellerId, userId).first<{ id: number }>().catch(() => null)
  if (owned) return { ok: true, role: 'owner', source: 'link' }

  const row = await DB.prepare(
    `SELECT role FROM seller_operators
      WHERE seller_id = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1`
  ).bind(sellerId, userId).first<{ role: string }>().catch(() => null)
  if (!row) return { ok: false }
  return { ok: true, role: isOperatorRole(row.role) ? row.role : 'operator', source: 'grant' }
}

/** 매장의 실소유자인가 — 운영자 추가/회수 같은 소유권 행위의 게이트. */
export async function isStoreOwner(DB: D1Database, userId: number, sellerId: number): Promise<boolean> {
  const r = await canOperateStore(DB, userId, sellerId)
  return r.ok && r.role === 'owner'
}

/**
 * 운영 권한 부여. 멱등(UNIQUE + INSERT OR IGNORE) — 같은 쌍을 두 번 눌러도 행 1개.
 * 이미 회수된 행이면 되살린다(같은 사람을 다시 부를 수 있어야 한다).
 */
export async function grantOperator(
  DB: D1Database, sellerId: number, userId: number, grantedByUserId: number, role: OperatorRole = 'operator'
): Promise<{ ok: boolean; reason?: string }> {
  if (!Number.isFinite(sellerId) || sellerId <= 0) return { ok: false, reason: 'bad_seller' }
  if (!Number.isFinite(userId) || userId <= 0) return { ok: false, reason: 'bad_user' }
  await ensureSellerOperators(DB)
  try {
    await DB.prepare(
      `INSERT OR IGNORE INTO seller_operators (seller_id, user_id, role, granted_by_user_id, granted_at)
       VALUES (?, ?, ?, ?, datetime('now'))`
    ).bind(sellerId, userId, role, grantedByUserId).run()
    // 재초대: 회수됐던 행 되살리기 + 역할 갱신
    await DB.prepare(
      `UPDATE seller_operators
          SET revoked_at = NULL, role = ?, granted_by_user_id = ?, granted_at = datetime('now')
        WHERE seller_id = ? AND user_id = ?`
    ).bind(role, grantedByUserId, sellerId, userId).run()
    return { ok: true }
  } catch {
    return { ok: false, reason: 'db' }
  }
}

/**
 * 운영 권한 회수. **소유자는 조건 없이 언제든 회수할 수 있어야 한다**
 * (§4.3 불변원칙 #2 회수권 — 이 모델의 존재 이유 중 하나).
 * 회수해도 그 사람이 만들어 둔 상품·주문은 매장에 그대로 남는다.
 */
export async function revokeOperator(
  DB: D1Database, sellerId: number, userId: number
): Promise<{ ok: boolean; changed: number }> {
  await ensureSellerOperators(DB)
  try {
    const r = await DB.prepare(
      `UPDATE seller_operators SET revoked_at = datetime('now')
        WHERE seller_id = ? AND user_id = ? AND revoked_at IS NULL`
    ).bind(sellerId, userId).run()
    return { ok: true, changed: r.meta?.changes ?? 0 }
  } catch {
    return { ok: false, changed: 0 }
  }
}

/** 매장의 운영자 목록(소유자 화면용). 회수된 이력도 함께 — 분쟁 근거. */
export async function listStoreOperators(DB: D1Database, sellerId: number) {
  await ensureSellerOperators(DB)
  const rows = await DB.prepare(
    `SELECT o.user_id, o.role, o.granted_at, o.revoked_at,
            u.name AS user_name, u.handle AS user_handle, u.email AS user_email
       FROM seller_operators o
       LEFT JOIN users u ON u.id = o.user_id
      WHERE o.seller_id = ?
      ORDER BY o.revoked_at IS NOT NULL, o.granted_at DESC
      LIMIT 100`
  ).bind(sellerId).all().catch(() => ({ results: [] as never[] }))
  return rows.results || []
}

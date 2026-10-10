/**
 * 🪑 **매장 좌석 토큰은 발급 순간이 아니라 매 요청마다 살아 있어야 한다** (2026-10-10)
 *
 * ## 무엇이 뚫려 있었나 (실측)
 * 좌석 토큰(`POST /api/seller/stores/:sellerId/token`)은 **30일짜리 JWT** 이고 `canOperateStore` 를
 * **발급할 때 한 번만** 본다. 그 뒤로는 아무도 `seller_operators` 를 다시 보지 않았다:
 *   ① 사장님이 중개자를 **회수**해도(`revokeOperator` = `revoked_at` 만 찍는다) 그 사람 손의 토큰은
 *      최대 30일 동안 그 매장의 주문·정산·상품을 그대로 연다.
 *   ② **소유권 이전**(`transferStoreOwnership`)이 이전 주인을 operator 로 강등해도, 이전 주인 토큰엔
 *      `store_role:'owner'` 가 박혀 있어 **정산 계좌를 자기 PIN 으로 갈아끼울 수 있었다** —
 *      `resolveStoreActor` 가 claim 만 믿었기 때문이다(그 파일 스스로 "못 막는 것"으로 적어 뒀다).
 *   ③ 탈퇴(`/account/withdraw`)의 "세션 무효화"는 `startDashboardSession(…'seller'…)` 였는데,
 *      2026-08-20 에 셀러가 단일 세션 대상에서 빠지면서 **아무 일도 안 하는 호출**이 됐다.
 *
 * ## 왜 세션 경계(dashboard_sessions)를 재사용하지 않았나
 * 처음 떠올린 처방이었다. 그런데 `SINGLE_SESSION_ROLES` 에 `seller`·`seller_operator` 가 **없다**
 * (대표 확정 — 셀러는 동시 로그인 허용). 경계를 올려도 `isDashboardSessionCurrent` 가 그 역할은
 * 무조건 통과시킨다. 되살리면 2026-08-20 의 401 폭풍이 돌아온다. 그리고 시트 키 자체도 안 맞는다 —
 * ('seller', 매장id) 를 올리면 **진짜 사장님도 같이 튕기고**, ('seller_operator', userId) 를 올리면
 * 그 사람이 운영하는 **다른 매장까지** 끊긴다. 끊어야 할 단위는 "이 사람 × 이 매장" 이다.
 *
 * ## 그래서 — 진실은 DB 에서, 토큰은 "누가" 만 말한다
 * - **정체성 있는 좌석 토큰**(`seat_user_id` 또는 `operator_user_id`): 매 요청 `(매장, 사람)` 의
 *   **지금** 권한을 본다(`sellers.linked_user_id` 또는 미회수 `seller_operators` 행). 없으면 401.
 *   역할도 DB 가 정답이다 — claim 의 `store_role` 은 화면 힌트일 뿐 권한 근거가 아니다.
 * - **정체성 없는 토큰**(매장 계정 자체의 비번·카카오 로그인 토큰, 그리고 이 수리 전에 발급된
 *   link 출처 좌석 토큰): 누구 것인지 모른다 → 매장 단위 **좌석 에포크**로 자른다.
 *   소유권 이전·탈퇴가 에포크를 올리면 그 이전에 발급된 정체성 없는 토큰은 전부 401.
 *   새 주인은 에포크 뒤에 좌석을 받으니 영향이 없다.
 *
 * ## 실패 방향
 * - 일반 접근(미들웨어): D1 장애면 **통과**(fail-open) — dashboard-session 과 같은 철학. D1 한 번
 *   흔들렸다고 모든 사장님이 로그아웃되면 그게 더 큰 사고다.
 * - 소유자 전용 행위(정산 계좌·사업자정보·탈퇴 — `resolveStoreActor`): 판단 근거를 못 얻으면
 *   **소유자가 아니다**(fail-closed). 잠깐 못 바꾸는 것이 남의 계좌로 돈이 가는 것보다 낫다.
 *
 * ## 비용
 * 인증된 좌석 요청마다 PK/UNIQUE 조회 1회. isolate 안에서 15초 캐시한다 → 회수가 다른 isolate 에
 * 닿기까지 최대 15초. 같은 isolate 의 회수·이전·탈퇴는 즉시(`invalidateStoreSeatCache`).
 *
 * ## ⚠️ 이 모듈이 못 막는 것
 * - 이전 주인이 **매장 계정 비밀번호**를 알고 있으면 이전 뒤에 새로 로그인해 새 토큰을 받는다
 *   (에포크 뒤라 통과). 그건 좌석이 아니라 계정 자격 문제다 — 이전 시 비번 재설정이 필요하다.
 * - `ud_seller_token` 쿠키(SSR GET 전용)로 들어오는 토큰은 이 미들웨어가 안 본다(Bearer 만).
 *   좌석 전환은 그 쿠키를 굽지 않으므로 오늘은 좌석 토큰이 그 길로 오지 않는다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import type { Context, Next } from 'hono'
import { verify } from 'hono/jwt'
import type { OperatorRole } from './seller-operators'

export const STORE_SEAT_REVOKED = 'STORE_SEAT_REVOKED'

export interface SeatClaims {
  type?: unknown
  seller_id?: unknown
  sub?: unknown
  iat?: unknown
  seat_user_id?: unknown
  operator_user_id?: unknown
  store_role?: unknown
}

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 && Math.floor(n) === n ? n : null
}

/** 이 좌석 토큰이 **누구에게** 발급됐나. 매장 계정 토큰(정체성 없음)이면 null. */
export function seatUserIdOf(p: SeatClaims): number | null {
  return posInt(p.seat_user_id) ?? posInt(p.operator_user_id)
}

/** 좌석 토큰 모양인가 — refresh 토큰으로 쓰면 안 되는 토큰을 가른다. */
export function isSeatShapedToken(p: SeatClaims): boolean {
  return p.seat_user_id != null || p.operator_user_id != null || p.store_role != null
}

// ── 좌석 에포크 테이블 ─────────────────────────────────────────────────────
const _ensured = new WeakSet<object>()
export async function ensureStoreSeatEpochs(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(
      `CREATE TABLE IF NOT EXISTS store_seat_epochs (
        seller_id     INTEGER PRIMARY KEY,
        min_valid_iat INTEGER NOT NULL DEFAULT 0,
        reason        TEXT,
        updated_at    TEXT
      )`,
    ).run()
  } catch { /* 권한/레거시 — 읽는 쪽이 fail-open 으로 다룬다 */ }
}

// ── isolate 캐시 (15초) ───────────────────────────────────────────────────
const CACHE_TTL_MS = 15_000
type Entry<T> = { v: T; exp: number }
const _seatCache = new WeakMap<object, Map<string, Entry<OperatorRole | null>>>()
const _epochCache = new WeakMap<object, Map<number, Entry<number>>>()

function bucket<K, T>(store: WeakMap<object, Map<K, Entry<T>>>, DB: object): Map<K, Entry<T>> {
  let m = store.get(DB)
  if (!m) { m = new Map(); store.set(DB, m) }
  if (m.size > 500) m.clear() // 메모리 상한 — 다시 채우면 된다
  return m
}

/** 회수·이전·탈퇴 직후 호출 — 같은 isolate 에선 즉시 반영. 다른 isolate 는 TTL(15초) 안에. */
export function invalidateStoreSeatCache(DB: D1Database, sellerId?: number): void {
  const seats = _seatCache.get(DB as unknown as object)
  const epochs = _epochCache.get(DB as unknown as object)
  if (sellerId == null) { seats?.clear(); epochs?.clear(); return }
  epochs?.delete(sellerId)
  if (seats) for (const k of [...seats.keys()]) if (k.startsWith(`${sellerId}:`)) seats.delete(k)
}

/**
 * 매장 단위 좌석 에포크를 지금으로 올린다 — 그 전에 발급된 **정체성 없는** 토큰을 전부 끊는다.
 * 정체성 있는 좌석 토큰은 에포크가 아니라 DB 행으로 판정되므로 영향받지 않는다
 * (강등된 사람은 operator 로 계속 들어오고, 새 주인은 owner 로 들어온다).
 * fail-soft: 실패가 호출부(이전·탈퇴)를 되돌리지 않는다.
 */
export async function bumpStoreSeatEpoch(DB: D1Database, sellerId: number, reason: string): Promise<void> {
  if (!posInt(sellerId)) return
  try {
    await ensureStoreSeatEpochs(DB)
    // +1: 이 초에 발급된 옛 토큰까지 자른다(iat 는 초 단위). 새 좌석은 이 호출 뒤 다음 초부터 받는다.
    const nowSec = Math.floor(Date.now() / 1000) + 1
    await DB.prepare(
      `INSERT INTO store_seat_epochs (seller_id, min_valid_iat, reason, updated_at)
       VALUES (?, ?, ?, datetime('now'))
       ON CONFLICT(seller_id) DO UPDATE SET
         min_valid_iat = MAX(store_seat_epochs.min_valid_iat, excluded.min_valid_iat),
         reason = excluded.reason, updated_at = excluded.updated_at`,
    ).bind(sellerId, nowSec, String(reason).slice(0, 60)).run()
  } catch (e) {
    try { console.error('[store-seat] epoch bump failed (fail-soft):', String(e)) } catch { /* noop */ }
  }
  invalidateStoreSeatCache(DB, sellerId)
}

/**
 * (매장, 사람)의 **지금** 역할. 권한 없음 = null. 판단 근거를 못 얻음 = undefined.
 * `canOperateStore` 와 같은 규칙(linked 가 grant 를 이긴다)이지만 **오류를 null 로 삼키지 않는다** —
 * 그걸 삼키면 D1 이 한 번 흔들릴 때 모든 좌석이 '회수됨' 으로 보인다.
 */
export async function liveSeatRole(
  DB: D1Database, sellerId: number, userId: number,
): Promise<OperatorRole | null | undefined> {
  const key = `${sellerId}:${userId}`
  const cache = bucket(_seatCache, DB as unknown as object)
  const hit = cache.get(key)
  if (hit && hit.exp > Date.now()) return hit.v
  try {
    const row = await DB.prepare(
      `SELECT
         (SELECT 1 FROM sellers WHERE id = ? AND linked_user_id = ? LIMIT 1) AS link_owner,
         (SELECT role FROM seller_operators
           WHERE seller_id = ? AND user_id = ? AND revoked_at IS NULL LIMIT 1) AS grant_role`,
    ).bind(sellerId, userId, sellerId, userId).first<{ link_owner: number | null; grant_role: string | null }>()
    const v: OperatorRole | null = row?.link_owner
      ? 'owner'
      : row?.grant_role
        ? (row.grant_role === 'owner' ? 'owner' : 'operator')
        : null
    cache.set(key, { v, exp: Date.now() + CACHE_TTL_MS })
    return v
  } catch {
    return undefined
  }
}

/** 매장의 좌석 에포크(초). 행 없음 = 0. 판단 근거를 못 얻음 = undefined. */
export async function storeSeatEpoch(DB: D1Database, sellerId: number): Promise<number | undefined> {
  const cache = bucket(_epochCache, DB as unknown as object)
  const hit = cache.get(sellerId)
  if (hit && hit.exp > Date.now()) return hit.v
  try {
    await ensureStoreSeatEpochs(DB)
    const row = await DB.prepare('SELECT min_valid_iat FROM store_seat_epochs WHERE seller_id = ? LIMIT 1')
      .bind(sellerId).first<{ min_valid_iat: number }>()
    const v = Number(row?.min_valid_iat) || 0
    cache.set(sellerId, { v, exp: Date.now() + CACHE_TTL_MS })
    return v
  } catch {
    return undefined
  }
}

export type SeatVerdict =
  /** 좌석 토큰이 아니다(셀러 타입 아님·매장 id 없음) — 이 모듈은 관여하지 않는다. */
  | { kind: 'not-seat' }
  /** 살아 있다. `role` = DB 가 말하는 지금 역할(정체성 있는 좌석만), 모르면 null. */
  | { kind: 'live'; sellerId: number; userId: number | null; role: OperatorRole | null }
  /** 끊겼다 — 회수됐거나, 에포크 이전에 발급된 정체성 없는 토큰. */
  | { kind: 'revoked'; sellerId: number; reason: 'seat_revoked' | 'epoch' }
  /** 판단 근거를 못 얻었다(D1 오류). 호출부가 실패 방향을 정한다. */
  | { kind: 'unknown'; sellerId: number; userId: number | null }

/** 🔑 판정의 SSOT — 미들웨어와 소유자 게이트가 같은 함수를 쓴다. */
export async function verifyStoreSeat(DB: D1Database, p: SeatClaims): Promise<SeatVerdict> {
  if (p.type !== 'seller') return { kind: 'not-seat' }
  const sellerId = posInt(p.seller_id) ?? posInt(p.sub)
  if (!sellerId) return { kind: 'not-seat' }

  const userId = seatUserIdOf(p)
  if (userId) {
    const role = await liveSeatRole(DB, sellerId, userId)
    if (role === undefined) return { kind: 'unknown', sellerId, userId }
    if (role === null) return { kind: 'revoked', sellerId, reason: 'seat_revoked' }
    return { kind: 'live', sellerId, userId, role }
  }

  // 정체성 없는 토큰 — 매장 에포크로만 자른다.
  const epoch = await storeSeatEpoch(DB, sellerId)
  if (epoch === undefined) return { kind: 'unknown', sellerId, userId: null }
  const iat = typeof p.iat === 'number' ? p.iat : null
  // iat 없는 레거시 토큰: 에포크가 한 번이라도 올라간 매장이면 자른다(누구 것인지도, 언제 것인지도 모른다).
  if (epoch > 0 && (iat === null || iat < epoch)) return { kind: 'revoked', sellerId, reason: 'epoch' }
  return { kind: 'live', sellerId, userId: null, role: null }
}

/**
 * 토큰이 가리키는 **사람**(users.id) — 좌석 토큰이면 그 좌석이 살아 있을 때만 그 사람,
 * 매장 계정 토큰이면 그 매장의 `linked_user_id`(종전 규칙).
 *
 * 🩸 종전 `resolveActorUserId` 는 좌석 토큰이어도 **무조건 매장 주인의 id** 로 되짚었다.
 *   소비자 쿠키 없이 운영자 좌석 토큰만 보내면 그 운영자가 **주인으로 둔갑**해 운영자를 추가·회수하고,
 *   주인의 다른 매장 좌석까지 발급받을 수 있었다. 토큰이 이미 누구 것인지 말하고 있으면 그걸 쓴다.
 */
export async function resolveTokenActorUserId(
  DB: D1Database, authorization: string | undefined, jwtSecret: string,
): Promise<number | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) return null
  let p: SeatClaims
  try { p = await verify(authorization.substring(7), jwtSecret, 'HS256') as SeatClaims } catch { return null }
  const v = await verifyStoreSeat(DB, p)
  if (v.kind !== 'live') return null
  if (v.userId) return v.userId
  const row = await DB.prepare('SELECT linked_user_id FROM sellers WHERE id = ? LIMIT 1')
    .bind(v.sellerId).first<{ linked_user_id: number | null }>().catch(() => null)
  return posInt(row?.linked_user_id)
}

/**
 * 미들웨어가 건너뛰는 경로 — **소비자 정체성(쿠키)으로 판정하는** 엔드포인트.
 * 회수된 좌석 토큰이 헤더에 붙어 있어도 여기서 401 을 내면 그 사람이 **다른 매장으로 옮겨 가지도,
 * 새 매장을 등록하지도 못한다.** 이 경로들은 토큰 폴백을 `resolveTokenActorUserId` 로 하므로
 * 죽은 좌석 토큰은 거기서 정체성으로 쓰이지 않는다.
 */
const SKIP_EXACT = new Set([
  '/api/seller/login', '/api/seller/refresh', '/api/seller/logout',
  '/api/seller/my-stores', '/api/seller/my-stores/summary', '/api/seller/operating-summary',
  '/api/seller/stores', '/api/seller/stores/verify-business',
])
const SKIP_PATTERN = /^\/api\/seller\/stores\/\d+\/(token|close|channel|profile)$/

export function isStoreSeatGuardSkipped(path: string): boolean {
  return SKIP_EXACT.has(path) || SKIP_PATTERN.test(path)
}

/** JWT 서명 검증 전에 싸게 걸러낸다 — 셀러 토큰이 아니면 HMAC 도 DB 도 안 탄다. */
function peekType(token: string): string | null {
  const part = token.split('.')[1]
  if (!part) return null
  try {
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
    const t = (JSON.parse(json) as { type?: unknown }).type
    return typeof t === 'string' ? t : null
  } catch { return null }
}

export function storeSeatRevokedResponse() {
  return {
    success: false,
    error: '이 매장에 대한 권한이 회수되었거나 바뀌었습니다. 매장을 다시 선택해 주세요.',
    code: STORE_SEAT_REVOKED,
  }
}

/**
 * 🛡️ `/api/*` 전역 — 셀러 Bearer 토큰이 가리키는 좌석이 **지금** 살아 있는지 본다.
 * 셀러 라우트 26곳이 `getSellerIdFromToken`(서명만 보고 DB 를 안 본다)으로 스코프를 잡으므로,
 * 라우트마다 고치는 대신 **입구 하나**에서 끊는다.
 */
export function storeSeatGuard() {
  return async (c: Context, next: Next) => {
    const auth = c.req.header('Authorization')
    if (!auth || !auth.startsWith('Bearer ')) return next()
    const token = auth.substring(7)
    if (peekType(token) !== 'seller') return next()
    if (isStoreSeatGuardSkipped(c.req.path)) return next()
    const env = c.env as { DB?: D1Database; JWT_SECRET?: string }
    if (!env.DB || !env.JWT_SECRET) return next()
    let p: SeatClaims
    try { p = await verify(token, env.JWT_SECRET, 'HS256') as SeatClaims } catch { return next() } // 무효 토큰은 라우트가 거절한다
    const v = await verifyStoreSeat(env.DB, p)
    if (v.kind === 'revoked') return c.json(storeSeatRevokedResponse(), 401)
    return next() // live · unknown(fail-open) · not-seat
  }
}

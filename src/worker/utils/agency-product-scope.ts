/**
 * 🤝 **한 매장 · 여러 에이전시 — 성과는 이용권 단위로 철저히 나눈다** (2026-10-24 대표 확정)
 *
 * 대표: *"사장님 직접 관리와 에이전시 관리가 동시에 되도록 … 성과나 이런건 분리가 철저히 되고.
 *        한 매장이 여러 에이전시와 함께 할 수 있는거지."*
 * 그리고 세 가지를 골랐다: **성과 = 이용권 단위** · **에이전시는 자기 것만 본다** · 수수료는 지금대로.
 *
 * ## 무엇을 하나
 * - 에이전시 좌석으로 만든 이용권에 그 에이전시를 찍는다(`agency_products`). 행이 없으면 사장님 이용권이다.
 * - 에이전시 좌석은 **기본이 차단**이다. 아래 허용목록에 있는 요청만 통과하고, 이용권 하나를 가리키는
 *   요청은 그 이용권이 **그 에이전시 것일 때만** 통과한다(남의 것은 404 — 있다는 사실도 안 알린다).
 *
 * ## 왜 기본 차단인가
 * 셀러 API 는 `/api/seller/*` 아래 수백 개이고, 거의 전부 토큰의 `seller_id` 하나로 **매장 전체**를 연다.
 * 하나씩 "이 에이전시 것만" 으로 고치는 방식은 **하나라도 빠뜨리면 다른 에이전시의 매출이 보인다** —
 * 그리고 그 누락은 에러가 안 난다. 그래서 반대로 간다: 에이전시 몫으로 고친 길만 열어 둔다.
 * 새 화면을 에이전시에게 열려면 **그 API 를 먼저 스코프하고** 여기에 한 줄 더한다.
 *
 * ## 판정은 토큰의 claim 으로 한다(DB 없이)
 * 에이전시 좌석인지는 서명된 claim(`agency_staff_id`)이 말한다. 그래서 D1 이 흔들려도 차단은 그대로다
 * (fail-closed) — 좌석이 살아 있는지는 `verifyStoreSeat` 가 따로 본다.
 *
 * ## ⚠️ 이 모듈이 못 막는 것
 * - 셀러 Bearer 를 안 쓰는 경로(소비자 쿠키 · 에이전시 토큰)는 이 차단 밖이다 — 에이전시 콘솔 API 는
 *   자기 쿼리에서 에이전시 몫으로 센다(`agency-store-today`).
 * - 매장 공용 자리(임시저장 · 매장 정보 · 정산)는 열지 않았다. 열려면 몫을 나누는 설계가 먼저다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { verify } from 'hono/jwt'

export const AGENCY_SCOPE_DENIED = 'AGENCY_SCOPE'

export interface AgencySeat {
  sellerId: number
  agencyId: number
  staffId: number
}

const posInt = (v: unknown): number | null => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 && Math.floor(n) === n ? n : null
}

/** 서명된 claim 이 에이전시 좌석이면 그 세 값. 아니면 null. */
export function agencySeatFromClaims(p: Record<string, unknown> | null | undefined): AgencySeat | null {
  if (!p || p.agency_staff_id == null) return null
  const sellerId = posInt(p.seller_id ?? p.sub)
  const agencyId = posInt(p.agency_id)
  const staffId = posInt(p.agency_staff_id)
  return sellerId && agencyId && staffId ? { sellerId, agencyId, staffId } : null
}

/** Bearer 가 에이전시 좌석이면 그 값(서명 검증 포함). 라우트가 목록을 자기 몫으로 거를 때 쓴다. */
export async function agencySeatOf(authorization: string | undefined, jwtSecret: string): Promise<AgencySeat | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) return null
  try {
    const p = await verify(authorization.substring(7), jwtSecret, 'HS256') as Record<string, unknown>
    if (p.type !== 'seller') return null
    return agencySeatFromClaims(p)
  } catch { return null }
}

// ── 허용목록 ──────────────────────────────────────────────────────────────
/** 이용권 하나에 딸린 화면 — 그 이용권이 이 에이전시 것일 때만. (`copy-to` 는 다른 매장으로 옮기는 일이라 뺐다.) */
const PRODUCT_SUBPATHS = new Set(['group-buy', 'brand-wide', 'resend-store-link', 'options', 'booking-slots'])

const PRODUCT_ONE = /^\/api\/seller\/products\/(\d+)(?:\/([a-z-]+))?$/

/** 매장을 가리키지 않거나 이미 자기 몫인 읽기 — 이용권 등록 화면이 여는 것들. */
const OPEN = new Set([
  'GET /api/seller/products', // 목록 — 라우트가 이 에이전시 이용권만 고른다
  'POST /api/seller/products', // 등록 — 라우트가 이 에이전시를 찍는다
  'GET /api/seller/fee-context', // 수수료 안내(요율 읽기)
  'GET /api/seller/stores/context', // 지금 좌석의 매장 이름·상태
  'POST /api/seller/upload-image', // 이용권 사진 올리기
])

export type AgencyScopeDecision =
  | { allow: true; productId?: number }
  | { allow: false }

/**
 * 에이전시 좌석의 요청을 통과시킬까. **목록에 없으면 차단**이다.
 * productId 가 오면 호출부가 그 이용권이 이 에이전시 것인지 DB 로 확인한다.
 */
export function agencyScopeDecision(method: string, path: string): AgencyScopeDecision {
  const m = method.toUpperCase()
  const p = path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  if (OPEN.has(`${m} ${p}`)) return { allow: true }
  const one = PRODUCT_ONE.exec(p)
  if (one) {
    const productId = Number(one[1])
    const sub = one[2]
    if (!sub) return ['GET', 'PUT', 'DELETE'].includes(m) ? { allow: true, productId } : { allow: false }
    if (PRODUCT_SUBPATHS.has(sub) && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) return { allow: true, productId }
  }
  return { allow: false }
}

export function agencyScopeDeniedResponse() {
  return {
    success: false,
    code: AGENCY_SCOPE_DENIED,
    error: '이 기능은 사장님만 쓸 수 있어요. 에이전시는 자기가 맡은 이용권만 관리해요.',
  }
}

// ── 이용권 귀속 ───────────────────────────────────────────────────────────
/**
 * 이 이용권이 이 에이전시(이 매장) 것인가. 판단 근거를 못 얻음 = undefined(호출부는 차단한다).
 * 테이블이 아직 없으면(에이전시가 한 번도 이용권을 안 만든 DB) 당연히 "아니다".
 */
export async function agencyOwnsProduct(
  DB: D1Database, seat: AgencySeat, productId: number,
): Promise<boolean | undefined> {
  try {
    const row = await DB.prepare(
      'SELECT 1 AS ok FROM agency_products WHERE product_id = ? AND agency_id = ? AND seller_id = ? LIMIT 1',
    ).bind(productId, seat.agencyId, seat.sellerId).first<{ ok: number }>()
    return !!row
  } catch (e) {
    if (/no such table/i.test(String((e as Error)?.message || ''))) return false
    return undefined
  }
}

/**
 * 에이전시 좌석으로 만든 이용권에 그 에이전시를 찍는다. 에이전시 좌석이 아니면 아무것도 안 한다(사장님 이용권).
 * 실패는 삼키지 않고 기록만 한다 — 찍히지 않은 이용권은 사장님 것이 되어 에이전시 목록에서 사라질 뿐,
 * 남에게 보이지는 않는다(안전한 방향으로 실패한다).
 */
export async function stampAgencyProduct(
  DB: D1Database, authorization: string | undefined, jwtSecret: string, productId: number, sellerId: number,
): Promise<void> {
  const seat = await agencySeatOf(authorization, jwtSecret)
  if (!seat || seat.sellerId !== Number(sellerId) || !posInt(productId)) return
  try {
    const { ensureAgencyConsoleTables } = await import('../../features/agency-console/api/agency-schema')
    await ensureAgencyConsoleTables(DB)
    // 지금 맡음 + 맡은 기간 시작을 함께(성과 귀속의 근거 — `channel-sales.ts`).
    const { startAgencyProduct } = await import('../../features/agency-console/api/channel-sales')
    await startAgencyProduct(DB, productId, seat.sellerId, seat.agencyId, seat.staffId)
  } catch (e) {
    try { console.error('[agency-products] stamp failed:', String(e)) } catch { /* noop */ }
  }
}

/** 목록 SQL 조각 — 에이전시 좌석이면 자기 이용권만. `alias` = products 별칭(없으면 ''). */
export function agencyProductFilterSql(alias: string): string {
  const col = alias ? `${alias}.id` : 'id'
  return `AND ${col} IN (SELECT product_id FROM agency_products WHERE agency_id = ? AND seller_id = ?)`
}

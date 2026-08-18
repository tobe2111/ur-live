/**
 * 🏬 소비자 도메인의 **경로 기반 몰 조회** — 세션 ③-a (O2 "몰이 열린다")
 *
 * `urdeal.kr/{슬러그}` 를 몰로 해석하려면 소비자 워커가 몰 행을 읽어야 한다.
 * 그런데 **몰 CRUD 모듈(`features/supply/api/wholesale-malls.ts`)은 소비자 번들에서 DCE 로 빠진다**
 * (`__INCLUDE_WHOLESALE__=false`). 거기서 import 하면 도매 그래프 전체(~200KB gzip)가 되살아난다.
 * ⇒ 여기서는 **테이블만 직접 읽는다.** 같은 파일(`worker/index.ts`)의 host→도매몰 판별이 이미 쓰는 방식이다.
 *
 * ## 🔴 불변식 1 — **예약어는 DB 를 조회하지 않는다**
 * 실제 라우트(`/products`·`/admin`·`/vouchers` …)는 전부 `RESERVED_SLUGS` 에 있고,
 * CI 가 `라우트 ⊆ 예약어` 를 강제한다(`mall-branding.test`). ⇒ **기존 소비자 트래픽은 조회 0**,
 * 핫패스가 byte-불변이다. DB 를 보는 건 *어차피 404 로 가던* 경로뿐이다.
 *
 * ## 🔴 불변식 2 — **경로로 열리는 몰은 명시적으로 표시된 것만** (fail-closed)
 * 도매몰(유통스타트·메디스타트)은 **자기 호스트에 산다.** 그것들이 `urdeal.kr/{슬러그}` 로도 열리면
 * **서비스 분리가 깨진다**(소비자 도메인에 B2B 도매몰 노출).
 * ⇒ `consumer_path = 1` 인 몰만 경로로 연다. **기존 행은 전부 기본값 0** 이라 아무것도 새로 열리지 않는다.
 *
 * > 왜 `host IS NULL` 로 추론하지 않는가: 메디스타트(id=2)는 host 가 NULL 인 **도매몰**이다.
 * >   추론했으면 `urdeal.kr/medi` 로 B2B 몰이 열렸을 것이다. **추론 대신 표시**가 맞다.
 */
import { isMallSlugCandidate, MAIN_MALL } from '@/shared/mall/resolve'

export interface ConsumerMallRow {
  id: number
  slug: string
  name: string
  brand_name?: string | null
  brand_color?: string | null
  logo_url?: string | null
  active?: number | null
  consumer_path?: number | null
}

/**
 * 이 세그먼트가 **DB 를 볼 가치가 있는가**. 예약어·문법 밖이면 false → 조회 자체를 안 한다.
 *
 * 🔴 판정은 **`shared/mall/resolve.ts` 하나뿐이다.** 2026-08-02 까지 여기 같은 정규식·예약어
 *   집합이 한 벌 더 있었는데, 클라(App.tsx)가 몰 표면을 알아야 하게 되면서 **세 벌이 될 뻔했다.**
 *   규칙이 갈리면 워커는 몰로 보고 클라는 아닌 경로가 생기고, 그 경로에서 유어딜 탭바가 몰 위에 뜬다.
 */
export function isMallLookupCandidate(seg: string | null | undefined): boolean {
  return isMallSlugCandidate(seg)
}

/**
 * 조회 결과에서 **경로로 열어도 되는 몰**을 고른다 (순수 — 테스트가 이 판정을 고정한다).
 *
 * fail-closed 3중: 슬러그 일치 · `active=1` · **`consumer_path=1`**.
 * 하나라도 불명이면 `null` → 호출부는 평소대로 SPA 404 를 태운다.
 */
export function pickConsumerMall(rows: readonly ConsumerMallRow[], seg: string): ConsumerMallRow | null {
  if (!isMallLookupCandidate(seg)) return null
  const s = String(seg).trim().toLowerCase()
  for (const r of rows ?? []) {
    if (String(r?.slug ?? '').trim().toLowerCase() !== s) continue
    if (Number(r.active ?? 1) !== 1) return null            // 비활성 몰은 열지 않는다
    if (Number(r.consumer_path ?? 0) !== 1) return null      // 🔴 표시 안 된 몰(=도매몰)은 열지 않는다
    return r
  }
  return null
}

// ── 조회 (isolate 캐시) ────────────────────────────────────────────────────────
// 몰 테이블은 작고(수십 행) 변경이 드물다.
// ⏱️ 2026-08-03: 300초 → **60초**. 5분은 "방금 만든 몰이 왜 404 냐"를 5분간 답할 수 없게 만든다
//   (대표가 실제로 그 구간에 걸렸다). 조회 비용은 무시할 만하다 — `isMallLookupCandidate` 가
//   예약어·문법으로 먼저 걸러 **기존 소비자 경로는 이 함수에 도달조차 안 하고**, 남는 건 몰 주소와
//   오타뿐이다. 그 몇 건이 60초에 한 번 작은 인덱스 조회를 하는 값으로 5분의 혼란을 산다.
//   ⚠️ isolate 마다 캐시가 따로라 "즉시"는 여전히 아니다. 즉시성이 필요해지면 KV/버전 스탬프가 답이다.
let _cache: { rows: ConsumerMallRow[]; at: number } | null = null
const TTL_MS = 60_000

/** 테스트/무효화용. 어드민 몰 변경 후 즉시 반영이 필요하면 호출부에서 쓴다. */
export function resetConsumerMallCache(): void { _cache = null }

async function loadRows(DB: D1Database): Promise<ConsumerMallRow[]> {
  const now = Date.now()
  if (_cache && now - _cache.at < TTL_MS) return _cache.rows
  let rows: ConsumerMallRow[] = []
  try {
    const { results } = await DB.prepare(
      `SELECT id, slug, name, brand_name, brand_color, logo_url,
              COALESCE(active,1) AS active, COALESCE(consumer_path,0) AS consumer_path
         FROM wholesale_malls
        WHERE COALESCE(active,1) = 1 AND COALESCE(consumer_path,0) = 1
        LIMIT 500`
    ).all<ConsumerMallRow>()
    rows = results ?? []
  } catch {
    // 컬럼/테이블 미적용 환경 — 빈 목록(= 아무 몰도 안 열림). **fail-closed 가 기본값**이다.
    rows = []
  }
  _cache = { rows, at: now }
  return rows
}

/**
 * 경로 1st 세그먼트 → 몰. **예약어·문법 밖이면 DB 를 아예 안 본다.**
 * @returns 몰 행 또는 `null`(그대로 SPA 라우팅으로 흘려보낸다)
 */
export async function lookupConsumerMall(DB: D1Database | undefined, seg: string | null | undefined): Promise<ConsumerMallRow | null> {
  if (!DB) return null
  if (!isMallLookupCandidate(seg)) return null   // 🔴 핫패스 조기 탈출 — 기존 라우트는 여기서 끝난다
  const rows = await loadRows(DB)
  return pickConsumerMall(rows, String(seg))
}

/**
 * 🏬 소비자 상품 상세 응답에 **몰 귀속**을 찍는다 (2026-08-11).
 *
 * `mall_id` = "이 손님이 몰 손님인가"(유어딜 영입 CTA 억제 — 대표 UX 기준 ⑤),
 * `mall_slug` = "어느 가게로 되돌릴 것인가"(본진 상세는 공구가를 몰라 상시가를 보여준다).
 *
 * 🔴 값의 출처는 **DB 행 하나뿐**이다. 리터럴 몰 id 를 쓰지 않는다(폴백은 `MAIN_MALL` 상수).
 * ⚠️ 본진 상품은 슬러그 조회 자체를 **안 한다** — 핫패스에 왕복이 붙으면 안 된다.
 * ⚠️ 경로로 못 여는 몰이면 슬러그가 `null` → 되돌리지 않는다(막다른 골목 방지).
 */
export async function stampConsumerMall(
  DB: D1Database | undefined,
  target: Record<string, unknown>,
  rawMallId: number | null | undefined,
): Promise<void> {
  const mid = Number(rawMallId ?? MAIN_MALL) || MAIN_MALL
  target.mall_id = mid
  if (mid !== MAIN_MALL) target.mall_slug = await consumerMallSlugById(DB, mid).catch(() => null)
}

/**
 * 🧾 **주문 목록에 "어느 가게에서 산 것인가" 를 찍는다** — 2026-08-12 (대표 *"완전 별개, 분리"*)
 *
 * 왜 서버가 해야 하는가: 결제 화면까지는 **세션 흔적**(`shared/mall/origin.ts`)으로 가게를 알 수 있지만,
 * 주문 내역은 **지난 주문**이라 흔적이 없다("이번 세션에 몰을 지나갔다"와 "이 주문이 몰 주문이다"는
 * 다른 명제다). 그래서 여기서만은 **서버 데이터**(`products.mall_id`)가 답이다.
 *
 * 🔴 fail-closed 3중은 `pickConsumerMall` 과 동일 — `consumer_path=1` · `active=1` 인 몰만.
 *   도매몰(유통스타트·메디스타트)이 소비자 주문 내역에 가게로 뜨면 서비스 분리가 깨진다.
 *
 * 성능: 주문 N 개에 **쿼리 1회**(IN + GROUP BY). 본진 전용 주문만 있으면 결과 0행이라 표시도 없다.
 * 실패·컬럼 미적용은 조용히 no-op — **주문 목록이 안 뜨는 것보다 가게 이름이 없는 편이 낫다.**
 */
export interface OrderMall { slug: string; name: string }

/**
 * 주문 id 묶음 → 가게. **한 주문에 두 가게 상품이 섞였을 때의 승자를 명시로 정한다.**
 *
 * ⚠️ 처음 구현은 `GROUP BY oi.order_id` 에 몰 컬럼을 그냥 얹었다 — SQLite 는 그때 **임의의 행**을
 *   고르므로 같은 주문이 새로고침마다 다른 가게로 보일 수 있었다(2026-08-12 자체 점검에서 발견).
 *   화면에 "어느 가게에서 샀는지"를 말해 놓고 그 답이 흔들리면 안 믿을 이유가 된다.
 * ⇒ **품목 수가 많은 가게**가 이긴다(동수면 몰 id 가 작은 쪽 — 먼저 열린 가게). 판정을 JS 에서
 *   하므로 SQL 방언(윈도 함수 지원 여부)에 의존하지 않는다.
 */
export interface OrderMallRow { oid: number; mid: number; slug: string; name: string; n: number }

/**
 * 승자 결정 — **순수함수**라 DB 없이 테스트된다(이 레포의 `auditMallSlugs` 와 같은 방침).
 * 규칙: 품목 수 많은 가게 → 동수면 몰 id 작은 쪽. 슬러그·이름이 비면 후보에서 제외한다.
 */
export function pickOrderMall(rows: OrderMallRow[] | null | undefined): Map<number, OrderMall> {
  const best = new Map<number, { mid: number; n: number; row: OrderMall }>()
  for (const r of rows ?? []) {
    const oid = Number(r?.oid)
    const slug = String(r?.slug ?? '').trim()
    const name = String(r?.name ?? '').trim()
    if (!Number.isFinite(oid) || oid <= 0 || !slug || !name) continue
    const cand = { mid: Number(r.mid) || 0, n: Number(r.n) || 0, row: { slug, name } }
    const cur = best.get(oid)
    if (!cur || cand.n > cur.n || (cand.n === cur.n && cand.mid < cur.mid)) best.set(oid, cand)
  }
  return new Map([...best].map(([oid, v]) => [oid, v.row]))
}

async function mallByOrderId(DB: D1Database, ids: number[]): Promise<Map<number, OrderMall>> {
  const ph = ids.map(() => '?').join(',')
  const { results } = await DB.prepare(
    `SELECT oi.order_id AS oid, m.id AS mid, m.slug AS slug,
            COALESCE(NULLIF(TRIM(m.brand_name), ''), m.name) AS name,
            COUNT(*) AS n
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       JOIN wholesale_malls m ON m.id = p.mall_id
      WHERE oi.order_id IN (${ph})
        AND COALESCE(m.consumer_path, 0) = 1 AND COALESCE(m.active, 1) = 1
      GROUP BY oi.order_id, m.id`,
  ).bind(...ids).all<OrderMallRow>()
  return pickOrderMall(results)
}

export async function stampOrdersMall(
  DB: D1Database | undefined,
  orders: Array<Record<string, unknown>> | null | undefined,
): Promise<void> {
  if (!DB || !Array.isArray(orders) || orders.length === 0) return
  const ids = orders.map((o) => Number(o?.id)).filter((n) => Number.isFinite(n) && n > 0)
  if (ids.length === 0) return
  try {
    const byOrder = await mallByOrderId(DB, ids)
    if (byOrder.size === 0) return
    for (const o of orders) {
      const hit = byOrder.get(Number(o?.id))
      if (hit) { o.mall_slug = hit.slug; o.mall_name = hit.name }
    }
  } catch { /* 컬럼/테이블 미적용 — 가게 표시 없이 정상 동작 */ }
}

/**
 * 🧾 **주문번호 → 그 주문의 가게** (2026-08-12) — 결제 완료 화면이 세션 흔적 대신 쓸 **서버 신호**.
 *
 * 세션 흔적(`shared/mall/origin.ts`)은 "이번 세션에 몰을 지나갔다" 만 안다. 새 탭·복귀·오래된 세션엔
 * 흔적이 없고, 반대로 **몰을 구경만 하고 본진 상품을 산 손님에게도 흔적이 남는다.**
 * 이 함수는 **그 주문 자체**를 보므로 양방향 모두 정확하다 — 몰 주문이면 가게를, 아니면 `null` 을 준다.
 *
 * 🔴 **소유자 확인은 호출부의 몫이 아니라 여기 조건**이다(`orders.user_id`) — 주문번호만 알면 남의
 *   주문이 어느 가게 것인지 알 수 있게 두지 않는다.
 * 🔴 fail-closed 는 위와 동일(`consumer_path=1` · `active=1`) — 도매몰은 소비자 화면에 안 뜬다.
 */
export async function mallForOrderNumber(
  DB: D1Database | undefined,
  orderNumber: string,
  userId: number,
): Promise<OrderMall | null> {
  if (!DB || !orderNumber || !Number.isFinite(userId) || userId <= 0) return null
  try {
    const row = await DB.prepare('SELECT id FROM orders WHERE order_number = ? AND user_id = ? LIMIT 1')
      .bind(orderNumber, userId).first<{ id: number }>()
    const oid = Number(row?.id)
    if (!oid) return null
    return (await mallByOrderId(DB, [oid])).get(oid) ?? null
  } catch {
    return null
  }
}

/**
 * 몰 **id → 슬러그** (2026-08-11). 소비자 상품 상세가 "이 상품은 어느 가게 것인가"를 알아야
 * 몰 손님을 그 가게로 돌려보낼 수 있다(`/products/:id` → `/{슬러그}/p/:id`).
 *
 * 🔴 **같은 캐시·같은 fail-closed 규칙을 쓴다.** 여기서 테이블을 따로 조회하면
 *   `active`/`consumer_path` 판정이 두 벌이 되고, 갈리는 순간 "경로로는 안 열리는 몰로
 *   리다이렉트하는" 막다른 골목이 생긴다(그 몰의 상세는 404 이므로 손님이 갇힌다).
 *
 * @returns 경로로 열 수 있는 몰이면 슬러그, 아니면 `null`(= 리다이렉트하지 않음 → 현행 동작)
 */
export async function consumerMallSlugById(DB: D1Database | undefined, mallId: number | null | undefined): Promise<string | null> {
  if (!DB) return null
  const id = Number(mallId)
  if (!Number.isFinite(id) || id < 1) return null
  const rows = await loadRows(DB)   // loadRows 는 이미 active=1 AND consumer_path=1 만 싣는다
  for (const r of rows) if (Number(r.id) === Math.floor(id)) return String(r.slug ?? '').trim().toLowerCase() || null
  return null
}

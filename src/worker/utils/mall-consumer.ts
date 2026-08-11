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
import { isMallSlugCandidate } from '@/shared/mall/resolve'

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

/**
 * 🏠 본진(유어딜) 노출 스코프 — 몰 격리 초크포인트 〔2026-07-29 세션 ②〕
 *
 * 운영자 SaaS 몰이 열리면 **운영자 상품이 유어딜 본진으로 샌다.**
 * 오늘 본진과 도매가 안 섞이는 이유는 `mall_id` 가 아니라 **`is_supply_product`** 인데
 * (불변식 ①), 운영자 몰 상품은 `is_supply_product=0`(소비자 셀러 상품)이라 **그 보호막 밖**이다.
 *
 * 판별자(대표 확정 2026-07-29):
 *   본진 노출 = 기존 ① 조건 **AND `COALESCE(mall_id,1) = 1`**
 *   몰 조회   = `mall_id = :mallId` (신규 운영자 몰은 **id ≥ 3** 보장)
 *
 * ❌ `mall_id IS NULL` 을 판별자로 쓰지 말 것 — `ALTER ... DEFAULT 1` 이라 **기존 행이 전부 1 로 채워졌다.**
 *    NULL 은 사실상 0건이므로 아무것도 안 걸러낸다.
 *
 * 🔴 **sitemap 이 이 스코프의 1순위 소비자다.** 다른 노출 경로(홈·검색·피드)는 배포 한 번으로
 *    되돌아가지만, **색인은 우리 배포와 무관하게 검색엔진 쪽에 남는다** — 회수 시점의 통제권이 없다.
 *    ⇒ 이 가드는 **첫 운영자 몰 개설보다 먼저** 들어가야 한다.
 *
 * ⚠️ 컬럼 부재 내성: `mall_id` 는 `repair-schema` best-effort ALTER 라 미적용 환경이 있을 수 있다.
 *    **컬럼이 없으면 몰 자체가 존재할 수 없으므로**(몰 스탬프 수단이 그 컬럼이다) 조건을 빼도 누수가 0 이다.
 *    ⇒ 부재 시 빈 문자열을 반환하는 것은 "조용한 우회"가 아니라 **구조적으로 안전한 폴백**이다.
 */

/** 유어딜 본진 몰 id. 1=유통스타트(폐기 예정)와 겸용 상태 — `operator-mall-saas-gap.md` §8-C 참조. */
export const MAIN_MALL_ID = 1

/** JOIN 쿼리용 컬럼 참조 — `alias` 를 주면 `s.mall_id` 처럼 한정한다(모호성 방지). */
function col(alias?: string): string {
  return alias ? `${alias}.mall_id` : 'mall_id'
}

/**
 * 본진 노출 WHERE 조각(순수 함수). 호출부는 기존 WHERE 뒤에 그대로 이어붙인다.
 * @param hasMallColumn 대상 테이블에 `mall_id` 가 있는가
 * @param alias JOIN 시 테이블 별칭(예: `'s'`)
 */
export function mainScopeClause(hasMallColumn: boolean, alias?: string): string {
  return hasMallColumn ? ` AND COALESCE(${col(alias)}, ${MAIN_MALL_ID}) = ${MAIN_MALL_ID}` : ''
}

/** 특정 몰 조회 WHERE 조각. 신규 운영자 몰은 id ≥ 3. */
export function mallScopeClause(mallId: number, alias?: string): string {
  const id = Number(mallId)
  if (!Number.isFinite(id) || id < 1) return ` AND 0 = 1` // 잘못된 몰 id → 아무것도 안 보여준다(fail-closed)
  return ` AND COALESCE(${col(alias)}, ${MAIN_MALL_ID}) = ${Math.floor(id)}`
}

// per-isolate 메모이즈 — sitemap 은 크롤러 트래픽이라 PRAGMA 를 매번 돌릴 이유가 없다.
const mallColumnCache = new WeakMap<D1Database, Map<string, Promise<boolean>>>()

/** 테이블에 `mall_id` 컬럼이 있는지(1회 감지 후 캐시). 실패 시 `false`(=조건 생략, 위 주석 참조). */
export function hasMallColumn(DB: D1Database, table: 'products' | 'sellers'): Promise<boolean> {
  let byTable = mallColumnCache.get(DB)
  if (!byTable) { byTable = new Map(); mallColumnCache.set(DB, byTable) }
  const hit = byTable.get(table)
  if (hit) return hit
  const probe = DB.prepare(`PRAGMA table_info('${table}')`)
    .all<{ name: string }>()
    .then((r) => (r.results ?? []).some((c) => c.name === 'mall_id'))
    .catch(() => false)
  byTable.set(table, probe)
  return probe
}

/** 본진 노출 WHERE 조각을 컬럼 존재 여부까지 반영해 만든다. */
export async function mainScopeFor(DB: D1Database, table: 'products' | 'sellers', alias?: string): Promise<string> {
  return mainScopeClause(await hasMallColumn(DB, table), alias)
}

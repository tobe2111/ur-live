/**
 * 🏪 **어드민이 어느 서비스를 보는가** — 스코프 SSOT 〔2026-08-16, 대표 *"모두 다 해줘"*〕
 *
 * 2026-08-14 에 공구 목록·GMV 집계 두 곳만 막았고, 나머지 어드민 화면은 `mall_id` 를 **한 번도
 * 보지 않았다.** 그래서 운영자 가게의 상품과 매출이 **유어딜 어드민 실적으로 계속 섞여** 들어왔다.
 *
 * 그때는 조건 조각(`scope === 'main' ? … : 'mall' ? …`)을 **호출부에 손으로 썼다.** 한 곳이면
 * 괜찮지만 다섯 곳이 되면 반드시 갈라지고, 갈라지면 **한쪽만 샌다** — 이 레포가 소비자/어드민
 * 경로에서 이미 겪은 바로 그 사고다. 그래서 조각 만드는 일을 여기로 모은다.
 *
 * ## 기본값이 `main` 인 이유
 * 어드민 화면은 대부분 **유어딜 운영 화면**이다. 스코프를 안 적었다는 것은 *"전부 보여 달라"* 가
 * 아니라 *"안 정했다"* 이고, 그 상태에서 남의 가게 매출을 유어딜 숫자에 더하는 것은
 * **조용한 오독**이다. 모르면 자기 것만 보여주는 쪽이 안전하다.
 *
 * ## 조건은 파생한다, 짓지 않는다
 * `main` 은 `mainScopeFor`(소비자 경로와 **같은 SSOT**), `mall` 은 **그 여집합**이다.
 * 여집합으로 파생하면 본진 정의가 바뀔 때 둘이 자동으로 같이 움직인다 — 따로 쓰면 갈라진다.
 *
 * ⚠️ 컬럼 부재 환경(`mall_id` 미적용)에서 `mainScopeFor` 는 빈 문자열을 준다. 그러면
 *   `main`=무조건, `mall`=`AND NOT (1=1)`(0건)이 된다. **몰을 스탬프할 수단 자체가 없는 환경**이라
 *   몰이 존재할 수 없고, 따라서 이 폴백은 누수가 아니라 정확하다(`consumer-scope.ts` 주석 참조).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { mainScopeFor } from './consumer-scope'

export type AdminMallScope = 'main' | 'mall' | 'all'

/** `?mall=` 파싱. 모르는 값·빈값·부재는 전부 `main`(fail-safe 기본값 — 위 주석). */
export function parseAdminMallScope(raw: unknown): AdminMallScope {
  const v = String(raw ?? '').trim().toLowerCase()
  return v === 'mall' || v === 'all' ? v : 'main'
}

/**
 * `products` 를 직접 거는 쿼리용 WHERE 조각. 기존 WHERE 뒤에 그대로 이어붙인다.
 * @param alias 테이블 별칭(`'p'`). 별칭 없이 `FROM products` 면 생략.
 */
export async function productScopeSql(
  DB: D1Database,
  scope: AdminMallScope,
  alias?: string,
): Promise<string> {
  if (scope === 'all') return ''
  const main = await mainScopeFor(DB, 'products', alias)
  if (scope === 'main') return main
  // 본진의 여집합. `main` 이 빈 문자열이면 `AND NOT (1=1)` → 0건(위 ⚠️ 참조).
  return ` AND NOT (1=1${main})`
}

/**
 * **주문**을 거는 쿼리용 WHERE 조각 — 주문엔 `mall_id` 가 없으므로 품목의 상품으로 판정한다.
 *
 * 🔴 `EXISTS` 여야 한다. `JOIN order_items` 로 걸면 품목이 여럿인 주문이 **여러 번 세어져**
 *   매출이 부풀고, 그건 스코프를 안 건 것보다 나쁘다(틀린 값을 자신 있게 보여준다).
 *
 * ⚠️ 품목이 하나도 없는 주문은 `main` 에서도 **제외**된다. 정상 주문에는 품목이 있고, 품목이
 *   없는 주문은 어느 서비스 것인지 판정할 근거 자체가 없다 — 유어딜 실적에 넣을 이유가 없다.
 *
 * @param orderAlias 주문 테이블 별칭(`'o'`). 별칭 없이 `FROM orders` 면 `'orders'` 를 넘긴다.
 */
export async function orderScopeSql(
  DB: D1Database,
  scope: AdminMallScope,
  orderAlias: string,
): Promise<string> {
  if (scope === 'all') return ''
  const inner = await productScopeSql(DB, scope, 'sp')
  if (!inner) return ''   // 컬럼 부재 — 몰이 존재할 수 없다(위 ⚠️)
  return ` AND EXISTS (SELECT 1 FROM order_items soi JOIN products sp ON sp.id = soi.product_id
                        WHERE soi.order_id = ${orderAlias}.id${inner})`
}

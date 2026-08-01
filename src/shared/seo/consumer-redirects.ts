/**
 * 🔀 2026-07-29 (소비자 표면 전수 점검): **별칭 경로 → 정본 경로 서버 301**.
 *
 * ## 왜 (라이브 실측)
 * `App.tsx` 에는 `<Navigate>` 로만 존재하는 경로가 여럿 있다 — 사람은 정상 이동하지만
 * **서버는 그 URL 에도 SPA 셸을 `200 + robots: index, follow` 로 내준다.** 즉 크롤러 입장에서는
 * "홈과 똑같은 내용의 색인 가능한 URL" 이 경로 수만큼 존재한다. 실측으로 7개를 확인했다:
 *
 * | 별칭 | 정본 | App.tsx |
 * |---|---|---|
 * | `/group-buy` | `/` | `<Navigate to="/">` |
 * | `/restaurant-map` | `/map` | `<Navigate to="/map">` |
 * | `/terms-of-service` | `/terms` | `<Navigate to="/terms">` |
 * | `/privacy-policy` | `/privacy` | `<Navigate to="/privacy">` |
 * | `/refund-policy` | `/refund` | `<Navigate to="/refund">` |
 * | `/shipping-policy` | `/refund` | `<Navigate to="/refund">` |
 * | `/product/:id` | `/products/:id` | `<ProductRedirect>` |
 *
 * 클라 리다이렉트는 **JS 를 돌리는 방문자에게만** 통한다. 301 은 크롤러에게 "이건 저 URL 이다"를
 * 명시해 신호를 정본으로 합치고, 사람에게는 JS 부팅 한 번을 아낀다.
 *
 * ## 주의
 * - SPA 내부 이동은 이 코드를 **타지 않는다**(서버에 안 간다) → `App.tsx` 의 `<Navigate>` 는
 *   그대로 둔다. 지우면 앱 안에서 그 경로를 눌렀을 때 갈 곳이 없어진다.
 * - **이 표와 `App.tsx` 는 손으로 동기화해야 한다.** 라우트를 바꾸면 여기도 바꿀 것 —
 *   `consumer-redirects.test.ts` 가 App.tsx 를 읽어 대조하므로 어긋나면 빨간불이 뜬다.
 */

/** 정확히 일치하는 별칭 → 정본. */
const ALIAS_EXACT: Readonly<Record<string, string>> = {
  '/group-buy': '/',
  '/restaurant-map': '/map',
  '/terms-of-service': '/terms',
  '/privacy-policy': '/privacy',
  '/refund-policy': '/refund',
  '/shipping-policy': '/refund',
}

/** `/product/:id` → `/products/:id` (단수/복수 두 URL 이 같은 상품을 가리키던 것). */
const PRODUCT_SINGULAR = /^\/product\/([^/]+)\/?$/

/**
 * 별칭이면 정본 경로를, 아니면 `null`.
 *
 * 후행 슬래시(`/terms-of-service/`)도 같은 별칭으로 본다 — 안 그러면 그 변형이 301 을 피해
 * 똑같은 중복 URL 로 남는다.
 */
export function resolveConsumerAlias(pathname: string): string | null {
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const exact = ALIAS_EXACT[p]
  if (exact) return exact
  const m = PRODUCT_SINGULAR.exec(p)
  if (m) {
    // id 는 원문 그대로 넘긴다(이미 URL 인코딩된 상태). 빈 값이면 리다이렉트하지 않는다.
    return m[1] ? `/products/${m[1]}` : null
  }
  return null
}

/** 테스트/문서용 — 별칭 목록(정본 포함). */
export const CONSUMER_ALIASES: Readonly<Record<string, string>> = ALIAS_EXACT

import type { Hono } from 'hono'
import { rateLimit } from '@/worker/middleware/rate-limit'

/**
 * 👁️ **상세 조회수(클릭) 비콘** — 홈 '인기순'의 세 신호 중 클릭 담당 (2026-09-03).
 *
 * 대표 *"리뷰 수, 클릭수, 결제 수로 총합 판정"*. 그 셋 중 **클릭만 실제로는 없었다** —
 * `products.view_count` 컬럼은 있는데 코드 전체에서 이 값을 올리는 곳이 **블로그 글 조회수뿐**이라
 * 이용권 339개가 전부 0 이었다. 그 집계를 여기서 만든다.
 *
 * ## 왜 GET 상세에서 안 세나
 * 상세 응답은 엣지 캐시(120s)라 **적중분은 핸들러에 오지 않는다.** 거기서 세면 "캐시 미스일 때만
 * 세는" 편향된 숫자가 되고, 인기 없는 상품일수록 캐시가 식어 더 많이 세지는 **역방향** 편향이 된다.
 * 그래서 별도 비콘으로 뺐다(블로그 조회수와 같은 방식 — 이 레포에서 이미 도는 패턴).
 *
 * ## 왜 별도 파일인가
 * `products.routes.ts` 가 file-size 래칫에 동결돼 있어 한 줄도 못 늘린다. 끼워 넣는 대신 분리했다.
 *
 * ## 비용과 조작
 * 세션당·상품당 1회(클라 `useProductViewBeacon` 가드) + IP 분당 60회.
 * ⚠️ KV 중복제거는 **일부러 안 쓴다** — 조회마다 KV write 를 하면 KV 쓰기 예산을 먹는다
 * (이 레포는 KV delete 로 한도를 터뜨린 적이 있다). 가드를 무시하는 클라가 숫자를 부풀릴 수 있는데,
 * 대표가 *"조작을 한 리뷰숫자라도 마찬가지"* 로 조작 허용을 확정했으므로 그 리스크는 받아들인다.
 *
 * 인증 불필요(비민감 카운터). 실패는 삼킨다 — 카운터가 상세 화면을 막으면 안 된다.
 */
export function registerProductViewRoutes(app: Hono<{ Bindings: { DB: D1Database } & Record<string, unknown> }>): void {
  app.post('/:id{[0-9]+}/view', rateLimit({ action: 'product_view', max: 60, windowSec: 60 }), async (c) => {
    const id = Number(c.req.param('id'))
    if (!Number.isInteger(id) || id <= 0) return c.json({ success: false }, 400)
    await c.env.DB.prepare(
      'UPDATE products SET view_count = COALESCE(view_count,0) + 1 WHERE id = ? AND is_active = 1',
    ).bind(id).run().catch(() => null)
    return c.json({ success: true })
  })
}

import { createRequestHandler } from 'react-router'
// react-router build 산출물 — wrangler 가 함께 번들.
// @ts-expect-error 빌드 산출물 (타입 선언 없음)
import * as build from '../build/server/index.js'

const handler = createRequestHandler(build)

// 🚀 렌더된 HTML 엣지 캐시 (60s) — SSR 의 약점(TTFB = 데이터 대기) 제거.
//   파일럿은 전부 익명 공개 뷰라 통째 캐시 안전. 적중 시 TTFB ≈ 수십 ms (전 세계 엣지).
//   Phase 2(로그인 개인화)에선 쿠키 있는 요청만 bypass 하는 동일 패턴으로 확장.
export default {
  async fetch(request: Request, env: unknown, ctx: { waitUntil(p: Promise<unknown>): void }) {
    if (request.method !== 'GET') return handler(request, { cloudflare: { env, ctx } })
    const cache = (caches as unknown as { default: Cache }).default
    const hit = await cache.match(request).catch(() => null)
    if (hit) return hit
    const res = await handler(request, { cloudflare: { env, ctx } })
    const ct = res.headers.get('content-type') || ''
    if (res.status === 200 && ct.includes('text/html')) {
      const copy = new Response(res.clone().body, res)
      copy.headers.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120')
      ctx.waitUntil(cache.put(request, copy).catch(() => {}))
    }
    return res
  },
}

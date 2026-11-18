/** 🧬 주입 — KV 지역 복사본 (2026-11-18) · 가드: src/tests/unit/ssr-kv-edge-copy-2026-11-18.test.ts */
const T = 'src/tests/unit/ssr-kv-edge-copy-2026-11-18.test.ts'
const F = 'src/worker/utils/ssr-payload.ts'
export default [
  { name: 'kvcopy: KV 에서 읽어도 복사본을 안 남긴다', file: F,
    find: "        status = 'kv-hit';\n        if (waitUntil) {", replace: "        status = 'kv-hit';\n        if (false && waitUntil) {", test: T,
    why: '홈·숙소가 매번 전역 KV 를 다시 읽어 응답이 들쭉날쭉하다.' },
  { name: 'kvcopy: 복사본을 API 캐시 키에 쓴다', file: F,
    find: "  return new Request(`${origin}${KV_EDGE_COPY_PREFIX}${path}`, { method: 'GET' });", replace: "  return new Request(`${origin}${path}`, { method: 'GET' });", test: T,
    why: 'API 응답 캐시를 SSR 복사본이 덮어써 API 헤더(CDN-Cache-Control 등)가 바뀐다.' },
]

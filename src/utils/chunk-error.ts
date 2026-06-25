/**
 * 🛡️ 청크 로드 실패 감지 (SSOT) — 새 배포 후 옛 HTML 이 참조하는 옛 청크 해시가
 *   404 → SPA HTML(text/html) 폴백 → dynamic import / modulepreload 실패.
 *
 * 브라우저별 메시지 변종을 모두 감지해야 자동 새로고침이 동작함:
 *   - Chrome: "Failed to fetch dynamically imported module: <url>"
 *   - Chrome(MIME): "Failed to load module script: Expected a JavaScript-or-Wasm module
 *                    script but the server responded with a MIME type of text/html."
 *   - Safari: "Importing a module script failed"
 *   - Firefox: "error loading dynamically imported module"
 *   - Vite CSS preload: "Unable to preload CSS for <url>"
 */
export function isChunkLoadError(message: unknown): boolean {
  const m = String(message || '').toLowerCase()
  if (!m) return false
  return (
    m.includes('failed to fetch dynamically imported module') ||
    m.includes('error loading dynamically imported module') ||
    m.includes('importing a module script failed') ||
    m.includes('failed to load module script') ||
    m.includes('expected a javascript-or-wasm module script') ||
    m.includes('responded with a mime type') ||
    m.includes('unable to preload css')
  )
}

/** URL 이 우리 빌드 청크(/assets/*.js)인지 — modulepreload/script 리소스 로드 실패 판별용. */
export function isAppChunkUrl(url: unknown): boolean {
  const u = String(url || '')
  return /\/assets\/[^?#]*\.(?:m?js|css)(?:[?#]|$)/.test(u)
}

/**
 * 🛡️ 2026-06-25 청크-에러 복구 reload (SSOT) — 옛 HTML(옛 청크 해시) 재서빙 방지.
 *
 *   plain `window.location.reload()` 의 함정: bfcache/브라우저 heuristic 캐시/edge 가
 *   "옛 index.html" 을 그대로 돌려주면 → 그 HTML 이 참조하는 옛 청크 해시가 또 404 →
 *   같은 ChunkLoadError 무한 → 가드가 막아 영구 흰화면 / 에러UI 루프 (사용자 신고:
 *   /admin/wholesale-overview 흰화면 + "판매사 승인 클릭해도 페이지 안 넘어감").
 *
 *   해결: `__cb` 캐시버스트 토큰 + `location.replace` → bfcache 무력화 + 항상 새 문서 fetch
 *   (새 빌드의 새 청크 해시 참조). `__cb` 는 main.tsx 부트스트랩이 마운트 후 URL 에서 제거.
 */
export function reloadWithCacheBust(): void {
  try {
    const u = new URL(window.location.href)
    u.searchParams.set('__cb', Date.now().toString(36))
    window.location.replace(u.toString())
  } catch {
    try { window.location.reload() } catch { /* URL/location 차단 환경 — silent */ }
  }
}

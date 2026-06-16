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

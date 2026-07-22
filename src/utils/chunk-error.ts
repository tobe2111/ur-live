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

let _reloadPending = false // 🛡️ 유예 재시도 중 다중 청크에러가 카운트를 소진하지 않게(재진입 가드).

/**
 * 🛡️ 청크 에러 자동복구 — 단일 루프 가드 SSOT.
 *   index.html 인라인 부트가드 + main.tsx window 핸들러 + React ErrorBoundary 가 모두 이 함수를 통해
 *   같은 sessionStorage 키(`__ur_chunk_reload__`)·포맷(`{n,t}`)·윈도(60초 내 2회)를 공유 → 이중 카운트·무한 reload 0.
 *   (인라인 가드는 모듈 로드 전 실행이라 같은 로직을 하드코딩으로 별도 보유 — 키/포맷/윈도만 일치.)
 * @returns true = 캐시버스트 새로고침 트리거함(유예 후 새 문서) / false = 90초 내 3회 초과(=stale 아닌 진짜 에러 → UI 표시)
 *
 * 🛡️ 2026-07-21 (대표 "배포해도 유저 불편"): 재시도 전 짧은 유예(배포 전파 대기) + 90초 3회 관용.
 *   배포 직후 새 청크가 엣지에 안 퍼진 수초 창에서 즉시 reload 하면 또 404 → 연속실패 → 수동 UI.
 *   유예 후 reload 하면 전파 완료 후 통과 → 수동 복구 화면 노출 급감. 무한루프는 3회 캡이 차단.
 *   index.html 인라인 부트가드의 reloadOnce 와 KEY/포맷/윈도(90s·3회)·유예식 동일(SSOT 미러).
 */
export function recoverFromChunkError(): boolean {
  if (_reloadPending) return true // 이미 유예 재시도 예약됨 — 같은 버스트의 추가 청크에러는 무시(카운트 1회만).
  try {
    const KEY = '__ur_chunk_reload__'
    const now = Date.now()
    let st: { n: number; t: number } = { n: 0, t: 0 }
    try { const raw = sessionStorage.getItem(KEY); if (raw) { const p = JSON.parse(raw); if (p && typeof p === 'object') st = p } } catch { /* 옛 포맷 — 리셋 */ }
    const within = now - st.t < 90_000
    if (within && st.n >= 3) return false // 90초 내 3회 — 진짜 에러 → 무한 reload 차단(수동 복구 UI)
    const attempt = within ? st.n + 1 : 1
    sessionStorage.setItem(KEY, JSON.stringify({ n: attempt, t: now }))
    _reloadPending = true
    setTimeout(reloadWithCacheBust, Math.min(700 * attempt, 2500)) // 전파 대기 유예(시도마다 0.7~2.5s)
    return true
  } catch {
    try { window.location.reload(); return true } catch { return false }
  }
}

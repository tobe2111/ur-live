/**
 * Killer Service Worker — 2026-04-27 긴급 롤백
 *
 * 이전 vite-plugin-pwa SW 가 OAuth redirect 차단 → 사이트 ERR_FAILED.
 * 이 SW 가 등록되면 자기 자신을 unregister + 모든 캐시 삭제 후 종료.
 * 사용자는 한 번만 페이지 방문하면 자동 복구.
 *
 * 위치: public/sw.js → 빌드 시 dist/client/sw.js 로 복사됨.
 * (vite-plugin-pwa 비활성화 했으므로 새 sw.js 자동 생성 안 됨.)
 */

self.addEventListener('install', (event) => {
  // 즉시 활성화
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. 모든 캐시 삭제
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) { /* ignore */ }

    // 2. 클라이언트들에게 새로고침 알림 (선택)
    try {
      const clients = await self.clients.matchAll();
      clients.forEach(c => c.navigate(c.url));
    } catch (e) { /* ignore */ }

    // 3. 자기 자신 unregister
    try {
      await self.registration.unregister();
    } catch (e) { /* ignore */ }
  })());
});

// fetch 가로채기 안 함 — 모든 요청 네트워크 직통
// (이전 SW 가 fetch 가로채서 OAuth redirect 막혔던 문제 회피)

/**
 * 🛡️ 2026-05-16: PWA installability 만 충족 + 캐시 완전 제거.
 *
 * 이전 (2026-04-30 v1): cache-first + stale-while-revalidate → 사용자 폰에
 *   old chunk hash 가 캐시 → 새 빌드 배포 후 무한 로딩 / 콘솔 empty 사고.
 *
 * 이번 (v2): fetch 핸들러는 유지하되 캐시 X, 모든 요청 network 그대로 통과.
 *   Chrome 'beforeinstallprompt' 요구사항 (fetch handler 존재) 만 충족.
 *
 * 효과:
 *   - 새 빌드 즉시 반영 (캐시 stale 문제 X)
 *   - PWA 설치 가능성 유지
 *   - 오프라인 캐시 기능은 X (대부분 사용자 unaffected — 외식 voucher 는 매장에서 사용)
 */

const CACHE_NAME = 'ur-pwa-v2'

// install 즉시 활성화
self.addEventListener('install', () => {
  self.skipWaiting()
})

// activate — 이전 모든 캐시 (v1 포함) 완전 삭제
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.map((k) => caches.delete(k)))
    await self.clients.claim()
  })())
})

// fetch — installability 요구사항만 충족, 캐시/가로채기 X
//   모든 요청은 브라우저 기본 (network) 처리
self.addEventListener('fetch', () => {
  // intentionally empty — 모든 요청이 network 로 직접 가도록 함
})

// PWA 설치 후 메시지 채널 (선택)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PING') {
    event.ports[0]?.postMessage({ type: 'PONG', cache: CACHE_NAME })
  }
})

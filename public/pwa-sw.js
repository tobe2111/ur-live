/**
 * 🛡️ 2026-04-30: PWA installability 만 위한 최소 Service Worker.
 *
 * 목적: Chrome / Samsung Internet 등의 'beforeinstallprompt' 이벤트가 fire 되려면
 *   서비스 워커가 '활성' 상태이면서 fetch 핸들러가 있어야 함.
 *   캐싱 전략은 일부러 minimal — 2026-04-27 vite-plugin-pwa 사고 (OAuth redirect 차단)
 *   재발 방지. 모든 OAuth/API 경로는 무조건 network 그대로 전달.
 *
 * 주의:
 *   - public/sw.js 는 killer SW (자기 self-unregister) — 옛 vite-plugin-pwa SW 청소용
 *   - 이 파일 (pwa-sw.js) 는 새로 도입하는 깨끗한 SW
 *   - main.tsx 에서 pwa-sw.js 등록. push-sw.js (push 전용) 와 별도.
 */

const CACHE_NAME = 'ur-pwa-v1'

// 설치 시 — skipWaiting 으로 즉시 활성화
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

// 활성화 시 — 옛 캐시 정리 + 즉시 클라이언트 take-over
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(
      keys.filter((k) => k !== CACHE_NAME && k.startsWith('ur-')).map((k) => caches.delete(k))
    )
    await self.clients.claim()
  })())
})

// fetch 핸들러 — installability 요구사항.
//   ⚠️ 절대 OAuth / API / external URL 가로채지 말 것 (2026-04-27 사고 재발 방지).
//   순수 same-origin GET 만 cache-first 시도, 나머지는 network 그대로 통과.
self.addEventListener('fetch', (event) => {
  const req = event.request

  // 1. method GET 만
  if (req.method !== 'GET') return

  const url = new URL(req.url)

  // 2. same-origin 만
  if (url.origin !== self.location.origin) return

  // 3. denylist — OAuth / API / SW / dynamic
  const path = url.pathname
  const denylist = [
    '/auth/', '/oauth/', '/api/',
    '/sw.js', '/pwa-sw.js', '/push-sw.js',
    '/.well-known/',
    '/_routes', '/_redirects', '/_headers',
  ]
  if (denylist.some((p) => path.startsWith(p))) return

  // 4. 정적 assets (image/css/js/font) 만 cache-first
  const isStatic = /\.(js|css|woff2?|ttf|otf|png|jpe?g|webp|gif|svg|ico|json)$/i.test(path)
  if (!isStatic) return

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // 백그라운드 갱신 (stale-while-revalidate)
        fetch(req).then((res) => {
          if (res.ok) {
            caches.open(CACHE_NAME).then((c) => c.put(req, res.clone()))
          }
        }).catch(() => { /* offline */ })
        return cached
      }
      return fetch(req).then((res) => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE_NAME).then((c) => c.put(req, clone))
        }
        return res
      })
    })
  )
})

// PWA 설치 후 첫 방문 트래킹용 메시지 채널 (선택)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PING') {
    event.ports[0]?.postMessage({ type: 'PONG', cache: CACHE_NAME })
  }
})

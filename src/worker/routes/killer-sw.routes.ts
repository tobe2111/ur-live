// ============================================================
// Killer Service Worker endpoints — 2026-04-27 OAuth redirect 사고 복구
// ============================================================
//
// 배경: vite-plugin-pwa 의 navigateFallback 이 카카오 OAuth redirect 를 가로채
//       ERR_FAILED 사고 발생 (2026-04-27).
//
// /sw.js: Killer SW 응답 — 기존 등록된 SW 의 install/activate 라이프사이클 시
//         자기 자신 unregister + 캐시 전체 삭제 → 다음 접속부터 정상.
// /workbox-:hash.js: 기존 SW 가 import 하는 workbox 청크. 빈 응답으로 차단.
//
// CDN/브라우저 캐시 우회: Cache-Control: no-cache, no-store
// Service-Worker-Allowed: '/' — 루트 scope 등록 허용
//
// 30일 후 (2026-05-27) 이 라우터 제거 — 모든 클라이언트 SW unregister 완료 시점.
//
// 분리 출처: 이전엔 worker/index.ts 인라인 핸들러. TD-006 partial split (2026-04-27).

import { Hono } from 'hono';
import type { Env } from '../types/env';

export const killerSwRoutes = new Hono<{ Bindings: Env }>();

const KILLER_SW = `// 🚨 Killer SW - 2026-04-27 OAuth redirect 차단 사고 복구
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch {}
    try { await self.registration.unregister(); } catch {}
    try {
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(c => c.navigate(c.url));
    } catch {}
  })());
});
// fetch 핸들러 없음 — 모든 요청 네트워크 직통 (OAuth redirect 통과)
`;

killerSwRoutes.get('/sw.js', (_c) => {
  return new Response(KILLER_SW, {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Service-Worker-Allowed': '/',
    },
  });
});

killerSwRoutes.get('/workbox-:hash{[a-zA-Z0-9]+}.js', (_c) => {
  return new Response('// Killer — workbox 의존성 차단', {
    headers: {
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
});

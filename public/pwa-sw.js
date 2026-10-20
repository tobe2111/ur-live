/**
 * Killer Service Worker (pwa-sw.js) — 2026-06-30 전환.
 *
 * 배경(대표 신고 "수차례 회색 빈화면, 시크릿창은 정상"): 2026-04-30 v1 pwa-sw.js 가
 *   cache-first 라 사용자 브라우저에 옛 chunk/index.html 을 캐시 → 새 빌드 후 이 SW 가
 *   stale 을 서빙 → blank #root / 무한로딩 / 콘솔 무에러. 그 SW 가 *이미 설치된* 브라우저는
 *   앱 코드(main.tsx)의 정리 로직이 로드조차 되기 전에 stale 을 받아 닭/달걀로 고착됐다.
 *   (v2 는 non-cache 였으나 여전히 controller 로 남아 잔존 위험 + 레거시 v1 미제거.)
 *
 * 근본 해결: pwa-sw.js 를 **자기 자신 unregister + 전 캐시 삭제 + 클라 새로고침** 하는
 *   killer 로 전환. 브라우저는 네비게이션마다 SW 스크립트 업데이트를 network 로 확인하므로,
 *   stale SW 가 남은 브라우저도 *다음 방문에서 자동으로* 이 killer 를 받아 스스로 제거된다
 *   (수동 캐시삭제 불필요). 이후 SW 는 push-sw.js(알림 전용, fetch 미가로챔)만 남는다.
 *
 * ⚠️ PWA '설치' 프롬프트(beforeinstallprompt)는 fetch 핸들러가 필요하나, 반복된 stale-SW
 *   장애(2026-05-16·06-30) 대비 안정성 우선 — 설치 기능보다 "항상 최신 서빙"을 택한다.
 *   현재 코드는 pwa-sw.js 를 등록하지 않으므로(오직 push-sw.js 만 등록), 이 killer 는
 *   레거시 설치분 정리 전용이다. 참고: sw.js 와 동일 패턴.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 1. 모든 캐시 삭제 (옛 ur-pwa-* stale chunk 캐시 포함)
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) { /* ignore */ }

    // 2. 이 SW 가 제어 중이던 페이지를 새로고침 → SW 제어 해제된 clean 문서 수신(자동복구)
    try {
      const clients = await self.clients.matchAll();
      clients.forEach((c) => c.navigate(c.url));
    } catch (e) { /* ignore */ }

    // 3. 자기 자신 unregister → 이후 이 origin 에 pwa-sw 없음
    try {
      await self.registration.unregister();
    } catch (e) { /* ignore */ }
  })());
});

// fetch 가로채기 안 함 — 모든 요청 네트워크 직통(stale 서빙 원천 차단)

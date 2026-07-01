/**
 * Push-only Service Worker (2026-04-28)
 *
 * 🛡️ 핵심 원칙: fetch 이벤트 가로채기 절대 X.
 *   2026-04-27 사고 (vite-plugin-pwa SW 가 OAuth redirect 가로채 사이트 다운) 의
 *   재발 방지를 위해, 이 SW 는 push / notificationclick 이벤트만 처리한다.
 *
 *   - install:           skipWaiting (즉시 활성)
 *   - activate:          clients.claim (등록 페이지 즉시 제어)
 *   - push:              알림 표시 (tickle 또는 payload)
 *   - notificationclick: URL 열기 / 포커스
 *   - fetch:             ❌ 핸들러 없음 — 모든 요청 네트워크 직통
 *
 * 등록: src/components/PushNotificationSetup.tsx 에서 명시적으로
 *       navigator.serviceWorker.register('/push-sw.js') 호출.
 */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Push 이벤트 — 서버가 VAPID 인증된 POST 를 보낼 때 호출됨.
 *
 * 현재 server (system-push.ts) 는 tickle (empty body) 만 보내므로
 * data 가 없을 때 generic 알림을 표시한다. payload 가 있으면 파싱.
 */
self.addEventListener('push', (event) => {
  let title = '유어딜';
  let body = '새 알림이 도착했어요';
  let url = '/';
  let icon = '/icons/icon-192.png';

  try {
    if (event.data) {
      const data = event.data.json();
      title = data.title || title;
      body = data.body || body;
      url = data.url || data.data?.url || url;
      if (data.icon) icon = data.icon;
    }
  } catch {
    // JSON 아니면 generic 사용
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge: icon,
      tag: 'urdeal-notification',
      data: { url },
      // 같은 tag 면 누적 X (가장 최근 1개만)
      renotify: false,
    })
  );
});

/**
 * 🔔 2026-07-01: pushsubscriptionchange — 브라우저가 구독(endpoint)을 교체/만료시킬 때 호출.
 *   이전엔 핸들러가 없어, 브라우저가 endpoint 를 rotate 하면 서버는 옛 endpoint 로만 알고
 *   410 후 구독행을 지워 사용자가 영구 두절됐음. 여기서 새 구독을 만들어 서버에 재등록한다.
 *   SW 는 localStorage(역할 토큰) 접근 불가 → 세션 쿠키(credentials:'include')로 인증.
 *   소비자(ur_session 쿠키)는 자동 self-heal, 셀러/어드민은 대시보드 재방문 시 클라가 재조정.
 */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil((async () => {
    try {
      let sub = await self.registration.pushManager.getSubscription();
      if (!sub) {
        const opts = event.oldSubscription && event.oldSubscription.options;
        if (opts && opts.applicationServerKey) {
          sub = await self.registration.pushManager.subscribe(opts);
        }
      }
      if (!sub) return;
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(sub.toJSON()),
      });
    } catch {
      // best-effort — 다음 마운트 시 클라이언트가 재조정
    }
  })());
});

/**
 * 알림 클릭 — 해당 URL 새 탭 열기 (또는 기존 탭 포커스).
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    // 같은 URL 이미 열려있으면 포커스
    for (const client of allClients) {
      try {
        const clientUrl = new URL(client.url);
        const targetUrl = new URL(url, self.location.origin);
        if (clientUrl.pathname === targetUrl.pathname) {
          await client.focus();
          return;
        }
      } catch {
        // ignore parse errors
      }
    }
    // 없으면 새 창
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});

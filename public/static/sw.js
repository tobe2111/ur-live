/**
 * Service Worker for Push Notifications
 * 
 * 파일 위치: /public/static/sw.js
 * 등록: navigator.serviceWorker.register('/static/sw.js')
 */

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push received:', event);

  let notificationData = {
    title: 'Notification',
    body: 'You have a new notification.',
    icon: '/static/icon-192x192.png',
    badge: '/static/badge-72x72.png'
  };

  if (event.data) {
    try {
      notificationData = event.data.json();
    } catch (e) {
      notificationData.body = event.data.text();
    }
  }

  const title = notificationData.title;
  const options = {
    body: notificationData.body,
    icon: notificationData.icon || '/static/icon-192x192.png',
    badge: notificationData.badge || '/static/badge-72x72.png',
    data: notificationData.data,
    actions: notificationData.actions || [],
    vibrate: [200, 100, 200],
    tag: notificationData.data?.type || 'default',
    requireInteraction: false
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click:', event);

  event.notification.close();

  const data = event.notification.data;
  let url = '/';

  // 알림 타입별 URL 결정
  if (data) {
    switch (data.type) {
      case 'order':
        url = `/seller/orders/${data.orderNumber}`;
        break;
      case 'live':
        url = `/live/${data.streamId}`;
        break;
      case 'stock':
        url = `/seller/products`;
        break;
      case 'settlement':
        url = `/seller/settlements`;
        break;
      default:
        url = '/';
    }
  }

  // 액션 버튼 처리
  if (event.action) {
    switch (event.action) {
      case 'view':
      case 'watch':
      case 'restock':
        // URL로 이동
        break;
      case 'close':
        // 알림만 닫기
        return;
    }
  }

  // 페이지 열기 또는 포커스
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // 이미 열린 창이 있으면 포커스
        for (let client of clientList) {
          if (client.url.includes(url) && 'focus' in client) {
            return client.focus();
          }
        }
        // 없으면 새 창 열기
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

self.addEventListener('pushsubscriptionchange', function(event) {
  console.log('[Service Worker] Push subscription changed');
  
  event.waitUntil(
    // 구독 갱신 처리
    self.registration.pushManager.subscribe({ userVisibleOnly: true })
      .then(function(subscription) {
        // 서버에 새 구독 정보 전송
        return fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription)
        });
      })
  );
});

// 백그라운드 동기화
self.addEventListener('sync', function(event) {
  if (event.tag === 'sync-notifications') {
    event.waitUntil(syncNotifications());
  }
});

function syncNotifications() {
  return fetch('/api/notifications/unread')
    .then(response => response.json())
    .then(data => {
      // 미확인 알림 표시
      if (data.notifications && data.notifications.length > 0) {
        return self.registration.showNotification('새 알림', {
          body: `${data.notifications.length}개의 새 알림이 있습니다.`,
          icon: '/static/icon-192x192.png',
          badge: '/static/badge-72x72.png'
        });
      }
    });
}

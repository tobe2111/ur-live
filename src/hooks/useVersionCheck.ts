import { useEffect, useState } from 'react';

/**
 * Version Checker Hook - 하이브리드 전략
 * 
 * 전략 1 (스마트 체크):
 * - 사용자 활동 추적 (idle 상태에만 알림)
 * - 페이지 포커스 복귀 시 체크
 * - 체크 주기 30분으로 증가
 * 
 * 전략 4 (서비스 워커):
 * - 백그라운드 업데이트 준비
 * - 즉시 적용 가능한 최신 버전
 * - PWA 준비
 * 
 * 사용자 경험 보호:
 * - 작업 중일 때는 알림 보류
 * - Idle 상태에서만 표시
 * - 닫기 버튼 제공
 */
export function useVersionCheck() {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [showNotification, setShowNotification] = useState(false);
  const [lastActivity, setLastActivity] = useState(Date.now());
  
  const STORAGE_KEY = 'app_version';
  const CHECK_INTERVAL = 30 * 60 * 1000; // ✅ 30분 (기존 5분에서 증가)
  const IDLE_TIME = 10 * 60 * 1000; // ✅ 10분 동안 활동 없으면 idle

  const checkVersion = async () => {
    try {
      // ✅ 사용자 활동 상태 확인
      const isIdle = Date.now() - lastActivity > IDLE_TIME;
      
      // Fetch version with cache-busting
      const response = await fetch(`/version.json?t=${Date.now()}`);
      const data = await response.json() as any;
      const newVersion = data.version;

      // Get stored version
      const currentVersion = localStorage.getItem(STORAGE_KEY);

      // console.log('[VersionCheck] Current:', currentVersion, 'New:', newVersion, 'Idle:', isIdle);

      if (currentVersion && currentVersion !== newVersion) {
        setNeedsUpdate(true);

        // ✅ 사용자가 idle 상태일 때만 알림 표시
        if (isIdle) {
          setShowNotification(true);
        } else {
          // console.log('[VersionCheck] ⏸️ Notification deferred (user is active)');
        }
      } else if (!currentVersion) {
        // First visit - store version
        localStorage.setItem(STORAGE_KEY, newVersion);
      }
    } catch (error) {
      console.error('[VersionCheck] Failed to check version:', error);
    }
  };

  const forceUpdate = () => {
    // Clear all caches
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => caches.delete(name));
      });
    }
    // Update version and reload
    fetch(`/version.json?t=${Date.now()}`)
      .then(res => res.json())
      .then((data: any) => {
        localStorage.setItem(STORAGE_KEY, data.version);
        window.location.reload();
      });
  };

  const dismissNotification = () => {
    setShowNotification(false);

    // ✅ 1시간 후 다시 표시 (사용자가 계속 사용 중이라면)
    setTimeout(() => {
      if (needsUpdate) {
        setShowNotification(true);
      }
    }, 60 * 60 * 1000);
  };

  useEffect(() => {
    // ✅ 사용자 활동 추적 (throttled)
    let activityTimeout: NodeJS.Timeout;
    const updateActivity = () => {
      // Throttle: 1초에 한 번만 업데이트
      if (activityTimeout) return;
      activityTimeout = setTimeout(() => {
        activityTimeout = null as any;
      }, 1000);
      
      setLastActivity(Date.now());
      
      // 활동 중일 때 알림이 떠 있으면 자동으로 숨김
      setShowNotification(prev => {
        if (prev) {
          // console.log('[VersionCheck] 👤 User became active, hiding notification');
          return false;
        }
        return prev;
      });
    };

    // 사용자 활동 이벤트 (passive로 성능 개선)
    window.addEventListener('mousemove', updateActivity, { passive: true });
    window.addEventListener('keydown', updateActivity, { passive: true });
    window.addEventListener('scroll', updateActivity, { passive: true });
    window.addEventListener('click', updateActivity, { passive: true });
    window.addEventListener('touchstart', updateActivity, { passive: true });

    // ✅ 페이지 포커스 복귀 시 체크 (가장 효율적)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // console.log('[VersionCheck] 👁️ Page focused, checking version...');
        checkVersion();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // ✅ 서비스 워커 업데이트 감지 (백그라운드 업데이트)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(registration => {
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // console.log('[ServiceWorker] New version installed in background');
                checkVersion(); // SW가 새 버전 감지 시 체크
              }
            });
          }
        });
      });
    }

    // Initial check
    checkVersion();

    // ✅ 주기적 체크 (30분)
    const interval = setInterval(checkVersion, CHECK_INTERVAL);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('touchstart', updateActivity);
    };
  }, []); // ✅ 의존성 배열 비우기 (한 번만 실행)

  return { 
    needsUpdate, 
    showNotification, 
    forceUpdate, 
    dismissNotification 
  };
}

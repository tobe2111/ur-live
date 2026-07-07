import { useState, useEffect } from 'react';

/**
 * Hook that tracks browser online/offline status.
 * Returns `true` when the browser is online, `false` when offline.
 */
export function useOnlineStatus(): boolean {
  // 🛡️ 2026-07-07 (대표 신고 — 로딩 중 "인터넷 연결이 끊겼습니다" 배너가 잠깐 뜸): SSR/prerender(Node 22)
  //   엔 전역 `navigator` 객체는 있으나 `navigator.onLine` 이 undefined → 기존 `navigator.onLine`
  //   (undefined=falsy)이 **오프라인**으로 판정돼 prerender 된 index.html(#root)에 오프라인 배너가
  //   구워짐 → 모든 페이지 첫 paint 에 잠깐 노출. 명시적 `=== false` 일 때만 오프라인, 그 외(undefined
  //   /알 수 없음 포함)는 온라인으로 간주(실제 브라우저는 온·오프라인 시 boolean 을 정확히 세팅).
  const [isOnline, setIsOnline] = useState<boolean>(
    !(typeof navigator !== 'undefined' && navigator.onLine === false)
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    // 마운트 시 실제 브라우저 값으로 동기화(초기값이 낙관적 online 이므로).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

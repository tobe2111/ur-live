import { useState, useEffect } from 'react';

/**
 * Hook that tracks browser online/offline status.
 * Returns `true` when the browser is online, `false` when offline.
 *
 * 🛡️ 2026-07-07 (대표 신고 — 로딩 중 "인터넷 연결이 끊겼습니다" 배너가 잠깐 뜸): SSR/prerender(Node 22)
 *   엔 전역 `navigator` 객체는 있으나 `navigator.onLine` 이 undefined → 기존 `navigator.onLine`
 *   (undefined=falsy)이 **오프라인**으로 판정돼 prerender 된 index.html(#root)에 오프라인 배너가
 *   구워짐 → 모든 페이지 첫 paint 에 잠깐 노출. 명시적 `=== false` 일 때만 오프라인, 그 외(undefined
 *   /알 수 없음 포함)는 온라인으로 간주.
 *
 * 🛡️ 2026-08-26 (대표 신고 — "와이파이 연결했는데도 문구가 안 없어져"): `navigator.onLine` 과
 *   `online` 이벤트는 **믿을 수 없다.** 인터페이스가 바뀌거나(모바일 데이터↔와이파이), 카카오 인앱
 *   브라우저·일부 WebView 에서는 offline 만 오고 online 이 끝내 안 오는 경우가 있다 → 플래그가 false 로
 *   고착돼 배너가 영영 안 사라진다(새로고침 전까지). 이벤트를 **신호로만** 쓰고 판정은 **실제 요청**으로 한다:
 *     ① offline 이벤트 = "확인해 봐라" 지 "오프라인이다"가 아니다 → 즉시 probe, 성공하면 배너 안 띄움
 *     ② 오프라인으로 판정된 동안 5초 워치독 probe → 복구되면 online 이벤트가 없어도 스스로 사라진다
 *     ③ 탭 복귀(visibilitychange)/focus 시 즉시 재확인 — 사용자가 보는 순간 가장 빨리 걷힌다
 *   probe 는 **오프라인 의심 구간에서만** 돈다(평상시 네트워크 비용 0).
 *   같은 클래스의 선례: keyboard-viewport 의 stuck 방지 워치독(2026-06-22).
 */

/** 연결 확인용 최소 요청 — 응답 코드는 무관하다(도달했다는 사실 자체가 온라인의 증거). */
async function probeConnectivity(timeoutMs = 3000): Promise<boolean> {
  if (typeof fetch === 'undefined') return true; // 판정 불가 → 낙관적 online(배너로 겁주지 않는다)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      await fetch(`/favicon.ico?_ping=${Date.now()}`, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });
      return true;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return false; // 네트워크 도달 실패 = 진짜 오프라인
  }
}

/** 오프라인 판정 후 재확인 주기 — 복구를 몇 초 안에 감지하되 과한 요청은 아니게. */
const RECHECK_MS = 5000;

export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    !(typeof navigator !== 'undefined' && navigator.onLine === false)
  );

  // ① 이벤트는 "확인 신호" — 실제 판정은 probe 가 한다.
  useEffect(() => {
    let alive = true;

    const verify = async () => {
      const ok = await probeConnectivity();
      if (alive) setIsOnline(ok);
    };

    // online 이벤트: 즉시 낙관적 복구(배너부터 걷어내고), probe 는 워치독이 이어서 확인.
    const handleOnline = () => { if (alive) setIsOnline(true); };
    // offline 이벤트: 곧바로 믿지 않는다 — 확인 후에만 배너.
    const handleOffline = () => { void verify(); };
    const handleVisible = () => { if (!document.hidden) void verify(); };

    // 마운트 시 실제 브라우저 값으로 동기화(초기값이 낙관적 online 이므로).
    if (typeof navigator !== 'undefined' && navigator.onLine === false) void verify();

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('focus', handleVisible);

    return () => {
      alive = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('focus', handleVisible);
    };
  }, []);

  // ② 워치독 — 오프라인으로 판정된 동안에만 재확인. online 이벤트가 끝내 안 와도 스스로 복구된다.
  useEffect(() => {
    if (isOnline) return; // 평상시엔 아무 요청도 하지 않는다
    let alive = true;
    const timer = setInterval(async () => {
      const ok = await probeConnectivity();
      if (alive && ok) setIsOnline(true);
    }, RECHECK_MS);
    return () => { alive = false; clearInterval(timer); };
  }, [isOnline]);

  return isOnline;
}

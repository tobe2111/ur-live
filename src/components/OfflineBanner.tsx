import { useConnectionState } from '../hooks/useOnlineStatus';

/**
 * 연결 상태 띠. 🛡️ 2026-11-12 (대표 신고 — 와이파이는 되는데 "인터넷 연결이 끊겼습니다"):
 *   브라우저도 오프라인일 때만 "끊겼어요", 와이파이는 되는데 우리 서버가 연속으로 늦으면 "원활하지 않아요".
 *   판정 규칙은 `hooks/useOnlineStatus.ts`.
 */
export const CONNECTION_COPY = {
  offline: '인터넷 연결이 끊겼어요',
  unstable: '연결이 원활하지 않아요 · 다시 시도하고 있어요',
} as const

export default function OfflineBanner() {
  const state = useConnectionState();
  if (state === 'ok') return null;
  return (
    <div role="status" className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-center py-2 px-4 text-[15px] font-medium shadow-lg">
      {CONNECTION_COPY[state]}
    </div>
  );
}

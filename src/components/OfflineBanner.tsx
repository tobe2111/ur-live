import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Fixed top banner that appears when the browser loses internet connection.
 * Uses amber/yellow background for visibility without being alarming.
 */
export default function OfflineBanner() {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-white text-center py-2 px-4 text-sm font-medium shadow-lg">
      인터넷 연결이 끊겼습니다
    </div>
  );
}

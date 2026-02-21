import { useVersionCheck } from '@/hooks/useVersionCheck';

/**
 * Update Notification Banner
 * Shows when new version is available and prompts user to refresh
 */
export function UpdateNotification() {
  const { needsUpdate, forceUpdate } = useVersionCheck();

  if (!needsUpdate) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <p className="font-semibold text-lg">새로운 버전이 출시되었습니다!</p>
              <p className="text-sm opacity-90">최신 기능과 개선사항을 사용하려면 새로고침해주세요.</p>
            </div>
          </div>
          <button
            onClick={forceUpdate}
            className="px-6 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl active:scale-95"
          >
            지금 새로고침
          </button>
        </div>
      </div>
    </div>
  );
}

import { useVersionCheck } from '@/hooks/useVersionCheck';

/**
 * Update Notification Banner - 개선 버전
 * 
 * 개선사항:
 * - showNotification 플래그로 표시 제어
 * - 닫기 버튼 추가
 * - 사용자가 idle 상태일 때만 표시
 * - 1시간 후 재표시
 */
export function UpdateNotification() {
  const { needsUpdate, showNotification, forceUpdate, dismissNotification } = useVersionCheck();

  // ✅ needsUpdate && showNotification 조건
  if (!needsUpdate || !showNotification) return null;

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] z-[9999] bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-2xl animate-slide-up">
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
          <div className="flex items-center gap-2">
            {/* ✅ 닫기 버튼 추가 */}
            <button
              onClick={dismissNotification}
              className="px-4 py-2 text-white/90 hover:text-white border border-white/30 rounded-lg hover:bg-white/10 transition-colors font-medium"
              title="나중에 알림 (1시간 후 재표시)"
            >
              나중에
            </button>
            <button
              onClick={forceUpdate}
              className="px-6 py-3 bg-white text-blue-600 font-bold rounded-lg hover:bg-gray-100 transition-all shadow-lg hover:shadow-xl active:scale-95"
            >
              지금 새로고침
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

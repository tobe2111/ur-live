/**
 * 🧭 2026-07-02 (대표 신고 "공구 상세 로딩 애니메이션이 2번 끊겨서 보임" — 06-30 링크샵 수리와 동일 클래스):
 *   `/group-buy/:id` 도달 시 [① PageLoader(로고+스윕바, 청크 Suspense) → ② 페이지 자체 스켈레톤 → ③ 본문]
 *   으로 **서로 다른 두 로딩 비주얼이 교체**되며 끊긴 느낌. 해결: 스켈레톤을 이 파일로 추출해
 *   ①(App.tsx PageLoader 의 공구상세 분기)과 ②(GroupBuyDetailPage `if (loading)`)가 **동일 비주얼**을
 *   쓰게 함 → 청크 로딩~데이터 로딩이 한 장의 스켈레톤으로 이어지고 본문만 채워짐(점프 0).
 *
 * JSX 는 GroupBuyDetailPage 기존 skeleton(2026-05-15 "대기업 수준 skeleton — CLS 0")과 byte-동일.
 */
export default function GroupBuyDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
      {/* 🏭 2026-06-07: 투명 overlay 헤더 — solid 흰 바 깜빡임 없이 이미지가 최상단까지. */}
      <div
        className="fixed top-0 inset-x-0 z-30 px-3 flex items-center justify-between lg:inset-x-auto lg:left-1/2 lg:-translate-x-1/2 lg:w-full lg:max-w-[var(--app-frame)]"
        style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top))', paddingBottom: '0.625rem' }}
      >
        <div className="w-9 h-9 rounded-full bg-black/25 backdrop-blur-sm animate-pulse" />
        <div className="w-9 h-9 rounded-full bg-black/25 backdrop-blur-sm animate-pulse" />
      </div>
      <div className="ur-content-narrow mx-auto">
        <div className="w-full aspect-square bg-gradient-to-br from-gray-100 to-gray-200 dark:from-[#1A1A1A] dark:to-[#0A0A0A] animate-pulse" />
      </div>
      <div className="ur-content-narrow mx-auto px-4 lg:px-8 py-4 space-y-4">
        <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-5 border border-gray-100 dark:border-[#1A1A1A] space-y-3">
          <div className="h-6 w-3/4 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-1/2 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
          <div className="h-4 w-1/3 bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
          <div className="pt-3 border-t border-gray-100 dark:border-[#1A1A1A]">
            <div className="h-8 w-32 bg-gray-200 dark:bg-[#1A1A1A] rounded animate-pulse" />
          </div>
        </div>
        <div className="bg-white dark:bg-[#0A0A0A] rounded-2xl p-5 border border-gray-100 dark:border-[#1A1A1A] space-y-3">
          <div className="flex items-center justify-between">
            <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
            <div className="h-6 w-16 bg-gray-200 dark:bg-[#1A1A1A] rounded animate-pulse" />
          </div>
          <div className="h-3 w-full bg-gray-100 dark:bg-[#1A1A1A] rounded animate-pulse" />
        </div>
      </div>
    </div>
  )
}

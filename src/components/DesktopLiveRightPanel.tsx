/**
 * 🛡️ 2026-05-02: PC 라이브 페이지 우측 영역 (셀러 정보 + 안내).
 *
 * 적용 범위:
 *   - MobileAppLayout 의 data-mobile-only 페이지 (라이브 9:16 풀스크린)
 *   - 2xl (1536px+) 에서만 표시 — 좌측 사이드바 224px + 가운데 430px + 우측 280px
 *     이 모두 들어갈 viewport 폭이 ≥1536px 일 때만 노출
 *   - mobile/tablet/lg/xl 에서는 hidden
 *
 * 디자인:
 *   - position: fixed, 화면 우측 점령 (280px 폭)
 *   - 9:16 컨테이너 (430px 가운데 정렬) 와 충돌 없음
 *   - 안내 카드 (현재는 정적): "라이브에서 만나보세요" + 바로가기 링크
 */
import { Link } from 'react-router-dom'
import { ShoppingBag, Sparkles, MapPin } from 'lucide-react'

export default function DesktopLiveRightPanel() {
  return (
    <aside
      className="hidden 2xl:flex fixed right-0 top-0 bottom-0 w-72 z-40 flex-col py-6 px-4 bg-white dark:bg-[#020202] border-l border-white/[0.06] overflow-y-auto"
      aria-label="PC 라이브 안내 패널"
    >
      <h2 className="text-[14px] font-bold text-gray-900 dark:text-white/85 mb-4">라이브에서 만나는 다른 즐길거리</h2>

      <div className="flex flex-col gap-3">
        <Link
          to="/browse"
          className="flex items-center gap-3 p-4 rounded-xl bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-500/[0.15] text-pink-300 shrink-0">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">오늘의 핫딜</p>
            <p className="text-[11px] text-gray-900 dark:text-white/55 mt-0.5 line-clamp-1">
              매일 바뀌는 초특가 상품 모음
            </p>
          </div>
        </Link>

        <Link
          to="/restaurant-map"
          className="flex items-center gap-3 p-4 rounded-xl bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/[0.15] text-amber-300 shrink-0">
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">맛집 지도</p>
            <p className="text-[11px] text-gray-900 dark:text-white/55 mt-0.5 line-clamp-1">
              내 주변 인기 식사권 + 공동구매
            </p>
          </div>
        </Link>

        <Link
          to="/referral"
          className="flex items-center gap-3 p-4 rounded-xl bg-gray-100 dark:bg-white/[0.04] hover:bg-gray-200 dark:hover:bg-white/[0.08] transition-colors"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500/[0.15] text-purple-300 shrink-0">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-gray-900 dark:text-white">친구 초대 공동구매</p>
            <p className="text-[11px] text-gray-900 dark:text-white/55 mt-0.5 line-clamp-1">
              초대할수록 더 큰 할인
            </p>
          </div>
        </Link>
      </div>

      <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-pink-500/[0.12] via-purple-500/[0.08] to-transparent border border-pink-500/15">
        <p className="text-[12px] font-bold text-pink-300 mb-1">팔로우 알림 받기</p>
        <p className="text-[11px] text-gray-900 dark:text-white/65 leading-relaxed">
          좋아하는 셀러를 팔로우하면 라이브 시작 시 알림을 받을 수 있어요.
        </p>
      </div>

      <p className="text-[10px] text-gray-900 dark:text-white/30 mt-auto pt-6">
        © 2026 UR·DEAL · 라이브 커머스
      </p>
    </aside>
  )
}

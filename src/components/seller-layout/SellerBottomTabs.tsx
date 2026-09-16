/**
 * 📱 **셀러 하단 탭 — 다섯 대분류** (2026-09-14 대표 승인 "그대로 모두 진행").
 *   폰에서 메뉴 14개가 햄버거 뒤에 숨어 있던 것을 소비자 앱과 같은 문법(하단 탭 5개)으로.
 *   활성 = 면 아이콘 + 잉크 라벨 + 브랜드 점(소비자 `BottomNav` 와 같은 장치) — 셀러가 소비자 화면에서
 *   이미 배운 그림이라 새로 배울 게 없다. 목록은 `useSellerNavModel().primary`(SSOT) — 여기서 따로 적지 않는다.
 *
 *   md(768px)+ 에서는 사이드바가 같은 다섯을 세로로 그리므로 숨긴다(`md:hidden`).
 *   z-index 는 소비자 하단 네비와 같은 층(`Z.NAVIGATION_BOTTOM`) — 모달(10500)·시트(10600)가 위에 온다.
 */
import { Link } from 'react-router-dom'
import { useSellerNavModel } from './useSellerNavModel'

/** 탭 바 본체 높이(safe-area 제외). 레이아웃의 본문 하단 여백·고정 CTA 오프셋이 이 값을 공유한다. */
export const SELLER_TABBAR_H = 60

export default function SellerBottomTabs({ pendingOrders = 0 }: { pendingOrders?: number }) {
  const { primary } = useSellerNavModel()
  return (
    <nav
      aria-label="셀러 대시보드 탭"
      className="fixed inset-x-0 bottom-0 z-[9999] border-t border-rule bg-white md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="flex" style={{ height: SELLER_TABBAR_H }}>
        {primary.map(({ key, path, label, icon: Icon, active }) => (
          <Link
            key={key}
            to={path}
            aria-current={active ? 'page' : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-[11px] leading-none ${active ? 'font-extrabold text-gray-900' : 'font-semibold text-gray-400'}`}
          >
            <span className="relative">
              <Icon size={24} filled={active} className={active ? 'text-gray-900' : 'text-gray-400'} />
              {key === 'orders' && pendingOrders > 0 && (
                <span className="absolute -right-2.5 -top-1.5 min-w-[18px] rounded-full bg-brand px-1 text-center text-[10px] font-extrabold leading-[18px] text-white">
                  {pendingOrders > 99 ? '99+' : pendingOrders}
                </span>
              )}
            </span>
            <span>{label}</span>
            {active && <span aria-hidden className="absolute bottom-1.5 h-1 w-1 rounded-full bg-brand" />}
          </Link>
        ))}
      </div>
    </nav>
  )
}

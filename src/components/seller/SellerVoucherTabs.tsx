import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

/**
 * 🎟️ **이용권 한 페이지** — 2026-09-03 대표 *"이용권 관련한 통합으로 한 페이지에 담기면 좋지 않을까?"*
 *
 * 이용권 하나를 운영하는 데 필요한 일이 세 화면에 흩어져 있었다(목록 / 사용처리 / 후기 인증).
 * nav 항목을 네 개로 늘리면 사이드바만 복잡해지고 **여전히 "이용권 페이지"는 없다.**
 * 그래서 상품 관리(`SellerProductTabs`, 2026-06-09)와 같은 방식을 쓴다 —
 * **nav 는 '이용권 관리' 하나, 페이지 안에서 탭 이동.** 라우트는 그대로라 딥링크·북마크가 안 깨진다.
 *
 * 🔴 `/seller/voucher-orders` 는 **여기 들어오지 않는다** — 이름이 비슷해서 처음에 넣었다가 되돌렸다.
 *   그건 **KT 교환권(기프티콘) 발송 이력**이고, 교환권 ≠ 이용권이다(CLAUDE.md 명칭 SSOT).
 *   이용권이 팔린 내역은 주문(`/seller/orders`), 발급·사용 현황은 이 그룹의 이용권 탭에 이미 있다.
 *
 * ⚠️ 탭을 늘릴 때는 nav 의 `also` 에도 같은 경로를 넣어야 한다(안 넣으면 그 탭에 있는 동안
 *   사이드바에서 '이용권 관리'가 꺼져 길을 잃는다). 그 쌍은 테스트가 지킨다.
 */
export const VOUCHER_TAB_PATHS = [
  '/seller/group-buy',
  '/seller/scan',
  '/seller/review-verifications',
] as const

const TABS = [
  { path: '/seller/group-buy', key: 'seller.voucherTabs.list', fallback: '이용권' },
  { path: '/seller/scan', key: 'seller.voucherTabs.scan', fallback: '사용처리' },
  { path: '/seller/review-verifications', key: 'seller.voucherTabs.reviews', fallback: '후기 인증' },
] as const

export default function SellerVoucherTabs() {
  const { pathname } = useLocation()
  const { t } = useTranslation()
  return (
    <div className="flex gap-1 p-1 bg-gray-100 rounded-xl w-fit max-w-full overflow-x-auto">
      {TABS.map(({ path, key, fallback }) => {
        const active = pathname === path || pathname.startsWith(path + '/')
        return (
          <Link
            key={path}
            to={path}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
              active ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t(key, { defaultValue: fallback })}
          </Link>
        )
      })}
    </div>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * 🆕 2026-06-26 유어애즈(UR Ads) — 유어팀의 종합 마케팅 툴(3번째 서비스). 유어딜/도매몰과 분리된 자체 chrome.
 *   도매몰의 surface 분리 패턴을 그대로 따름(worker isMarketingSurface, 경로 /ads).
 *   네이버 검색광고 자동입찰 + 쇼핑몰 발주수집 + 키워드 도구.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#0A0A0A]">
      <header className="sticky top-0 z-30 bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-[#2A2A2A]">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/ads/dashboard" className="text-[15px] font-extrabold text-gray-900 dark:text-white">
            유어애즈 <span className="text-gray-400 dark:text-gray-500 font-medium text-[12px]">UR Ads</span>
          </Link>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">유어팀 종합 마케팅</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 min-h-0">{children}</main>
    </div>
  )
}

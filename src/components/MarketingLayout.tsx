import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * 🆕 2026-06-26 통합 마케팅 서비스(가칭) 레이아웃 — 유어딜/도매몰과 분리된 자체 chrome.
 *   도매몰의 surface 분리 패턴을 그대로 따름(worker isMarketingSurface). 브랜드명은 placeholder('마케팅')
 *   이라 확정 시 일괄 치환. 현재는 골격(헤더 + 콘텐츠).
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#0A0A0A]">
      <header className="sticky top-0 z-30 bg-white dark:bg-[#121212] border-b border-gray-200 dark:border-[#2A2A2A]">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/ads" className="text-[15px] font-extrabold text-gray-900 dark:text-white">
            마케팅 <span className="text-gray-400 dark:text-gray-500 font-medium">(가칭)</span>
          </Link>
          <span className="text-[11px] text-gray-400 dark:text-gray-500">유어딜 통합 마케팅</span>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 min-h-0">{children}</main>
    </div>
  )
}

import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import UrAdsLogo from '@/components/brand/UrAdsLogo'

/**
 * 🆕 2026-06-26 유어애즈(UR Ads) — 유어팀의 종합 마케팅 툴(3번째 서비스). 유어딜/도매몰과 분리된 자체 chrome.
 *   도매몰의 surface 분리 패턴을 그대로 따름(worker isMarketingSurface, 경로 /ads).
 *   네이버 검색광고 자동입찰 + 쇼핑몰 발주수집 + 키워드 도구 + AI 마케터/주간리포트.
 *   🆕 2026-06-27 브랜드 chrome — UrAdsLogo(스파크) 헤더 + 그라데이션 액센트 + 랜딩 링크.
 */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-gray-50 dark:bg-[#0A0A0A]">
      <header className="sticky top-0 z-30 bg-white/90 dark:bg-[#121212]/95 backdrop-blur border-b border-gray-200 dark:border-[#2A2A2A]">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <Link to="/ads" aria-label="유어애즈 홈" className="text-gray-900 dark:text-white">
            <UrAdsLogo size={24} />
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/ads" className="text-[12px] font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">랜딩</Link>
            <span className="text-[11px] font-semibold text-gray-400 dark:text-gray-500">대시보드</span>
          </div>
        </div>
        {/* 브랜드 그라데이션 액센트 라인(코스믹 네이비) */}
        <div className="h-[2px] w-full" style={{ background: 'linear-gradient(96deg,#3B6EF5,#8B5CF6,#EC4899)' }} />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 min-h-0">{children}</main>
    </div>
  )
}

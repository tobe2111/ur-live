import MarketingLayout from '@/components/MarketingLayout'
import SEO from '@/components/SEO'

/**
 * 🆕 2026-06-26 통합 마케팅 서비스(가칭) 대시보드 — 골격 placeholder.
 *   유어딜/도매몰처럼 /ads surface 로 분리. 기능(자동입찰/발주수집/키워드)은 단계적으로 추가.
 */
const FEATURES = [
  { icon: '🎯', title: '네이버 검색광고 자동입찰', desc: '목표순위·최대입찰가만 설정 → 최저 CPC 자동 탐색. 쇼핑검색광고 포함.' },
  { icon: '📦', title: '쇼핑몰 발주수집', desc: '스마트스토어(네이버 커머스 API) 주문 자동수집·발송처리.' },
  { icon: '🔑', title: '키워드 도구', desc: '상품별 고매출 키워드 추천 · 제외키워드 관리.' },
]

export default function MarketingDashboardPage() {
  return (
    <MarketingLayout>
      <SEO title="마케팅 - 유어딜" description="네이버 검색광고 자동입찰 + 쇼핑몰 발주수집 통합 마케팅 서비스" url="/ads" />
      <h1 className="text-[22px] font-extrabold text-gray-900 dark:text-white">
        통합 마케팅 <span className="text-gray-400 dark:text-gray-500 text-[15px] font-medium">준비 중</span>
      </h1>
      <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400">
        유어딜·도매몰에 이은 3번째 서비스. 아래 기능을 단계적으로 출시합니다.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-2xl border border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#121212] p-4">
            <div className="text-2xl">{f.icon}</div>
            <div className="mt-2 text-[14px] font-bold text-gray-900 dark:text-white">{f.title}</div>
            <div className="mt-1 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed">{f.desc}</div>
            <div className="mt-3 inline-block text-[11px] font-bold text-amber-600 dark:text-amber-400">준비 중</div>
          </div>
        ))}
      </div>
    </MarketingLayout>
  )
}

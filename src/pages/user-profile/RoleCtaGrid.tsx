/**
 * 🛡️ 2026-05-21 v4: 마이페이지 역할 진입 CTA — 영구 디자인.
 *
 * v4 (2026-05-21): 보유한 role 의 "대시보드 바로가기" 단축 카드 추가.
 *   - 셀러 토큰 있으면: 📊 셀러 대시보드 → /seller
 *   - 에이전시 토큰 있으면: 📊 에이전시 대시보드 → /agency
 *   - 둘 다 있는 사용자도 양쪽 진입 가능 (셀러+에이전시 겸업).
 *
 * v3 영구 디자인:
 *   - 단일 화이트 카드 컨테이너 안에 list 형식 (당근 마이페이지 "내 메뉴" 패턴).
 *   - 각 항목: emoji + 제목 + 설명 + ›
 *   - 깔끔한 divider, 색은 emoji 자체 색만 사용 (시각 노이즈 zero).
 *   - 로그인 상태로 자동 필터.
 */

import { Link } from 'react-router-dom'
import { useMemo } from 'react'
import { ChevronRight } from 'lucide-react'

interface Cta {
  icon: string
  title: string
  desc: string
  to: string
  show: () => boolean
  accent?: boolean // 보유 role 의 대시보드 단축 — 시각적 강조
}

export default function RoleCtaGrid() {
  const { dashboardItems, signupItems } = useMemo(() => {
    const hasSellerToken = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
    const hasAgencyToken = typeof window !== 'undefined' && !!localStorage.getItem('agency_token')
    // 보유한 role 의 대시보드 단축 (위로 강조)
    const dash: Cta[] = [
      { icon: '📊', title: '셀러 대시보드',   desc: '내 상품·라이브·정산 관리', to: '/seller',  show: () => hasSellerToken,  accent: true },
      { icon: '📊', title: '에이전시 대시보드', desc: '소속 셀러·소개 가게 commission', to: '/agency', show: () => hasAgencyToken, accent: true },
    ]
    // 신규 가입 CTA (보유 안 한 role 만)
    const signup: Cta[] = [
      { icon: '🤝', title: '공구 개최', desc: '친구와 같이 모이면 더 싸게', to: '/referral', show: () => true },
      { icon: '🏪', title: '사장님 입점', desc: '내 가게 공구권 발행하기',     to: '/seller/register/supplier', show: () => !hasSellerToken },
      { icon: '📺', title: '라이브 셀러', desc: '라이브 방송으로 판매 시작',   to: '/seller/register/business', show: () => !hasSellerToken },
      { icon: '🤵', title: '에이전시 사업', desc: '가게 영업 → 2% 영구 수익',  to: '/agency/register/business', show: () => !hasAgencyToken },
    ]
    return {
      dashboardItems: dash.filter(c => c.show()),
      signupItems: signup.filter(c => c.show()),
    }
  }, [])

  if (dashboardItems.length === 0 && signupItems.length === 0) return null

  const Row = (c: Cta, i: number, total: number) => (
    <Link
      key={c.to}
      to={c.to}
      className={`flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 dark:active:bg-[#1A1A1A] transition-colors min-w-0 ${
        i > 0 ? 'border-t border-gray-50 dark:border-[#1A1A1A]' : ''
      } ${total > 0 ? '' : ''}`}
    >
      <span className="text-xl shrink-0" aria-hidden="true">{c.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-[13px] font-bold truncate ${c.accent ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>
          {c.title}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
          {c.desc}
        </p>
      </div>
      <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
    </Link>
  )

  return (
    <section className="w-full min-w-0 space-y-4">
      {dashboardItems.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-gray-600 dark:text-gray-400 mb-2 px-1">
            내 역할 바로가기
          </p>
          <div className="rounded-2xl bg-blue-50/40 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 overflow-hidden">
            {dashboardItems.map((c, i) => Row(c, i, dashboardItems.length))}
          </div>
        </div>
      )}
      {signupItems.length > 0 && (
        <div>
          <p className="text-[12px] font-bold text-gray-600 dark:text-gray-400 mb-2 px-1">
            추가 역할로 시작하기
          </p>
          <div className="rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#1A1A1A] overflow-hidden">
            {signupItems.map((c, i) => Row(c, i, signupItems.length))}
          </div>
        </div>
      )}
    </section>
  )
}

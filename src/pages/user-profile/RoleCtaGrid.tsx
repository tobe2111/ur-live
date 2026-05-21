/**
 * 🛡️ 2026-05-21 v3: 마이페이지 역할 진입 CTA — 영구 디자인.
 *
 * 사용자 신고 (v2):
 *   1. 화면 밖으로 카드 튀어나감 → 부모 wrap 부재 (UserProfilePage 에서 ur-content-medium 추가).
 *   2. 색상/디자인 별로 → pastel 4색 카드 너무 가벼움, 일관성 부족.
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
}

export default function RoleCtaGrid() {
  const items: Cta[] = useMemo(() => {
    const hasSellerToken = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
    const hasAgencyToken = typeof window !== 'undefined' && !!localStorage.getItem('agency_token')
    return [
      { icon: '🤝', title: '공구 개최', desc: '친구와 같이 모이면 더 싸게', to: '/referral', show: () => true },
      { icon: '🏪', title: '사장님 입점', desc: '내 가게 공구권 발행하기',     to: '/seller/register/supplier', show: () => !hasSellerToken },
      { icon: '📺', title: '라이브 셀러', desc: '라이브 방송으로 판매 시작',   to: '/seller/register/business', show: () => !hasSellerToken },
      { icon: '🤵', title: '에이전시 사업', desc: '가게 영업 → 2% 영구 수익',  to: '/agency/register/business', show: () => !hasAgencyToken },
    ]
  }, [])

  const visible = items.filter(c => c.show())
  if (visible.length === 0) return null

  return (
    <section className="w-full min-w-0">
      <p className="text-[12px] font-bold text-gray-600 dark:text-gray-400 mb-2 px-1">
        추가 역할로 시작하기
      </p>
      <div className="rounded-2xl bg-white dark:bg-[#121212] border border-gray-100 dark:border-[#1A1A1A] overflow-hidden">
        {visible.map((c, i) => (
          <Link
            key={c.to}
            to={c.to}
            className={`flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 dark:active:bg-[#1A1A1A] transition-colors min-w-0 ${
              i > 0 ? 'border-t border-gray-50 dark:border-[#1A1A1A]' : ''
            }`}
          >
            <span className="text-xl shrink-0" aria-hidden="true">{c.icon}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-gray-900 dark:text-white truncate">
                {c.title}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {c.desc}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0" />
          </Link>
        ))}
      </div>
    </section>
  )
}

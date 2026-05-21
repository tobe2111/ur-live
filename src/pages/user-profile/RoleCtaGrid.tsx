/**
 * 🛡️ 2026-05-21: 마이페이지 역할 진입 CTA 2x2 그리드.
 *
 * 사용자 요청: 홈은 단순 유지, 가입 진입은 마이페이지/footer 에 집중.
 *
 * 4개 카드:
 *   🤝 공구 개최  → /referral
 *   🏪 사장님 입점 → /seller/register/supplier
 *   📺 라이브 셀러 → /seller/register/business
 *   🤵 에이전시 사업 → /agency/register/business
 *
 * 로그인 상태 자동 필터:
 *   - 이미 seller_token 있으면 셀러/사장님 카드 숨김
 *   - 이미 agency_token 있으면 에이전시 카드 숨김
 */

import { Link } from 'react-router-dom'
import { useMemo } from 'react'

interface Cta {
  icon: string
  title: string
  desc: string
  to: string
  bg: string
  show: () => boolean
}

export default function RoleCtaGrid() {
  const items: Cta[] = useMemo(() => {
    const hasSellerToken = typeof window !== 'undefined' && !!localStorage.getItem('seller_token')
    const hasAgencyToken = typeof window !== 'undefined' && !!localStorage.getItem('agency_token')
    return [
      {
        icon: '🤝',
        title: '공구 개최',
        desc: '친구와 같이 더 싸게',
        to: '/referral',
        bg: 'bg-pink-50 border-pink-200 dark:bg-pink-500/[0.08] dark:border-pink-500/30',
        show: () => true,
      },
      {
        icon: '🏪',
        title: '사장님 입점',
        desc: '내 가게 공구권 발행',
        to: '/seller/register/supplier',
        bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-500/[0.08] dark:border-emerald-500/30',
        show: () => !hasSellerToken,
      },
      {
        icon: '📺',
        title: '라이브 셀러',
        desc: '라이브로 판매 시작',
        to: '/seller/register/business',
        bg: 'bg-blue-50 border-blue-200 dark:bg-blue-500/[0.08] dark:border-blue-500/30',
        show: () => !hasSellerToken,
      },
      {
        icon: '🤵',
        title: '에이전시 사업',
        desc: '가게 영업 → 2% 영구 수익',
        to: '/agency/register/business',
        bg: 'bg-violet-50 border-violet-200 dark:bg-violet-500/[0.08] dark:border-violet-500/30',
        show: () => !hasAgencyToken,
      },
    ]
  }, [])

  const visible = items.filter(c => c.show())
  if (visible.length === 0) return null

  return (
    <div className="mb-4 w-full min-w-0">
      <p className="text-[12px] font-bold text-gray-600 dark:text-gray-400 mb-2.5 px-0.5">
        추가 역할로 시작하기
      </p>
      {/* 🛡️ 2026-05-21: 사용자 신고 — UI 디자인 별로 + 화면 튀어나감.
            영구 fix:
              - 부모 width 제약 (min-w-0 + w-full)
              - grid-cols-2 + gap-2.5 (간격 일관)
              - 카드 텍스트 truncate / line-clamp 적용 (가로 overflow 방지)
              - 단순화된 디자인 — 작은 아이콘 + 1줄 제목 + 1줄 설명
              - 색상 단색 border 으로 강조 (gradient 제거 — 시각 노이즈 ↓) */}
      <div className="grid grid-cols-2 gap-2.5">
        {visible.map(c => (
          <Link
            key={c.to}
            to={c.to}
            className={`relative rounded-xl border p-3 active:scale-[0.98] transition-transform min-w-0 ${c.bg}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl shrink-0" aria-hidden="true">{c.icon}</span>
              <p className="text-[13px] font-extrabold text-gray-900 dark:text-white truncate flex-1 min-w-0">
                {c.title}
              </p>
            </div>
            <p className="text-[11px] text-gray-600 dark:text-gray-400 line-clamp-1 leading-tight">
              {c.desc}
            </p>
          </Link>
        ))}
      </div>
    </div>
  )
}

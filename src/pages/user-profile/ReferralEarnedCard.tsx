/**
 * 🛡️ 2026-05-18 / 2026-05-20: 마이페이지 — referral 누적 적립 카드.
 *   /api/affiliate/stats 호출 → 적립이 있으면 누적 액수, 없으면 "시작하기" CTA 노출.
 *   클릭 → /influencer 인플 대시보드.
 *
 *   2026-05-20 정책 변경 (사용자 요청): 적립 0 도 항상 노출 — 신규 사용자에게 referral 인지/유도.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon } from '@/utils/format'
import { isLoggedInSync } from '@/utils/auth'

interface Stats {
  total_referrals: number
  total_earned: number
}

export default function ReferralEarnedCard() {
  const { t } = useTranslation()
  // 🛡️ 2026-05-31: 수동 fetch → useApiQuery (RQ). 로그인 시에만 enabled, 인증=인터셉터 자동.
  // 🛡️ 2026-07-02: 로그인 판정을 isLoggedInSync 로 — 기존 access_token/firebase_token 검사는
  //   카카오 세션쿠키 유저(한국 대부분)에게 false → stats 미조회 → 카드가 항상 숨겨지던 버그.
  const loggedIn = isLoggedInSync()
  const { data: stats = null } = useApiQuery<Stats | null>(
    ['affiliate', 'stats'],
    '/api/affiliate/stats',
    { enabled: loggedIn, select: (raw) => ((raw as { success?: boolean; data?: Stats })?.success ? ((raw as { data: Stats }).data) : null) },
  )

  // 🛡️ 2026-07-02: stats 미수신(신규/일시 실패)이어도 CTA 행은 노출 —
  //   2026-05-20 정책("적립 0도 항상 노출 — 신규 사용자 인지 유도")과 정합. 이전 `if (!stats) return null` 폐기.
  const hasEarned = !!stats && stats.total_earned > 0

  return (
    <Link
      to="/influencer"
      className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-gray-200 dark:active:bg-white/[0.06]"
    >
      <span className="text-lg" aria-hidden="true">💸</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-gray-900 dark:text-white">
          {hasEarned ? t('my.referralEarnedTitle', { defaultValue: '추천 적립 현황' }) : t('my.referralStartTitle', { defaultValue: '상품 추천하고 적립받기' })}
        </span>
        <span className="block text-[10px] text-gray-500 dark:text-white/45 mt-0.5">
          {hasEarned
            ? t('my.referralCountN', { n: stats?.total_referrals ?? 0, defaultValue: `추천 ${stats?.total_referrals ?? 0}건` })
            : t('my.referralStartSub', { defaultValue: '내 SNS 공유 → 친구 결제 시 자동 적립' })}
        </span>
      </span>
      {hasEarned && (
        <span className="text-[12px] font-semibold text-gray-900 dark:text-white shrink-0">
          {/* 🛡️ 2026-07-02: raw toLocaleString → formatWon (null/NaN 가드 — 대시보드 ₩NaN 규칙) */}
          {formatWon(stats?.total_earned)}
        </span>
      )}
      <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-white/30 shrink-0" aria-hidden="true" />
    </Link>
  )
}

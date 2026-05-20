/**
 * 🛡️ 2026-05-18 / 2026-05-20: 마이페이지 — referral 누적 적립 카드.
 *   /api/affiliate/stats 호출 → 적립이 있으면 누적 액수, 없으면 "시작하기" CTA 노출.
 *   클릭 → /influencer 인플 대시보드.
 *
 *   2026-05-20 정책 변경 (사용자 요청): 적립 0 도 항상 노출 — 신규 사용자에게 referral 인지/유도.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '@/lib/api'
import { ChevronRight } from 'lucide-react'

interface Stats {
  total_referrals: number
  total_earned: number
}

export default function ReferralEarnedCard() {
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('access_token') || localStorage.getItem('firebase_token')
    if (!token) return
    api.get('/api/affiliate/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.data?.success) setStats(r.data.data as Stats) })
      .catch(() => { /* fail-soft */ })
  }, [])

  // 적립 0 이거나 데이터 없으면 — '인플 시작' CTA 로.
  const hasEarned = stats && stats.total_earned > 0
  if (!stats) return null

  return (
    <Link
      to="/influencer"
      className="block bg-gradient-to-br from-pink-500/[0.18] to-violet-500/[0.18] dark:from-pink-500/[0.15] dark:to-violet-500/[0.15]
                 border border-pink-300/40 dark:border-pink-500/30 rounded-2xl p-4 mb-3
                 hover:from-pink-500/[0.25] hover:to-violet-500/[0.25] transition-all active:scale-[0.98]"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-pink-500/30 flex items-center justify-center text-2xl shrink-0">
          💸
        </div>
        <div className="flex-1 min-w-0">
          {hasEarned ? (
            <>
              <p className="text-[10px] font-bold text-pink-600 dark:text-pink-300/80 tracking-wide">
                referral 누적 적립
              </p>
              <p className="text-lg font-extrabold text-gray-900 dark:text-white mt-0.5">
                ₩{stats.total_earned.toLocaleString()}
                <span className="text-[11px] text-gray-500 dark:text-gray-400 font-normal ml-2">
                  · {stats.total_referrals}건
                </span>
              </p>
            </>
          ) : (
            <>
              <p className="text-[12px] font-bold text-pink-600 dark:text-pink-300">
                인플루언서 referral 시작하기
              </p>
              <p className="text-[10px] text-gray-600 dark:text-gray-300/80 mt-0.5">
                내 SNS 에 공유 → 친구 결제 시 자동 적립
              </p>
            </>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-pink-500 shrink-0" />
      </div>
    </Link>
  )
}

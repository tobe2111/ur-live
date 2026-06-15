/**
 * 🛡️ 2026-05-25: 마이페이지에 큐레이터 수익 인라인 카드.
 *
 * 정책 분기:
 *   - 사업자 셀러 (payout_mode='cash') → 현금 출금 안내 + /u/me/earnings 로 detail
 *   - 일반 user (payout_mode='deal') → 딜 누적 표시 (TeamPointsCard 와 별개 — 큐레이션 한정)
 *
 * 본 카드는 큐레이터 페이지의 "수익" 부분을 마이페이지로 이전 (사용자 결정 2026-05-25):
 *   "링크샵 페이지에서는 수익이 보이면 안돼. 마이페이지에서 보여야지."
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, TrendingUp, ChevronRight } from 'lucide-react'
import { curatorApi } from '@/features/curator/api/curator-api'
import { formatWon, formatNumber } from '@/utils/format'

interface Info {
  lifetime_earnings: number
  available: number
  payout_mode: 'cash' | 'deal'
  is_business_seller: boolean
  deal_balance: number
}

export default function CuratorEarningsCard() {
  const [info, setInfo] = useState<Info | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    curatorApi.getWithdrawalInfo()
      .then((res: any) => {
        if (!alive) return
        if (res.success) {
          setInfo({
            lifetime_earnings: res.lifetime_earnings ?? 0,
            available: res.available ?? 0,
            payout_mode: res.payout_mode ?? 'deal',
            is_business_seller: !!res.is_business_seller,
            deal_balance: res.deal_balance ?? 0,
          })
        }
      })
      .catch(() => { /* 비로그인 or 미가입 — 카드 숨김 */ })
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [])

  // 비로그인 / 누적 0 = 카드 숨김 (마이페이지에 빈 카드 노출 X)
  if (loading || !info || info.lifetime_earnings === 0) return null

  const isCash = info.payout_mode === 'cash'

  return (
    <Link
      to="/creator"
      className="block mx-4 lg:mx-8 mt-3 rounded-xl border border-gray-100 dark:border-[#1A1A1A] bg-white dark:bg-[#121212] overflow-hidden hover:border-gray-300 dark:hover:border-[#2A2A2A] transition-colors"
    >
      <div className="p-4 bg-gray-50 dark:bg-white/[0.04]">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
            크리에이터 콘솔
          </p>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
        <div className="flex items-baseline gap-2 mt-2">
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {isCash ? formatWon(info.available) : `${formatNumber(info.lifetime_earnings)}딜`}
          </p>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            {isCash ? '출금 가능' : '누적 적립'}
          </p>
        </div>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          {isCash
            ? `누적 ${formatWon(info.lifetime_earnings)} · 현금 정산`
            : '1딜=1원, 쇼핑/공구에 사용 가능'}
        </p>
      </div>
    </Link>
  )
}

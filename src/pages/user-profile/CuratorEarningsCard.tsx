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
import { ChevronRight } from 'lucide-react'
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
      className="w-full flex items-center gap-3 px-3.5 py-3 text-left active:bg-gray-200 dark:active:bg-white/[0.06]"
    >
      <span className="text-lg" aria-hidden="true">🛍️</span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-medium text-gray-900 dark:text-white">링크샵 수익</span>
        <span className="block text-[10px] text-gray-500 dark:text-white/45 mt-0.5">
          {isCash ? '현금 정산 · 출금 가능' : '누적 적립 · 1딜=1원'}
        </span>
      </span>
      <span className="text-[12px] font-semibold text-gray-900 dark:text-white shrink-0">
        {isCash ? formatWon(info.available) : `${formatNumber(info.lifetime_earnings)}딜`}
      </span>
      <ChevronRight className="w-3.5 h-3.5 text-gray-400 dark:text-white/30 shrink-0" aria-hidden="true" />
    </Link>
  )
}

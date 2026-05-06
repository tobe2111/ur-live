import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { Swords, Trophy } from 'lucide-react'

interface PKBattleStatus {
  id: number
  seller_a_id: number
  seller_b_id: number
  live_a_id: number | null
  live_b_id: number | null
  duration_minutes: number
  status: string
  started_at: string | null
  ends_at: string
  revenue_a: number
  revenue_b: number
  winner_seller_id: number | null
  seller_a_name: string | null
  seller_b_name: string | null
}

interface Props {
  liveStreamId: number
}

/**
 * 시청자가 라이브 볼 때 PK 진행 상황 표시.
 *
 * 활성 PK 가 있으면 상단/하단에 매출 막대 + 카운트다운.
 * 시청자의 응원 (=결제) 이 매출에 즉시 반영됨.
 */
export default function PKLiveBanner({ liveStreamId }: Props) {
  const { t } = useTranslation()
  const [pk, setPk] = useState<PKBattleStatus | null>(null)
  const [now, setNow] = useState(Date.now())

  async function fetchPk() {
    try {
      const r = await api.get(`/api/pk-public/live/${liveStreamId}`)
      setPk(r.data?.data || null)
    } catch { /* skip */ }
  }

  useEffect(() => {
    fetchPk()
    const interval = setInterval(() => {
      setNow(Date.now())
      if (!document.hidden) fetchPk()
    }, 15_000)
    return () => clearInterval(interval)
  }, [liveStreamId])

  if (!pk || pk.status === 'cancelled') return null

  const totalRevenue = pk.revenue_a + pk.revenue_b
  const aPercent = totalRevenue > 0 ? (pk.revenue_a / totalRevenue) * 100 : 50
  const bPercent = 100 - aPercent

  // 종료된 경우
  if (pk.status === 'ended') {
    if (!pk.winner_seller_id) return null
    const winnerName = pk.winner_seller_id === pk.seller_a_id ? pk.seller_a_name : pk.seller_b_name
    const winnerSide = pk.winner_seller_id === pk.seller_a_id ? 'A' : 'B'
    return (
      <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-xl px-4 py-3 shadow-lg flex items-center gap-2.5">
        <Trophy className="w-5 h-5 flex-shrink-0 fill-white" />
        <div className="text-sm font-bold flex-1">
          {t('live.pk.endedPrefix', { defaultValue: '🏆 PK 종료 — ' })}<span className="font-black">{t('live.pk.winnerName', { defaultValue: '{{name}} ({{side}}측)', name: winnerName, side: winnerSide })}</span>{t('live.pk.endedSuffix', { defaultValue: ' 우승!' })}
        </div>
      </div>
    )
  }

  // 진행 중
  const remainingMs = new Date(pk.ends_at).getTime() - now
  const remainingSec = Math.max(0, Math.floor(remainingMs / 1000))
  const mm = Math.floor(remainingSec / 60)
  const ss = remainingSec % 60

  return (
    <div className="bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-xl px-3 py-2.5 shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-sm font-bold">
          <Swords className="w-4 h-4" />
          <span>{t('live.pk.inProgress', { defaultValue: '🔴 PK 진행 중' })}</span>
        </div>
        <div className="text-base font-bold tabular-nums">
          {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
        </div>
      </div>

      {/* 매출 비율 막대 */}
      <div className="relative h-7 bg-black/30 rounded-full overflow-hidden flex">
        <div
          className="bg-gradient-to-r from-blue-500 to-cyan-400 flex items-center justify-start px-2 text-xs font-bold transition-all duration-500"
          style={{ width: `${aPercent}%` }}
        >
          {aPercent > 15 && <span className="truncate">{pk.seller_a_name || 'A'}</span>}
        </div>
        <div
          className="bg-gradient-to-r from-pink-500 to-yellow-400 flex items-center justify-end px-2 text-xs font-bold transition-all duration-500"
          style={{ width: `${bPercent}%` }}
        >
          {bPercent > 15 && <span className="truncate">{pk.seller_b_name || 'B'}</span>}
        </div>
      </div>

      <div className="flex items-center justify-between mt-1.5 text-[11px] opacity-90">
        <span>{t('live.pk.tenThousandDeal', { defaultValue: '{{amount}}만 딜', amount: (pk.revenue_a / 10_000).toFixed(1) })}</span>
        <span>{t('live.pk.tenThousandDeal', { defaultValue: '{{amount}}만 딜', amount: (pk.revenue_b / 10_000).toFixed(1) })}</span>
      </div>

      <p className="mt-2 text-[10px] text-center opacity-80">
        {t('live.pk.cheerNotice', { defaultValue: '💝 응원하는 셀러에게 결제/후원하면 그 셀러 매출에 즉시 반영됩니다!' })}
      </p>
    </div>
  )
}

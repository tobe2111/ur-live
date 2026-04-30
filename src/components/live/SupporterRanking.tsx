import { useState, useEffect } from 'react'
import api from '@/lib/api'
import { Crown, Diamond, Star, Heart, Users } from 'lucide-react'
import { formatNumber } from '@/utils/format'

interface Supporter {
  donor_user_id: string; donor_name: string
  total_amount: number; donation_count: number
  rank: number; badge: string | null
}

interface Props {
  sellerId: string | number
  compact?: boolean
}

const BADGE_ICONS: Record<string, { icon: typeof Crown; color: string; bg: string }> = {
  crown: { icon: Crown, color: 'text-yellow-500', bg: 'bg-yellow-50' },
  diamond: { icon: Diamond, color: 'text-blue-500', bg: 'bg-blue-50' },
  star: { icon: Star, color: 'text-purple-500', bg: 'bg-purple-50' },
}

export default function SupporterRanking({ sellerId, compact = false }: Props) {
  const [supporters, setSupporters] = useState<Supporter[]>([])
  const [stats, setStats] = useState({ supporter_count: 0, total_donations: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get(`/api/social/supporters/${sellerId}`)
      .then(r => {
        if (r.data.success) {
          setSupporters(r.data.data.supporters || [])
          setStats(r.data.data.stats || { supporter_count: 0, total_donations: 0 })
        }
      })
      .catch((e) => { if (import.meta.env.DEV) console.warn('[SupporterRanking] fetch failed:', e) })
      .finally(() => setLoading(false))
  }, [sellerId])

  if (loading) return null
  if (supporters.length === 0 && compact) return null

  if (compact) {
    // 라이브 페이지 / 셀러 스토어 축소 버전: Top 3만
    return (
      <div className="flex items-center gap-2">
        {supporters.slice(0, 3).map((s, i) => {
          const badge = BADGE_ICONS[s.badge || '']
          return (
            <div key={s.donor_user_id} className="flex items-center gap-1 text-xs">
              {badge ? <badge.icon className={`w-3.5 h-3.5 ${badge.color}`} /> : null}
              <span className="text-gray-600 font-medium">{s.donor_name}</span>
            </div>
          )
        })}
        {stats.supporter_count > 3 && (
          <span className="text-[10px] text-gray-400">+{stats.supporter_count - 3}</span>
        )}
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* 헤더 */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 px-4 py-3 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
            <h3 className="font-bold text-gray-900">서포터 랭킹</h3>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Users className="w-3.5 h-3.5" />
            <span>{stats.supporter_count}명</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          총 {formatNumber(stats.total_donations)}딜 후원
        </p>
      </div>

      {/* 랭킹 리스트 */}
      {supporters.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">
          아직 서포터가 없습니다
        </div>
      ) : (
        <div className="divide-y divide-gray-50">
          {supporters.slice(0, 10).map((s) => {
            const badge = BADGE_ICONS[s.badge || '']
            const BadgeIcon = badge?.icon
            return (
              <div key={s.donor_user_id} className="flex items-center gap-3 px-4 py-3">
                {/* 순위 */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${badge?.bg || 'bg-gray-50'}`}>
                  {BadgeIcon ? (
                    <BadgeIcon className={`w-4 h-4 ${badge.color}`} />
                  ) : (
                    <span className="text-xs font-bold text-gray-400">{s.rank}</span>
                  )}
                </div>

                {/* 이름 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{s.donor_name}</p>
                  <p className="text-[10px] text-gray-400">{s.donation_count}회 후원</p>
                </div>

                {/* 총액 */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-pink-500">{formatNumber(s.total_amount)}</p>
                  <p className="text-[10px] text-gray-400">딜</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

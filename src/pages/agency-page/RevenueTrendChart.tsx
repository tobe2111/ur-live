/**
 * 🛡️ 2026-05-02: TD-018 분할 — AgencyPage 7일 매출 추이 막대 차트.
 */
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { formatNumber } from '@/utils/format'
import type { DailyStat } from './types'

export default function RevenueTrendChart() {
  const { t } = useTranslation()
  const [daily, setDaily] = useState<DailyStat[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('agency_token')
    if (!token) return
    api.get('/api/agency/stats/daily?days=7', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.data.success) setDaily(r.data.data || [])
      })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [])

  // 최근 7일 날짜 버킷 생성 (데이터 없는 날도 0으로 표시)
  const buckets = useMemo(() => {
    const dayNames = [t('common.sun'), t('common.mon'), t('common.tue'), t('common.wed'), t('common.thu'), t('common.fri'), t('common.sat')]
    const byDate: Record<string, DailyStat> = {}
    for (const d of daily) byDate[d.date] = d
    const out: { key: string; label: string; revenue: number; orders: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const dt = new Date()
      dt.setDate(dt.getDate() - i)
      const key = dt.toISOString().slice(0, 10)
      const match = byDate[key]
      out.push({
        key,
        label: dayNames[dt.getDay()],
        revenue: match?.revenue || 0,
        orders: match?.orders || 0,
      })
    }
    return out
  }, [daily, t])

  const maxVal = Math.max(1, ...buckets.map(b => b.revenue))

  if (loading && daily.length === 0) {
    return (
      <div className="flex items-end gap-2 h-[140px] px-2 pt-4">
        {[0, 1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1">
            <div className="w-full animate-pulse bg-gray-200 rounded" style={{ height: '40%' }} />
            <span className="text-[10px] text-gray-300">·</span>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-end gap-2 h-[140px] px-2 pt-4">
      {buckets.map((b, i) => {
        const heightPct = b.revenue > 0 ? (b.revenue / (maxVal * 1.1)) * 100 : 0
        // 라이브/공구/제휴 세분화 데이터는 아직 없으므로 단일 바 (그라디언트) 표시
        return (
          <div key={b.key} className="flex-1 flex flex-col items-center gap-1" title={`${b.key}: ${formatNumber(b.revenue)}${t('common.won')} / ${b.orders}${t('agency.unitCase')}`}>
            <div className="w-full relative" style={{ height: `${Math.max(heightPct, 2)}%` }}>
              <div
                className="absolute bottom-0 w-full rounded-t-md"
                style={{
                  height: '100%',
                  background: b.revenue > 0
                    ? 'linear-gradient(180deg, #8B5CF6 0%, #6D28D9 100%)'
                    : '#E5E7EB',
                }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-medium">{b.label}</span>
            {i === buckets.length - 1 && (
              <span className="text-[9px] text-purple-600 font-bold">{t('agency.today')}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/**
 * 🛡️ 2026-05-25 (migration 0278): 큐레이터 수익 대시보드 (/u/me/earnings).
 *
 * Phase 1-C 핵심 UX — 수익 가시화.
 * 30일 적립 / 클릭 / 구매 / 인기 핀 top 3 / 일별 차트.
 * 출금은 기존 user_withdrawals 시스템 재활용 (Phase 4 에서 본격 통합).
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { curatorApi, type DashboardStats } from '@/features/curator/api/curator-api'
import { useAuthStore } from '@/client/stores/auth.store'
import { formatWon, formatNumber, safeNum } from '@/utils/format'

export default function CuratorEarningsPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s: any) => s.user)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [handle, setHandle] = useState<string | null>((user as any)?.handle || null)

  useEffect(() => {
    let alive = true
    curatorApi
      .getDashboard()
      .then((res) => {
        if (!alive) return
        if (res.success) setStats(res.stats)
        else setError(t('curator.dashboardError', { defaultValue: '대시보드 로딩 실패' }))
      })
      .catch(() => alive && setError(t('curator.dashboardError', { defaultValue: '대시보드 로딩 실패' })))
      .finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [t])

  // best-effort: handle 가져오기
  useEffect(() => {
    if (handle || !user) return
    // user store 에 handle 없을 수 있음. /api/curator/me/dashboard 응답에는 없으나 user store sync 가
    // 미반영일 수 있어 굳이 안 받아옴. 핀 추가하면 자동 동기.
  }, [handle, user])

  return (
    <>
      <SEO title={t('curator.earnings.title', { defaultValue: '내 링크샵 수익' })} noindex />
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] text-gray-900 dark:text-white pb-24">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A] px-4 py-3">
          <div className="max-w-3xl mx-auto flex items-center justify-between">
            <h1 className="text-lg font-bold">💰 {t('curator.earnings.title', { defaultValue: '내 링크샵 수익' })}</h1>
            {handle && (
              <Link to={`/u/${handle}`} className="text-sm text-pink-500 dark:text-pink-400 hover:underline">
                @{handle}
              </Link>
            )}
          </div>
        </header>

        <div className="max-w-3xl mx-auto px-4 py-6">
          {loading ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-12">{t('common.loading')}</p>
          ) : error ? (
            <p className="text-center text-red-500 py-12">{error}</p>
          ) : !stats ? null : (
            <>
              <SummaryCards stats={stats} />
              <TopPinsSection stats={stats} />
              <DailyChart stats={stats} />
            </>
          )}
        </div>
      </div>
    </>
  )
}

function SummaryCards({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  const cards: Array<{ label: string; value: string; accent: string }> = [
    { label: t('curator.earnings.monthEarning', { defaultValue: '30일 적립' }), value: formatWon(stats.month_earnings), accent: 'text-pink-500 dark:text-pink-400' },
    { label: t('curator.earnings.clicks30d', { defaultValue: '30일 클릭' }), value: formatNumber(stats.clicks_30d), accent: 'text-blue-500 dark:text-blue-400' },
    { label: t('curator.earnings.purchases30d', { defaultValue: '30일 구매' }), value: formatNumber(stats.purchases_30d), accent: 'text-emerald-500 dark:text-emerald-400' },
  ]
  return (
    <div className="grid grid-cols-3 gap-3 mb-6">
      {cards.map((card) => (
        <div key={card.label} className="bg-gray-50 dark:bg-[#121212] rounded-xl p-3 border border-gray-100 dark:border-[#1A1A1A]">
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-1">{card.label}</p>
          <p className={`text-lg font-bold ${card.accent}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}

function TopPinsSection({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  if (!stats.top_pins?.length) return null
  return (
    <section className="mb-6">
      <h2 className="text-sm font-bold mb-3">🔥 {t('curator.earnings.topPins', { defaultValue: '인기 핀 TOP 3' })}</h2>
      <div className="space-y-2">
        {stats.top_pins.map((pin, idx) => (
          <Link
            key={pin.id}
            to={`/products/${pin.product_id}`}
            className="flex items-center gap-3 bg-gray-50 dark:bg-[#121212] rounded-xl p-3 border border-gray-100 dark:border-[#1A1A1A] hover:border-pink-500/50 transition-colors"
          >
            <div className="text-lg font-bold text-gray-400 dark:text-gray-500 w-6">{idx + 1}</div>
            {(pin.thumbnail || pin.image_url) && (
              <img src={pin.thumbnail || pin.image_url || ''} alt={pin.product_name} className="w-12 h-12 rounded object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pin.product_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">👆 {formatNumber(pin.click_count)} 클릭</p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}

function DailyChart({ stats }: { stats: DashboardStats }) {
  const { t } = useTranslation()
  const daily = stats.earnings_daily_30d || []
  if (!daily.length) return (
    <section className="bg-gray-50 dark:bg-[#121212] rounded-xl p-6 text-center text-sm text-gray-500 dark:text-gray-400">
      {t('curator.earnings.noData', { defaultValue: '아직 데이터가 없어요. 친구에게 핀을 공유해보세요!' })}
    </section>
  )

  const max = Math.max(...daily.map((d) => safeNum(d.amount)), 1)
  return (
    <section>
      <h2 className="text-sm font-bold mb-3">📈 {t('curator.earnings.dailyChart', { defaultValue: '일별 적립 (30일)' })}</h2>
      <div className="bg-gray-50 dark:bg-[#121212] rounded-xl p-4 border border-gray-100 dark:border-[#1A1A1A]">
        <div className="flex items-end gap-1 h-32">
          {daily.map((d) => {
            const pct = (safeNum(d.amount) / max) * 100
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.date}: ${formatWon(d.amount)}`}>
                <div className="w-full bg-pink-500/30 dark:bg-pink-500/40 rounded-t group-hover:bg-pink-500" style={{ height: `${pct}%` }} />
              </div>
            )
          })}
        </div>
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">{daily[0]?.date} → {daily[daily.length - 1]?.date}</p>
      </div>
    </section>
  )
}

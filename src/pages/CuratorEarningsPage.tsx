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
import { toast } from '@/hooks/useToast'

interface WithdrawalInfo {
  lifetime_earnings: number
  total_withdrawn: number
  available: number
  min_withdrawal: number
  withholding_rate: number
  history: Array<{ id: number; amount: number; withholding_tax: number; net_amount: number; bank_name: string; status: string; requested_at: string }>
  seller_upgrade: { threshold: number; eligible: boolean; offered: boolean }
}

export default function CuratorEarningsPage() {
  const { t } = useTranslation()
  const user = useAuthStore((s: any) => s.user)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [handle, setHandle] = useState<string | null>((user as any)?.handle || null)
  const [wdInfo, setWdInfo] = useState<WithdrawalInfo | null>(null)
  const [showWithdraw, setShowWithdraw] = useState(false)

  useEffect(() => {
    curatorApi.getWithdrawalInfo().then((res) => {
      if (res.success) setWdInfo(res as any)
    }).catch(() => {})
  }, [])

  async function reloadWithdrawal() {
    try {
      const res = await curatorApi.getWithdrawalInfo()
      if (res.success) setWdInfo(res as any)
    } catch {}
  }

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
              {wdInfo && (
                <WithdrawalCard
                  info={wdInfo}
                  onWithdraw={() => setShowWithdraw(true)}
                  onAckUpgrade={async () => {
                    await curatorApi.acknowledgeUpgradeOffer()
                    setWdInfo({ ...wdInfo, seller_upgrade: { ...wdInfo.seller_upgrade, offered: true } })
                  }}
                />
              )}
              <TopPinsSection stats={stats} />
              <DailyChart stats={stats} />
            </>
          )}
        </div>

        {/* 출금 모달 */}
        {showWithdraw && wdInfo && (
          <WithdrawModal
            info={wdInfo}
            onClose={() => setShowWithdraw(false)}
            onSuccess={() => { setShowWithdraw(false); reloadWithdrawal() }}
          />
        )}
      </div>
    </>
  )
}

function WithdrawalCard({ info, onWithdraw, onAckUpgrade }: { info: WithdrawalInfo; onWithdraw: () => void; onAckUpgrade: () => Promise<void> }) {
  return (
    <section className="mb-6">
      <div className="bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl p-5 text-white">
        <p className="text-xs opacity-80 mb-1">💰 출금 가능 잔액</p>
        <p className="text-3xl font-bold mb-3">{formatWon(info.available)}</p>
        <div className="flex justify-between text-xs opacity-90 mb-4">
          <span>누적 적립 {formatWon(info.lifetime_earnings)}</span>
          <span>출금 {formatWon(info.total_withdrawn)}</span>
        </div>
        <button
          onClick={onWithdraw}
          disabled={info.available < info.min_withdrawal}
          className="w-full py-2.5 bg-white text-pink-600 font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {info.available < info.min_withdrawal
            ? `최소 ${formatWon(info.min_withdrawal)} 부터 출금 가능`
            : '출금 신청'}
        </button>
      </div>

      {/* 셀러 승급 안내 */}
      {info.seller_upgrade.eligible && !info.seller_upgrade.offered && (
        <div className="mt-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
          <p className="text-sm font-bold text-amber-900 dark:text-amber-100 mb-1">🎯 셀러 승급 안내</p>
          <p className="text-xs text-amber-800 dark:text-amber-200 mb-3">
            누적 적립이 {formatWon(info.seller_upgrade.threshold)} 를 넘었어요! 셀러로 승급하시면 직접 상품 판매·라이브 송출이 가능해져요.
          </p>
          <div className="flex gap-2">
            <Link to="/seller/register" className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg text-center">
              셀러 가입하기
            </Link>
            <button onClick={onAckUpgrade} className="px-3 py-2 text-amber-700 dark:text-amber-300 text-xs font-bold">
              나중에
            </button>
          </div>
        </div>
      )}

      {/* 출금 이력 */}
      {info.history.length > 0 && (
        <div className="mt-3 bg-gray-50 dark:bg-[#121212] rounded-xl p-4">
          <p className="text-xs font-bold text-gray-700 dark:text-gray-300 mb-2">최근 출금 이력</p>
          <div className="space-y-2">
            {info.history.slice(0, 5).map((h) => (
              <div key={h.id} className="flex justify-between items-center text-xs">
                <div>
                  <span className="text-gray-700 dark:text-gray-300">{formatWon(h.amount)}</span>
                  <span className="text-gray-400 dark:text-gray-500 ml-2">({h.bank_name})</span>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  h.status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                  h.status === 'rejected' ? 'bg-red-100 text-red-700' :
                  'bg-gray-100 text-gray-600'
                }`}>{h.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function WithdrawModal({ info, onClose, onSuccess }: { info: WithdrawalInfo; onClose: () => void; onSuccess: () => void }) {
  const [amount, setAmount] = useState(info.available)
  const [bankName, setBankName] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const withholding = Math.floor(amount * info.withholding_rate)
  const netAmount = amount - withholding

  async function submit() {
    if (amount < info.min_withdrawal) {
      toast.error(`최소 ${info.min_withdrawal.toLocaleString()}원 부터 출금 가능`)
      return
    }
    if (!bankName || !bankAccount || !accountHolder) {
      toast.error('은행 / 계좌 / 예금주를 모두 입력하세요')
      return
    }
    setSubmitting(true)
    try {
      const res = await curatorApi.requestWithdrawal({ amount, bank_name: bankName, bank_account: bankAccount, account_holder: accountHolder })
      if (res.success) {
        toast.success(`출금 신청 완료 — 실 입금 ${res.withdrawal?.net_amount.toLocaleString()}원`)
        onSuccess()
      } else {
        toast.error(res.error || '출금 신청 실패')
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '출금 신청 실패')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[10001] bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="w-full sm:max-w-md bg-white dark:bg-[#121212] rounded-t-2xl sm:rounded-2xl p-5" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold text-gray-900 dark:text-white mb-4">💰 출금 신청</h2>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">금액 (최대 {formatWon(info.available)})</label>
            <input
              type="number"
              min={info.min_withdrawal}
              max={info.available}
              value={amount}
              onChange={(e) => setAmount(Math.max(0, Math.min(info.available, Number(e.target.value) || 0)))}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">은행</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              placeholder="예: 카카오뱅크"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">계좌번호</label>
            <input
              type="text"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value.replace(/[^0-9-]/g, ''))}
              placeholder="3333-01-1234567"
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">예금주</label>
            <input
              type="text"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-[#0A0A0A] border border-gray-200 dark:border-[#2A2A2A] text-gray-900 dark:text-white rounded-lg"
            />
          </div>
        </div>

        <div className="mt-4 bg-gray-50 dark:bg-[#0A0A0A] rounded-lg p-3 text-xs space-y-1">
          <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>신청 금액</span><span>{formatWon(amount)}</span></div>
          <div className="flex justify-between text-gray-600 dark:text-gray-400"><span>원천징수 ({(info.withholding_rate * 100).toFixed(1)}%)</span><span>-{formatWon(withholding)}</span></div>
          <div className="flex justify-between font-bold text-gray-900 dark:text-white pt-1 border-t border-gray-200 dark:border-[#2A2A2A]"><span>실 입금</span><span>{formatWon(netAmount)}</span></div>
        </div>

        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-300 font-bold rounded-lg">취소</button>
          <button onClick={submit} disabled={submitting} className="flex-1 py-2.5 bg-pink-500 hover:bg-pink-600 disabled:opacity-50 text-white font-bold rounded-lg">
            {submitting ? '신청 중...' : '신청'}
          </button>
        </div>
      </div>
    </div>
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

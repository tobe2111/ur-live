/**
 * 🛡️ 2026-05-24 (사용자 요청): 딜 사용 히스토리 페이지.
 *   - 잔액 hero card
 *   - 필터: 전체 / 충전 / 사용 / 적립 / 환불
 *   - 페이지네이션 (50건/페이지)
 *   - 항목 클릭 시 관련 페이지 (충전 → /points/charge, 주문 → /my-orders, 등)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { useBalance } from '@/hooks/queries'
import { useDealHistory, type Transaction } from '@/hooks/queries/useDealHistory'
import { formatNumber } from '@/utils/format'
import { ChevronLeft } from 'lucide-react'

type FilterType = '' | 'charge' | 'donate' | 'refund' | 'referral_bonus' | 'ad_reward'

const FILTER_OPTIONS: { value: FilterType; label: string; emoji: string }[] = [
  { value: '',                label: '전체',    emoji: '📋' },
  { value: 'charge',          label: '충전',    emoji: '💳' },
  { value: 'donate',          label: '사용',    emoji: '🛒' },
  { value: 'refund',          label: '환불',    emoji: '🔄' },
  { value: 'referral_bonus',  label: '추천',    emoji: '👥' },
  { value: 'ad_reward',       label: '광고',    emoji: '🎬' },
]

const TYPE_EMOJI: Record<string, string> = {
  charge: '💳',
  donate: '🛒',
  refund: '🔄',
  referral_bonus: '👥',
  ad_reward: '🎬',
  admin_adjust: '⚙️',
  affiliate: '🔗',
}

function relativeTime(iso: string): string {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  if (diff < 60_000) return '방금'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}일 전`
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

const PAGE_SIZE = 50

export default function MyDealHistoryPage() {
  const navigate = useNavigate()
  const { data: balance = 0 } = useBalance({ fresh: true })
  const [page, setPage] = useState(0)
  const [filter, setFilter] = useState<FilterType>('')
  // 🛡️ 2026-06-01 Tier2: 수동 페칭 → React Query (page/filter queryKey + keepPreviousData).
  const { data, isLoading: loading, isError: error, refetch } = useDealHistory(page, filter)
  const items: Transaction[] = data?.items ?? []
  const total = data?.total ?? 0

  function onItemClick(tx: Transaction) {
    if (tx.type === 'charge') navigate('/points/charge')
    else if (tx.order_id) navigate(`/my-orders/${tx.order_id}`)
    else if (tx.type === 'referral_bonus') navigate('/referral')
    else if (tx.type === 'ad_reward') return  // no-op
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="min-h-screen bg-white dark:bg-[#020202] pb-20">
      <SEO title="딜 사용 내역 - 유어딜" description="딜 충전, 사용, 적립, 환불 내역" url="/my-deal-history" noindex />

      {/* Header */}
      <div className="sticky top-0 md:top-14 z-30 bg-white/95 dark:bg-[#020202]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-medium flex items-center px-4 lg:px-8 py-3">
          <button onClick={() => navigate(-1)} aria-label="뒤로"
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.06]">
            <ChevronLeft className="w-5 h-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="ml-1 text-[15px] font-bold text-gray-900 dark:text-white">딜 사용 내역</h1>
        </div>
      </div>

      {/* Hero — 현재 잔액 */}
      <div className="ur-content-medium px-4 lg:px-8 pt-5">
        <div className="rounded-2xl p-5 bg-gradient-to-br from-pink-500 to-rose-500 text-white">
          <p className="text-[11px] font-medium opacity-90">현재 딜 잔액</p>
          <p className="text-3xl font-extrabold mt-1">{formatNumber(balance)}<span className="text-base ml-1 font-bold opacity-90">딜</span></p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => navigate('/points/charge')}
              className="flex-1 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-[12px] font-bold transition-colors">
              충전
            </button>
            <button onClick={() => navigate('/browse')}
              className="flex-1 py-2 rounded-lg bg-white/20 hover:bg-white/30 text-[12px] font-bold transition-colors">
              쇼핑
            </button>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="ur-content-medium px-4 lg:px-8 pt-4">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setPage(0); setFilter(opt.value) }}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${
                filter === opt.value
                  ? 'bg-pink-500 text-white'
                  : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.12]'
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 리스트 */}
      <div className="ur-content-medium px-4 lg:px-8 pt-4">
        {loading ? (
          <div className="py-16 text-center">
            <div className="w-8 h-8 border-2 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">⚠️</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">거래 내역을 불러오지 못했어요</p>
            <button onClick={() => refetch()} className="mt-3 text-xs text-pink-500 font-bold">다시 시도 →</button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-4xl mb-3">📭</p>
            <p className="text-sm text-gray-500 dark:text-gray-400">거래 내역이 없어요</p>
            {filter && (
              <button onClick={() => { setFilter(''); setPage(0) }}
                className="mt-3 text-xs text-pink-500 font-bold">전체 보기 →</button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-gray-50 dark:bg-white/[0.03] overflow-hidden">
            {items.map((tx, i) => {
              const emoji = TYPE_EMOJI[tx.type] || '📋'
              const isPositive = tx.amount > 0 || tx.type === 'charge' || tx.type === 'refund' || tx.type === 'referral_bonus' || tx.type === 'ad_reward'
              const amountColor = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              const sign = isPositive ? '+' : ''
              return (
                <button
                  key={tx.id}
                  onClick={() => onItemClick(tx)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-100 dark:active:bg-white/[0.06] transition-colors"
                  style={{ borderTop: i ? '1px solid rgba(0,0,0,0.04)' : 'none' }}
                >
                  <span className="text-xl flex-shrink-0">{emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{tx.description || tx.type}</p>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{relativeTime(tx.created_at)}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-[14px] font-extrabold ${amountColor}`}>
                      {sign}{formatNumber(Math.abs(tx.amount))}딜
                    </p>
                    {tx.balance_after != null && (
                      <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">잔액 {formatNumber(tx.balance_after)}</p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {total > PAGE_SIZE && (
        <div className="ur-content-medium px-4 lg:px-8 pt-4 flex items-center justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">{formatNumber(total)}건 · {page + 1}/{totalPages} 페이지</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 rounded disabled:opacity-40"
            >이전</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs border border-gray-200 dark:border-[#2A2A2A] text-gray-700 dark:text-gray-300 rounded disabled:opacity-40"
            >다음</button>
          </div>
        </div>
      )}
    </div>
  )
}

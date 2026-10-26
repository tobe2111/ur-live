/**
 * 🛡️ 2026-05-24 (사용자 요청): 딜 사용 히스토리 페이지.
 *   - 잔액 hero card
 *   - 필터: 전체 / 충전 / 사용 / 환불 / 광고
 *   - 페이지네이션 (50건/페이지)
 *   - 항목 클릭 시 관련 페이지 (충전 → /points/charge, 주문 → /my-orders, 등)
 */
import { useState } from 'react'
import { BagIcon, PeopleIcon, SettingsIcon, WarnIcon } from '@/components/icons/urdeal-icons'
import { useNavigate } from 'react-router-dom'
import SEO from '@/components/SEO'
import { REFERRAL_GROUP_DISCOUNT_DISABLED, TOPUP_DISABLED } from '@/shared/feature-flags'
import { useBalance } from '@/hooks/queries'
import { useDealHistory, type Transaction } from '@/hooks/queries/useDealHistory'
import { formatNumber } from '@/utils/format'
import { Clapperboard, CreditCard, List, RotateCcw, Link as LinkIcon, type LucideIcon } from 'lucide-react'
import SubPageHeader, { SUB_PAGE_CLS } from '@/components/ui/sub-page-header'
import Udal from '@/components/mascot/Udal'
import BrandLoader from '@/components/brand/BrandLoader'
import { parseUTCDate } from '@/utils/date'
type FilterType = '' | 'charge' | 'donate' | 'refund' | 'ad_reward'

const FILTER_OPTIONS: { value: FilterType; label: string; Icon: LucideIcon }[] = [
  // 🧹 2026-10-19: '추천' 칩 제거 — 유저 추천 보너스는 지급된 적이 없고(원장 0행) 2026-10-16 대표 확정으로
  //   주지 않는다. 누르면 늘 빈 목록인 칩은 "있는 혜택" 처럼 읽힌다. 옛 행이 있어도 '전체'에 그대로 보인다.
  { value: '',                label: '전체',    Icon: List },
  { value: 'charge',          label: '충전',    Icon: CreditCard },
  { value: 'donate',          label: '사용',    Icon: BagIcon },
  { value: 'refund',          label: '환불',    Icon: RotateCcw },
  { value: 'ad_reward',       label: '광고',    Icon: Clapperboard },
]

/**
 * 🎨 2026-09-01: 이모지 맵 → lucide. 바로 위 `FILTER_OPTIONS` 가 **이미 같은 종류를 아이콘으로**
 *   갖고 있었는데(충전=CreditCard, 사용=ShoppingCart…) 목록 행만 이모지를 따로 썼다. 같은 화면에서
 *   위 필터 칩과 아래 행이 서로 다른 그림 언어를 쓰던 셈이라 종류를 맞췄다. */
const TYPE_ICON: Record<string, LucideIcon> = {
  charge: CreditCard,
  donate: BagIcon,
  refund: RotateCcw,
  referral_bonus: PeopleIcon,
  ad_reward: Clapperboard,
  admin_adjust: SettingsIcon,
  affiliate: LinkIcon,
}

function relativeTime(iso: string): string {
  const d = parseUTCDate(iso).getTime()  // UTC-naive(created_at) — 로컬 파싱하면 '9시간 전'이 된다
  const diff = Date.now() - d
  if (diff < 60_000) return '방금'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}분 전`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}시간 전`
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)}일 전`
  return parseUTCDate(iso).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'short', day: 'numeric' })
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
    // 🛡️ 2026-07-18: 충전 종료 — 과거 충전 항목 클릭은 no-op (내역 자체는 보존 표시).
    if (tx.type === 'charge') { if (!TOPUP_DISABLED) navigate('/points/charge'); return }
    else if (tx.order_id) navigate('/my-orders')
    // 🧭 2026-06-17: 그룹 referral 숨김 — 초대보너스는 /user/profile 의 MyReferralCard 로.
    else if (tx.type === 'referral_bonus') navigate(REFERRAL_GROUP_DISCOUNT_DISABLED ? '/user/profile' : '/referral')
    else if (tx.type === 'ad_reward') return  // no-op
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className={`${SUB_PAGE_CLS} pb-20`}>
      <SEO title="딜 사용 내역 - 유어딜" description="딜 충전, 사용, 적립, 환불 내역" url="/my-deal-history" noindex />

      <SubPageHeader title="딜 사용 내역" />

      {/* 🎫 2026-10-19 (대표 *"다 이상적으로 진행해줘 모두"*): 검정 그라디언트 판 → 흰 카드.
          숫자가 주인공이고(규칙 ③) 행동은 브랜드 블루 하나(규칙 ②) — 검정 판은 이 화면에만 있던 모양이었다. */}
      <div className="ur-content-medium px-4 lg:px-8 pt-2">
        <div className="rounded-2xl bg-surface shadow-lift dark:shadow-none p-5">
          <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">현재 딜 잔액</p>
          <p className="mt-1 flex items-baseline gap-1 leading-none">
            <span className="text-[28px] font-extrabold tabular-nums tracking-[-0.02em] text-gray-900 dark:text-white">{formatNumber(balance)}</span>
            <span className="text-[15px] font-bold text-gray-500 dark:text-gray-400">딜</span>
          </p>
          <div className="mt-4 flex gap-2">
            {/* 🛡️ 2026-07-18 (대표 "충전 자체를 빼자"): 충전 버튼 → 딜 모으기(마이 리워드 카드) 유도 */}
            <button onClick={() => navigate(TOPUP_DISABLED ? '/user/profile' : '/points/charge')}
              className="flex-1 h-11 rounded-xl bg-wash text-[15px] font-medium text-gray-900 dark:text-white active:opacity-70">
              {TOPUP_DISABLED ? '딜 모으기' : '충전'}
            </button>
            {/* 🧭 2026-06-10: '쇼핑'(잠정 숨김 탭) → '교환권' — 딜의 실제 사용처로 유도 */}
            <button onClick={() => navigate('/vouchers')}
              className="flex-1 h-11 rounded-xl bg-brand text-[15px] font-medium text-white active:opacity-80">
              교환권 쓰기
            </button>
          </div>
        </div>
      </div>

      {/* 필터 */}
      <div className="ur-content-medium px-4 lg:px-8 pt-4">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setPage(0); setFilter(opt.value) }}
              className={`shrink-0 inline-flex items-center gap-2 px-3 py-2 rounded-full text-[12px] font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-brand text-white'
                  : 'bg-gray-100 dark:bg-white/[0.06] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-white/[0.12]'
              }`}
            >
              <opt.Icon className="w-3.5 h-3.5" aria-hidden="true" />{opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 리스트 */}
      <div className="ur-content-medium px-4 lg:px-8 pt-4">
        {loading ? (
          /* 🚑 2026-07-10 로더 통일: ad-hoc 스피너 → BrandLoader */
          <BrandLoader />
        ) : error ? (
          <div className="py-16 text-center">
            <WarnIcon className="w-9 h-9 mx-auto mb-3 text-gray-300 dark:text-gray-600" aria-hidden />
            <p className="text-[15px] text-gray-500 dark:text-gray-400">거래 내역을 불러오지 못했어요</p>
            <button onClick={() => refetch()} className="mt-3 text-[12px] font-medium text-gray-900 dark:text-white underline">다시 시도 →</button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <Udal mood="empty" size={96} className="mx-auto mb-3" />
            <p className="text-[15px] text-gray-500 dark:text-gray-400">거래 내역이 없어요</p>
            {filter && (
              <button onClick={() => { setFilter(''); setPage(0) }}
                className="mt-3 text-[12px] font-medium text-gray-900 dark:text-white underline">전체 보기 →</button>
            )}
          </div>
        ) : (
          <div className="rounded-2xl bg-surface shadow-lift dark:shadow-none overflow-hidden">
            {items.map((tx, i) => {
              const TxIcon = TYPE_ICON[tx.type] || List
              const isPositive = tx.amount > 0 || tx.type === 'charge' || tx.type === 'refund' || tx.type === 'referral_bonus' || tx.type === 'ad_reward'
              const amountColor = isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'
              const sign = isPositive ? '+' : ''
              return (
                <button
                  key={tx.id}
                  onClick={() => onItemClick(tx)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left active:bg-gray-100 dark:active:bg-white/[0.06] transition-colors ${i ? 'border-t border-rule' : ''}`}
                >
                  <TxIcon className="w-[18px] h-[18px] flex-shrink-0 text-gray-400 dark:text-gray-500" strokeWidth={1.8} aria-hidden />
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-gray-900 dark:text-white truncate">{tx.description || tx.type}</p>
                    <p className="text-[12px] text-gray-500 dark:text-gray-400 mt-1">{relativeTime(tx.created_at)}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className={`text-[15px] font-bold ${amountColor}`}>
                      {sign}{formatNumber(Math.abs(tx.amount))}딜
                    </p>
                    {tx.balance_after != null && (
                      <p className="text-[12px] text-gray-400 dark:text-gray-500 mt-1">잔액 {formatNumber(tx.balance_after)}</p>
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
          <p className="text-[12px] text-gray-500 dark:text-gray-400">{formatNumber(total)}건 · {page + 1}/{totalPages} 페이지</p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-2 text-[12px] border border-line text-gray-700 dark:text-gray-300 rounded disabled:opacity-40"
            >이전</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-2 text-[12px] border border-line text-gray-700 dark:text-gray-300 rounded disabled:opacity-40"
            >다음</button>
          </div>
        </div>
      )}
    </div>
  )
}

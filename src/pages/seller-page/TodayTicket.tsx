/**
 * 🎫 오늘 티켓 — 홈 첫 블록 (M2 시안 · 2026-09-14). 파란 밴드(오늘 날짜 · 내 매장) + 흰 본문에 숫자.
 *   폰은 셋(매출·주문·처리 대기), PC 는 넷(+정산 가능). 코레일톡 티켓 은유 — 결제 완료·지갑과 같은 문법.
 *   숫자는 전부 훅이 준 값만 그린다. 로딩 중엔 스켈레톤 — 0 을 먼저 보여 주면 "오늘 안 팔렸다"고 읽힌다.
 */
import { useTranslation } from 'react-i18next'
import { formatNumber, formatWon } from '@/utils/format'

interface Props {
  loading: boolean
  storeName: string
  todayRevenue: number
  todayOrders: number
  pendingOrders: number
  withdrawable: number
}

const Skel = () => <span className="inline-block h-6 w-16 animate-pulse rounded bg-gray-200" />

export default function TodayTicket({ loading, storeName, todayRevenue, todayOrders, pendingOrders, withdrawable }: Props) {
  const { t, i18n } = useTranslation()
  const today = new Date().toLocaleDateString(i18n.language || 'ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' })
  const cells: Array<{ label: string; value: string; hot?: boolean; pcOnly?: boolean }> = [
    { label: t('seller.home.revenue', { defaultValue: '매출' }), value: formatWon(todayRevenue) },
    { label: t('seller.home.orders', { defaultValue: '주문' }), value: formatNumber(todayOrders) },
    { label: t('seller.home.pending', { defaultValue: '처리 대기' }), value: formatNumber(pendingOrders), hot: pendingOrders > 0 },
    { label: t('seller.home.settleAvail', { defaultValue: '정산 가능' }), value: formatWon(withdrawable), pcOnly: true },
  ]
  return (
    <section className="overflow-hidden rounded-2xl border border-rule bg-white">
      <div className="flex h-11 items-center justify-between bg-brand px-4 text-[13px] text-white">
        <span className="font-bold">{t('seller.home.today', { defaultValue: '오늘' })} · {today}</span>
        <span className="truncate pl-3 font-medium opacity-90">{storeName}</span>
      </div>
      <div className="grid grid-cols-[1.35fr_1fr_1fr] lg:grid-cols-4 px-2 py-4">
        {cells.map((c) => (
          <div key={c.label} className={`px-3 [&+&]:border-l [&+&]:border-rule ${c.pcOnly ? 'hidden lg:block' : ''}`}>
            <p className={`whitespace-nowrap text-[19px] font-extrabold leading-tight tracking-tight tabular-nums lg:text-[24px] ${c.hot ? 'text-brand-text' : 'text-gray-900'}`}>
              {loading ? <Skel /> : c.value}
            </p>
            <p className="mt-1 text-[12px] text-gray-400">{c.label}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

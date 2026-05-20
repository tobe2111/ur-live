import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Radio, ShoppingBag, PackagePlus, Wallet } from 'lucide-react'

interface Props {
  pendingOrders: number
  isInfluencer: boolean
  settlementAvailable?: number  // 정산 가능 금액 (있으면 강조 표시)
}

/**
 * 🛡️ 2026-05-20: 셀러 대시보드 상단 큰 CTA 카드 (사용자 요청).
 *   기존 QuickActions / Insights 가 작아서 핵심 플로우 진입이 묻혔음.
 *   4개 핵심 액션 (live / orders / add product / settlements) 을 큰 카드 그리드로 노출.
 *
 *   - 라이브 송출은 인플루언서/both 만 표시 (store_owner 는 숨김)
 *   - pendingOrders > 0 / settlementAvailable > 0 이면 배지로 강조
 */
export default function PrimaryActions({ pendingOrders, isInfluencer, settlementAvailable = 0 }: Props) {
  const { t } = useTranslation()

  const cards: Array<{
    to: string
    title: string
    subtitle: string
    icon: typeof Radio
    bg: string
    iconBg: string
    iconColor: string
    badge?: number
    badgeBg?: string
    show: boolean
  }> = [
    {
      to: '/seller/live-broadcast',
      title: t('seller.primary.startLive', { defaultValue: '라이브 시작' }),
      subtitle: t('seller.primary.startLiveDesc', { defaultValue: '바로 송출' }),
      icon: Radio,
      bg: 'bg-gradient-to-br from-red-500 to-pink-500 text-white hover:from-red-600 hover:to-pink-600 shadow-md hover:shadow-lg',
      iconBg: 'bg-white/20',
      iconColor: 'text-white',
      show: isInfluencer,
    },
    {
      to: '/seller/orders',
      title: t('seller.primary.orders', { defaultValue: '주문 확인' }),
      subtitle: pendingOrders > 0
        ? t('seller.primary.pendingOrders', { defaultValue: '미처리 주문', count: pendingOrders })
        : t('seller.primary.allDone', { defaultValue: '신규/배송 관리' }),
      icon: ShoppingBag,
      bg: pendingOrders > 0
        ? 'bg-blue-500 text-white hover:bg-blue-600 shadow-md'
        : 'bg-white border border-gray-200 hover:bg-gray-50',
      iconBg: pendingOrders > 0 ? 'bg-white/20' : 'bg-blue-50',
      iconColor: pendingOrders > 0 ? 'text-white' : 'text-blue-600',
      badge: pendingOrders > 0 ? pendingOrders : undefined,
      badgeBg: 'bg-white text-blue-700',
      show: true,
    },
    {
      to: '/seller/products/new',
      title: t('seller.primary.addProduct', { defaultValue: '상품 등록' }),
      subtitle: t('seller.primary.addProductDesc', { defaultValue: '쇼핑/공구 모두' }),
      icon: PackagePlus,
      bg: 'bg-white border border-gray-200 hover:bg-gray-50',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
      show: true,
    },
    {
      to: '/seller/settlements',
      title: t('seller.primary.settlements', { defaultValue: '정산' }),
      subtitle: settlementAvailable > 0
        ? `₩${settlementAvailable.toLocaleString()}`
        : t('seller.primary.settlementsDesc', { defaultValue: '딜/현금 출금' }),
      icon: Wallet,
      bg: settlementAvailable > 0
        ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-md'
        : 'bg-white border border-gray-200 hover:bg-gray-50',
      iconBg: settlementAvailable > 0 ? 'bg-white/20' : 'bg-emerald-50',
      iconColor: settlementAvailable > 0 ? 'text-white' : 'text-emerald-600',
      show: true,
    },
  ]

  const visible = cards.filter(c => c.show)

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
      {visible.map((c) => (
        <Link
          key={c.to}
          to={c.to}
          className={`relative flex flex-col items-start gap-2.5 p-4 rounded-2xl transition-all active:scale-[0.98] ${c.bg}`}
        >
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.iconBg}`}>
            <c.icon className={`w-4.5 h-4.5 ${c.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[13px] font-extrabold leading-tight">{c.title}</p>
            <p className={`text-[11px] mt-0.5 ${c.bg.includes('text-white') ? 'opacity-80' : 'text-gray-500'} truncate max-w-[140px]`}>{c.subtitle}</p>
          </div>
          {c.badge && c.badge > 0 && (
            <span className={`absolute top-2.5 right-2.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${c.badgeBg ?? 'bg-red-500 text-white'}`}>
              {c.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}

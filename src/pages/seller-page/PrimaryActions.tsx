import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShoppingBag, Wallet, Ticket, Utensils, Megaphone } from 'lucide-react'

interface Props {
  pendingOrders: number
  activeGroupBuys: number
  settlementAvailable?: number  // 정산 가능 금액 (있으면 강조 표시)
}

/**
 * 🛡️ 2026-05-20: 셀러 대시보드 상단 큰 CTA 카드 (사용자 요청).
 * 🧱 2026-08-23 (대표 AB테스트 — "중요한 작업들이 어느정도 모여있어야 해. 컴팩트하게"):
 *   흩어져 있던 핵심 작업(빠른 액션의 '이용권 등록' + 큰 카드 3개)을 **한 줄 5버튼**으로 통합.
 *   [이용권 등록(주역, 다크) · 주문 확인 · 이용권 관리 · 정산 · 인플루언서 찾기]
 *   가로형 컴팩트 버튼(아이콘+텍스트 한 줄) — 종전 세로형 큰 카드 대비 높이 절반.
 *   ('상품 등록'/'라이브'는 제거 — 상품은 링크샵 일원화, 라이브는 영구 중단.)
 */
export default function PrimaryActions({ pendingOrders, activeGroupBuys, settlementAvailable = 0 }: Props) {
  const { t } = useTranslation()

  const cards: Array<{
    to: string
    title: string
    subtitle: string
    icon: typeof Ticket
    bg: string
    iconBg: string
    iconColor: string
    badge?: number
    badgeBg?: string
  }> = [
    {
      to: '/seller/meal-voucher/new',
      title: t('seller.registerVoucher', { defaultValue: '이용권 등록' }),
      subtitle: t('seller.selectOnKakaoMap', { defaultValue: '카카오맵으로 매장 선택' }),
      icon: Utensils,
      bg: 'bg-gray-900 text-white hover:bg-gray-800 shadow-md',
      iconBg: 'bg-white/15',
      iconColor: 'text-white',
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
    },
    {
      to: '/seller/group-buy',
      title: t('seller.nav.mealVoucher', { defaultValue: '이용권 관리' }),
      subtitle: activeGroupBuys > 0
        ? t('seller.activeGroupBuyCount', { defaultValue: '진행 중 {{count}}건', count: activeGroupBuys })
        : t('seller.primary.voucherManageDesc', { defaultValue: '판매·현황' }),
      icon: Ticket,
      bg: 'bg-white border border-gray-200 hover:bg-gray-50',
      iconBg: 'bg-pink-50',
      iconColor: 'text-pink-600',
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
    },
    {
      to: '/seller/influencers',
      title: t('seller.nav.findInfluencers', { defaultValue: '인플루언서 찾기' }),
      subtitle: t('seller.primary.findInfluencersDesc', { defaultValue: '협업 제안 보내기' }),
      icon: Megaphone,
      bg: 'bg-white border border-gray-200 hover:bg-gray-50',
      iconBg: 'bg-violet-50',
      iconColor: 'text-violet-600',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {cards.map((c) => (
        <Link
          key={c.to}
          to={c.to}
          className={`relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-all active:scale-[0.98] ${c.bg}`}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${c.iconBg}`}>
            <c.icon className={`w-4 h-4 ${c.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className="text-[12.5px] font-extrabold leading-tight truncate">{c.title}</p>
            <p className={`text-[10.5px] mt-0.5 truncate ${c.bg.includes('text-white') ? 'opacity-80' : 'text-gray-500'}`}>{c.subtitle}</p>
          </div>
          {c.badge && c.badge > 0 && (
            <span className={`absolute top-1.5 right-1.5 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full ${c.badgeBg ?? 'bg-red-500 text-white'}`}>
              {c.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}

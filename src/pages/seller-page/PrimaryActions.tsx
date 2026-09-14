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
 *   흩어져 있던 핵심 작업을 **한 줄 5버튼**으로 통합.
 *   [이용권 등록 · 주문 확인 · 이용권 관리 · 정산 · 소개 파트너 찾기]
 *
 * 🎨 2026-09-14 (대표 Rinda 시안 — docs/design/dashboard-rinda-2026-09.md §4):
 *   **검은 타일을 걷어냈다.** 종전엔 `bg-gray-900` 타일이 조건에 따라 **동시에 셋까지**(이용권 등록 항상
 *   + 미처리 주문 + 정산 가능) 떴다. 셋이 똑같이 새까매서 "무엇이 더 급한가"를 구별해 주지 못했고,
 *   같은 화면의 매장 카드 버튼까지 검정이라 대표가 말한 "헷갈린다"의 한 축이었다.
 *   ⇒ 기본은 흰 면 + 헤어라인 하나로 통일하고, **강조는 브랜드 틴트 한 가지로만** 준다
 *     (= "당신이 지금 처리할 게 여기 있다"). 강조가 생기는 자리는 미처리 주문 · 정산 가능 둘뿐이다.
 *   '이용권 등록'은 사이드바 상단 **파란 CTA** 가 주역을 맡는다(SellerLayout) — 그래서 여기서는
 *   다른 넷과 같은 무게로 둔다. 주역을 없앤 게 아니라 **한 자리로 모은 것**이다.
 */
export default function PrimaryActions({ pendingOrders, activeGroupBuys, settlementAvailable = 0 }: Props) {
  const { t } = useTranslation()

  const cards: Array<{
    to: string
    title: string
    subtitle: string
    icon: typeof Ticket
    iconBg: string
    iconColor: string
    /** 지금 사람이 움직여야 하는 자리 — 브랜드 틴트로 딱 이때만 강조한다. */
    attention?: boolean
    badge?: number
  }> = [
    {
      to: '/seller/meal-voucher/new',
      title: t('seller.registerVoucher', { defaultValue: '이용권 등록' }),
      subtitle: t('seller.selectOnKakaoMap', { defaultValue: '카카오맵으로 매장 선택' }),
      icon: Utensils,
      iconBg: 'bg-brand-tint',
      iconColor: 'text-brand-text',
    },
    {
      to: '/seller/orders',
      title: t('seller.primary.orders', { defaultValue: '주문 확인' }),
      subtitle: pendingOrders > 0
        ? t('seller.primary.pendingOrders', { defaultValue: '미처리 주문', count: pendingOrders })
        : t('seller.primary.allDone', { defaultValue: '신규/배송 관리' }),
      icon: ShoppingBag,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-500',
      attention: pendingOrders > 0,
      badge: pendingOrders > 0 ? pendingOrders : undefined,
    },
    {
      to: '/seller/group-buy',
      title: t('seller.nav.mealVoucher', { defaultValue: '이용권 관리' }),
      subtitle: activeGroupBuys > 0
        ? t('seller.activeGroupBuyCount', { defaultValue: '진행 중 {{count}}건', count: activeGroupBuys })
        : t('seller.primary.voucherManageDesc', { defaultValue: '판매·현황' }),
      icon: Ticket,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-500',
    },
    {
      to: '/seller/settlements',
      title: t('seller.primary.settlements', { defaultValue: '정산' }),
      subtitle: settlementAvailable > 0
        ? `₩${settlementAvailable.toLocaleString()}`
        : t('seller.primary.settlementsDesc', { defaultValue: '딜/현금 출금' }),
      icon: Wallet,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-500',
      attention: settlementAvailable > 0,
    },
    {
      to: '/seller/influencers',
      title: t('seller.nav.findInfluencers', { defaultValue: '소개 파트너 찾기' }),
      subtitle: t('seller.primary.findInfluencersDesc', { defaultValue: '협업 제안 보내기' }),
      icon: Megaphone,
      iconBg: 'bg-gray-100',
      iconColor: 'text-gray-500',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((c) => (
        <Link
          key={c.to}
          to={c.to}
          className={`relative flex items-center gap-2.5 rounded-xl px-3 py-2.5 transition-colors active:scale-[0.98] ${
            c.attention
              ? 'border border-brand bg-brand-tint'
              : 'border border-rule bg-white hover:bg-gray-50'
          }`}
        >
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${c.attention ? 'bg-white' : c.iconBg}`}>
            <c.icon className={`h-4 w-4 ${c.attention ? 'text-brand-text' : c.iconColor}`} />
          </div>
          <div className="min-w-0">
            <p className={`truncate text-[13px] font-bold leading-tight ${c.attention ? 'text-brand-text' : 'text-gray-900'}`}>{c.title}</p>
            <p className={`mt-0.5 truncate text-[11px] ${c.attention ? 'text-brand-text opacity-80' : 'text-gray-500'}`}>{c.subtitle}</p>
          </div>
          {c.badge && c.badge > 0 && (
            <span className="absolute right-1.5 top-1.5 rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-extrabold text-white">
              {c.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  )
}

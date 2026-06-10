import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Building2, Ticket, BookOpen, type LucideIcon } from 'lucide-react'

/**
 * 🧭 2026-06-09: 신규 셀러(상품 0 · 주문 0) 빈 대시보드용 3단계 시작 안내.
 *
 * 배경: 2026-06-04 간소화 때 온보딩 체크리스트가 통째로 제거되어, 첫 진입한 매장 사장님이
 * 빈 KPI 카드만 보고 다음 행동을 모름. 풀 체크리스트 부활 대신 — 빈 상태일 때만 나오는
 * 가벼운 3단계 카드(데이터 생기면 자동 소멸, localStorage/서버 상태 없음).
 */
export default function NewSellerSteps({ isStoreOwner }: { isStoreOwner: boolean }) {
  const { t } = useTranslation()
  const steps: { icon: LucideIcon; title: string; desc: string; path: string }[] = [
    {
      icon: Building2,
      title: t('seller.newSteps.step1', { defaultValue: '사업자·정산 정보 입력' }),
      desc: t('seller.newSteps.step1Desc', { defaultValue: '정산 받을 계좌와 사업자 정보를 등록해요' }),
      path: '/seller/business-info',
    },
    isStoreOwner
      ? {
          icon: Ticket,
          title: t('seller.newSteps.step2Store', { defaultValue: '첫 공구권 발행' }),
          desc: t('seller.newSteps.step2StoreDesc', { defaultValue: '우리 매장 공동구매 교환권을 만들어요' }),
          path: '/seller/group-buy',
        }
      : {
          icon: Ticket,
          title: t('seller.newSteps.step2', { defaultValue: '첫 상품 등록' }),
          desc: t('seller.newSteps.step2Desc', { defaultValue: '판매할 상품을 올려요' }),
          path: '/seller/products/new',
        },
    {
      icon: BookOpen,
      title: t('seller.newSteps.step3', { defaultValue: '운영 가이드 읽기' }),
      desc: t('seller.newSteps.step3Desc', { defaultValue: '주문 처리부터 정산까지 한눈에' }),
      path: '/seller/guide',
    },
  ]
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-5">
      <h3 className="text-sm font-extrabold text-gray-900">
        👋 {t('seller.newSteps.title', { defaultValue: '시작해 볼까요?' })}
      </h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-3">
        {t('seller.newSteps.subtitle', { defaultValue: '세 단계만 마치면 판매를 시작할 수 있어요' })}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {steps.map((s, i) => (
          <Link
            key={s.path}
            to={s.path}
            className="flex items-start gap-2.5 rounded-xl border border-gray-200 p-3 hover:bg-gray-50 transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-[11px] font-extrabold text-gray-700">
              {i + 1}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-gray-900 flex items-center gap-1.5">
                <s.icon className="w-3.5 h-3.5 text-gray-500" /> {s.title}
              </p>
              <p className="text-[11px] text-gray-500 mt-0.5">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

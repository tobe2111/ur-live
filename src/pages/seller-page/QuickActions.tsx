import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Utensils, Gift } from 'lucide-react'

interface Props {
  hasMealVouchers: boolean
  sellerType: string
  activeGroupBuys: number
  isInfluencer: boolean
  hasLiveHistory: boolean
}

/**
 * 셀러 빠른 액션 — 활동 데이터 기반 동적 배치.
 * 🛡️ TD-006 추출 (2026-05-06).
 * 🖥️ 2026-07-16 (대표 — "공동구매 만들기 필요한가?"): '공동구매 만들기'와 '이용권 등록'이 둘 다
 *   /seller/meal-voucher/new 로 가는 **중복 액션**이라 '공동구매 만들기' 제거. '이용권 등록'을 항상
 *   단일 primary 로 두고, 진행 중 공구가 있으면 '공동구매 관리'만 추가 노출(필요한 것 우선).
 */
export default function QuickActions({ activeGroupBuys }: Props) {
  const { t } = useTranslation()

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('seller.quickActions')}</h2>
      <div className="space-y-2">
        {/* 이용권 등록 — 항상 primary (이용권 발행 = 매장 공구 등록, 같은 흐름) */}
        <Link to="/seller/meal-voucher/new"
          className="flex items-center justify-between p-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors">
          <div className="flex items-center gap-3">
            <Utensils className="w-4 h-4" />
            <div>
              <p className="text-[13px] font-bold">{t('seller.registerVoucher')}</p>
              <p className="text-[11px] text-gray-400">{t('seller.selectOnKakaoMap')}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </Link>

        {/* 공동구매 관리 — 진행 중 공구가 있을 때만 */}
        {activeGroupBuys > 0 && (
          <Link to="/seller/group-buy"
            className="flex items-center justify-between p-3.5 bg-pink-50 border border-pink-200 rounded-xl hover:bg-pink-100 transition-colors">
            <div className="flex items-center gap-3">
              <Gift className="w-4 h-4 text-pink-600" />
              <div>
                <p className="text-[13px] font-bold text-gray-900">{t('seller.groupBuyManage')}</p>
                <p className="text-[11px] text-pink-600">{t('seller.activeGroupBuyCount', { count: activeGroupBuys })}</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400" />
          </Link>
        )}
      </div>
    </div>
  )
}

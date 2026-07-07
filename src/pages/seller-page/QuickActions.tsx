import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Utensils, Gift, Users, Radio } from 'lucide-react'
import { isStoreOwner as isStoreOwnerRole } from '@/shared/seller-roles'

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
 */
export default function QuickActions({
  hasMealVouchers, sellerType, activeGroupBuys, isInfluencer, hasLiveHistory
}: Props) {
  const { t } = useTranslation()
  // 🛡️ 2026-05-21 Phase D-5: isStoreOwner helper 사용.
  const isVoucherFirst = hasMealVouchers || isStoreOwnerRole(sellerType)

  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-900 mb-3">{t('seller.quickActions')}</h2>
      <div className="space-y-2">
        {isVoucherFirst && (
          <>
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
          </>
        )}

        {/* 공동구매 만들기 (항상 표시) */}
        <Link to="/seller/meal-voucher/new"
          className={`flex items-center justify-between p-3.5 rounded-xl transition-colors ${
            isVoucherFirst
              ? 'bg-white border border-gray-200 hover:bg-gray-50'
              : 'bg-gray-900 text-white hover:bg-gray-800'
          }`}>
          <div className="flex items-center gap-3">
            <Users className={`w-4 h-4 ${isVoucherFirst ? 'text-gray-600' : ''}`} />
            <div>
              <p className={`text-[13px] font-bold ${isVoucherFirst ? 'text-gray-900' : ''}`}>{t('seller.createGroupBuy')}</p>
              <p className={`text-[11px] ${isVoucherFirst ? 'text-gray-500' : 'text-gray-400'}`}>{t('seller.tierBasedDiscount')}</p>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </Link>

        {/* 🗑️ 2026-07-07 라이브커머스 제거: '라이브 방송 시작' 빠른 액션 삭제. */}
      </div>
    </div>
  )
}

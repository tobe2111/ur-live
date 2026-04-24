import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Package, ShoppingBag, Radio, CheckCircle2, CreditCard } from 'lucide-react'
import type { DashboardStats } from '@/components/seller/dashboard/seller-dashboard-types'

// 🛡️ 2026-04-23 배치 170: 셀러 온보딩 체크리스트
export default function OnboardingChecklist({ stats, hasBank }: { stats: DashboardStats; hasBank: boolean }) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('seller_onboarding_done') === '1')
  if (dismissed) return null

  const steps = [
    { key: 'product', done: (stats.totalProducts ?? 0) > 0, label: t('seller.onboarding.addProduct', '첫 상품 등록'), path: '/seller/products/new', icon: Package },
    { key: 'bank', done: hasBank, label: t('seller.onboarding.bankAccount', '정산 계좌 등록'), path: '/seller/profile', icon: CreditCard },
    { key: 'live', done: (stats.totalStreams ?? 0) > 0, label: t('seller.onboarding.firstLive', '첫 라이브 방송'), path: '/seller/live-broadcast', icon: Radio },
    { key: 'order', done: (stats.totalOrders ?? 0) > 0, label: t('seller.onboarding.firstOrder', '첫 주문 받기'), path: '#', icon: ShoppingBag },
  ]
  const doneCount = steps.filter(s => s.done).length
  const allDone = doneCount === steps.length
  if (allDone) {
    localStorage.setItem('seller_onboarding_done', '1')
    return null
  }
  const progress = Math.round((doneCount / steps.length) * 100)

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900">{t('seller.onboarding.title', '🚀 시작 가이드')}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{t('seller.onboarding.subtitle', '아래 단계를 완료하면 판매를 시작할 수 있어요')}</p>
        </div>
        <button onClick={() => { setDismissed(true); localStorage.setItem('seller_onboarding_done', '1') }}
          className="text-xs text-gray-400 hover:text-gray-600">
          {t('common.dismiss', '닫기')}
        </button>
      </div>
      <div className="w-full bg-blue-100 rounded-full h-2">
        <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
      </div>
      <p className="text-[11px] text-blue-700 font-medium">{doneCount}/{steps.length} {t('seller.onboarding.completed', '완료')}</p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {steps.map(s => (
          <Link key={s.key} to={s.done ? '#' : s.path}
            className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs transition-all ${
              s.done
                ? 'bg-green-50 border-green-200 text-green-700'
                : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300 hover:bg-blue-50'
            }`}>
            {s.done
              ? <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
              : <s.icon className="w-4 h-4 text-gray-400 shrink-0" />}
            <span className={s.done ? 'line-through' : 'font-medium'}>{s.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}

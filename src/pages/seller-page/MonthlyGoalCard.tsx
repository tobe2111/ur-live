import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'

interface Props {
  totalRevenue: number
  monthlyGoal: number
  setMonthlyGoal: (n: number) => void
  editingGoal: boolean
  setEditingGoal: (v: boolean) => void
  goalProgress: number
  daysLeft: number
}

/**
 * 월간 매출 목표 진행률 카드.
 * 🛡️ TD-006 추출 (2026-05-06).
 */
export default function MonthlyGoalCard({
  totalRevenue, monthlyGoal, setMonthlyGoal, editingGoal, setEditingGoal, goalProgress, daysLeft
}: Props) {
  const { t } = useTranslation()
  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E8EAEE]">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-bold text-gray-700">{t('seller.monthlyGoalTitle')}</p>
            <button
              onClick={() => setEditingGoal(!editingGoal)}
              className="text-[10px] text-blue-600 hover:underline"
            >
              {editingGoal ? t('common.close') : t('seller.changeGoal')}
            </button>
          </div>
          {editingGoal ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={0}
                step={100000}
                defaultValue={monthlyGoal}
                onBlur={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0)
                  setMonthlyGoal(v)
                  localStorage.setItem('seller_monthly_goal', String(v))
                  setEditingGoal(false)
                }}
                className="text-[14px] font-bold text-gray-900 px-2 py-1 border border-gray-300 rounded w-40"
              />
              <span className="text-[12px] text-gray-500">{t('common.won')}</span>
            </div>
          ) : (
            <p className="text-[16px] sm:text-[20px] font-extrabold text-gray-900 truncate">
              {formatNumber(totalRevenue || 0)}{t('common.won')} / {formatNumber(monthlyGoal)}{t('common.won')}
            </p>
          )}
        </div>
        <p className="text-[13px] font-extrabold shrink-0" style={{ color: '#FF0033' }}>
          {Math.round(goalProgress)}%
        </p>
      </div>
      <div className="w-full h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${Math.min(goalProgress, 100)}%`,
            background: 'linear-gradient(90deg, #FF0033, #EC4899)'
          }}
        />
      </div>
      <p className="text-[10px] text-gray-500 mt-1.5">
        {t('seller.daysLeft', { days: daysLeft })} · {t('seller.goalRemaining', { amount: Math.max(0, monthlyGoal - (totalRevenue || 0)) })}
      </p>
    </div>
  )
}

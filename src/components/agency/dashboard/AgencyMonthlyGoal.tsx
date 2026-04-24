import { useTranslation } from 'react-i18next'

interface AgencyMonthlyGoalProps {
  currentRev: number
  monthlyGoal: number
  goalProgress: number
  daysLeft: number
  editingGoal: boolean
  onToggleEdit: () => void
  onGoalChange: (value: number) => void
}

export function AgencyMonthlyGoal({
  currentRev,
  monthlyGoal,
  goalProgress,
  daysLeft,
  editingGoal,
  onToggleEdit,
  onGoalChange,
}: AgencyMonthlyGoalProps) {
  const { t } = useTranslation()

  return (
    <div className="bg-white rounded-2xl p-4 border border-[#E8EAEE]">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[12px] font-bold text-gray-700">{t('seller.monthlyGoalTitle')}</p>
            <button
              onClick={onToggleEdit}
              className="text-[10px] text-purple-600 hover:underline"
            >
              {editingGoal ? t('common.close') : t('seller.changeGoal')}
            </button>
          </div>
          {editingGoal ? (
            <div className="flex items-center gap-2 mt-1">
              <input
                type="number"
                min={0}
                step={1000000}
                defaultValue={monthlyGoal}
                onBlur={(e) => {
                  const v = Math.max(0, Number(e.target.value) || 0)
                  onGoalChange(v)
                }}
                className="text-[14px] font-bold text-gray-900 px-2 py-1 border border-gray-300 rounded w-44"
              />
              <span className="text-[12px] text-gray-500">{t('common.won')}</span>
            </div>
          ) : (
            <p className="text-[16px] sm:text-[20px] font-extrabold text-gray-900 truncate">
              {currentRev.toLocaleString()}{t('common.won')} / {monthlyGoal.toLocaleString()}{t('common.won')}
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
        {t('seller.daysLeft', { days: daysLeft })} · {t('seller.goalRemaining', { amount: Math.max(0, monthlyGoal - currentRev).toLocaleString() })}
      </p>
    </div>
  )
}

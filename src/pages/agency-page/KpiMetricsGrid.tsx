import { useTranslation } from 'react-i18next'
import type { KpiData, MonthlyTask } from './types'

export function KpiMetricsGrid({ kpiData }: { kpiData: KpiData }) {
  const { t } = useTranslation()
  const metrics = [
    { labelKey: 'agency.kpiMetricRevenue',    labelDefault: '총 매출(딜)',       value: `${(kpiData.diamond_total / 10_000).toFixed(1)}만`, subKey: 'agency.kpiMetricRevenueSub',    subDefault: '매출+후원',       color: 'bg-purple-500' },
    { labelKey: 'agency.kpiMetricLiveRate',   labelDefault: '라이브 진행률',     value: `${kpiData.live_rate}%`,                                subKey: 'agency.kpiMetricLiveRateSub',   subDefault: '진행 셀러 비율',  color: 'bg-blue-500' },
    { labelKey: 'agency.kpiMetricEffLive',    labelDefault: '유효 라이브 진행률', value: `${kpiData.effective_live_rate}%`,                       subKey: 'agency.kpiMetricEffLiveSub',    subDefault: '30분↑ 셀러',      color: 'bg-indigo-500' },
    { labelKey: 'agency.kpiMetricActive',     labelDefault: '활성 셀러',         value: String(kpiData.active_creators),                        subKey: 'agency.kpiMetricActiveSub',     subDefault: '진행 셀러 수',    color: 'bg-emerald-500' },
    { labelKey: 'agency.kpiMetricEffActive',  labelDefault: '유효 활성 셀러',    value: String(kpiData.effective_active_creators),              subKey: 'agency.kpiMetricEffActiveSub',  subDefault: '30분↑ 진행',      color: 'bg-teal-500' },
    { labelKey: 'agency.kpiMetricNew',        labelDefault: '신규 셀러',         value: String(kpiData.new_creators_today),                     subKey: 'agency.kpiMetricNewSub',        subDefault: '오늘 영입',       color: 'bg-orange-500' },
  ]
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          📊 {t('agency.kpiMetricTitle', { days: kpiData.period_days, defaultValue: `핵심 지표 6 (${kpiData.period_days}일 기준 · 참고용)` })}
        </span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {metrics.map((kpi) => (
          <div key={kpi.labelKey} className="rounded-xl p-3 bg-white border border-gray-200">
            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              {t(kpi.labelKey, { defaultValue: kpi.labelDefault })}
            </p>
            <p className="text-lg font-extrabold text-gray-900">{kpi.value}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">
              {t(kpi.subKey, { defaultValue: kpi.subDefault })}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MonthlyTasksGrid({ tasks }: { tasks: MonthlyTask[] }) {
  const { t } = useTranslation()
  if (tasks.length === 0) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          🎯 {t('agency.monthlyTaskTitle', { defaultValue: '이번 달 의무 작업' })}
        </span>
        <span className="text-[10px] text-gray-400">{tasks[0]?.month}</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {tasks.map(task => {
          const pct = Math.min(100, Math.round((task.actual_value / Math.max(1, task.target_value)) * 100))
          const isCompleted = task.status === 'completed'
          const isFailed = task.status === 'failed'
          const taskLabel: Record<MonthlyTask['task_type'], string> = {
            creator_growth: t('agency.taskCreatorGrowth', { defaultValue: '신규 영입' }),
            sales_quota:    t('agency.taskSalesQuota',    { defaultValue: '월 매출' }),
            activation:     t('agency.taskActivation',    { defaultValue: '활성화 (1시간↑ 라이브)' }),
          }
          const formatValue = (n: number) =>
            task.task_type === 'sales_quota'
              ? `${(n / 10_000).toFixed(0)}${t('agency.manwon', { defaultValue: '만원' })}`
              : `${n}${t('common.person', { defaultValue: '명' })}`
          return (
            <div key={task.id} className={`rounded-xl p-4 border ${
              isCompleted ? 'bg-green-50 border-green-200' :
              isFailed    ? 'bg-red-50 border-red-200' :
                            'bg-white border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-bold text-gray-700">{taskLabel[task.task_type]}</p>
                {isCompleted && <span className="text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-bold">{t('agency.taskDone', { defaultValue: '완료 ✓' })}</span>}
                {isFailed    && <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-bold">{t('agency.taskFailed', { defaultValue: '미달' })}</span>}
              </div>
              <p className="text-lg font-extrabold text-gray-900 mb-2">
                {formatValue(task.actual_value)} <span className="text-xs text-gray-400 font-normal">/ {formatValue(task.target_value)}</span>
              </p>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`h-full transition-all ${isCompleted ? 'bg-green-500' : isFailed ? 'bg-red-500' : pct >= 70 ? 'bg-blue-500' : 'bg-amber-500'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-gray-500 mt-1">{pct}%</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

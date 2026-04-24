import { useNavigate } from 'react-router-dom'
import type { AgencyInsight } from './agency-dashboard-types'

interface AgencyInsightsCalloutsProps {
  insights: AgencyInsight[]
}

export function AgencyInsightsCallouts({ insights }: AgencyInsightsCalloutsProps) {
  const navigate = useNavigate()

  if (insights.length === 0) return null

  return (
    <div className="space-y-2">
      {insights.map((insight, i) => (
        <div key={i} className={`rounded-xl p-3 flex items-start gap-3 ${insight.severity === 'high' ? 'bg-red-50 border border-red-200' : insight.severity === 'medium' ? 'bg-amber-50 border border-amber-200' : 'bg-blue-50 border border-blue-200'}`}>
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${insight.severity === 'high' ? 'bg-red-100' : insight.severity === 'medium' ? 'bg-amber-100' : 'bg-blue-100'}`}>
            <insight.icon className={`w-4 h-4 ${insight.severity === 'high' ? 'text-red-600' : insight.severity === 'medium' ? 'text-amber-600' : 'text-blue-600'}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-extrabold text-gray-900">{insight.title}</p>
            {insight.description && <p className="text-[11px] text-gray-600 mt-0.5">{insight.description}</p>}
          </div>
          {insight.action && (
            <button onClick={() => navigate(insight.action!.path)} className="text-[11px] font-bold px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 shrink-0">
              {insight.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

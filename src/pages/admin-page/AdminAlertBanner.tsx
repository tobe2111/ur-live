/**
 * 🔔 어드민 실시간 알림 배너 — `AdminPage` 에서 추출(2026-09-01).
 *
 * ■ 왜 파일로 뺐나
 *   `AdminPage.tsx` 는 파일크기 래칫에 **동결된 644줄 god 파일**이라 한 줄도 못 늘린다.
 *   이모지를 lucide 로 바꾸면서 두 줄이 늘었고, 룰(CLAUDE.md "새 페이지 체크리스트")이
 *   그럴 때 하라고 정해 둔 것이 **섹션 추출**이다 — 래칫을 올리는 게 아니라.
 *
 * ■ 아이콘·색은 `type` 하나에서 파생한다
 *   예전엔 `Alert.emoji` 필드가 따로 있어 색(type)과 **같은 말을 두 번** 했고, 둘이 어긋나면
 *   (빨간 배경에 🎉) 아무도 못 잡았다. 이제 아래 표가 유일한 출처다.
 */
import { AlertTriangle, PartyPopper, Siren, X } from 'lucide-react'
import type { Alert } from './types'

const ALERT_STYLE = {
  success: { Icon: PartyPopper, box: 'bg-green-50 border-green-200', text: 'text-green-600' },
  warning: { Icon: AlertTriangle, box: 'bg-amber-50 border-amber-200', text: 'text-amber-600' },
  error: { Icon: Siren, box: 'bg-red-50 border-red-200', text: 'text-red-600' },
} as const

export default function AdminAlertBanner({ alerts, onDismiss, closeLabel }: {
  alerts: Alert[]
  onDismiss: (index: number) => void
  closeLabel: string
}) {
  if (alerts.length === 0) return null
  return (
    <div className="space-y-2 mb-4">
      {alerts.map((alert, i) => {
        const A = ALERT_STYLE[alert.type]
        return (
          <div key={i} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${A.box}`}>
            <A.Icon className={`w-[18px] h-[18px] shrink-0 ${A.text}`} strokeWidth={1.9} aria-hidden />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{alert.title}</p>
              <p className="text-xs text-gray-500">{alert.message}</p>
            </div>
            <button onClick={() => onDismiss(i)} aria-label={closeLabel} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}

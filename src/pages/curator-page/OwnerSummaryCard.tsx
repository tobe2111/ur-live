import { Link } from 'react-router-dom'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatNumber } from '@/utils/format'
import type { DashboardStats } from '@/features/curator/api/curator-api'

/**
 * 🧾 **최근 30일 내 유어샵** — [방문 · 구매 · 소개 수익] (2026-11-03 대표 *"유어샵은 B"*, 시안 I4·I5).
 *
 * 📍 2026-11-04 대표 *"최근 30일 내 유어샵 부분을 관리 버튼 안에 넣거나 해줘"* — 유어샵(손님 화면)에서 빼고
 *   **관리 화면(`/u/me/manage`)의 '수익과 정산' 맨 위**로 옮겼다. 그 자리에 있던 30일 적립 띠(OwnerEarningsStrip)를 대신한다
 *   (같은 요청·같은 30일 — 두 장이면 같은 숫자를 두 번 말한다). 담기·공유 버튼은 뺐다: 담기는 바로 위 '내 유어샵' 줄에,
 *   공유는 유어샵 머리에 이미 있다.
 *
 * 숫자는 수익 콘솔과 **같은 요청·같은 RQ 키**(`['curator','dashboard']`)다. 모르면 숫자를 지어내지 않는다(`—`).
 */
export default function OwnerSummaryCard() {
  const q = useApiQuery<DashboardStats | null>(
    ['curator', 'dashboard'],
    '/api/curator/me/dashboard',
    { select: (raw) => ((raw as { success?: boolean; stats?: DashboardStats })?.success ? ((raw as { stats: DashboardStats }).stats) : null) },
  )
  const s = q.data ?? null
  const cell = (v: number | null | undefined, unit = '') => (s && v != null ? `${formatNumber(v)}${unit}` : '—')
  return (
    <Link to="/u/me/earnings" className="block py-3 active:opacity-80" data-testid="ushop-owner-summary">
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-gray-500 dark:text-gray-400">최근 30일 내 유어샵</p>
        <span className="text-[13px] text-gray-500 dark:text-gray-400">자세히 ›</span>
      </div>
      <div className="mt-2 grid grid-cols-3">
        {([['방문', cell(s?.unique_clicks_30d ?? s?.clicks_30d)], ['구매', cell(s?.purchases_30d)], ['소개 수익', cell(s?.month_earnings, '원')]] as const).map(([label, val]) => (
          <div key={label}>
            <p className="text-[12px] text-gray-500 dark:text-gray-400">{label}</p>
            <p className="mt-1 text-[20px] font-bold tabular-nums text-gray-900 dark:text-white">{val}</p>
          </div>
        ))}
      </div>
    </Link>
  )
}

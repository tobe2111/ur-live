/**
 * 📈 매출 분석 — 마이 안에서 (2026-09-25, 설계 §19, 대표 *"분석도 마이에서 돼야해"*)
 *
 * ## 표가 아니라 요약이다
 * §14 선별 표가 분석을 뺀 이유는 *"표를 봐야 하면 폰 한 손으로 못 한다"* 였다. 대표가 "전부" 로
 * 답했으므로 그 기준은 이제 **어떻게 넣을지**를 정한다 — 표를 옮기는 대신 **읽히는 요약**으로 다시 그린다.
 * 행과 열을 옮겨 놓으면 폰에서 가로로 잘리고, 결국 아무도 안 본다.
 *
 * ## 서버가 준 값만 그린다
 * `GET /api/seller/dashboard/stats` 의 `daily_revenue`(30일) 하나로 전부 만든다.
 * 🔴 **화면이 매출을 계산하지 않는다** — 합계도 서버 배열을 더한 것이고, 그 배열이 진실이다.
 * 깊은 분석(원장·정산 명세·상품별)은 여전히 전체 도구가 맡는다.
 */
import { useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { formatNumber } from '@/utils/format'
import { currentSeatId } from '@/lib/seller-seat'
import Sheet from './Sheet'

interface Daily { date: string; revenue: number }

/** KST 기준 'YYYY-MM-DD' — 서버 `dashboard/stats` 가 같은 규약으로 키를 만든다. */
const kstKey = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10)

export default function AnalyticsSheet({ sellerId, storeName, onClose }: {
  sellerId: number
  storeName: string
  onClose: () => void
}) {
  const [daily, setDaily] = useState<Daily[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    if (currentSeatId() !== sellerId) { setFailed(true); return }
    import('@/lib/api').then(({ default: api }) => api.get('/api/seller/dashboard/stats'))
      .then((r) => {
        if (!alive) return
        if (!r.data?.success) { setFailed(true); return }
        const d = r.data.data as { daily_revenue?: Daily[] }
        setDaily(Array.isArray(d?.daily_revenue) ? d.daily_revenue : [])
      })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [sellerId])

  const view = useMemo(() => {
    if (!daily) return null
    const byDate = new Map(daily.map((d) => [d.date, Number(d.revenue) || 0]))
    // 최근 14일 — 폰 폭에서 막대가 읽히는 최대치(30일은 1~2px 이 되어 아무 말도 못 한다).
    const days = Array.from({ length: 14 }, (_, i) => {
      const ms = Date.now() - (13 - i) * 86400_000
      const key = kstKey(ms)
      return { key, label: key.slice(8), revenue: byDate.get(key) || 0 }
    })
    const max = Math.max(1, ...days.map((d) => d.revenue))
    const sum = (n: number) => days.slice(-n).reduce((s, d) => s + d.revenue, 0)
    const last7 = sum(7)
    const prev7 = days.slice(0, 7).reduce((s, d) => s + d.revenue, 0)
    const delta = prev7 > 0 ? Math.round(((last7 - prev7) / prev7) * 100) : (last7 > 0 ? 100 : 0)
    const best = days.reduce((a, d) => (d.revenue > a.revenue ? d : a), days[0])
    return { days, max, last7, prev7, delta, best, month: daily.filter((d) => d.date.startsWith(kstKey(Date.now()).slice(0, 7))).reduce((s, d) => s + (Number(d.revenue) || 0), 0) }
  }, [daily])

  return (
    <Sheet title="매출 분석" onClose={onClose}>
      {!view && !failed && (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" aria-hidden="true" />
        </div>
      )}
      {failed && (
        <p className="px-4 py-8 text-center text-[13.5px] text-gray-500 dark:text-gray-400">
          매출을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.
        </p>
      )}
      {view && (
        <div className="px-4 py-4">
          <p className="text-[12px] text-gray-500 dark:text-gray-400">{storeName} · 이번 달</p>
          <p className="text-[30px] font-extrabold tabular-nums leading-none text-gray-900 dark:text-white mt-1">
            {formatNumber(view.month)}
            <span className="text-[16px] font-bold text-gray-500 dark:text-gray-400 ml-1">원</span>
          </p>

          {/* 최근 14일 — 막대 하나가 하루. 높이는 그 기간의 최고 매출 기준(절대 금액이 아니다). */}
          <div className="mt-5 flex items-end gap-[3px] h-24" aria-hidden="true">
            {view.days.map((d) => (
              <span key={d.key} className="flex-1 flex flex-col justify-end h-full">
                <span
                  className={`w-full rounded-t-sm ${d.revenue > 0 ? 'bg-brand' : 'bg-gray-200 dark:bg-white/10'}`}
                  style={{ height: `${Math.max(d.revenue > 0 ? 6 : 2, Math.round((d.revenue / view.max) * 100))}%` }}
                />
              </span>
            ))}
          </div>
          <div className="flex justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-1.5">
            <span>{view.days[0].label}일</span>
            <span>오늘</span>
          </div>

          <dl className="mt-5 pt-4 border-t border-rule space-y-3">
            <div className="flex items-baseline justify-between">
              <dt className="text-[13.5px] text-gray-500 dark:text-gray-400">최근 7일</dt>
              <dd className="text-[15px] font-bold tabular-nums text-gray-900 dark:text-white">
                {formatNumber(view.last7)}원
                {view.prev7 > 0 && (
                  <span className={`ml-2 text-[12.5px] font-semibold ${view.delta >= 0 ? 'text-brand-text' : 'text-gray-500 dark:text-gray-400'}`}>
                    지난주보다 {view.delta >= 0 ? '+' : ''}{view.delta}%
                  </span>
                )}
              </dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-[13.5px] text-gray-500 dark:text-gray-400">가장 많이 판 날</dt>
              <dd className="text-[15px] font-bold tabular-nums text-gray-900 dark:text-white">
                {view.best.revenue > 0 ? <>{view.best.label}일 · {formatNumber(view.best.revenue)}원</> : '아직 없어요'}
              </dd>
            </div>
          </dl>

          <p className="text-[12px] leading-[1.6] text-gray-500 dark:text-gray-400 mt-5">
            상품별 매출, 정산 명세, 원장은 전체 도구에서 볼 수 있어요.
          </p>
        </div>
      )}
    </Sheet>
  )
}

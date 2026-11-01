/**
 * 📊 에이전시 콘솔 — **우리 이용권 판매 내역 · 통계** 시트 (2026-10-24 대표 확정 "판매 내역·통계까지")
 *   서버: `GET /api/agency-console/stores/:sellerId/sales?period=` (직원 토큰 — 매장 좌석 없이 본다).
 *
 * 그 매장에서 **우리가 맡은 기간 안에** 팔린 우리 이용권만(사장님 성과표 '누가 팔았나' 와 같은 귀속).
 * 손님 정보·이용권 코드는 없다. 사용처리(QR)는 매장 몫이라 여기엔 상태 보기만 있다.
 */
import { useEffect, useState } from 'react'
import { formatNumber } from '@/utils/format'
import { formatKSTShort } from '@/utils/date'
import Sheet from '@/pages/user-profile/seller-section/Sheet'
import { agencyRequest } from './agency-api'

type Period = 'month' | '30d' | 'all'
interface Summary { sold: number; revenue: number; used: number; refunded: number }
interface Share { pct: number | null; amount: number }
interface SaleItem { id: number; productName: string; price: number; status: string; soldAt: string; usedAt: string | null }

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month', label: '이번 달' },
  { key: '30d', label: '최근 30일' },
  { key: 'all', label: '전체' },
]
const STATUS_LABEL: Record<string, string> = { unused: '사용 전', used: '사용함', refunded: '환불', expired: '기간 지남' }

export default function AgencySalesSheet({ sellerId, storeName, onClose }: { sellerId: number; storeName: string; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<{ summary: Summary; items: SaleItem[]; share?: Share } | null>(null)
  const [error, setError] = useState('')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let alive = true
    setData(null); setError('')
    void agencyRequest<{ data: { summary: Summary; items: SaleItem[]; share?: Share } }>(`/stores/${sellerId}/sales?period=${period}`).then((r) => {
      if (!alive) return
      if (!r.ok || !r.data.data) { setError(r.data.error || '판매 내역을 불러오지 못했어요'); return }
      setData(r.data.data)
    })
    return () => { alive = false }
  }, [sellerId, period, nonce])

  const s = data?.summary
  return (
    <Sheet title={`${storeName} 판매 내역`} onClose={onClose}>
      <div className="px-4 pt-3">
        <div className="flex gap-1" role="tablist">
          {PERIODS.map((p) => (
            <button key={p.key} type="button" role="tab" aria-selected={period === p.key} onClick={() => setPeriod(p.key)}
              className={`h-8 rounded-full px-3 text-[12px] font-semibold ${period === p.key ? 'bg-brand text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300'}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="px-4 py-6 text-center">
          <p className="text-[13px] text-tone-bad">{error}</p>
          <button type="button" onClick={() => setNonce((n) => n + 1)} className="mt-2 text-[13px] font-semibold text-brand-text underline">다시 시도</button>
        </div>
      ) : !data ? (
        <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">불러오는 중…</p>
      ) : (
        <>
          <dl className="grid grid-cols-4 gap-2 px-4 pt-4">
            {[
              ['판매', `${formatNumber(s?.sold ?? 0)}장`],
              ['매출', `${formatNumber(s?.revenue ?? 0)}원`],
              ['사용', `${formatNumber(s?.used ?? 0)}장`],
              ['환불', `${formatNumber(s?.refunded ?? 0)}장`],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[12px] text-gray-400 dark:text-gray-500">{k}</dt>
                <dd className="truncate text-[15px] font-bold tabular-nums text-gray-900 dark:text-white">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="mx-4 mt-4 rounded-xl bg-gray-50 dark:bg-white/5 px-3 py-3">
            <p className="text-[13px] font-semibold text-gray-900 dark:text-white">
              {data.share?.pct == null
                ? '우리 몫: 사장님이 아직 정하지 않았어요'
                : `우리 몫 ${formatNumber(data.share.amount)}원 (${data.share.pct}%)`}
            </p>
            <p className="mt-0.5 text-[12px] leading-[1.55] text-gray-500 dark:text-gray-400">
              환불 안 된 판매에만 붙어요. 돈은 매장이 직접 보내고, 세금계산서는 우리가 매장에 발행해요.
            </p>
          </div>
          {data.items.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-gray-500 dark:text-gray-400">이 기간에 팔린 우리 이용권이 없어요.</p>
          ) : (
            <ul className="mt-3 divide-y divide-rule">
              {data.items.map((it) => (
                <li key={it.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold text-gray-900 dark:text-white">{it.productName}</span>
                    <span className="block text-[12px] text-gray-400 dark:text-gray-500">{formatKSTShort(it.soldAt)}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[13px] tabular-nums text-gray-900 dark:text-white">{formatNumber(it.price)}원</span>
                    <span className={`block text-[12px] ${it.status === 'refunded' ? 'text-tone-bad' : it.status === 'used' ? 'text-tone-ok' : 'text-gray-500'}`}>
                      {STATUS_LABEL[it.status] ?? it.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="px-4 py-3 text-[12px] leading-[1.55] text-gray-500 dark:text-gray-400">
            우리가 맡은 기간에 팔린 우리 이용권만 보여요. 최근 100건까지. 손님 정보는 사장님 화면에만 있어요.
          </p>
        </>
      )}
    </Sheet>
  )
}

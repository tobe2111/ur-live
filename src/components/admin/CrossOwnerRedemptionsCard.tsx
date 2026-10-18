/**
 * 🏷️ 어드민 정산 화면 — **다른 점주 가맹점끼리 사용한 이용권** (2026-10-18 브랜드 3단계 후속).
 *
 * 그 이용권은 판 지점이 아니라 **쓴 지점**이 정산받는다. 게이트를 켠 뒤 몇 건이 어디로 넘어갔는지를
 * 여기서 본다. 게이트가 꺼져 있고 기록도 0건이면 아무것도 그리지 않는다(켜지지도 않은 기능의 빈 표를 보여 주지 않는다).
 * 읽기 전용 — 서버 `GET /api/admin/brand-cross-owner/redemptions`.
 */
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { formatWon, formatNumber } from '@/utils/format'
import { formatKSTShort } from '@/utils/date'

interface Row {
  voucher_id: number
  used_at: string | null
  amount: number
  product_name: string | null
  sold_seller_id: number
  sold_store_name: string | null
  store_seller_id: number
  store_name: string | null
}
interface Data { enabled: boolean; total_count: number; total_amount: number; rows: Row[] }

export default function CrossOwnerRedemptionsCard() {
  const q = useApiQuery<Data | null>(['admin', 'brand-cross-owner-redemptions'], '/api/admin/brand-cross-owner/redemptions', {
    params: { limit: 50 },
    select: (r: any) => (r?.success ? r.data : null),
  })
  const d = q.data
  if (!d || (!d.enabled && d.total_count === 0)) return null

  return (
    <section className="mx-auto max-w-5xl px-4 pt-4">
      <div className="bg-white rounded-[var(--dash-radius,16px)] border border-gray-200 p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-gray-900">다른 점주 가맹점에서 쓴 이용권</p>
          <p className="text-xs text-gray-500">
            {d.enabled ? '스위치 켜짐' : '스위치 꺼짐 — 이미 받은 건만 표시'} · {formatNumber(d.total_count)}건 · {formatWon(d.total_amount)}
          </p>
        </div>
        <p className="mt-1 text-xs text-gray-500">이 이용권은 판 지점이 아니라 쓴 지점이 정산받습니다(쓴 지점 수수료율).</p>
        {d.rows.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">아직 다른 점주 지점에서 쓴 이용권이 없습니다.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="py-2 pr-3 font-medium">사용 시각</th>
                  <th className="py-2 pr-3 font-medium">이용권</th>
                  <th className="py-2 pr-3 font-medium">판 지점</th>
                  <th className="py-2 pr-3 font-medium">쓴 지점(정산)</th>
                  <th className="py-2 font-medium text-right">금액</th>
                </tr>
              </thead>
              <tbody>
                {d.rows.map((r) => (
                  <tr key={r.voucher_id} className="border-b border-gray-50 text-gray-700">
                    <td className="py-2 pr-3 whitespace-nowrap tabular-nums">{r.used_at ? formatKSTShort(r.used_at) : '-'}</td>
                    <td className="py-2 pr-3">{r.product_name || `#${r.voucher_id}`}</td>
                    <td className="py-2 pr-3">{r.sold_store_name || `매장 ${r.sold_seller_id}`}</td>
                    <td className="py-2 pr-3 font-semibold text-gray-900">{r.store_name || `매장 ${r.store_seller_id}`}</td>
                    <td className="py-2 text-right tabular-nums">{formatWon(r.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}

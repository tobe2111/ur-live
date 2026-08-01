/**
 * ↩️ **운영자 반품 큐** — 세션 ⑤ (체크리스트 §5.4 🟡)
 *
 * `GET /api/returns/seller` 는 **있는데 소비 화면이 0건**이었다(returns.routes.ts:312).
 * 운영자가 **자기 상품의 반품 요청을 볼 데가 없었다** — 소비자가 신청해도 운영자는 모르고,
 * 어드민(`AdminReturnsPage`)만 본다. 파일럿에서 그 어드민은 **대표 한 명**이라
 * 반품이 늘면 그대로 대표 부담이 된다.
 *
 * ## 🔴 이 화면이 하는 일과 안 하는 일
 * - **한다**: 목록 조회 · 승인 · 거절 (이미 있는 `PUT /:id/approve` · `/:id/reject`)
 * - **안 한다**: **환불 실행**. 그건 `AdminReturnsPage` 의 `/:id/refund` 이고 **머니 경로**다.
 *   여기서 금액을 만지면 §C7(보관구분 부분환불) 정책이 정해지기 전에 돈이 움직인다.
 *
 * > 승인/거절은 **상태 전이**이고, 환불은 **돈**이다. 한 화면에 섞지 않는다.
 */
import { useEffect, useState, useCallback } from 'react'
import { Loader2, PackageOpen, AlertCircle } from 'lucide-react'
import SellerLayout from '@/components/SellerLayout'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { formatWon } from '@/utils/format'
import { formatKST } from '@/utils/date'

interface ReturnRow {
  id: number
  order_id: number
  status: string
  reason?: string | null
  requested_at?: string | null
  order_total?: number | null
  shipping_name?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  requested: '요청됨', approved: '승인', rejected: '거절',
  refunded: '환불완료', completed: '완료',
}

export default function SellerReturnsPage() {
  const [rows, setRows] = useState<ReturnRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true); setError(false)
    api.get('/api/returns/seller')
      .then((r) => setRows(Array.isArray(r.data?.data) ? r.data.data : []))
      // 🔴 실패를 빈 목록으로 위장하지 않는다 — "반품 0건" 과 "조회 실패" 는 전혀 다른 상태다
      //    (이 레포의 `check-query-iserror` 가 지키는 클래스).
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  async function act(id: number, kind: 'approve' | 'reject') {
    setBusy(id)
    try {
      await api.put(`/api/returns/${id}/${kind}`)
      load()
    } catch {
      setError(true)
    } finally {
      setBusy(null)
    }
  }

  return (
    <SellerLayout title="반품 요청">
      <SEO title="반품 요청 - 유어딜" description="내 상품의 반품 요청" noindex />
      <div className="p-4 max-w-4xl mx-auto">
        <h1 className="text-lg font-bold text-gray-900">반품 요청</h1>
        <p className="mt-1 text-xs text-gray-500">
          내 상품에 들어온 반품 요청입니다. <b>환불 실행은 관리자가 처리</b>합니다.
        </p>

        {loading && (
          <div className="py-16 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        )}

        {/* 🔴 조회 실패를 "0건" 으로 보여주지 않는다 — 운영자가 요청이 없다고 오해한다. */}
        {!loading && error && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="flex items-center gap-1.5 text-sm text-rose-700">
              <AlertCircle className="w-4 h-4" /> 목록을 불러오지 못했습니다.
            </p>
            <button onClick={load} className="mt-2 h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-bold">
              다시 시도
            </button>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <p className="py-16 text-center text-sm text-gray-500 flex flex-col items-center gap-2">
            <PackageOpen className="w-6 h-6 text-gray-300" />
            들어온 반품 요청이 없습니다.
          </p>
        )}

        {!loading && !error && rows.length > 0 && (
          <ul className="mt-4 space-y-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-gray-900">주문 #{r.order_id}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {r.shipping_name || '-'} · {formatWon(r.order_total)}
                      {r.requested_at ? ` · ${formatKST(r.requested_at)}` : ''}
                    </p>
                    {r.reason && <p className="mt-1 text-xs text-gray-600 break-words">사유 · {r.reason}</p>}
                  </div>
                  <span className="shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {STATUS_LABEL[r.status] || r.status}
                  </span>
                </div>

                {/* 승인·거절만. 환불(=돈)은 여기 없다 — 위 주석 참조. */}
                {r.status === 'requested' && (
                  <div className="mt-3 flex gap-2">
                    <button disabled={busy === r.id} onClick={() => act(r.id, 'approve')}
                      className="h-9 px-3 rounded-lg bg-gray-900 text-white text-xs font-bold disabled:opacity-50">
                      승인
                    </button>
                    <button disabled={busy === r.id} onClick={() => act(r.id, 'reject')}
                      className="h-9 px-3 rounded-lg border border-gray-200 text-gray-700 text-xs font-bold disabled:opacity-50">
                      거절
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </SellerLayout>
  )
}

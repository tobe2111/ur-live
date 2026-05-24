/**
 * 🛡️ 2026-05-23: KT Alpha 기프티쇼 voucher_orders 발송 상태 추적 페이지.
 *
 * 운영자가 /admin/voucher-orders 에서:
 *   - 최근 1h/24h/7일 발송 통계 (processing/sent/failed)
 *   - 실패 항목 클릭 시 failure_reason 확인
 *   - "재발송" 버튼 — failed 항목 1건 다시 시도
 *
 * /api/admin/voucher-orders (신규) + /api/admin/voucher-orders/:id/resend (신규)
 */

import { useEffect, useState } from 'react'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface VoucherOrderRow {
  id: number
  goods_name: string
  recipient_phone: string
  unit_price: number
  quantity: number
  status: 'processing' | 'sent' | 'failed'
  external_order_id: string | null
  sent_at: string | null
  failure_reason: string | null
  created_at: string
  updated_at: string
}

interface KtAlphaStatus {
  dev_mode: boolean
  api_enabled: boolean
  has_user_id: boolean
  has_callback_no: boolean
}

export default function AdminVoucherOrdersPage() {
  const [hours, setHours] = useState(24)
  const [statusFilter, setStatusFilter] = useState<'all' | 'processing' | 'sent' | 'failed'>('all')
  const [rows, setRows] = useState<VoucherOrderRow[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<{ processing: number; sent: number; failed: number }>({ processing: 0, sent: 0, failed: 0 })
  const [ktStatus, setKtStatus] = useState<KtAlphaStatus | null>(null)

  // 운영 상태 (dev_mode / settings) 로드
  useEffect(() => {
    api.get('/api/admin/kt-alpha/settings').then(r => {
      if (r.data?.success) {
        const s = r.data.data || {}
        setKtStatus({
          dev_mode: s.dev_mode === 1 || s.dev_mode === '1' || s.dev_mode === 'Y',
          api_enabled: s.api_enabled === 1 || s.api_enabled === '1',
          has_user_id: !!s.user_id,
          has_callback_no: !!s.callback_no,
        })
      }
    }).catch(() => null)
  }, [])

  async function load() {
    setLoading(true)
    try {
      const params = new URLSearchParams({ hours: String(hours), limit: '500' })
      if (statusFilter !== 'all') params.set('status', statusFilter)
      const res = await api.get(`/api/admin/voucher-orders?${params.toString()}`)
      if (res.data?.success) {
        setRows(res.data.data || [])
        setStats(res.data.stats || { processing: 0, sent: 0, failed: 0 })
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [hours, statusFilter])

  async function handleResend(id: number) {
    if (!confirm('이 voucher 를 재발송할까요?')) return
    try {
      const res = await api.post(`/api/admin/voucher-orders/${id}/resend`)
      if (res.data?.success) {
        toast.success('재발송 요청 완료')
        load()
      } else {
        toast.error(res.data?.error || '재발송 실패')
      }
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <SEO title="KT Alpha 발송 추적" url="/admin/voucher-orders" noindex />
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-3">KT Alpha 기프티쇼 발송 추적</h1>

          {ktStatus && (
            <div className={`mb-3 px-4 py-3 rounded border ${ktStatus.dev_mode ? 'bg-amber-50 border-amber-300' : 'bg-green-50 border-green-300'}`}>
              <div className="flex items-center gap-2 text-sm font-bold">
                {ktStatus.dev_mode ? (
                  <>
                    <span className="text-amber-700">⚠️ DEV 모드 — 실제 발송 안 됨 (기프티쇼 구매관리에 안 보임)</span>
                  </>
                ) : (
                  <span className="text-green-700">✅ LIVE 모드 — 실제 발송 + 기프티쇼 구매관리 반영</span>
                )}
              </div>
              <div className="text-xs text-gray-600 mt-1">
                api_enabled: {ktStatus.api_enabled ? '✅' : '❌'} ·
                user_id: {ktStatus.has_user_id ? '✅' : '❌'} ·
                callback_no: {ktStatus.has_callback_no ? '✅' : '❌'}
              </div>
              {ktStatus.dev_mode && (
                <p className="text-xs text-amber-700 mt-2">
                  해결: <code>/admin/kt-alpha/settings</code> 에서 dev_mode = 0 (또는 Cloudflare env KT_ALPHA_DEV_MODE=N)
                </p>
              )}
            </div>
          )}
          <div className="flex gap-2 mb-3">
            {([1, 6, 24, 168] as const).map(h => (
              <button key={h} onClick={() => setHours(h)} className={`px-3 py-1.5 text-sm rounded ${hours === h ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {h === 168 ? '7일' : `${h}h`}
              </button>
            ))}
            <button onClick={load} className="px-3 py-1.5 text-sm bg-gray-100 rounded">새로고침</button>
          </div>
          <div className="flex gap-2 mb-3">
            {(['all', 'processing', 'sent', 'failed'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-sm rounded ${statusFilter === s ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {s === 'all' ? '전체' : s}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-amber-50 border border-amber-200 rounded p-3 text-center">
              <div className="text-xs text-amber-700">처리 중</div>
              <div className="text-xl font-extrabold text-amber-700">{stats.processing}</div>
            </div>
            <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
              <div className="text-xs text-green-700">발송 완료</div>
              <div className="text-xl font-extrabold text-green-700">{stats.sent}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
              <div className="text-xs text-red-700">실패</div>
              <div className="text-xl font-extrabold text-red-700">{stats.failed}</div>
            </div>
          </div>
        </div>

        {loading && <div className="text-center py-8 text-gray-500">로딩 중...</div>}

        {!loading && rows.length === 0 && (
          <div className="bg-white rounded-lg p-8 text-center text-gray-500">최근 {hours}h 데이터 없음</div>
        )}

        <div className="space-y-2">
          {rows.map(r => (
            <div key={r.id} className={`bg-white rounded-lg shadow p-3 border-l-4 ${
              r.status === 'sent' ? 'border-green-500' :
              r.status === 'failed' ? 'border-red-500' : 'border-amber-500'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                      r.status === 'sent' ? 'bg-green-100 text-green-700' :
                      r.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {r.status}
                    </span>
                    <span className="text-[11px] text-gray-500">{new Date(r.created_at).toLocaleString('ko-KR')}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate">{r.goods_name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    📱 {r.recipient_phone} · {r.unit_price.toLocaleString('ko-KR')}원 × {r.quantity}
                  </p>
                  {r.external_order_id && <p className="text-[10px] text-gray-400 font-mono mt-1">{r.external_order_id}</p>}
                  {r.failure_reason && (
                    <p className="text-[11px] text-red-700 mt-2 p-2 bg-red-50 rounded">⚠️ {r.failure_reason}</p>
                  )}
                </div>
                {r.status === 'failed' && (
                  <button onClick={() => handleResend(r.id)} className="ml-2 px-3 py-1.5 text-xs bg-blue-600 text-white rounded font-bold shrink-0">재발송</button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

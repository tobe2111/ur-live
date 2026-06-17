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

import { useState } from 'react'
import SEO from '@/components/SEO'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import { toast } from '@/hooks/useToast'
import { confirmDialog } from '@/components/ui/confirm-dialog'

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

  // 🛡️ 2026-06-03 Tier2(대시보드): 수동 페칭 → useApiQuery (KT 설정 + 발송 리스트, 필터 key 반응형).
  const ktStatusQ = useApiQuery<KtAlphaStatus | null>(['admin', 'kt-alpha-settings'], '/api/admin/kt-alpha/settings', {
    select: (r: any) => {
      if (!r?.success) return null
      const s = r.data || {}
      return {
        dev_mode: s.dev_mode === 1 || s.dev_mode === '1' || s.dev_mode === 'Y',
        api_enabled: s.api_enabled === 1 || s.api_enabled === '1',
        has_user_id: !!s.user_id,
        has_callback_no: !!s.callback_no,
      }
    },
  })
  const ktStatus = ktStatusQ.data ?? null

  const ordersQ = useApiQuery<{ rows: VoucherOrderRow[]; stats: { processing: number; sent: number; failed: number; failed_all: number } }>(
    ['admin', 'voucher-orders', hours, statusFilter], '/api/admin/voucher-orders',
    {
      params: { hours, limit: 500, ...(statusFilter !== 'all' ? { status: statusFilter } : {}) },
      select: (r: any) => ({ rows: r?.success ? (r.data || []) : [], stats: r?.stats || { processing: 0, sent: 0, failed: 0, failed_all: 0 } }),
    },
  )
  const rows = ordersQ.data?.rows ?? []
  const stats = ordersQ.data?.stats ?? { processing: 0, sent: 0, failed: 0, failed_all: 0 }
  const loading = ordersQ.isLoading
  const load = () => ordersQ.refetch()

  async function handleResend(id: number) {
    if (!(await confirmDialog('이 voucher 를 재발송할까요?'))) return
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

  // 🛡️ 2026-06-14: 상태 의미를 한국어로 명시 (운영자가 영문 status 만 보고 의미 모름 신고).
  const STATUS_META: Record<VoucherOrderRow['status'], { label: string; desc: string; cls: string }> = {
    processing: { label: '처리 중', desc: 'KT 발송 요청 후 결과 대기', cls: 'bg-amber-100 text-amber-700' },
    sent: { label: '발송 완료', desc: '고객 문자로 기프티콘 전송됨', cls: 'bg-green-100 text-green-700' },
    failed: { label: '발송 실패', desc: '재발송 필요 (사유 확인)', cls: 'bg-red-100 text-red-700' },
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <SEO title="교환권 발송 관리" url="/admin/voucher-orders" noindex />
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h1 className="text-xl font-bold text-gray-900 mb-1">교환권(기프티콘) 발송 관리</h1>
          {/* 🛡️ 2026-06-14: 이 페이지가 무엇인지 한 줄 설명 (사용자 신고 — 의미 불명확). */}
          <p className="text-sm text-gray-500 mb-3">
            고객이 결제한 교환권을 KT Alpha 기프티쇼로 자동 발송한 내역입니다.
            고객 휴대폰으로 기프티콘이 전송되며, 실패 건은 아래에서 <span className="font-semibold text-gray-700">재발송</span>할 수 있습니다.
          </p>

          {/* 🛡️ 2026-06-17: 전체 발송 실패 배너 — 기간 무관(대시보드 "실패 N"과 일치). 시간창에 가려 안 보이던 문제 해소. */}
          {stats.failed_all > 0 && (
            <div className="mb-3 px-4 py-3 rounded-lg border border-red-300 bg-red-50 flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold text-red-700">⚠️ 발송 실패 {stats.failed_all}건 (기간 무관 전체)</span>
              <span className="text-xs text-red-600">— 아래 기간 필터와 무관하게 모든 실패 건입니다.</span>
              {statusFilter !== 'failed' && (
                <button onClick={() => setStatusFilter('failed')}
                  className="ml-auto px-3 py-1.5 text-xs font-semibold bg-red-600 text-white rounded hover:bg-red-700">
                  실패 {stats.failed_all}건 모두 보기 →
                </button>
              )}
            </div>
          )}

          {/* 🛡️ 2026-06-14: 상태 의미 범례 */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
            {(Object.keys(STATUS_META) as VoucherOrderRow['status'][]).map(k => (
              <div key={k} className="flex items-center gap-1.5 text-xs">
                <span className={`font-bold px-2 py-0.5 rounded ${STATUS_META[k].cls}`}>{STATUS_META[k].label}</span>
                <span className="text-gray-500">{STATUS_META[k].desc}</span>
              </div>
            ))}
          </div>

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
            {statusFilter === 'failed' && (
              <span className="self-center text-xs text-red-600 font-medium">※ 발송 실패 목록은 기간 무관 전체 표시</span>
            )}
          </div>
          <div className="flex gap-2 mb-3">
            {(['all', 'processing', 'sent', 'failed'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 text-sm rounded ${statusFilter === s ? 'bg-pink-600 text-white' : 'bg-gray-100 text-gray-700'}`}>
                {s === 'all' ? '전체' : STATUS_META[s].label}
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
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${STATUS_META[r.status]?.cls || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_META[r.status]?.label || r.status}
                    </span>
                    <span className="text-[11px] text-gray-500">주문일시 {new Date(r.created_at).toLocaleString('ko-KR')}</span>
                  </div>
                  <p className="text-sm font-bold text-gray-900 truncate">{r.goods_name}</p>
                  <p className="text-xs text-gray-600 mt-1">
                    <span className="text-gray-400">받는 분</span> 📱 {r.recipient_phone}
                    <span className="mx-1.5 text-gray-300">|</span>
                    <span className="text-gray-400">단가</span> {r.unit_price.toLocaleString('ko-KR')}원
                    <span className="mx-1.5 text-gray-300">|</span>
                    <span className="text-gray-400">수량</span> {r.quantity}개
                  </p>
                  {r.sent_at && r.status === 'sent' && (
                    <p className="text-[11px] text-green-600 mt-0.5">✅ 발송 완료: {new Date(r.sent_at).toLocaleString('ko-KR')}</p>
                  )}
                  {r.external_order_id && <p className="text-[10px] text-gray-400 font-mono mt-1">KT 주문번호: {r.external_order_id}</p>}
                  {r.failure_reason && (
                    <p className="text-[11px] text-red-700 mt-2 p-2 bg-red-50 rounded">⚠️ 실패 사유: {r.failure_reason}</p>
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

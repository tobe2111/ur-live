import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { DollarSign, TrendingUp, Users, Download, CheckCircle, Clock } from 'lucide-react'

interface SettlementStats {
  total_orders: number
  total_sales: number
  total_commission: number
  total_seller_amount: number
}

interface SellerSettlement {
  seller_id: number
  seller_name: string
  business_name: string
  commission_rate: number
  order_count: number
  total_sales: number
  commission_amount: number
  seller_amount: number
  pending_amount: number
  settled_amount: number
}

interface SettlementRecord {
  id: number
  order_number: string
  seller_id: number
  seller_name: string
  business_name: string
  total_amount: number
  commission_rate: number
  commission_amount: number
  seller_amount: number
  settlement_status: string
  settled_at: string | null
  created_at: string
  user_name: string
}

export default function AdminSettlementPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [stats, setStats] = useState<SettlementStats | null>(null)
  const [sellers, setSellers] = useState<SellerSettlement[]>([])
  const [records, setRecords] = useState<SettlementRecord[]>([])
  const [selectedSeller, setSelectedSeller] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [revertModal, setRevertModal] = useState<{ orderId: number } | null>(null)
  const [revertReason, setRevertReason] = useState('')

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    loadData()
  }, [navigate, period, selectedSeller, statusFilter])

  async function loadData() {
    try {
      setLoading(true)
      const statsRes = await api.get(`/api/admin/settlement/stats?period=${period}`)
      if (statsRes.data.success) {
        setStats(statsRes.data.data.overview)
        setSellers(statsRes.data.data.sellers || [])
      }
      const params = new URLSearchParams()
      if (period !== 'all') params.append('period', period)
      if (selectedSeller) params.append('seller_id', selectedSeller.toString())
      if (statusFilter !== 'all') params.append('status', statusFilter)
      const recordsRes = await api.get(`/api/admin/settlement/records?${params.toString()}`)
      if (recordsRes.data.success) setRecords(recordsRes.data.data || [])
      setLoading(false)
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status?: number } }
      if (axiosErr.response?.status === 401) {
        localStorage.removeItem('admin_token'); localStorage.removeItem('user_type'); navigate('/admin/login')
      }
      setLoading(false)
    }
  }

  async function updateSettlementStatus(orderId: number, status: string, currentStatus?: string) {
    if (currentStatus === 'completed' && status === 'pending') {
      setRevertReason('')
      setRevertModal({ orderId })
      return
    }
    try {
      await api.patch(`/api/admin/settlement/${orderId}/status`, { status })
      toast.success('정산 상태가 변경되었습니다')
      loadData()
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } }; message?: string }; toast.error(`상태 변경 실패: ${e.response?.data?.error || e.message}`) }
  }

  async function confirmRevert() {
    if (!revertModal) return
    if (revertReason.trim().length < 5) { toast.error('사유를 5자 이상 입력해주세요.'); return }
    try {
      await api.patch(`/api/admin/settlement/${revertModal.orderId}/status`, { status: 'pending', reason: revertReason.trim() })
      toast.success('정산 상태가 변경되었습니다')
      setRevertModal(null)
      loadData()
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } }; message?: string }; toast.error(`상태 변경 실패: ${e.response?.data?.error || e.message}`) }
  }

  async function batchComplete(orderIds: number[]) {
    if (!confirm(`${orderIds.length}건을 정산 완료 처리하시겠습니까?`)) return
    try {
      await api.post('/api/admin/settlement/batch-complete', { order_ids: orderIds })
      toast.success('일괄 정산 완료!'); loadData()
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } }; message?: string }; toast.error(`일괄 처리 실패: ${e.response?.data?.error || e.message}`) }
  }

  async function executeSellerSettlement(sellerId: number, sellerName: string) {
    if (!confirm(`${sellerName}의 미정산 건을 정산 실행하시겠습니까?`)) return
    try {
      // Find pending records for this seller and batch complete them
      const pendingForSeller = records.filter(r => r.seller_id === sellerId && r.settlement_status === 'pending')
      if (pendingForSeller.length === 0) {
        toast.info('정산 대기 중인 건이 없습니다')
        return
      }
      await api.post('/api/admin/settlement/batch-complete', { order_ids: pendingForSeller.map(r => r.id) })
      toast.success(`${sellerName}의 ${pendingForSeller.length}건 정산 완료!`)
      loadData()
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } }; message?: string }; toast.error(`정산 실행 실패: ${e.response?.data?.error || e.message}`) }
  }

  async function exportCSV() {
    try {
      const params = new URLSearchParams()
      if (period !== 'all') params.append('period', period)
      if (selectedSeller) params.append('seller_id', selectedSeller.toString())
      const response = await api.get(`/api/admin/settlement/export-csv?${params.toString()}`, { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url; link.setAttribute('download', `settlement_${period}_${Date.now()}.csv`)
      document.body.appendChild(link); link.click(); link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err: unknown) { const e = err as { response?: { data?: { error?: string } }; message?: string }; toast.error(`CSV 다운로드 실패: ${e.response?.data?.error || e.message}`) }
  }

  function fmtCurrency(n: number) {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW' }).format(n)
  }
  function fmtDate(s: string) {
    if (!s) return '-'
    return new Date(s).toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F4F5F7]">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">{t('admin.settlement.loadingData', { defaultValue: '정산 데이터를 불러오는 중...' })}</p>
        </div>
      </div>
    )
  }

  const pendingOrders = records.filter(r => r.settlement_status === 'pending')

  return (
    <AdminLayout title={t('admin.pages.settlement')}>
      {/* 정산 되돌리기 사유 입력 모달 */}
      {revertModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4">
            <p className="text-sm font-bold text-gray-900 mb-1">⚠️ 정산 되돌리기</p>
            <p className="text-xs text-gray-500 mb-4">이 작업은 감사 로그에 기록됩니다.</p>
            <textarea
              value={revertReason}
              onChange={e => setRevertReason(e.target.value)}
              placeholder="되돌리기 사유를 입력하세요 (최소 5자)"
              rows={3}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setRevertModal(null)} className="flex-1 px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">취소</button>
              <button onClick={confirmRevert} className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600">확인</button>
            </div>
          </div>
        </div>
      )}
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.pages.settlement')}
          subtitle={t('admin.settlement.subtitle', { defaultValue: '셀러별 정산 현황 · CSV 내보내기' })}
          icon={<DollarSign className="h-5 w-5" />}
          actions={
            <button onClick={exportCSV} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700">
              <Download className="h-3.5 w-3.5" /> {t('admin.settlement.csvDownload', { defaultValue: 'CSV 다운로드' })}
            </button>
          }
        />
      {/* 기간 필터 */}
      <div className="flex items-center gap-2">
        {[['today', t('admin.settlement.today', { defaultValue: '오늘' })], ['week', t('admin.settlement.thisWeek', { defaultValue: '이번 주' })], ['month', t('admin.settlement.thisMonth', { defaultValue: '이번 달' })], ['all', t('admin.settlement.all', { defaultValue: '전체' })]].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'}`}>{l}</button>
        ))}
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: t('admin.settlement.totalSales', { defaultValue: '총 판매액' }), value: fmtCurrency(stats.total_sales), icon: <DollarSign className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: t('admin.settlement.totalCommission', { defaultValue: '총 수수료' }), value: fmtCurrency(stats.total_commission), icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: t('admin.settlement.totalSettlement', { defaultValue: '총 정산액' }), value: fmtCurrency(stats.total_seller_amount), icon: <Users className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: t('admin.settlement.orderCount', { defaultValue: '주문 건수' }), value: `${stats.total_orders}건`, icon: <CheckCircle className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-gray-500">{card.label}</span>
                <div className={`w-8 h-8 rounded-lg ${card.bg} ${card.color} flex items-center justify-center`}>{card.icon}</div>
              </div>
              <p className="text-lg font-bold text-gray-900">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* 셀러별 정산 현황 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{t('admin.settlement.sellerStatusTitle', { defaultValue: '셀러별 정산 현황' })}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50">
                {[t('admin.settlement.thSeller', { defaultValue: '판매자' }), t('admin.settlement.thBusiness', { defaultValue: '사업자명' }), t('admin.settlement.thOrderCount', { defaultValue: '주문수' }), t('admin.settlement.thSalesAmount', { defaultValue: '판매액' }), t('admin.settlement.thCommissionRate', { defaultValue: '수수료율' }), t('admin.settlement.thCommissionAmount', { defaultValue: '수수료' }), t('admin.settlement.thSettlementAmount', { defaultValue: '정산액' }), t('admin.settlement.thPending', { defaultValue: '정산대기' }), t('admin.settlement.thCompleted', { defaultValue: '정산완료' }), t('admin.settlement.thAction', { defaultValue: '액션' })].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sellers.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">{t('admin.settlement.noData', { defaultValue: '정산 데이터가 없습니다' })}</td></tr>
              ) : sellers.map(seller => (
                <tr
                  key={seller.seller_id}
                  onClick={() => setSelectedSeller(selectedSeller === seller.seller_id ? null : seller.seller_id)}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedSeller === seller.seller_id ? 'bg-blue-50' : ''}`}
                >
                  <td className="px-4 py-3 text-xs font-medium text-gray-900">{seller.seller_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{seller.business_name || '-'}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{seller.order_count}건</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{fmtCurrency(seller.total_sales)}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{seller.commission_rate}%</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{fmtCurrency(seller.commission_amount)}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-blue-700">{fmtCurrency(seller.seller_amount)}</td>
                  <td className="px-4 py-3 text-xs text-amber-600">{fmtCurrency(seller.pending_amount)}</td>
                  <td className="px-4 py-3 text-xs text-emerald-600">{fmtCurrency(seller.settled_amount)}</td>
                  <td className="px-4 py-3">
                    {seller.pending_amount > 0 && (
                      <button
                        onClick={(e) => { e.stopPropagation(); executeSellerSettlement(seller.seller_id, seller.seller_name) }}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
                      >
                        {t('admin.settlement.executeSettlement', { defaultValue: '정산 실행' })}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 정산 내역 */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">{t('admin.settlement.historyTitle', { defaultValue: '정산 내역' })}</h2>
          <div className="flex items-center gap-2">
            {[['all', t('admin.settlement.statusAll', { defaultValue: '전체' })], ['pending', t('admin.settlement.statusPending', { defaultValue: '대기중' })], ['completed', t('admin.settlement.statusCompleted', { defaultValue: '완료' })]].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
            ))}
            {pendingOrders.length > 0 && (
              <button onClick={() => batchComplete(pendingOrders.map(r => r.id))} className="ml-2 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                {t('admin.settlement.batchComplete', { defaultValue: '일괄 완료' })} ({pendingOrders.length})
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-gray-50">
                {[t('admin.settlement.thOrderNumber', { defaultValue: '주문번호' }), t('admin.settlement.thSeller', { defaultValue: '판매자' }), t('admin.settlement.thBuyer', { defaultValue: '구매자' }), t('admin.settlement.thOrderAmount', { defaultValue: '주문금액' }), t('admin.settlement.thCommissionAmount', { defaultValue: '수수료' }), t('admin.settlement.thSettlementAmount', { defaultValue: '정산액' }), t('admin.settlement.thStatus', { defaultValue: '상태' }), t('admin.settlement.thOrderDate', { defaultValue: '주문일시' }), t('admin.settlement.thAction', { defaultValue: '액션' })].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">{t('admin.settlement.noHistory', { defaultValue: '정산 내역이 없습니다' })}</td></tr>
              ) : records.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{record.order_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{record.seller_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{record.user_name || t('admin.settlement.anonymous', { defaultValue: '익명' })}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{fmtCurrency(record.total_amount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtCurrency(record.commission_amount)} <span className="text-gray-400">({record.commission_rate}%)</span></td>
                  <td className="px-4 py-3 text-xs font-semibold text-blue-700">{fmtCurrency(record.seller_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${record.settlement_status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {record.settlement_status === 'completed' ? <><CheckCircle className="w-3 h-3" />{t('admin.settlement.statusCompletedLabel', { defaultValue: '완료' })}</> : <><Clock className="w-3 h-3" />{t('admin.settlement.statusPendingLabel', { defaultValue: '대기' })}</>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(record.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateSettlementStatus(record.id, record.settlement_status === 'pending' ? 'completed' : 'pending', record.settlement_status)}
                      className={`text-xs font-medium ${record.settlement_status === 'pending' ? 'text-emerald-600 hover:text-emerald-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {record.settlement_status === 'pending' ? t('admin.settlement.markCompleted', { defaultValue: '정산완료' }) : t('admin.settlement.markPending', { defaultValue: '대기로 변경' })}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 🛡️ 2026-05-18: 원천징수 / 지급조서 CSV 다운로드 카드 */}
      <TaxWithholdingCard />
      </div>
    </AdminLayout>
  )
}

// 🛡️ 2026-05-18: 어드민 — 비사업자 셀러 원천징수 현황 + 국세청 양식 CSV.
function TaxWithholdingCard() {
  const currentYear = new Date().getFullYear()
  const [year, setYear] = useState(currentYear)
  const [summary, setSummary] = useState<{
    year: number; seller_count: number; payouts_count: number;
    total_gross: number; total_withheld: number; total_net: number;
    reportable_count: number;
    reportable_sellers: Array<{ seller_id: number; name: string; business_name?: string; business_number?: string; ytd_gross: number; ytd_withheld: number }>;
  } | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) return
    api.get(`/api/admin/tax-withholding/summary?year=${year}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => { if (r.data?.success) setSummary(r.data.data) })
      .catch(() => { /* fail-soft */ })
  }, [year])

  function downloadCsv(reportableOnly: boolean) {
    const token = localStorage.getItem('admin_token')
    if (!token) return
    fetch(`/api/admin/tax-withholding/export?year=${year}${reportableOnly ? '&reportable_only=1' : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => res.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `tax-withholding-${year}${reportableOnly ? '-reportable' : ''}.csv`
        a.click()
      })
      .catch(() => { /* noop */ })
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-4 sm:p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900">📊 비사업자 셀러 원천징수 (지급조서)</h3>
          <p className="text-xs text-gray-500 mt-0.5">소득세법 §145 — 다음 해 2월 말 국세청 제출용</p>
        </div>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))}
          className="text-xs px-2 py-1.5 border border-gray-200 rounded-lg">
          {[currentYear, currentYear - 1, currentYear - 2].map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
      </div>

      {summary && summary.payouts_count > 0 ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            <KpiBox label="셀러" value={`${summary.seller_count}`} unit="명" color="text-blue-600" />
            <KpiBox label="지급 건수" value={`${summary.payouts_count}`} unit="건" color="text-gray-700" />
            <KpiBox label="원천징수액" value={`₩${summary.total_withheld.toLocaleString()}`} color="text-red-600" />
            <KpiBox label="300만 초과" value={`${summary.reportable_count}`} unit="건" color="text-amber-600"
              warn={summary.reportable_count > 0} />
          </div>

          <div className="flex gap-2 mb-3">
            <button onClick={() => downloadCsv(false)}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">
              📥 전체 CSV 다운로드
            </button>
            {summary.reportable_count > 0 && (
              <button onClick={() => downloadCsv(true)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 text-white text-xs font-semibold rounded-lg hover:bg-amber-700">
                📥 합산의무 만 ({summary.reportable_count})
              </button>
            )}
          </div>

          {summary.reportable_sellers.length > 0 && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-bold text-amber-700 mb-2">⚠️ 종합소득 합산 의무 셀러 (Top 10)</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-gray-500">
                      <th className="text-left py-1">셀러</th>
                      <th className="text-left py-1">사업자번호</th>
                      <th className="text-right py-1">연 지급액</th>
                      <th className="text-right py-1">원천징수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.reportable_sellers.slice(0, 10).map((s) => (
                      <tr key={s.seller_id} className="border-t border-gray-50">
                        <td className="py-1.5">{s.name}</td>
                        <td className="py-1.5 text-gray-500">{s.business_number || '-'}</td>
                        <td className="py-1.5 text-right font-bold">₩{s.ytd_gross.toLocaleString()}</td>
                        <td className="py-1.5 text-right text-red-600">₩{s.ytd_withheld.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-xs text-gray-500 italic">{year}년 원천징수 내역 없음</p>
      )}
    </div>
  )
}

function KpiBox({ label, value, unit, color, warn }: { label: string; value: string; unit?: string; color: string; warn?: boolean }) {
  return (
    <div className={`p-2 rounded-lg ${warn ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}`}>
      <p className="text-[10px] text-gray-500 font-medium">{label}</p>
      <p className={`text-base font-extrabold ${color}`}>{value}{unit && <span className="text-xs font-medium ml-0.5">{unit}</span>}</p>
    </div>
  )
}

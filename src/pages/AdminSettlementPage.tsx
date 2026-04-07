import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
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
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState('all')
  const [stats, setStats] = useState<SettlementStats | null>(null)
  const [sellers, setSellers] = useState<SellerSettlement[]>([])
  const [records, setRecords] = useState<SettlementRecord[]>([])
  const [selectedSeller, setSelectedSeller] = useState<number | null>(null)
  const [statusFilter, setStatusFilter] = useState('all')

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
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token'); localStorage.removeItem('user_type'); navigate('/admin/login')
      }
      setLoading(false)
    }
  }

  async function updateSettlementStatus(orderId: number, status: string) {
    try {
      await api.patch(`/api/admin/settlement/${orderId}/status`, { status })
      toast.success('정산 상태가 변경되었습니다')
      loadData()
    } catch (err: any) { toast.error(`상태 변경 실패: ${err.response?.data?.error || err.message}`) }
  }

  async function batchComplete(orderIds: number[]) {
    if (!confirm(`${orderIds.length}건을 정산 완료 처리하시겠습니까?`)) return
    try {
      await api.post('/api/admin/settlement/batch-complete', { order_ids: orderIds })
      toast.success('일괄 정산 완료!'); loadData()
    } catch (err: any) { toast.error(`일괄 처리 실패: ${err.response?.data?.error || err.message}`) }
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
    } catch (err: any) { toast.error(`정산 실행 실패: ${err.response?.data?.error || err.message}`) }
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
    } catch (err: any) { toast.error(`CSV 다운로드 실패: ${err.response?.data?.error || err.message}`) }
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
          <p className="text-sm text-gray-500">정산 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  const pendingOrders = records.filter(r => r.settlement_status === 'pending')

  return (
    <AdminLayout
      title="정산 대시보드"
      headerRight={
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700">
          <Download className="w-3.5 h-3.5" /> CSV 다운로드
        </button>
      }
    >
      {/* 기간 필터 */}
      <div className="flex items-center gap-2">
        {[['today', '오늘'], ['week', '이번 주'], ['month', '이번 달'], ['all', '전체']].map(([v, l]) => (
          <button key={v} onClick={() => setPeriod(v)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${period === v ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-100 shadow-sm'}`}>{l}</button>
        ))}
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: '총 판매액', value: fmtCurrency(stats.total_sales), icon: <DollarSign className="w-5 h-5" />, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '총 수수료', value: fmtCurrency(stats.total_commission), icon: <TrendingUp className="w-5 h-5" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: '총 정산액', value: fmtCurrency(stats.total_seller_amount), icon: <Users className="w-5 h-5" />, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: '주문 건수', value: `${stats.total_orders}건`, icon: <CheckCircle className="w-5 h-5" />, color: 'text-amber-600', bg: 'bg-amber-50' },
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
          <h2 className="text-sm font-semibold text-gray-900">셀러별 정산 현황</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="bg-gray-50">
                {['판매자', '사업자명', '주문수', '판매액', '수수료율', '수수료', '정산액', '정산대기', '정산완료', '액션'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sellers.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-8 text-center text-sm text-gray-400">정산 데이터가 없습니다</td></tr>
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
                        정산 실행
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
          <h2 className="text-sm font-semibold text-gray-900">정산 내역</h2>
          <div className="flex items-center gap-2">
            {[['all', '전체'], ['pending', '대기중'], ['completed', '완료']].map(([v, l]) => (
              <button key={v} onClick={() => setStatusFilter(v)} className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${statusFilter === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l}</button>
            ))}
            {pendingOrders.length > 0 && (
              <button onClick={() => batchComplete(pendingOrders.map(r => r.id))} className="ml-2 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700">
                일괄 완료 ({pendingOrders.length})
              </button>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px]">
            <thead>
              <tr className="bg-gray-50">
                {['주문번호', '판매자', '구매자', '주문금액', '수수료', '정산액', '상태', '주문일시', '액션'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-gray-400">정산 내역이 없습니다</td></tr>
              ) : records.map(record => (
                <tr key={record.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{record.order_number}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{record.seller_name}</td>
                  <td className="px-4 py-3 text-xs text-gray-600">{record.user_name || '익명'}</td>
                  <td className="px-4 py-3 text-xs text-gray-700">{fmtCurrency(record.total_amount)}</td>
                  <td className="px-4 py-3 text-xs text-gray-500">{fmtCurrency(record.commission_amount)} <span className="text-gray-400">({record.commission_rate}%)</span></td>
                  <td className="px-4 py-3 text-xs font-semibold text-blue-700">{fmtCurrency(record.seller_amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${record.settlement_status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                      {record.settlement_status === 'completed' ? <><CheckCircle className="w-3 h-3" />완료</> : <><Clock className="w-3 h-3" />대기</>}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">{fmtDate(record.created_at)}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => updateSettlementStatus(record.id, record.settlement_status === 'pending' ? 'completed' : 'pending')}
                      className={`text-xs font-medium ${record.settlement_status === 'pending' ? 'text-emerald-600 hover:text-emerald-800' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      {record.settlement_status === 'pending' ? '정산완료' : '대기로 변경'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  )
}

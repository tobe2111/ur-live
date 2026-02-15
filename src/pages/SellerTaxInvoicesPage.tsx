import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  ArrowLeft, 
  FileText,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Download,
  Eye,
  RefreshCw,
  Calendar,
  Building2,
  DollarSign
} from 'lucide-react'

interface TaxInvoice {
  id: number
  invoice_number: string
  issue_date: string
  order_number: string
  supplier_business_name: string
  buyer_business_name: string
  buyer_business_number: string
  total_amount: number
  supply_price: number
  tax_amount: number
  status: 'issued' | 'cancelled'
  nts_confirm_number: string
  created_at: string
}

interface AutoIssueLog {
  id: number
  order_number: string
  status: 'success' | 'failed' | 'pending' | 'retry'
  error_message: string | null
  retry_count: number
  tax_invoice_id: number | null
  total_amount: number
  buyer_business_name: string
  created_at: string
}

export default function SellerTaxInvoicesPage() {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'invoices' | 'logs'>('invoices')
  const [invoices, setInvoices] = useState<TaxInvoice[]>([])
  const [logs, setLogs] = useState<AutoIssueLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedInvoice, setSelectedInvoice] = useState<TaxInvoice | null>(null)
  const [showDetail, setShowDetail] = useState(false)
  const [retrying, setRetrying] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [activeTab])

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const sessionToken = localStorage.getItem('seller_session_token')
      

      if (!sessionToken) {
        navigate('/seller/login')
        return
      }

      if (activeTab === 'invoices') {
        await loadInvoices(sessionToken)
      } else {
        await loadLogs(sessionToken)
      }
    } catch (error: any) {
      console.error('Failed to load data:', error)
      setError('데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  async function loadInvoices(sessionToken: string) {
    const response = await axios.get('/api/seller/tax-invoices', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })

    if (response.data.success) {
      setInvoices(response.data.data)
    }
  }

  async function loadLogs(sessionToken: string) {
    const response = await axios.get('/api/seller/tax-invoices/auto-issue-logs', {
      headers: { 'Authorization': `Bearer ${sessionToken}` }
    })

    if (response.data.success) {
      setLogs(response.data.data)
    }
  }

  async function handleRetry(orderNumber: string) {
    setRetrying(orderNumber)
    setError('')

    try {
      const sessionToken = localStorage.getItem('seller_session_token')
      

      const response = await axios.post(`/api/seller/tax-invoices/retry/${orderNumber}`, {}, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        alert('세금계산서 재발행에 성공했습니다.')
        loadData()
      }
    } catch (error: any) {
      console.error('Failed to retry:', error)
      setError(error.response?.data?.error || '재시도에 실패했습니다.')
    } finally {
      setRetrying(null)
    }
  }

  async function viewInvoiceDetail(invoiceId: number) {
    try {
      const sessionToken = localStorage.getItem('seller_session_token')
      

      const response = await axios.get(`/api/seller/tax-invoices/${invoiceId}`, {
        headers: { 'Authorization': `Bearer ${sessionToken}` }
      })

      if (response.data.success) {
        setSelectedInvoice(response.data.data)
        setShowDetail(true)
      }
    } catch (error: any) {
      console.error('Failed to load invoice detail:', error)
      alert('세금계산서 상세 정보를 불러올 수 없습니다.')
    }
  }

  function formatPrice(price: number) {
    return price.toLocaleString('ko-KR')
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'issued':
        return <Badge className="bg-green-100 text-green-800 border-green-200">발행완료</Badge>
      case 'cancelled':
        return <Badge className="bg-red-100 text-red-800 border-red-200">취소됨</Badge>
      case 'success':
        return <Badge className="bg-green-100 text-green-800 border-green-200">성공</Badge>
      case 'failed':
        return <Badge className="bg-red-100 text-red-800 border-red-200">실패</Badge>
      case 'retry':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">재시도됨</Badge>
      case 'pending':
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">대기중</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate('/seller')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>판매자 대시보드로 돌아가기</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Title */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="w-10 h-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">세금계산서 관리</h1>
          </div>
          <p className="text-gray-600 mt-2">
            발행된 세금계산서를 조회하고, 자동 발행 로그를 확인할 수 있습니다.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b">
          <button
            onClick={() => setActiveTab('invoices')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'invoices'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            발행 내역
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-6 py-3 font-medium border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            자동 발행 로그
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="w-5 h-5" />
              <p>{error}</p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-10 h-10 animate-spin text-blue-600" />
          </div>
        ) : activeTab === 'invoices' ? (
          /* Invoices List */
          <div className="bg-white rounded-lg shadow-sm border">
            {invoices.length === 0 ? (
              <div className="text-center py-20">
                <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">발행된 세금계산서가 없습니다.</p>
                <p className="text-sm text-gray-500">배송완료 시 자동으로 발행됩니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">계산서번호</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">발행일</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">구매 사업자</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">공급가액</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">부가세</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상세</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {invoices.map((invoice) => (
                      <tr key={invoice.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{invoice.invoice_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(invoice.issue_date).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{invoice.order_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          <div>{invoice.buyer_business_name}</div>
                          <div className="text-xs text-gray-400">{invoice.buyer_business_number}</div>
                        </td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900">{formatPrice(invoice.supply_price)}원</td>
                        <td className="px-6 py-4 text-sm text-right text-gray-600">{formatPrice(invoice.tax_amount)}원</td>
                        <td className="px-6 py-4 text-center">{getStatusBadge(invoice.status)}</td>
                        <td className="px-6 py-4 text-center">
                          <button
                            onClick={() => viewInvoiceDetail(invoice.id)}
                            className="text-blue-600 hover:text-blue-800 transition-colors"
                          >
                            <Eye className="w-5 h-5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Auto Issue Logs */
          <div className="bg-white rounded-lg shadow-sm border">
            {logs.length === 0 ? (
              <div className="text-center py-20">
                <AlertCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">자동 발행 로그가 없습니다.</p>
                <p className="text-sm text-gray-500">배송완료 시 자동 발행이 시도됩니다.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">구매 사업자</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">금액</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">재시도</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">오류 메시지</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">일시</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">액션</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm font-mono text-gray-900">{log.order_number}</td>
                        <td className="px-6 py-4 text-sm text-gray-600">{log.buyer_business_name || '-'}</td>
                        <td className="px-6 py-4 text-sm text-right text-gray-900">
                          {log.total_amount ? `${formatPrice(log.total_amount)}원` : '-'}
                        </td>
                        <td className="px-6 py-4 text-center">{getStatusBadge(log.status)}</td>
                        <td className="px-6 py-4 text-center text-sm text-gray-600">
                          {log.retry_count > 0 ? `${log.retry_count}회` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-600 max-w-xs truncate">
                          {log.error_message || '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {new Date(log.created_at).toLocaleString('ko-KR')}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {log.status === 'failed' && log.retry_count < 3 && (
                            <Button
                              size="sm"
                              onClick={() => handleRetry(log.order_number)}
                              disabled={retrying === log.order_number}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              {retrying === log.order_number ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <RefreshCw className="w-4 h-4" />
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {showDetail && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              {/* Modal Header */}
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">세금계산서 상세</h2>
                <button
                  onClick={() => setShowDetail(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              {/* Invoice Info */}
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">기본 정보</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">계산서 번호</p>
                      <p className="font-mono font-medium">{selectedInvoice.invoice_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">발행일자</p>
                      <p className="font-medium">
                        {new Date(selectedInvoice.issue_date).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">주문번호</p>
                      <p className="font-mono font-medium">{selectedInvoice.order_number}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">상태</p>
                      <div>{getStatusBadge(selectedInvoice.status)}</div>
                    </div>
                  </div>
                </div>

                {/* Supplier Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">공급자 정보</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">상호(법인명)</p>
                      <p className="font-medium">{selectedInvoice.supplier_business_name}</p>
                    </div>
                  </div>
                </div>

                {/* Buyer Info */}
                <div className="border-b pb-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">공급받는자 정보</h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <p className="text-gray-500 mb-1">상호(법인명)</p>
                      <p className="font-medium">{selectedInvoice.buyer_business_name}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 mb-1">사업자등록번호</p>
                      <p className="font-mono">{selectedInvoice.buyer_business_number}</p>
                    </div>
                  </div>
                </div>

                {/* Amount Info */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">금액 정보</h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">공급가액</span>
                      <span className="font-medium">{formatPrice(selectedInvoice.supply_price)}원</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">부가세</span>
                      <span className="font-medium">{formatPrice(selectedInvoice.tax_amount)}원</span>
                    </div>
                    <div className="flex justify-between text-lg font-bold border-t pt-2">
                      <span>합계</span>
                      <span className="text-blue-600">{formatPrice(selectedInvoice.total_amount)}원</span>
                    </div>
                  </div>
                </div>

                {/* NTS Confirm Number */}
                {selectedInvoice.nts_confirm_number && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-900 mb-1">국세청 승인번호</p>
                    <p className="font-mono font-medium text-green-700">{selectedInvoice.nts_confirm_number}</p>
                  </div>
                )}
              </div>

              {/* Close Button */}
              <div className="mt-6 pt-4 border-t">
                <Button
                  onClick={() => setShowDetail(false)}
                  className="w-full py-3 bg-gray-600 hover:bg-gray-700 text-white"
                >
                  닫기
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

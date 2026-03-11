/**
 * 셀러 알림톡 대시보드 페이지
 * 
 * 기능:
 * - 알림톡 잔액 조회
 * - 충전하기
 * - 템플릿 관리
 * - 발송 내역
 * - 통계
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { 
  MessageSquare, 
  CreditCard, 
  FileText, 
  Send,
  TrendingUp,
  ArrowLeft,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react'

interface AlimtalkBalance {
  balance: number
  total_sent: number
  total_cost: number
}

interface AlimtalkTemplate {
  id: number
  template_code: string
  name: string
  content: string
  status: string
  category: string
  created_at: string
}

interface AlimtalkMessage {
  id: number
  template_name: string
  recipient_phone: string
  status: string
  cost: number
  sent_at: string
  delivered_at: string | null
  error_message: string | null
}

export default function SellerAlimtalkDashboardPage() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState<AlimtalkBalance | null>(null)
  const [templates, setTemplates] = useState<AlimtalkTemplate[]>([])
  const [messages, setMessages] = useState<AlimtalkMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'templates' | 'history'>('overview')

  useEffect(() => {
    const sessionToken = localStorage.getItem('seller_token')
    const userType = localStorage.getItem('user_type')
    
    if (!sessionToken || userType !== 'seller') {
      navigate('/seller/login')
      return
    }
    
    loadAllData()
  }, [])

  async function loadAllData() {
    try {
      setLoading(true)
      const sessionToken = localStorage.getItem('seller_token')

      const [balanceRes, templatesRes, messagesRes] = await Promise.all([
        api.get('/api/seller/alimtalk/balance', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        }),
        api.get('/api/seller/alimtalk/templates', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        }),
        api.get('/api/seller/alimtalk/messages?limit=20', {
          headers: { 'Authorization': `Bearer ${sessionToken}` }
        })
      ])

      setBalance(balanceRes.data.data)
      setTemplates(templatesRes.data.data)
      setMessages(messagesRes.data.data)
      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load alimtalk data:', err)
      if (err.response?.status === 401) {
        navigate('/seller/login')
      }
      setLoading(false)
    }
  }

  function formatPrice(price: number) {
    return new Intl.NumberFormat('ko-KR').format(price || 0)
  }

  function formatDate(dateString: string) {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('ko-KR')
  }

  function getStatusColor(status: string) {
    switch (status) {
      case 'approved':
      case 'sent':
      case 'delivered':
        return 'bg-green-100 text-green-800'
      case 'pending':
      case 'queued':
        return 'bg-yellow-100 text-yellow-800'
      case 'rejected':
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  function getStatusLabel(status: string) {
    const labels: Record<string, string> = {
      approved: '승인됨',
      pending: '심사중',
      rejected: '거부됨',
      sent: '발송됨',
      delivered: '전달됨',
      failed: '실패',
      queued: '대기중'
    }
    return labels[status] || status
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">알림톡 데이터를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/seller')}
                className="text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">💬 알림톡 관리</h1>
                <p className="text-sm text-gray-600">카카오 알림톡 발송 및 관리</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Balance Card */}
        {balance && (
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg shadow-lg p-6 mb-8 text-white">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-blue-100 text-sm mb-1">알림톡 잔액</p>
                <p className="text-4xl font-bold">{formatPrice(balance.balance)}원</p>
              </div>
              <div className="bg-white bg-opacity-20 rounded-full p-4">
                <CreditCard className="w-8 h-8" />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-blue-100 text-xs">총 발송</p>
                <p className="text-xl font-semibold">{formatPrice(balance.total_sent)}건</p>
              </div>
              <div>
                <p className="text-blue-100 text-xs">총 비용</p>
                <p className="text-xl font-semibold">{formatPrice(balance.total_cost)}원</p>
              </div>
            </div>
            
            <button
              onClick={() => navigate('/seller/alimtalk/charge')}
              className="w-full bg-white text-blue-600 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-colors"
            >
              충전하기
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('overview')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'overview'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  <span>개요</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'templates'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  <span>템플릿</span>
                </div>
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-6 py-4 font-medium border-b-2 transition-colors ${
                  activeTab === 'history'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  <span>발송 내역</span>
                </div>
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {activeTab === 'overview' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">알림톡 시작하기</h2>
                
                <div className="space-y-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-100 rounded-full p-3">
                        <span className="text-blue-600 font-bold text-lg">1</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">카카오 채널 생성</h3>
                        <p className="text-sm text-gray-600 mb-2">
                          카카오톡 채널 관리자 센터에서 채널을 생성하고 비즈니스 인증을 받으세요.
                        </p>
                        <a
                          href="https://center-pf.kakao.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 text-sm hover:underline"
                        >
                          채널 만들기 →
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-100 rounded-full p-3">
                        <span className="text-blue-600 font-bold text-lg">2</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">알림톡 충전</h3>
                        <p className="text-sm text-gray-600 mb-2">
                          알림톡 발송을 위한 잔액을 충전하세요. 건당 13-15원으로 저렴하게 발송할 수 있습니다.
                        </p>
                        <button
                          onClick={() => navigate('/seller/alimtalk/charge')}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          충전하기 →
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="border rounded-lg p-4">
                    <div className="flex items-start gap-4">
                      <div className="bg-blue-100 rounded-full p-3">
                        <span className="text-blue-600 font-bold text-lg">3</span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 mb-2">템플릿 등록</h3>
                        <p className="text-sm text-gray-600 mb-2">
                          발송할 메시지 템플릿을 등록하고 카카오 심사를 받으세요. 심사는 보통 1-2일 소요됩니다.
                        </p>
                        <button
                          onClick={() => setActiveTab('templates')}
                          className="text-blue-600 text-sm hover:underline"
                        >
                          템플릿 관리 →
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'templates' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-gray-900">템플릿 관리</h2>
                  <button
                    onClick={() => navigate('/seller/alimtalk/templates/new')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    <Plus className="w-5 h-5" />
                    <span>템플릿 등록</span>
                  </button>
                </div>

                {templates.length > 0 ? (
                  <div className="space-y-4">
                    {templates.map((template) => (
                      <div key={template.id} className="border rounded-lg p-4 hover:bg-gray-50">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="font-semibold text-gray-900">{template.name}</h3>
                              <span className={`px-2 py-1 text-xs rounded ${getStatusColor(template.status)}`}>
                                {getStatusLabel(template.status)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-2">{template.content}</p>
                            <div className="flex items-center gap-4 text-xs text-gray-500">
                              <span>코드: {template.template_code}</span>
                              <span>카테고리: {template.category}</span>
                              <span>등록일: {formatDate(template.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">등록된 템플릿이 없습니다</p>
                    <button
                      onClick={() => navigate('/seller/alimtalk/templates/new')}
                      className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      템플릿 등록하기
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-4">발송 내역</h2>

                {messages.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">날짜</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">수신번호</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">템플릿</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">상태</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">비용</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {messages.map((message) => (
                          <tr key={message.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {formatDate(message.sent_at)}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {message.recipient_phone}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900">
                              {message.template_name}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`px-2 py-1 text-xs rounded ${getStatusColor(message.status)}`}>
                                {getStatusLabel(message.status)}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-900 text-right">
                              {formatPrice(message.cost)}원
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Send className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">발송 내역이 없습니다</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

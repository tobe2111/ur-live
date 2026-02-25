import { CustomModal, useModal } from '@/components/CustomModal'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { logout as authLogout } from '@/utils/auth'
import { Users, Play, Package, TrendingUp, CheckCircle, XCircle } from 'lucide-react'

interface Seller {
  id: number
  email: string
  username?: string
  name?: string
  phone?: string
  business_name?: string
  business_number?: string
  company_name?: string
  status: string
  commission_rate?: number
  created_at: string
}

interface Stream {
  id: number
  title: string
  seller_id: number
  status: string
  youtube_video_id: string
  created_at: string
}

interface Stats {
  totalSellers: number
  activeSellers: number
  totalStreams: number
  activeStreams: number
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { isAuthReady } = useAuth()  // ✅ URL 파라미터 처리 Hook 추가
  const [sellers, setSellers] = useState<Seller[]>([])
  const [pendingSellers, setPendingSellers] = useState<Seller[]>([])
  const [streams, setStreams] = useState<Stream[]>([])
  const [stats, setStats] = useState<Stats>({
    totalSellers: 0,
    activeSellers: 0,
    totalStreams: 0,
    activeStreams: 0
  })
  const [loading, setLoading] = useState(true)
  const [rejectModalOpen, setRejectModalOpen] = useState(false)
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')

  useEffect(() => {
    // ⏳ URL 파라미터 처리가 완료될 때까지 대기
    if (!isAuthReady) {
      console.log('[AdminPage] ⏳ URL 파라미터 처리 대기 중...')
      return
    }
    
    // Check admin session
    const token = localStorage.getItem('access_token')
    const userType = localStorage.getItem('user_type')
    const adminId = localStorage.getItem('admin_id')
    
    console.log('[AdminPage] 🔍 Authentication check:', {
      hasToken: !!token,
      tokenLength: token?.length,
      userType,
      adminId,
      allKeys: Object.keys(localStorage),
      timestamp: new Date().toISOString()
    })
    
    if (!token) {
      console.log('[AdminPage] ❌ No session token found')
      navigate('/admin/login', { replace: true })
      return
    }
    
    if (userType !== 'admin') {
      console.log('[AdminPage] ❌ Invalid user_type:', userType, '(expected: admin)')
      navigate('/admin/login', { replace: true })
      return
    }
    
    console.log('[AdminPage] ✅ Auth success, loading data')
    loadData()
  }, [navigate, isAuthReady])  // ✅ isProcessed 추가

  async function loadData() {
    try {
      const token = localStorage.getItem('access_token')
      
      // Load all sellers
      const sellersRes = await api.get('/api/admin/sellers', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      // Load pending sellers
      const pendingRes = await api.get('/api/admin/sellers/pending', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      // Load streams
      const streamsRes = await api.get('/api/streams')

      const sellersData = sellersRes.data.data || []
      const pendingData = pendingRes.data.data || []
      const streamsData = streamsRes.data.data || []

      setSellers(sellersData)
      setPendingSellers(pendingData)
      setStreams(streamsData)

      // Calculate stats
      setStats({
        totalSellers: sellersData.length,
        activeSellers: sellersData.filter((s: Seller) => s.status === 'approved').length,
        totalStreams: streamsData.length,
        activeStreams: streamsData.filter((s: Stream) => s.status === 'live').length
      })

      setLoading(false)
    } catch (err: any) {
      console.error('Failed to load data:', err)
      if (err.response?.status === 401) {
        localStorage.removeItem('access_token')
        localStorage.removeItem('user_type')
        navigate('/admin/login')
      }
      setLoading(false)
    }
  }

  async function approveSeller(sellerId: number) {
    if (!confirm('이 판매자를 승인하시겠습니까?')) return

    try {
      const token = localStorage.getItem('access_token')
      const response = await api.patch(
        `/api/admin/sellers/${sellerId}/approve`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      alert(response.data.message || '판매자 승인 완료!')
      loadData()
    } catch (err: any) {
      alert(`승인 실패: ${err.response?.data?.error || err.message}`)
    }
  }

  async function rejectSeller() {
    if (!selectedSeller || !rejectionReason.trim()) {
      alert('거부 사유를 입력해주세요')
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      const response = await api.patch(
        `/api/admin/sellers/${selectedSeller.id}/reject`,
        { reason: rejectionReason },
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      alert(response.data.message || '판매자 승인이 거부되었습니다')
      setRejectModalOpen(false)
      setSelectedSeller(null)
      setRejectionReason('')
      loadData()
    } catch (err: any) {
      alert(`거부 실패: ${err.response?.data?.error || err.message}`)
    }
  }

  function openRejectModal(seller: Seller) {
    setSelectedSeller(seller)
    setRejectionReason('')
    setRejectModalOpen(true)
  }

  async function deleteStream(streamId: number) {
    if (!confirm('정말 이 라이브를 삭제하시겠습니까?')) return

    try {
      const token = localStorage.getItem('access_token')
      await api.delete(`/api/admin/streams/${streamId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      alert('라이브 삭제 완료!')
      loadData()
    } catch (err: any) {
      alert(`삭제 실패: ${err.response?.data?.error || err.message}`)
    }
  }

  async function updateCommissionRate(sellerId: number, currentRate: number) {
    const newRate = prompt(`새로운 수수료율을 입력하세요 (0-100%, 현재: ${currentRate}%)`, currentRate.toString())
    if (!newRate) return

    const rate = parseFloat(newRate)
    if (isNaN(rate) || rate < 0 || rate > 100) {
      alert('수수료율은 0에서 100 사이의 값이어야 합니다')
      return
    }

    try {
      const token = localStorage.getItem('access_token')
      await api.patch(
        `/api/admin/sellers/${sellerId}/commission`,
        { commission_rate: rate },
        { headers: { 'Authorization': `Bearer ${token}` } }
      )
      alert(`수수료율이 ${currentRate}%에서 ${rate}%로 변경되었습니다`)
      loadData()
    } catch (err: any) {
      alert(`수수료율 변경 실패: ${err.response?.data?.error || err.message}`)
    }
  }

  function logout() {
    // 🔧 표준 logout 함수 사용 (JWT + 레거시 키 모두 삭제)
    authLogout()
    console.log('[AdminPage] 🚪 관리자 로그아웃 완료')
    navigate('/admin/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">👨‍💼 관리자 대시보드</h1>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/admin/banners')}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 font-medium"
            >
              🎨 배너 관리
            </button>
            <button
              onClick={() => navigate('/admin/settlement')}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 font-medium"
            >
              💰 정산 대시보드
            </button>
            <button
              onClick={logout}
              className="text-gray-600 hover:text-gray-900"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Users className="w-10 h-10 text-blue-600" />
              <TrendingUp className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">총 판매자</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalSellers}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
            <p className="text-sm text-gray-600">승인된 판매자</p>
            <p className="text-3xl font-bold text-gray-900">{stats.activeSellers}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Play className="w-10 h-10 text-red-600" />
            </div>
            <p className="text-sm text-gray-600">총 라이브</p>
            <p className="text-3xl font-bold text-gray-900">{stats.totalStreams}</p>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between mb-2">
              <Package className="w-10 h-10 text-orange-600" />
            </div>
            <p className="text-sm text-gray-600">진행 중 라이브</p>
            <p className="text-3xl font-bold text-gray-900">{stats.activeStreams}</p>
          </div>
        </div>

        {/* Pending Sellers Approval Section */}
        {pendingSellers.length > 0 && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-lg shadow mb-8">
            <div className="p-6 border-b border-yellow-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-yellow-600" />
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">⏳ 승인 대기 중인 판매자</h2>
                    <p className="text-sm text-gray-600">{pendingSellers.length}명의 판매자가 승인을 기다리고 있습니다</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-yellow-100 border-b border-yellow-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">신청일시</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">이름</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">이메일</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">연락처</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">상호명</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">사업자번호</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">승인 관리</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {pendingSellers.map((seller) => (
                    <tr key={seller.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(seller.created_at).toLocaleString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{seller.name || '-'}</div>
                        <div className="text-xs text-gray-500">{seller.username}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {seller.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {seller.phone || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {seller.business_name || seller.company_name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {seller.business_number || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => approveSeller(seller.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            승인
                          </button>
                          <button
                            onClick={() => openRejectModal(seller)}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm font-medium flex items-center gap-1"
                          >
                            <XCircle className="w-4 h-4" />
                            거부
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rejection Modal */}
        {rejectModalOpen && selectedSeller && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4">판매자 승인 거부</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>{selectedSeller.name || selectedSeller.username}</strong>님의 승인을 거부하시겠습니까?
                </p>
                <p className="text-sm text-gray-500 mb-4">거부 사유를 입력해주세요:</p>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="예: 사업자등록증 확인 불가, 부적절한 상호명 등"
                  rows={4}
                  className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRejectModalOpen(false)
                    setSelectedSeller(null)
                    setRejectionReason('')
                  }}
                  className="flex-1 bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 font-medium"
                >
                  취소
                </button>
                <button
                  onClick={rejectSeller}
                  disabled={!rejectionReason.trim()}
                  className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  거부 확정
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Sellers Section */}
        <div className="bg-white rounded-lg shadow mb-8">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">판매자 관리</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이메일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">회사명</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">수수료율</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">가입일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {sellers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                      등록된 판매자가 없습니다
                    </td>
                  </tr>
                ) : (
                  sellers.map(seller => (
                    <tr key={seller.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{seller.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{seller.email}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{seller.business_name || seller.company_name || '-'}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => updateCommissionRate(seller.id, seller.commission_rate || 10.00)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          {(seller.commission_rate || 10.00).toFixed(2)}%
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          seller.status === 'approved'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {seller.status === 'approved' ? '승인됨' : '대기중'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(seller.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4">
                        {seller.status !== 'approved' && (
                          <button
                            onClick={() => approveSeller(seller.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium mr-2"
                          >
                            승인
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Streams Section */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">라이브 스트림 관리</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">제목</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">YouTube ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {streams.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      등록된 라이브가 없습니다
                    </td>
                  </tr>
                ) : (
                  streams.map(stream => (
                    <tr key={stream.id}>
                      <td className="px-6 py-4 text-sm text-gray-900">{stream.id}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{stream.title}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 font-mono">{stream.youtube_video_id}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          stream.status === 'live'
                            ? 'bg-red-100 text-red-800'
                            : stream.status === 'scheduled'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {stream.status === 'live' ? '🔴 라이브' : stream.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(stream.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => deleteStream(stream.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

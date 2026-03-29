import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { Heart, TrendingUp, CreditCard, Loader2 } from 'lucide-react'
import { getSellerToken, isSellerAuthenticated, redirectToLogin } from '@/lib/seller-auth'
import SellerLayout from '@/components/SellerLayout'

interface Donation {
  id: number
  donor_name: string
  amount: number
  commission_amount: number
  credit_amount: number
  message: string
  stream_title: string
  created_at: string
}

interface DonationStats {
  totalCount: number
  totalAmount: number
  totalCredits: number
  totalCommission: number
}

export default function SellerDonationsPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [donations, setDonations] = useState<Donation[]>([])
  const [stats, setStats] = useState<DonationStats>({ totalCount: 0, totalAmount: 0, totalCredits: 0, totalCommission: 0 })
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (!isSellerAuthenticated()) { redirectToLogin(navigate); return }
    loadDonations()
  }, [navigate, page])

  async function loadDonations() {
    setLoading(true)
    try {
      const resp = await api.get(`/api/donations/seller?page=${page}`, {
        headers: { Authorization: `Bearer ${getSellerToken()}` },
      })
      if (resp.data.success) {
        setDonations(resp.data.data.donations || [])
        setStats(resp.data.data.stats || { totalCount: 0, totalAmount: 0, totalCredits: 0, totalCommission: 0 })
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  function formatTimeAgo(dateStr: string) {
    const d = new Date(dateStr)
    const now = new Date()
    const sec = Math.floor((now.getTime() - d.getTime()) / 1000)
    if (sec < 60) return '방금 전'
    if (sec < 3600) return `${Math.floor(sec / 60)}분 전`
    if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`
    if (sec < 604800) return `${Math.floor(sec / 86400)}일 전`
    return d.toLocaleDateString('ko-KR')
  }

  return (
    <SellerLayout title="후원 내역">
      <div className="max-w-4xl mx-auto">

        {/* 통계 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-4 h-4 text-pink-500" />
              <span className="text-xs text-gray-500">총 후원</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.totalCount.toLocaleString()}건</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-gray-500">총 후원 금액</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.totalAmount.toLocaleString()}원</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-emerald-500" />
              <span className="text-xs text-gray-500">적립 크레딧</span>
            </div>
            <p className="text-xl font-bold text-emerald-600">{stats.totalCredits.toLocaleString()}원</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-400">수수료 (10%)</span>
            </div>
            <p className="text-xl font-bold text-gray-400">{stats.totalCommission.toLocaleString()}원</p>
          </div>
        </div>

        {/* 후원 목록 */}
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">후원 내역</h2>
          </div>

          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 className="w-8 h-8 text-pink-500 animate-spin" />
            </div>
          ) : donations.length === 0 ? (
            <div className="py-16 text-center">
              <Heart className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-sm text-gray-400">아직 받은 후원이 없습니다</p>
              <p className="text-xs text-gray-300 mt-1">라이브 방송 중 시청자들이 후원할 수 있습니다</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {donations.map(d => (
                <div key={d.id} className="px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Heart className="w-3.5 h-3.5 text-pink-500 fill-pink-500" />
                        <span className="text-sm font-semibold text-gray-900">
                          {d.donor_name}
                        </span>
                        <span className="text-sm font-bold text-pink-600">
                          {d.amount.toLocaleString()}원
                        </span>
                      </div>
                      {d.message && (
                        <p className="text-sm text-gray-600 mb-1">"{d.message}"</p>
                      )}
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{d.stream_title}</span>
                        <span>{formatTimeAgo(d.created_at)}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs text-emerald-600 font-semibold">+{d.credit_amount.toLocaleString()}원</p>
                      <p className="text-xs text-gray-300">크레딧</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {donations.length > 0 && (
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
              >
                이전
              </button>
              <span className="text-xs text-gray-400">{page} 페이지</span>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={donations.length < 20}
                className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
              >
                다음
              </button>
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  )
}

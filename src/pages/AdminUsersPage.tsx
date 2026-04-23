import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { formatKST } from '@/utils/date'
import {
  Users, Search, ChevronDown, ChevronUp,
  Loader2, ChevronLeft, ChevronRight
} from 'lucide-react'

// NOTE: users 테이블에는 deal_balance, status 컬럼이 존재하지 않습니다.
// 포인트는 user_points 테이블 / 상태는 별도 관리 필요.
interface User {
  id: number
  name: string
  email: string
  phone: string | null
  provider: string | null
  created_at: string
}

interface UserDetail {
  order_count: number
  total_spent: number
  review_count: number
}

export default function AdminUsersPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState<number | null>(null)
  const [details, setDetails] = useState<Record<number, UserDetail>>({})

  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const LIMIT = 50

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadUsers()
  }, [page])

  async function loadUsers() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        search,
      })
      const res = await api.get(`/api/admin/users?${params}`, h)
      if (res.data.success) {
        setUsers(res.data.data || [])
        setTotalPages(res.data.totalPages || 1)
        setTotalCount(res.data.total || 0)
      }
    } catch {
      toast.error('유저 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    loadUsers()
  }

  async function toggleDetail(userId: number) {
    if (expandedId === userId) {
      setExpandedId(null)
      return
    }
    setExpandedId(userId)
    if (details[userId]) return
    setDetailLoading(userId)
    try {
      const res = await api.get(`/api/admin/users/${userId}`, h)
      if (res.data.success) {
        setDetails(prev => ({ ...prev, [userId]: res.data.data }))
      }
    } catch {
      toast.error('유저 상세 정보를 불러오지 못했습니다')
    } finally {
      setDetailLoading(null)
    }
  }

  function getProviderLabel(provider: string | null) {
    if (!provider) return '-'
    const map: Record<string, string> = {
      email: '이메일', google: 'Google', kakao: '카카오',
      naver: '네이버', apple: 'Apple', phone: '전화번호',
    }
    return map[provider] || provider
  }

  return (
    <AdminLayout title={t('admin.pages.users')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 135: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('admin.pages.users')}
          subtitle={!loading ? `총 ${totalCount.toLocaleString()}명` : '불러오는 중...'}
          icon={<Users className="h-5 w-5" />}
        />

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="이름 또는 이메일로 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            검색
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-20">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-500">유저가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">ID</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">이름</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">이메일</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">전화번호</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">가입방법</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">가입일</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">액션</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const isExpanded = expandedId === user.id
                  const detail = details[user.id]
                  const isDetailLoading = detailLoading === user.id
                  return (
                    <Fragment key={user.id}>
                      <tr className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{user.id}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{user.name || '-'}</td>
                        <td className="px-4 py-3 text-gray-700">{user.email || '-'}</td>
                        <td className="px-4 py-3 text-gray-700">{user.phone || '-'}</td>
                        <td className="px-4 py-3 text-gray-700">{getProviderLabel(user.provider)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {formatKST(user.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => toggleDetail(user.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                            >
                              상세
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-blue-50/30">
                          <td colSpan={7} className="px-4 py-4">
                            {isDetailLoading ? (
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                불러오는 중...
                              </div>
                            ) : detail ? (
                              <div className="flex gap-8 text-sm">
                                <div>
                                  <span className="text-gray-500">주문 수:</span>{' '}
                                  <span className="font-semibold text-gray-900">{detail.order_count.toLocaleString()}건</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">총 결제액:</span>{' '}
                                  <span className="font-semibold text-gray-900">{detail.total_spent.toLocaleString()}원</span>
                                </div>
                                <div>
                                  <span className="text-gray-500">리뷰 수:</span>{' '}
                                  <span className="font-semibold text-gray-900">{detail.review_count.toLocaleString()}건</span>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500">상세 정보를 불러올 수 없습니다</p>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">
              {((page - 1) * LIMIT + 1).toLocaleString()} - {Math.min(page * LIMIT, totalCount).toLocaleString()} / {totalCount.toLocaleString()}명
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4 text-gray-700" />
              </button>
              <span className="px-3 py-1 text-sm font-medium text-gray-700">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4 text-gray-700" />
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </AdminLayout>
  )
}


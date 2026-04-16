import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { formatKST } from '@/utils/date'
import {
  Users, Search, Ban, ShieldCheck, ShieldX, ChevronDown, ChevronUp,
  Loader2, ChevronLeft, ChevronRight
} from 'lucide-react'

interface User {
  id: number
  name: string
  email: string
  phone: string | null
  provider: string | null
  deal_balance: number
  status: 'active' | 'suspended' | 'banned'
  created_at: string
}

interface UserDetail {
  order_count: number
  total_spent: number
  review_count: number
}

const STATUS_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'active', label: '활성' },
  { value: 'suspended', label: '정지' },
  { value: 'banned', label: '차단' },
]

const STATUS_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: '활성', color: 'text-emerald-700', bg: 'bg-emerald-50' },
  suspended: { label: '정지', color: 'text-amber-700',   bg: 'bg-amber-50' },
  banned:    { label: '차단', color: 'text-red-700',     bg: 'bg-red-50' },
}

export default function AdminUsersPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState<number | null>(null)
  const [details, setDetails] = useState<Record<number, UserDetail>>({})
  const [actionLoading, setActionLoading] = useState<number | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ userId: number; action: string; label: string } | null>(null)

  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const LIMIT = 50

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadUsers()
  }, [page, statusFilter])

  async function loadUsers() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        search,
        status: statusFilter,
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

  function openConfirm(userId: number, action: string, label: string) {
    setConfirmDialog({ userId, action, label })
  }

  async function executeAction() {
    if (!confirmDialog) return
    const { userId, action } = confirmDialog
    setActionLoading(userId)
    setConfirmDialog(null)
    try {
      await api.patch(`/api/admin/users/${userId}/status`, { status: action }, h)
      toast.success('상태가 변경되었습니다')
      loadUsers()
    } catch {
      toast.error('상태 변경에 실패했습니다')
    } finally {
      setActionLoading(null)
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
    <AdminLayout title="유저 관리">
      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-sm w-full mx-4 shadow-lg">
            <h3 className="text-base font-bold text-gray-900 mb-2">확인</h3>
            <p className="text-sm text-gray-700 mb-5">
              이 유저를 <span className="font-semibold">{confirmDialog.label}</span> 하시겠습니까?
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                취소
              </button>
              <button
                onClick={executeAction}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header Stats */}
      <div className="flex items-center gap-3 mb-1">
        <Users className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-900">유저 관리</h2>
        {!loading && (
          <span className="text-sm text-gray-500">총 {totalCount.toLocaleString()}명</span>
        )}
      </div>

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
        <div className="flex gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => { setStatusFilter(opt.value); setPage(1) }}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                statusFilter === opt.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
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
                  <th className="text-right px-4 py-3 font-semibold text-gray-700">딜잔액</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">상태</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">가입일</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">액션</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => {
                  const badge = STATUS_BADGE[user.status] || STATUS_BADGE.active
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
                        <td className="px-4 py-3 text-right text-gray-900 font-medium">
                          {(user.deal_balance || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${badge.color} ${badge.bg}`}>
                            {badge.label}
                          </span>
                        </td>
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
                            {actionLoading === user.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                            ) : (
                              <>
                                {user.status === 'active' && (
                                  <button
                                    onClick={() => openConfirm(user.id, 'suspended', '정지')}
                                    className="px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1"
                                  >
                                    <ShieldX className="w-3 h-3" />
                                    정지
                                  </button>
                                )}
                                {user.status === 'suspended' && (
                                  <>
                                    <button
                                      onClick={() => openConfirm(user.id, 'active', '정지해제')}
                                      className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1"
                                    >
                                      <ShieldCheck className="w-3 h-3" />
                                      해제
                                    </button>
                                    <button
                                      onClick={() => openConfirm(user.id, 'banned', '차단')}
                                      className="px-2.5 py-1.5 text-xs font-medium text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center gap-1"
                                    >
                                      <Ban className="w-3 h-3" />
                                      차단
                                    </button>
                                  </>
                                )}
                                {user.status === 'banned' && (
                                  <button
                                    onClick={() => openConfirm(user.id, 'active', '차단해제')}
                                    className="px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-lg hover:bg-emerald-100 transition-colors flex items-center gap-1"
                                  >
                                    <ShieldCheck className="w-3 h-3" />
                                    해제
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-blue-50/30">
                          <td colSpan={9} className="px-4 py-4">
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
    </AdminLayout>
  )
}


import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { formatKST } from '@/utils/date'
import { formatNumber } from '@/utils/format'
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
  // 🛡️ 2026-05-24: backend aggregate columns
  order_count?: number
  total_spent?: number
  review_count?: number
}

type SortKey = 'created_at' | 'order_count' | 'total_spent' | 'review_count' | 'name'

interface UserDetail {
  order_count: number
  total_spent: number
  review_count: number
  linked_seller?: {
    id: number; business_name: string; seller_type: string; status: string
    commission_rate?: number; created_at: string
  } | null
  linked_agency?: {
    id: number; name: string; contact_name: string; status: string
    commission_rate?: number; created_at: string
  } | null
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
  const [sort, setSort] = useState<SortKey>('created_at')
  const [order, setOrder] = useState<'desc' | 'asc'>('desc')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  // 🛡️ 2026-05-24: 데이터 사라짐 진단 모달 — 잔액 / 쿠폰 / 바우처 / 중복 row.
  const [fullStateUserId, setFullStateUserId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState<number | null>(null)
  const [details, setDetails] = useState<Record<number, UserDetail>>({})

  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const LIMIT = 50

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sort, order])

  async function loadUsers() {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(LIMIT),
        sort,
        order,
      })
      if (search.trim()) params.set('search', search.trim())
      const res = await api.get(`/api/admin/users?${params}`, h)
      if (res.data.success) {
        setUsers(res.data.data || [])
        // 🛡️ 2026-05-24: backend 가 totalPages 와 pagination.totalPages 둘 다 반환 (호환).
        const tp = res.data.totalPages || res.data.pagination?.totalPages || 1
        const tc = res.data.total || res.data.pagination?.total || 0
        setTotalPages(tp)
        setTotalCount(tc)
      }
    } catch {
      toast.error('유저 목록을 불러오지 못했습니다')
    } finally {
      setLoading(false)
    }
  }

  // 🛡️ 컬럼 헤더 클릭 시 정렬 — 같은 컬럼 다시 클릭하면 asc/desc 토글.
  function handleSort(key: SortKey) {
    if (sort === key) {
      setOrder(o => (o === 'desc' ? 'asc' : 'desc'))
    } else {
      setSort(key)
      setOrder('desc')
    }
    setPage(1)
  }

  function SortHeader({ k, children }: { k: SortKey; children: React.ReactNode }) {
    const active = sort === k
    return (
      <button onClick={() => handleSort(k)}
        className={`flex items-center gap-1 font-semibold ${active ? 'text-blue-700' : 'text-gray-700 hover:text-gray-900'}`}>
        {children}
        {active && (order === 'desc' ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />)}
      </button>
    )
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
          subtitle={!loading ? `총 ${formatNumber(totalCount)}명` : t('admin.users.loading', { defaultValue: '불러오는 중...' })}
          icon={<Users className="h-5 w-5" />}
        />

      {/* Search & Sort */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('admin.users.searchPlaceholder', { defaultValue: '이름 / 이메일 / 전화번호 검색...' })}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {t('admin.users.searchBtn', { defaultValue: '검색' })}
          </button>
        </form>
        {/* 🛡️ 2026-05-24: 정렬 드롭다운 — 헤더 클릭과 동일 동작 (둘 다 가능). */}
        <select
          value={`${sort}:${order}`}
          onChange={(e) => {
            const [k, o] = e.target.value.split(':')
            setSort(k as SortKey); setOrder(o as 'asc' | 'desc'); setPage(1)
          }}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900"
        >
          <option value="created_at:desc">최신가입순</option>
          <option value="created_at:asc">오래된 가입순</option>
          <option value="order_count:desc">주문 수 많은순</option>
          <option value="total_spent:desc">총 결제액 많은순</option>
          <option value="review_count:desc">리뷰 수 많은순</option>
          <option value="name:asc">이름순 (가나다)</option>
        </select>
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
            <p className="text-sm text-gray-500">{t('admin.users.noUsers', { defaultValue: '유저가 없습니다' })}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">ID</th>
                  <th className="text-left px-4 py-3"><SortHeader k="name">{t('admin.users.thName', { defaultValue: '이름' })}</SortHeader></th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">{t('admin.users.thEmail', { defaultValue: '이메일' })}</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-700">{t('admin.users.thPhone', { defaultValue: '전화번호' })}</th>
                  <th className="text-right px-4 py-3"><SortHeader k="order_count">주문</SortHeader></th>
                  <th className="text-right px-4 py-3"><SortHeader k="total_spent">총 결제액</SortHeader></th>
                  <th className="text-right px-4 py-3"><SortHeader k="review_count">리뷰</SortHeader></th>
                  <th className="text-left px-4 py-3"><SortHeader k="created_at">{t('admin.users.thJoinDate', { defaultValue: '가입일' })}</SortHeader></th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-700">{t('admin.users.thAction', { defaultValue: '액션' })}</th>
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
                        <td className="px-4 py-3 text-gray-700">
                          {user.phone || <span className="text-red-500 text-xs">미등록</span>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-900 font-mono">{formatNumber(user.order_count || 0)}</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-mono">{formatNumber(user.total_spent || 0)}원</td>
                        <td className="px-4 py-3 text-right text-gray-900 font-mono">{formatNumber(user.review_count || 0)}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                          {formatKST(user.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={() => toggleDetail(user.id)}
                              className="px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
                            >
                              {t('admin.users.detailBtn', { defaultValue: '상세' })}
                              {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
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
                              <div className="space-y-3 text-sm">
                                <div className="flex gap-8 items-center">
                                  <div>
                                    <span className="text-gray-500">{t('admin.users.orderCount', { defaultValue: '주문 수' })}:</span>{' '}
                                    <span className="font-semibold text-gray-900">{formatNumber(detail.order_count)}건</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">{t('admin.users.totalSpent', { defaultValue: '총 결제액' })}:</span>{' '}
                                    <span className="font-semibold text-gray-900">{formatNumber(detail.total_spent)}원</span>
                                  </div>
                                  <div>
                                    <span className="text-gray-500">{t('admin.users.reviewCount', { defaultValue: '리뷰 수' })}:</span>{' '}
                                    <span className="font-semibold text-gray-900">{formatNumber(detail.review_count)}건</span>
                                  </div>
                                  {/* 🛡️ 2026-05-24: 데이터 사라짐 / 잔액 안 보임 진단 */}
                                  <button
                                    onClick={() => setFullStateUserId(user.id)}
                                    className="ml-auto px-3 py-1.5 bg-red-100 text-red-700 text-xs font-bold rounded hover:bg-red-200"
                                  >
                                    🔍 전체 상태 진단 (잔액/쿠폰/바우처/중복)
                                  </button>
                                </div>

                                {/* 연결된 셀러 / 에이전시 */}
                                {(detail.linked_seller || detail.linked_agency) && (
                                  <div className="pt-2 border-t border-gray-200 space-y-2">
                                    <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{t('admin.users.linkedAccounts', { defaultValue: '연결된 계정' })}</p>
                                    {detail.linked_seller && (
                                      <div className="bg-red-50 border border-red-100 rounded-lg p-2.5 flex items-center justify-between">
                                        <div>
                                          <p className="text-[11px] text-red-700 font-bold">🛍 셀러</p>
                                          <p className="text-sm text-gray-900 font-semibold">{detail.linked_seller.business_name}</p>
                                          <p className="text-[10px] text-gray-500">
                                            {detail.linked_seller.seller_type} · {detail.linked_seller.status}
                                          </p>
                                        </div>
                                        <button onClick={() => navigate(`/admin/sellers?id=${detail.linked_seller!.id}`)}
                                          className="text-[11px] text-red-600 font-semibold px-2 py-1 hover:bg-red-100 rounded">
                                          {t('admin.users.manageLink', { defaultValue: '관리 →' })}
                                        </button>
                                      </div>
                                    )}
                                    {detail.linked_agency && (
                                      <div className="bg-purple-50 border border-purple-100 rounded-lg p-2.5 flex items-center justify-between">
                                        <div>
                                          <p className="text-[11px] text-purple-700 font-bold">💼 에이전시</p>
                                          <p className="text-sm text-gray-900 font-semibold">{detail.linked_agency.name}</p>
                                          <p className="text-[10px] text-gray-500">
                                            담당: {detail.linked_agency.contact_name} · {detail.linked_agency.status}
                                          </p>
                                        </div>
                                        <button onClick={() => navigate(`/admin/agencies?id=${detail.linked_agency!.id}`)}
                                          className="text-[11px] text-purple-600 font-semibold px-2 py-1 hover:bg-purple-100 rounded">
                                          {t('admin.users.manageLink', { defaultValue: '관리 →' })}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
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
              {formatNumber((page - 1) * LIMIT + 1)} - {Math.min(page * LIMIT, totalCount)} / {formatNumber(totalCount)}명
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

      {/* 🛡️ 2026-05-24: 전체 상태 진단 모달 */}
      {fullStateUserId && <FullStateModal userId={fullStateUserId} onClose={() => setFullStateUserId(null)} />}
    </AdminLayout>
  )
}

// ─── 전체 상태 진단 모달 (잔액/쿠폰/바우처/중복) ───
function FullStateModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [data, setData] = useState<{
    user: { id: number; name: string; email: string | null; phone: string | null; kakao_id: string | null; created_at: string }
    duplicates: Array<{ id: number; name: string | null; email: string | null; phone: string | null; kakao_id: string | null; created_at: string }>
    wallet: { balance: number; updated_at: string } | null
    point_transactions: Array<{ id: number; type: string; amount: number; balance_after: number; description: string; created_at: string }>
    vouchers: { count: number; recent: Array<{ id: number; code: string; status: string; product_name: string | null }> }
    coupons: { count: number; recent: Array<{ id: number; coupon_code: string; status: string }> }
    wishlists: { count: number; recent: Array<{ id: number; product_id: number; product_name: string | null }> }
    orders: { count: number; recent: Array<{ id: number; order_number: string; status: string; total_amount: number }> }
    diagnosis: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
    api.get(`/api/admin/users/${userId}/full-state`, h)
      .then(r => { if (r.data.success) setData(r.data.data); else setError(r.data.error || '조회 실패') })
      .catch(e => setError((e as Error).message))
      .finally(() => setLoading(false))
  }, [userId])

  return (
    <div className="fixed inset-0 z-[10100] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl p-5 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-gray-900">🔍 user #{userId} 전체 상태 진단</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500">✕</button>
        </div>
        {loading ? <p className="text-center py-8 text-gray-500">로딩 중...</p>
        : error ? <p className="text-center py-8 text-red-600">{error}</p>
        : data ? (
          <div className="space-y-3 text-sm">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-bold mb-2">📋 진단</p>
              {data.diagnosis.map((d, i) => <p key={i} className="text-gray-800 mb-1 whitespace-pre">{d}</p>)}
            </div>

            {data.duplicates.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="font-bold text-red-900 mb-2">⚠️ 중복 의심 user row {data.duplicates.length}개</p>
                {data.duplicates.map(d => (
                  <div key={d.id} className="text-xs text-red-800 mb-1">
                    <b>id={d.id}</b> · {d.name || '(no name)'} · {d.email || '-'} · kakao={d.kakao_id || '-'} · phone={d.phone || '-'} · {d.created_at}
                  </div>
                ))}
                <p className="text-[11px] text-red-600 mt-2">→ 이 ID 들이 정지원님의 다른 row 입니다. 잔액/쿠폰/바우처는 이 중 어디에 있을지 확인하세요.</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded p-2">
                <p className="text-[10px] text-gray-500">user</p>
                <p className="font-mono text-xs">id={data.user.id} · kakao={data.user.kakao_id}</p>
                <p className="font-mono text-xs">phone={data.user.phone || '없음'}</p>
              </div>
              <div className="bg-gray-50 rounded p-2">
                <p className="text-[10px] text-gray-500">딜 잔액</p>
                <p className="font-bold text-lg">{data.wallet ? data.wallet.balance.toLocaleString() : '없음'}</p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              <div className="bg-blue-50 rounded p-2 text-center">
                <p className="text-[10px] text-gray-600">바우처</p>
                <p className="font-bold">{data.vouchers.count}</p>
              </div>
              <div className="bg-pink-50 rounded p-2 text-center">
                <p className="text-[10px] text-gray-600">쿠폰</p>
                <p className="font-bold">{data.coupons.count}</p>
              </div>
              <div className="bg-rose-50 rounded p-2 text-center">
                <p className="text-[10px] text-gray-600">찜</p>
                <p className="font-bold">{data.wishlists.count}</p>
              </div>
              <div className="bg-emerald-50 rounded p-2 text-center">
                <p className="text-[10px] text-gray-600">주문</p>
                <p className="font-bold">{data.orders.count}</p>
              </div>
            </div>

            {data.point_transactions.length > 0 && (
              <div>
                <p className="font-bold mb-1">최근 딜 거래 (10건)</p>
                {data.point_transactions.map(p => (
                  <div key={p.id} className="text-xs text-gray-700 border-b border-gray-100 py-1">
                    <span className={p.amount > 0 ? 'text-emerald-600' : 'text-red-600'}>
                      {p.amount > 0 ? '+' : ''}{p.amount.toLocaleString()}
                    </span>
                    {' '}· {p.type} · {p.description} · <span className="text-gray-400">{p.created_at}</span>
                  </div>
                ))}
              </div>
            )}

            {data.vouchers.recent.length > 0 && (
              <div>
                <p className="font-bold mb-1">최근 바우처 (5건)</p>
                {data.vouchers.recent.map(v => (
                  <div key={v.id} className="text-xs text-gray-700">
                    #{v.id} · {v.code} · {v.status} · {v.product_name || '(deleted product)'}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}


import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { UserCheck, UserX, Loader2, Search, Pause, Play } from 'lucide-react'
import { toast } from '@/hooks/useToast'

/**
 * 🛡️ 2026-04-28: 셀러 관리 통합 페이지
 *  - 이전: 대기 셀러 승인/거절만 가능
 *  - 변경: 전체 셀러 (대기/활성/정지/거부) 조회 + 검색 + 상태 변경 통합
 */
type Seller = {
  id: number
  email: string
  name: string | null
  phone: string | null
  business_name: string | null
  business_number: string | null
  status: 'pending' | 'active' | 'suspended' | 'rejected' | string
  commission_rate?: number
  created_at: string
}

const STATUS_OPTIONS = [
  { key: 'all', label: '전체' },
  { key: 'pending', label: '승인 대기' },
  { key: 'active', label: '활성' },
  { key: 'suspended', label: '정지' },
  { key: 'rejected', label: '거부' },
] as const

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  active: 'bg-green-100 text-green-700 border-green-200',
  suspended: 'bg-gray-200 text-gray-600 border-gray-300',
  rejected: 'bg-red-100 text-red-700 border-red-200',
}

const STATUS_LABEL: Record<string, string> = {
  pending: '승인 대기',
  active: '활성',
  suspended: '정지',
  rejected: '거부',
}

export default function AdminSellerApprovalPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [actingId, setActingId] = useState<number | null>(null)
  const [filter, setFilter] = useState<typeof STATUS_OPTIONS[number]['key']>(
    (searchParams.get('status') as typeof STATUS_OPTIONS[number]['key']) || 'pending'
  )
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const h = useMemo(() => ({
    headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
  }), [])

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true })
  }, [navigate])

  const load = async () => {
    setLoading(true)
    try {
      // 전체 셀러 + pending 별도 (병합 쿼리)
      const res = await api.get('/api/admin/sellers?limit=200', h)
      if (res.data.success) setSellers(res.data.data || [])
    } catch (e) {
      if (import.meta.env.DEV) console.warn(e)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  // 필터 + 검색 적용
  const filtered = useMemo(() => {
    return sellers.filter(s => {
      if (filter !== 'all' && s.status !== filter) return false
      if (search.trim()) {
        const q = search.toLowerCase().trim()
        const text = `${s.name || ''} ${s.email || ''} ${s.business_name || ''} ${s.business_number || ''} ${s.phone || ''}`.toLowerCase()
        if (!text.includes(q)) return false
      }
      return true
    })
  }, [sellers, filter, search])

  const approve = async (id: number) => {
    setActingId(id)
    try {
      await api.put(`/api/admin/tools/sellers/${id}/approve`, {}, h)
      toast.success('승인 완료'); load()
    } catch { toast.error('승인 실패') } finally { setActingId(null) }
  }

  const reject = async (id: number) => {
    const reason = prompt('거절 사유 (선택)')
    setActingId(id)
    try {
      await api.put(`/api/admin/tools/sellers/${id}/reject`, { reason }, h)
      toast.info('거절됨'); load()
    } catch { toast.error('거절 실패') } finally { setActingId(null) }
  }

  const toggleSuspend = async (s: Seller) => {
    const isActivating = s.status === 'suspended'
    const action = isActivating ? '재활성' : '정지'
    if (!confirm(`${s.name || s.email} 셀러를 ${action} 처리할까요?`)) return
    setActingId(s.id)
    try {
      if (isActivating) {
        // 재활성: PATCH /sellers/:id/approve (status='approved'로 변경)
        await api.patch(`/api/admin/sellers/${s.id}/approve`, {}, h)
      } else {
        // 정지: DELETE /sellers/:id (status='suspended')
        await api.delete(`/api/admin/sellers/${s.id}`, h)
      }
      toast.success(`${action} 완료`); load()
    } catch { toast.error(`${action} 실패`) } finally { setActingId(null) }
  }

  const onFilterChange = (key: typeof STATUS_OPTIONS[number]['key']) => {
    setFilter(key)
    const next = new URLSearchParams(searchParams)
    if (key === 'pending') next.delete('status')
    else next.set('status', key)
    setSearchParams(next, { replace: true })
  }

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: sellers.length }
    for (const s of sellers) c[s.status] = (c[s.status] || 0) + 1
    return c
  }, [sellers])

  return (
    <AdminLayout title="셀러 관리">
      <div className="mx-auto max-w-5xl space-y-4 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="셀러 관리"
          subtitle="가입 승인/거절 + 활성 셀러 정지/재활성 + 검색"
          icon={<UserCheck className="h-5 w-5" />}
        />

        {/* 검색 */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="이름 / 이메일 / 사업자번호 / 전화번호 검색"
              className="w-full pl-9 pr-9 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200"
            />
            {search && (
              <button onClick={() => setSearch('')} aria-label="검색어 지우기"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">×</button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => onFilterChange(opt.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  filter === opt.key
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                }`}
              >
                {opt.label}
                <span className="ml-1.5 text-[10px] opacity-70">{counts[opt.key] ?? 0}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 목록 */}
        {loading ? <DashboardLoading /> : filtered.length === 0 ? (
          <DashboardEmptyState
            icon={<UserCheck className="h-7 w-7" />}
            title={search ? `'${search}' 검색 결과 없음` : `${STATUS_LABEL[filter] || '해당'} 셀러 없음`}
          />
        ) : (
          <div className="space-y-2">
            {filtered.map(s => (
              <div key={s.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <p className="text-sm font-bold text-gray-900 truncate">
                      {s.name || s.email} {s.business_name && <span className="text-gray-500 font-normal">({s.business_name})</span>}
                    </p>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${STATUS_BADGE[s.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABEL[s.status] || s.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{s.email} · {s.phone || '-'} · 사업자 {s.business_number || '-'}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">가입일: {new Date(s.created_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  {s.status === 'pending' && (
                    <>
                      <button onClick={() => approve(s.id)} disabled={actingId === s.id}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-md text-[11px] font-bold flex items-center gap-1 disabled:opacity-50">
                        {actingId === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserCheck className="w-3 h-3" />} 승인
                      </button>
                      <button onClick={() => reject(s.id)} disabled={actingId === s.id}
                        className="px-3 py-1.5 bg-red-100 text-red-600 rounded-md text-[11px] font-bold flex items-center gap-1 disabled:opacity-50">
                        <UserX className="w-3 h-3" /> 거절
                      </button>
                    </>
                  )}
                  {(s.status === 'active' || s.status === 'suspended') && (
                    <button onClick={() => toggleSuspend(s)} disabled={actingId === s.id}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 disabled:opacity-50 ${
                        s.status === 'suspended'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                      {s.status === 'suspended' ? <><Play className="w-3 h-3" /> 재활성</> : <><Pause className="w-3 h-3" /> 정지</>}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

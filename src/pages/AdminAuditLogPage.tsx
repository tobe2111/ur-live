import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { Shield, ChevronDown, ChevronUp, Filter, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

interface AuditLog {
  id: number
  admin_id: number
  admin_email: string
  action: string
  target_type: string
  target_id: string | number
  ip_address: string
  before_value: Record<string, unknown> | string | null
  after_value: Record<string, unknown> | string | null
  created_at: string
}

interface AdminOption {
  id: number
  email: string
}

const LIMIT = 50

export default function AdminAuditLogPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  // Filters
  const [adminId, setAdminId] = useState('')
  const [action, setAction] = useState('')
  const [targetType, setTargetType] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Admin options for dropdown
  const [adminOptions, setAdminOptions] = useState<AdminOption[]>([])

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) { navigate('/admin/login'); return }
    loadAdminOptions()
  }, [navigate])

  useEffect(() => {
    loadLogs()
  }, [page])

  async function loadAdminOptions() {
    try {
      const res = await api.get('/api/admin/admins')
      if (res.data.success) {
        setAdminOptions(res.data.data.map((a: { id: number; email: string }) => ({ id: a.id, email: a.email })))
      }
    } catch {
      // ignore - dropdown will just be empty
    }
  }

  async function loadLogs() {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
      if (adminId) params.append('admin_id', adminId)
      if (action) params.append('action', action)
      if (targetType) params.append('target_type', targetType)
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      const res = await api.get(`/api/admin/audit-logs?${params}`)
      if (res.data.success) {
        setLogs(res.data.data || [])
        setTotalPages(res.data.pagination?.totalPages || 1)
      }
    } catch (err: any) {
      if (err.response?.status === 401) {
        localStorage.removeItem('admin_token')
        navigate('/admin/login')
      } else {
        toast.error('감사 로그를 불러오지 못했습니다')
      }
    } finally {
      setLoading(false)
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    loadLogs()
  }

  function resetFilters() {
    setAdminId('')
    setAction('')
    setTargetType('')
    setStartDate('')
    setEndDate('')
    setPage(1)
    setTimeout(loadLogs, 0)
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return '-'
    const d = new Date(dateStr)
    return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  }

  function formatJSON(val: any) {
    if (!val) return '-'
    try {
      const parsed = typeof val === 'string' ? JSON.parse(val) : val
      return JSON.stringify(parsed, null, 2)
    } catch {
      return String(val)
    }
  }

  return (
    <AdminLayout title="감사 로그">
      {/* Filter Section */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
        >
          <Filter className="w-4 h-4" />
          필터
          {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showFilters && (
          <form onSubmit={handleSearch} className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">관리자</label>
              <select
                value={adminId}
                onChange={e => setAdminId(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white"
              >
                <option value="">전체</option>
                {adminOptions.map(a => (
                  <option key={a.id} value={a.id}>{a.email}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">액션 유형</label>
              <input
                type="text"
                value={action}
                onChange={e => setAction(e.target.value)}
                placeholder="예: CREATE, UPDATE, DELETE"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">대상 유형</label>
              <input
                type="text"
                value={targetType}
                onChange={e => setTargetType(e.target.value)}
                placeholder="예: product, order, user"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900"
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-5 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
              >
                검색
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200"
              >
                초기화
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Shield className="w-12 h-12 mb-3" />
            <p className="text-sm">감사 로그가 없습니다</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-500">시간</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">관리자</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">액션</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">대상</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500">IP</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map(log => (
                  <>
                    <tr
                      key={log.id}
                      className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer"
                      onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                    >
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{formatDate(log.created_at)}</td>
                      <td className="px-4 py-3 text-gray-700">{log.admin_email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          log.action?.toUpperCase().includes('DELETE') ? 'bg-red-50 text-red-700' :
                          log.action?.toUpperCase().includes('CREATE') ? 'bg-emerald-50 text-emerald-700' :
                          log.action?.toUpperCase().includes('UPDATE') ? 'bg-blue-50 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">
                        {log.target_type}{log.target_id ? ` #${log.target_id}` : ''}
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{log.ip_address || '-'}</td>
                      <td className="px-4 py-3">
                        {expandedId === log.id
                          ? <ChevronUp className="w-4 h-4 text-gray-400" />
                          : <ChevronDown className="w-4 h-4 text-gray-400" />
                        }
                      </td>
                    </tr>
                    {expandedId === log.id && (
                      <tr key={`${log.id}-detail`} className="bg-gray-50">
                        <td colSpan={6} className="px-4 py-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">변경 전 (before_value)</p>
                              <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto max-h-60">
                                {formatJSON(log.before_value)}
                              </pre>
                            </div>
                            <div>
                              <p className="text-xs font-medium text-gray-500 mb-1">변경 후 (after_value)</p>
                              <pre className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 overflow-x-auto max-h-60">
                                {formatJSON(log.after_value)}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-500">{page} / {totalPages} 페이지</p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4 text-gray-600" />
              </button>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

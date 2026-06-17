import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { History, RefreshCw, MapPin, Monitor } from 'lucide-react'

// 🆕 2026-06-17 (대표 요청 — 계정 보안): 관리자 로그인 이력(IP).
//   백엔드 GET /api/admin/login-history (슈퍼 전용). 누가 언제 어느 IP/기기에서 로그인했는지 — 비정상 접근 탐지.

interface Row {
  id: number
  admin_id: string
  email: string | null
  admin_name: string
  admin_role: string | null
  ip: string | null
  user_agent: string | null
  success: number
  created_at: string
}

const ROLE_LABEL: Record<string, string> = {
  super_admin: '슈퍼', admin: '관리자', ops: '운영', cs: 'CS', finance: '정산', viewer: '읽기', wholesale: '도매 파트너',
}

function fmtTime(s: string): string {
  try { const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z'); return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return s }
}
function device(ua: string | null): string {
  if (!ua) return '-'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '기타'
  const br = /Edg/.test(ua) ? 'Edge' : /Chrome/.test(ua) ? 'Chrome' : /Safari/.test(ua) ? 'Safari' : /Firefox/.test(ua) ? 'Firefox' : ''
  return br ? `${os} · ${br}` : os
}

export default function AdminLoginHistoryPage() {
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [rows, setRows] = useState<Row[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback((p: number) => {
    setLoading(true)
    api.get(`/api/admin/login-history?page=${p}&limit=50`, h)
      .then(r => {
        if (r.data?.success) {
          setRows(prev => p === 1 ? r.data.data : [...prev, ...r.data.data])
          setTotal(r.data.pagination?.total ?? 0)
          setPage(p)
        }
      })
      .catch(() => { /* noop */ })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load(1) }, [load])

  const card = 'bg-white rounded-2xl border border-gray-200'

  return (
    <AdminLayout title="관리자 로그인 이력">
      <div className="ur-content-wide px-4 lg:px-6 py-5 space-y-4">
        <DashboardPageHeader title="관리자 로그인 이력" subtitle="누가 언제 어느 IP·기기에서 로그인했는지 — 계정 도용·비정상 접근 탐지." />

        <div className={card + ' p-4 flex items-center justify-between'}>
          <p className="text-sm text-gray-600">총 <b className="text-gray-900">{total.toLocaleString()}</b>건의 로그인 기록</p>
          <button onClick={() => load(1)} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
          </button>
        </div>

        <div className={card + ' overflow-hidden'}>
          {rows.length === 0 && !loading ? (
            <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center gap-2"><History className="w-8 h-8" />아직 로그인 기록이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-[12px]">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">시각</th>
                    <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">계정</th>
                    <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">IP</th>
                    <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap hidden sm:table-cell">기기</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                      <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap tabular-nums">{fmtTime(r.created_at)}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className="font-semibold text-gray-900">{r.admin_name}</span>
                        {r.admin_role && <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold ${r.admin_role === 'wholesale' ? 'bg-orange-100 text-orange-700' : r.admin_role === 'super_admin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{ROLE_LABEL[r.admin_role] || r.admin_role}</span>}
                        {r.email && <span className="block text-[11px] text-gray-400">{r.email}</span>}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-700 font-mono text-[12px]"><MapPin className="w-3.5 h-3.5 inline text-gray-400 mr-1" />{r.ip || '-'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-gray-500 text-[12px] hidden sm:table-cell"><Monitor className="w-3.5 h-3.5 inline text-gray-400 mr-1" />{device(r.user_agent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length < total && (
            <div className="p-3 border-t border-gray-100 text-center">
              <button onClick={() => load(page + 1)} disabled={loading} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50">
                {loading ? '불러오는 중…' : `더 보기 (${rows.length}/${total})`}
              </button>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  )
}

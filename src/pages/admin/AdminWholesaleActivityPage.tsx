import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { History, RefreshCw, User } from 'lucide-react'

// 🕵️ 2026-06-17 (대표 요청 "누가 처리했는지"): 도매 처리 이력.
//   백엔드 GET /api/admin/distributor/activity-log — admin_audit_logs(자동기록) 도매 액션 + 처리자 이름.
//   도매 파트너(wholesale 역할)도 접근 가능 → 동업자 간 책임 추적.

interface LogRow {
  id: number
  admin_id: string
  admin_email: string | null
  admin_name: string
  admin_role: string | null
  action: string
  ip: string | null
  created_at: string
}

const SEG_LABELS: Record<string, string> = {
  'wholesale-deposits': '예치금', 'wholesale-withdrawals': '제조사 출금', 'wholesale-orders': '도매 주문',
  'wholesale-products': '프리미엄관', 'wholesale-malls': '도매 몰', 'wholesale-banners': '도매 배너',
  'wholesale-board': '도매 게시판', 'wholesale-proposals': '제안/신고', 'wholesale-claims': '클레임',
  'wholesale-quotes': '견적', 'wholesale-tax': '세무/정산', 'wholesale-integrity': '무결성',
  'wholesale-import': '상품 일괄등록', 'wholesale': '도매 세무·무결성', 'distributor': '유통사·등급',
  'suppliers': '제조사', 'supplier': '제조사', 'partnership-inquiries': '제휴 문의', 'partnership': '제휴',
}
const TAIL_LABELS: Record<string, string> = {
  confirm: '입금확인', approve: '승인', reject: '반려', ship: '발송', cancel: '취소', resolve: '처리완료',
  grades: '등급변경', settings: '설정변경', run: '실행', 'supply-bulk-import': '일괄등록',
  'supply-stats': '현황조회', issue: '발행', pay: '지급', complete: '완료', hold: '보류',
}
const METHOD_VERB: Record<string, string> = { POST: '처리', PATCH: '수정', PUT: '수정', DELETE: '삭제' }

/** "POST /api/admin/wholesale-deposits/5/confirm" → { domain:'예치금 #5', verb:'입금확인', method } */
function humanize(action: string): { domain: string; verb: string; method: string } {
  const m = action.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/\S+)/i)
  if (!m) return { domain: action, verb: '', method: '' }
  const method = m[1].toUpperCase()
  const path = m[2]
  const seg = (path.match(/\/api\/admin[/-]([a-z0-9-]+)/i)?.[1] || '').toLowerCase()
  const id = path.match(/\/(\d+)(?:\/|$)/)?.[1] || ''
  const tail = (path.split('?')[0].split('/').filter(Boolean).pop() || '').toLowerCase()
  const domain = (SEG_LABELS[seg] || seg || '도매') + (id ? ` #${id}` : '')
  const verb = TAIL_LABELS[tail] || (method === 'DELETE' ? '삭제' : METHOD_VERB[method] || method)
  return { domain, verb, method }
}

function fmtTime(s: string): string {
  try { const d = new Date(s.includes('T') ? s : s.replace(' ', 'T') + 'Z'); return d.toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) } catch { return s }
}

export default function AdminWholesaleActivityPage() {
  const h = { headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` } }
  const [rows, setRows] = useState<LogRow[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  const load = useCallback((p: number) => {
    setLoading(true)
    api.get(`/api/admin/distributor/activity-log?page=${p}&limit=50`, h)
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
    <AdminLayout title="도매 처리 이력">
      <div className="ur-content-wide px-4 lg:px-6 py-5 space-y-4">
        <DashboardPageHeader title="도매 처리 이력" subtitle="누가 무엇을 언제 처리했는지 — 도매 어드민의 모든 변경 작업 기록(자동)." />

        <div className={card + ' p-4 flex items-center justify-between'}>
          <p className="text-sm text-gray-600">총 <b className="text-gray-900">{total.toLocaleString()}</b>건의 도매 처리 기록</p>
          <button onClick={() => load(1)} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> 새로고침
          </button>
        </div>

        <div className={card + ' overflow-hidden'}>
          {rows.length === 0 && !loading ? (
            <div className="py-16 text-center text-gray-400 text-sm flex flex-col items-center gap-2"><History className="w-8 h-8" />아직 처리 기록이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-[12px]">
                  <tr>
                    <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">시각</th>
                    <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">처리자</th>
                    <th className="text-left px-4 py-2.5 font-semibold">작업</th>
                    <th className="text-left px-4 py-2.5 font-semibold whitespace-nowrap hidden sm:table-cell">IP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const a = humanize(r.action)
                    const isPartner = r.admin_role === 'wholesale'
                    return (
                      <tr key={r.id} className="border-t border-gray-100 hover:bg-gray-50/60">
                        <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap tabular-nums">{fmtTime(r.created_at)}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-gray-400" />
                            <span className="font-semibold text-gray-900">{r.admin_name}</span>
                            {isPartner && <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-orange-100 text-orange-700">도매 파트너</span>}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-700">
                          <span className="font-medium text-gray-900">{a.domain}</span>
                          {a.verb && <span className="ml-1.5 text-gray-500">· {a.verb}</span>}
                          {a.method === 'DELETE' && <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-50 text-red-600">삭제</span>}
                        </td>
                        <td className="px-4 py-2.5 text-gray-400 text-[12px] whitespace-nowrap hidden sm:table-cell">{r.ip || '-'}</td>
                      </tr>
                    )
                  })}
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

/**
 * 🛡️ 2026-05-15: 어드민 분쟁 큐 — AI 가 escalation 한 케이스 처리.
 *
 * 탭:
 *   - escalated (검토 필요)
 *   - auto_refunded (AI 가 자동 처리)
 *   - resolved / rejected
 *
 * 액션:
 *   - 환불 승인 → voucher refunded + 딜 환불
 *   - 거절 → 그대로 유지 + 거절 사유 기록
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { AlertCircle, CheckCircle2, XCircle, Loader2, Clock, Bot, ChevronDown, ChevronRight } from 'lucide-react'
import { formatKST } from '@/utils/date'

interface Dispute {
  id: number
  voucher_code: string
  user_id: string
  reason_text: string
  evidence_url: string | null
  ai_category: string
  ai_confidence: number
  ai_reasoning: string
  action: 'pending' | 'auto_refunded' | 'escalated' | 'resolved' | 'rejected'
  admin_notes: string | null
  admin_user_id: string | null
  resolved_at: string | null
  created_at: string
}

type Tab = 'escalated' | 'auto_refunded' | 'resolved' | 'rejected' | 'all'

const ACTION_COLOR: Record<string, string> = {
  escalated: 'bg-amber-100 text-amber-700',
  auto_refunded: 'bg-green-100 text-green-700',
  resolved: 'bg-blue-100 text-blue-700',
  rejected: 'bg-gray-200 text-gray-600',
  pending: 'bg-gray-100 text-gray-600',
}

const CATEGORY_LABEL: Record<string, string> = {
  voucher_refused: '🚫 사장님 거부',
  merchant_closed: '🏚️ 매장 폐업/휴업',
  quality_issue: '😞 품질 불만',
  already_used: '⚠️ 이미 사용 표시',
  other: '🤷 기타',
}

export default function AdminDisputesPage() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Dispute[]>([])
  const [tab, setTab] = useState<Tab>('escalated')
  const [loading, setLoading] = useState(true)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [submitting, setSubmitting] = useState<number | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) { navigate('/admin/login'); return }
    loadList(tab)
  }, [tab])

  async function loadList(status: Tab) {
    setLoading(true)
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` }
      const res = await api.get(`/api/disputes/admin/list?status=${status}`, { headers })
      if (res.data?.success) setItems(res.data.data || [])
    } catch (err) {
      if (import.meta.env.DEV) console.error('[admin disputes]', err)
    } finally {
      setLoading(false)
    }
  }

  async function approveRefund(d: Dispute) {
    if (!confirm(`voucher ${d.voucher_code} 환불 승인하시겠습니까?\n\n• voucher → refunded\n• 딜 결제건 자동 환불\n• 유저에게 푸시`)) return
    const notes = window.prompt('어드민 메모 (선택, 500자 내):', '') || ''
    setSubmitting(d.id)
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` }
      const res = await api.post(`/api/disputes/admin/${d.id}/approve`, { admin_notes: notes }, { headers })
      if (res.data?.success) {
        alert('✅ 환불 처리 완료')
        loadList(tab)
      } else {
        alert(`❌ ${res.data?.error || '환불 실패'}`)
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      alert(`❌ ${e?.response?.data?.error || '환불 처리 실패'}`)
    } finally {
      setSubmitting(null)
    }
  }

  async function rejectDispute(d: Dispute) {
    const notes = window.prompt('거절 사유 (5자+ 필수, 유저에게 푸시 통보됨):', '')
    if (!notes || notes.trim().length < 5) return
    setSubmitting(d.id)
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem('admin_token') || ''}` }
      const res = await api.post(`/api/disputes/admin/${d.id}/reject`, { admin_notes: notes.trim() }, { headers })
      if (res.data?.success) {
        alert('✅ 거절 처리 완료')
        loadList(tab)
      } else {
        alert(`❌ ${res.data?.error || '거절 실패'}`)
      }
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      alert(`❌ ${e?.response?.data?.error || '거절 처리 실패'}`)
    } finally {
      setSubmitting(null)
    }
  }

  return (
    <AdminLayout title="분쟁 큐">
      <div className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="분쟁 큐 (AI 자동 분류)"
          subtitle="escalated 케이스 = 어드민 검토 필요 / auto_refunded = AI 자동 처리"
          icon={<AlertCircle className="h-5 w-5" />}
        />

        {/* 탭 */}
        <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
          {(['escalated', 'auto_refunded', 'resolved', 'rejected', 'all'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-bold border-b-2 whitespace-nowrap transition-colors ${tab === t ? 'border-pink-500 text-pink-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'escalated' && <><Clock className="w-3.5 h-3.5 inline mr-1" /> 검토 필요</>}
              {t === 'auto_refunded' && <><Bot className="w-3.5 h-3.5 inline mr-1" /> AI 자동</>}
              {t === 'resolved' && <><CheckCircle2 className="w-3.5 h-3.5 inline mr-1" /> 해결</>}
              {t === 'rejected' && <><XCircle className="w-3.5 h-3.5 inline mr-1" /> 거절</>}
              {t === 'all' && '전체'}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="py-20 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
        ) : items.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-700 font-bold">분쟁 없음</p>
            <p className="text-xs text-gray-500 mt-1">현재 {tab} 상태 케이스 없음</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map(d => {
              const expanded = expandedId === d.id
              return (
                <div key={d.id} className="bg-white rounded-xl border border-gray-200">
                  <button
                    onClick={() => setExpandedId(expanded ? null : d.id)}
                    className="w-full p-4 text-left flex items-center gap-3"
                  >
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ACTION_COLOR[d.action] || 'bg-gray-100 text-gray-600'}`}>
                      {d.action}
                    </span>
                    <span className="text-xs text-gray-500">{CATEGORY_LABEL[d.ai_category] || d.ai_category}</span>
                    <span className="text-[10px] text-gray-400">conf {Math.round((d.ai_confidence || 0) * 100)}%</span>
                    <span className="font-mono text-xs text-gray-700 ml-auto">{d.voucher_code}</span>
                    <span className="text-[10px] text-gray-400 hidden sm:inline">{formatKST(d.created_at)}</span>
                    {expanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  </button>

                  {expanded && (
                    <div className="border-t border-gray-100 p-4 space-y-3">
                      <div>
                        <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">유저 사유</p>
                        <p className="text-sm text-gray-900 whitespace-pre-line">{d.reason_text}</p>
                      </div>
                      {d.evidence_url && (
                        <div>
                          <p className="text-[11px] font-bold text-gray-500 uppercase mb-1">증거</p>
                          <a href={d.evidence_url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline break-all">{d.evidence_url}</a>
                        </div>
                      )}
                      {d.ai_reasoning && (
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <p className="text-[11px] font-bold text-purple-700 uppercase mb-1">🤖 AI 분석</p>
                          <p className="text-sm text-purple-900">{d.ai_reasoning}</p>
                        </div>
                      )}
                      {d.action === 'escalated' && (
                        <div className="flex gap-2 pt-2">
                          <button
                            onClick={() => approveRefund(d)}
                            disabled={submitting === d.id}
                            className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
                          >
                            ✅ 환불 승인
                          </button>
                          <button
                            onClick={() => rejectDispute(d)}
                            disabled={submitting === d.id}
                            className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-800 disabled:opacity-50 text-white rounded-lg text-xs font-bold"
                          >
                            🗙 거절
                          </button>
                        </div>
                      )}
                      {d.admin_notes && (
                        <div className="text-[10px] text-gray-400">관리자 메모: {d.admin_notes}</div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}

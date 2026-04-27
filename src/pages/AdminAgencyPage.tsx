import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Plus, Pencil, Trash2, UserPlus, UserMinus, ChevronDown, ChevronUp, CheckCircle, XCircle, KeyRound, Users } from 'lucide-react'
import { tierLabel, tierBadgeClass } from '@/shared/utils/agency-tier'

interface Agency {
  id: number
  name: string
  contact_name: string
  email: string
  phone: string | null
  status: string
  seller_count: number
  linked_user_id?: number | null
  created_at: string
  // Q1 등급제 (migration 0212)
  tier?: 'new' | 'junior' | 'senior'
  tier_locked?: number
  tier_evaluated_at?: string | null
  commission_rate?: number
  auto_settle?: number
}

interface Seller {
  id: number
  name: string
  business_name: string
  email: string
}

type ModalMode = 'create' | 'edit' | null

const initForm = { name: '', contact_name: '', email: '', password: '', phone: '', status: 'active' }

export default function AdminAgencyPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [agencies, setAgencies] = useState<Agency[]>([])
  const [unassigned, setUnassigned] = useState<Seller[]>([])
  const [agencySellers, setAgencySellers] = useState<Record<number, Seller[]>>({})
  const [expanded, setExpanded] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<ModalMode>(null)
  const [editTarget, setEditTarget] = useState<Agency | null>(null)
  const [form, setForm] = useState(initForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const token = localStorage.getItem('admin_token')
  const headers = { Authorization: `Bearer ${token}` }

  useEffect(() => {
    if (!localStorage.getItem('admin_token')) {
      navigate('/admin/login', { replace: true })
    }
  }, [navigate])

  async function fetchAgencies() {
    const r = await api.get('/api/admin/agencies', { headers })
    setAgencies(r.data.data || [])
  }

  async function fetchUnassigned() {
    const r = await api.get('/api/admin/agencies/unassigned-sellers', { headers })
    setUnassigned(r.data.data || [])
  }

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAgencies(), fetchUnassigned()])
      .finally(() => setLoading(false))
  }, [])

  async function toggleExpand(agencyId: number) {
    if (expanded === agencyId) { setExpanded(null); return }
    setExpanded(agencyId)
    if (!agencySellers[agencyId]) {
      const r = await api.get(`/api/admin/agencies/${agencyId}/sellers`, { headers })
      setAgencySellers(prev => ({ ...prev, [agencyId]: r.data.data || [] }))
    }
  }

  async function refreshAgencySellers(agencyId: number) {
    const r = await api.get(`/api/admin/agencies/${agencyId}/sellers`, { headers })
    setAgencySellers(prev => ({ ...prev, [agencyId]: r.data.data || [] }))
    fetchAgencies()
    fetchUnassigned()
  }

  function openCreate() {
    setForm(initForm)
    setEditTarget(null)
    setError('')
    setModal('create')
  }

  function openEdit(a: Agency) {
    setForm({ name: a.name, contact_name: a.contact_name, email: a.email, password: '', phone: a.phone || '', status: a.status })
    setEditTarget(a)
    setError('')
    setModal('edit')
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      if (modal === 'create') {
        await api.post('/api/admin/agencies', form, { headers })
      } else if (editTarget) {
        const payload: Record<string, string> = {
          name: form.name, contact_name: form.contact_name, phone: form.phone, status: form.status
        }
        if (form.password) payload.password = form.password
        await api.patch(`/api/admin/agencies/${editTarget.id}`, payload, { headers })
      }
      setModal(null)
      fetchAgencies()
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      setError(err_.response?.data?.error || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  async function handleApprove(a: Agency) {
    try {
      await api.patch(`/api/admin/agencies/${a.id}`, { status: 'active' }, { headers })
      fetchAgencies()
    } catch {
      toast.error('승인 처리에 실패했습니다.')
    }
  }

  async function handleReject(a: Agency) {
    if (!confirm(`"${a.name}" 에이전시 가입을 거절하시겠습니까?`)) return
    try {
      await api.patch(`/api/admin/agencies/${a.id}`, { status: 'rejected' }, { headers })
      fetchAgencies()
    } catch {
      toast.error('거절 처리에 실패했습니다.')
    }
  }

  async function handleToggleStatus(a: Agency) {
    const newStatus = a.status === 'active' ? 'inactive' : 'active'
    try {
      await api.patch(`/api/admin/agencies/${a.id}`, { status: newStatus }, { headers })
      fetchAgencies()
    } catch {
      toast.error('상태 변경에 실패했습니다.')
    }
  }

  async function handleResetPassword(a: Agency) {
    const newPwd = prompt(`"${a.name}" 에이전시의 새 비밀번호 (8자 이상):`, '')
    if (newPwd === null) return
    if (!newPwd || newPwd.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다.')
      return
    }
    try {
      const r = await api.post(`/api/admin/agencies/${a.id}/reset-password`, { newPassword: newPwd }, { headers })
      toast.success(r.data?.message || '비밀번호가 재설정되었습니다.')
      fetchAgencies()
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string } } }
      toast.error(err_.response?.data?.error || '비밀번호 재설정에 실패했습니다.')
    }
  }

  async function handleDelete(a: Agency) {
    if (!confirm(`"${a.name}" 에이전시를 삭제하시겠습니까? 소속 셀러 배정도 모두 해제됩니다.`)) return
    try {
      await api.delete(`/api/admin/agencies/${a.id}`, { headers })
      fetchAgencies()
      fetchUnassigned()
    } catch {
      toast.error('삭제에 실패했습니다.')
    }
  }

  async function assignSeller(agencyId: number, sellerId: number) {
    try {
      await api.post(`/api/admin/agencies/${agencyId}/sellers`, { seller_id: sellerId }, { headers })
      refreshAgencySellers(agencyId)
    } catch {
      toast.error('셀러 배정에 실패했습니다.')
    }
  }

  async function removeSeller(agencyId: number, sellerId: number) {
    try {
      await api.delete(`/api/admin/agencies/${agencyId}/sellers/${sellerId}`, { headers })
      refreshAgencySellers(agencyId)
    } catch {
      toast.error('셀러 해제에 실패했습니다.')
    }
  }

  return (
    <AdminLayout title={t('admin.pages.agency')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('admin.pages.agency')}
          subtitle={`총 ${agencies.length}개 에이전시`}
          icon={<Users className="h-5 w-5" />}
          actions={
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              <Plus className="h-3.5 w-3.5" />
              에이전시 추가
            </button>
          }
        />
      <div className="hidden flex items-center justify-between">
        <p className="text-sm text-gray-500">총 {agencies.length}개 에이전시</p>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          에이전시 추가
        </button>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
          불러오는 중...
        </div>
      ) : (
        <>
        {/* 승인 대기 섹션 */}
        {agencies.filter(a => a.status === 'pending').length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">승인 대기</span>
              <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                {agencies.filter(a => a.status === 'pending').length}
              </span>
            </div>
            <div className="space-y-2">
              {agencies.filter(a => a.status === 'pending').map(a => (
                <div key={a.id} className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">대기중</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{a.contact_name} · {a.email} {a.phone && `· ${a.phone}`}</p>
                    <p className="text-xs text-gray-400 mt-0.5">신청일: {new Date(a.created_at).toLocaleDateString('ko-KR')}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                    <button
                      onClick={() => handleApprove(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> 승인
                    </button>
                    <button
                      onClick={() => handleReject(a)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-red-300 text-red-500 hover:bg-red-50 text-xs font-semibold rounded-lg transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> 거절
                    </button>
                    <button onClick={() => handleDelete(a)} className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 전체 에이전시 목록 */}
        {agencies.filter(a => a.status !== 'pending').length === 0 && agencies.filter(a => a.status === 'pending').length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <p className="text-gray-500 text-sm mb-1">등록된 에이전시가 없습니다.</p>
            <p className="text-gray-400 text-xs">에이전시 추가 버튼으로 생성하세요.</p>
          </div>
        ) : (
        <div className="space-y-3">
          {agencies.filter(a => a.status !== 'pending').map(a => (
            <div key={a.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              {/* Agency row */}
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-indigo-600 font-bold text-sm">{a.name.charAt(0)}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-900">{a.name}</p>
                      {a.linked_user_id && (
                        <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded font-bold" title="카카오 계정 연동됨">
                          💬 카카오
                        </span>
                      )}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'active'   ? 'bg-green-100 text-green-700' :
                        a.status === 'rejected' ? 'bg-red-100 text-red-600' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {a.status === 'active' ? '승인' : a.status === 'rejected' ? '거절' : '비활성'}
                      </span>
                      {/* 🛡️ 2026-04-26 Q1: 등급 표시 + tier_locked 표시 */}
                      {a.tier && (
                        <span
                          title={a.tier_locked ? '어드민 수동 고정 (자동 평가 무시)' : `자동 평가: ${a.tier_evaluated_at || '없음'}`}
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border ${tierBadgeClass(a.tier)}`}
                        >
                          {a.tier_locked ? '🔒' : ''}{tierLabel(a.tier)}
                        </span>
                      )}
                      {a.auto_settle === 1 && (
                        <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded font-medium" title="자동 정산 활성화">
                          🤖 자동정산
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{a.contact_name} · {a.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                  <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                    셀러 {a.seller_count}명
                  </span>
                  {/* 🛡️ 2026-04-26 Q1: 등급 수동 변경 토글 */}
                  <select
                    value={a.tier || 'new'}
                    onChange={async (e) => {
                      const newTier = e.target.value as 'new' | 'junior' | 'senior'
                      if (a.tier === newTier) return
                      try {
                        await api.patch(`/api/admin/agencies/${a.id}`, { tier: newTier, tier_locked: true }, { headers })
                        toast.success(`${a.name} → ${tierLabel(newTier)} (수동 고정)`)
                        fetchAgencies()
                      } catch (err: any) {
                        toast.error(err?.response?.data?.error || '등급 변경 실패')
                      }
                    }}
                    title="등급 수동 변경 (자동 평가 비활성화됨)"
                    className="text-xs bg-white border border-gray-200 rounded-lg px-2 py-1 cursor-pointer hover:border-gray-300"
                  >
                    <option value="new">브론즈</option>
                    <option value="junior">실버</option>
                    <option value="senior">골드</option>
                  </select>
                  {a.tier_locked === 1 && (
                    <button
                      onClick={async () => {
                        if (!confirm('자동 평가를 다시 활성화하시겠습니까? 다음 cron 실행 시 등급이 자동 재산정됩니다.')) return
                        await api.patch(`/api/admin/agencies/${a.id}`, { tier_locked: false }, { headers })
                        toast.info('자동 평가 활성화')
                        fetchAgencies()
                      }}
                      title="자동 평가 다시 켜기"
                      className="text-[10px] text-blue-600 hover:text-blue-800 underline"
                    >
                      자동평가 ↻
                    </button>
                  )}
                  {/* 승인/거절 토글 */}
                  <button
                    onClick={() => handleToggleStatus(a)}
                    title={a.status === 'active' ? '비활성(거절)으로 변경' : '활성(승인)으로 변경'}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      a.status === 'active'
                        ? 'bg-green-50 text-green-600 hover:bg-red-50 hover:text-red-500'
                        : 'bg-gray-100 text-gray-500 hover:bg-green-50 hover:text-green-600'
                    }`}
                  >
                    {a.status === 'active'
                      ? <><CheckCircle className="w-3.5 h-3.5" /> 승인됨</>
                      : <><XCircle className="w-3.5 h-3.5" /> 거절됨</>
                    }
                  </button>
                  {a.status === 'active' && (
                    <button
                      onClick={() => handleResetPassword(a)}
                      title="비밀번호 재설정"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      비밀번호 재설정
                    </button>
                  )}
                  <button
                    onClick={() => openEdit(a)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(a)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleExpand(a.id)}
                    className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
                  >
                    {expanded === a.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Expanded: seller management */}
              {expanded === a.id && (
                <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Assigned sellers */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">소속 셀러</p>
                      {(agencySellers[a.id] || []).length === 0 ? (
                        <p className="text-xs text-gray-400">소속 셀러가 없습니다.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {agencySellers[a.id].map(s => (
                            <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">{s.business_name || s.name}</p>
                                <p className="text-xs text-gray-400">{s.email}</p>
                              </div>
                              <button
                                onClick={() => removeSeller(a.id, s.id)}
                                className="ml-2 p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors flex-shrink-0"
                                title="소속 해제"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unassigned sellers */}
                    <div>
                      <p className="text-xs font-semibold text-gray-600 mb-2">배정 가능한 셀러</p>
                      {unassigned.length === 0 ? (
                        <p className="text-xs text-gray-400">배정 가능한 셀러가 없습니다.</p>
                      ) : (
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {unassigned.map(s => (
                            <div key={s.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100">
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-gray-900 truncate">{s.business_name || s.name}</p>
                                <p className="text-xs text-gray-400">{s.email}</p>
                              </div>
                              <button
                                onClick={() => assignSeller(a.id, s.id)}
                                className="ml-2 p-1 text-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors flex-shrink-0"
                                title="소속 추가"
                              >
                                <UserPlus className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-5">
              {modal === 'create' ? '에이전시 추가' : '에이전시 수정'}
            </h2>

            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">{error}</div>
            )}

            <div className="space-y-4">
              {[
                { key: 'name', label: '에이전시명', placeholder: '(주)베스트에이전시', required: true },
                { key: 'contact_name', label: '담당자명', placeholder: '홍길동', required: true },
                { key: 'email', label: '이메일', placeholder: 'agency@example.com', required: true },
                { key: 'password', label: modal === 'create' ? '비밀번호' : '비밀번호 (변경 시만 입력)', placeholder: '8자 이상', required: modal === 'create' },
                { key: 'phone', label: '전화번호', placeholder: '010-1234-5678', required: false },
              ].map(({ key, label, placeholder, required }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    {label}{required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <input
                    type={key === 'password' ? 'password' : key === 'email' ? 'email' : 'text'}
                    value={form[key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}

              {modal === 'edit' && (
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">상태</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setModal(null)}
                className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {saving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  )
}
